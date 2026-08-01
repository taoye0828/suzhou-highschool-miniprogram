const assert = require('assert')
const fs = require('fs')
const path = require('path')
const {
  installWxStorage,
  loadStorageFresh,
  makeExam,
  clone
} = require('./rc9_test_helpers')
const stability = require('../utils/rc11-stability')

class FixedClock {
  constructor(iso = '2026-07-31T14:00:00.000Z') { this.iso = iso }
  nowIso() { return this.iso }
}

class FixedIdGenerator {
  constructor(prefix = 'restore-fixed') { this.prefix = prefix; this.sequence = 0 }
  next() { this.sequence += 1; return `${this.prefix}-${String(this.sequence).padStart(3, '0')}` }
}

class FakeFaultInjector {
  constructor(operationType, failAtStage) {
    this.operationType = operationType
    this.failAtStage = failAtStage
    this.errorCode = 'TEST_INJECTED_FAILURE'
  }
}

function setup() {
  const memoryStorage = installWxStorage()
  const storage = loadStorageFresh()
  assert.strictEqual(storage.ensureStorageMigrated().ok, true)
  return { storage, memoryStorage }
}

function addScore(storage, id, score) {
  const result = storage.saveScoreRecord(makeExam(id, score), { operationId: `save_${id}` })
  assert.strictEqual(result.ok, true)
  return storage.getScoreRecords().find((item) => item.id === id)
}

function testArchitecture() {
  const source = fs.readFileSync(path.join(__dirname, '../utils/rc9-storage.js'), 'utf8')
  assert.match(source, /createRestorePoint/)
  assert.match(source, /recoverStartupState/)
  assert.doesNotMatch(fs.readFileSync(path.join(__dirname, '../pages/restore-points/restore-points.js'), 'utf8'), /getStorageSync|setStorageSync/)
  const { storage } = setup()
  assert.strictEqual(typeof storage.createRestorePoint, 'function')
  assert.strictEqual(storage.TRANSACTION_STAGES.length, 10)
}

function testModel() {
  const { storage } = setup()
  const point = storage.createRestorePoint({
    reason: 'manual',
    profileScope: { type: 'full_user_state' },
    operationId: 'model-op',
    id: 'restore-model',
    createdAt: new FixedClock().nowIso()
  }).restorePoint
  assert.strictEqual(point.restorePointFormatVersion, stability.RESTORE_POINT_FORMAT_VERSION)
  assert.strictEqual(point.restorePointFormatVersion, 2)
  assert.strictEqual(point.checksumAlgorithm, 'sha256')
  assert.strictEqual(point.summary.profileCount, 1)
  assert.strictEqual(stability.validateRestorePoint(point).ok, true)
}

function testChecksum() {
  const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, '../docs/fixtures/rc11_2_restore_point_fixture.json'), 'utf8'))
  assert.strictEqual(stability.checksumForRestorePoint(fixture), fixture.checksum)
  assert.strictEqual(fixture.checksum, '72fbf5651a6b76a7d51c93e0a0f6296e809c77d3bc0486d2dac9a4f903db6109')
  const damaged = clone(fixture)
  damaged.summary.scoreRecordCount = 2
  assert.strictEqual(stability.validateRestorePoint(damaged).code, stability.ERROR_CODES.RESTORE_POINT_CHECKSUM_MISMATCH)
}

function testCreation() {
  const { storage, memoryStorage } = setup()
  addScore(storage, 'score-create', 650)
  const result = storage.createRestorePoint({
    reason: 'manual',
    profileScope: { type: 'single_profile', profileId: storage.getActiveProfile().id },
    operationId: 'create-op',
    id: 'restore-create',
    createdAt: '2026-07-31T14:00:00.000Z'
  })
  assert.strictEqual(result.ok, true)
  assert.strictEqual(storage.listRestorePoints().length, 1)
  assert.strictEqual(memoryStorage.memory.has(storage.KEYS.restorePointTemporary), false)
  assert.strictEqual(storage.createRestorePoint({ operationId: 'create-op' }).idempotent, true)
}

function testLimits() {
  const { storage } = setup()
  const ids = new FixedIdGenerator()
  for (let index = 0; index < 11; index += 1) {
    const result = storage.createRestorePoint({
      reason: 'manual',
      profileScope: { type: 'full_user_state' },
      operationId: `limit-${index}`,
      id: ids.next(),
      createdAt: `2026-07-31T14:${String(index).padStart(2, '0')}:00.000Z`
    })
    assert.strictEqual(result.ok, true)
  }
  const points = storage.listRestorePoints()
  assert.strictEqual(points.length, 10)
  assert.strictEqual(points.some((item) => item.id === 'restore-fixed-001'), false)
}

function testRestore() {
  const { storage, memoryStorage } = setup()
  addScore(storage, 'score-restore', 650)
  const point = storage.createRestorePoint({
    reason: 'manual',
    profileScope: { type: 'full_user_state' },
    operationId: 'restore-create',
    id: 'restore-source',
    createdAt: '2026-07-31T14:00:00.000Z'
  }).restorePoint
  storage.saveScoreRecord({ ...storage.getScoreRecords()[0], totalScore: 660, score: 660 })
  const result = storage.restoreFromRestorePoint(point.id, { operationId: 'restore-execute' })
  assert.strictEqual(result.ok, true)
  assert.strictEqual(storage.getScoreRecords()[0].totalScore, 650)
  assert.ok(storage.listRestorePoints().some((item) => item.reason === 'before_restore'))
  assert.strictEqual(memoryStorage.memory.has(storage.KEYS.restoreTemporary), false)
}

function testFaultInjection() {
  for (const stage of stability.TRANSACTION_STAGES) {
    const { storage } = setup()
    const before = JSON.stringify(storage.getVersionedState().state)
    const result = storage.atomicWrite({ fault_target: 1 }, {
      operationType: 'fault_test',
      operationId: `fault-${stage}`,
      faultInjector: new FakeFaultInjector('fault_test', stage)
    })
    if (['writeCommittedJournal', 'cleanup'].includes(stage)) {
      assert.strictEqual(result.ok, true)
      assert.strictEqual(result.committed, true)
      assert.strictEqual(result.status, 'committed_with_warning')
    }
    else assert.strictEqual(result.ok, false, stage)
    if (!['verifyCommitted', 'writeCommittedJournal', 'cleanup', 'finalReadback'].includes(stage)) {
      assert.strictEqual(JSON.stringify(storage.getVersionedState().state), before)
    }
  }
}

function testIdempotency() {
  const { storage } = setup()
  const record = makeExam('score-idempotent', 650)
  const first = storage.saveScoreRecord(record, { operationId: 'same-score-op' })
  const second = storage.saveScoreRecord(record, { operationId: 'same-score-op' })
  assert.strictEqual(first.ok, true)
  assert.strictEqual(second.idempotent, true)
  assert.strictEqual(storage.getScoreRecords().filter((item) => item.id === record.id).length, 1)
  const profileId = storage.getActiveProfile().id
  storage.saveTargetRecord({ id: 'target-a', schoolId: 'suzhou_high_school', schoolName: '江苏省苏州中学校', createdAt: new Date().toISOString(), profileId })
  storage.saveTargetRecord({ id: 'target-b', schoolId: 'suzhou_high_school', schoolName: '江苏省苏州中学校', createdAt: new Date().toISOString(), profileId })
  assert.strictEqual(storage.getTargetRecords().length, 1)
}

function testLocks() {
  const { storage } = setup()
  const lock = storage.acquireOperationLock({ operationId: 'global-lock', operationType: 'restore', global: true })
  assert.strictEqual(lock.ok, true)
  const result = storage.saveScoreRecord(makeExam('locked-score', 650), { operationId: 'locked-write' })
  assert.strictEqual(result.code, stability.ERROR_CODES.OPERATION_LOCKED)
}

function testVersionConflict() {
  const { storage } = setup()
  const first = addScore(storage, 'score-version', 650)
  const second = storage.saveScoreRecord({ ...first, totalScore: 660, score: 660 })
  assert.strictEqual(second.ok, true)
  const conflict = storage.saveScoreRecord({ ...first, totalScore: 640, score: 640 })
  assert.strictEqual(conflict.code, stability.ERROR_CODES.VERSION_CONFLICT)
  assert.strictEqual(storage.getScoreRecords()[0].totalScore, 660)
  const refreshed = storage.getScoreRecords()[0]
  assert.strictEqual(storage.saveScoreRecord({ ...refreshed, totalScore: 670, score: 670 }).ok, true)
  assert.strictEqual(storage.getScoreRecords()[0].version, 3)
}

function testStartupRecovery() {
  const { storage, memoryStorage } = setup()
  memoryStorage.memory.set(storage.KEYS.restorePointTemporary, { broken: true })
  memoryStorage.memory.set(storage.KEYS.operationLock, {
    owner: 'stale', global: true, createdAt: '2026-07-30T00:00:00.000Z'
  })
  const first = storage.recoverStartupState()
  const second = storage.recoverStartupState()
  assert.strictEqual(first.ok, true)
  assert.strictEqual(memoryStorage.memory.has(storage.KEYS.restorePointTemporary), false)
  assert.strictEqual(memoryStorage.memory.has(storage.KEYS.operationLock), false)
  assert.strictEqual(second.ok, true)
}

function testProfileIsolation() {
  const { storage } = setup()
  const firstId = storage.getActiveProfile().id
  addScore(storage, 'score-first', 650)
  const point = storage.createRestorePoint({
    reason: 'manual',
    profileScope: { type: 'single_profile', profileId: firstId },
    operationId: 'profile-point',
    id: 'restore-profile',
    createdAt: '2026-07-31T14:00:00.000Z'
  }).restorePoint
  storage.createStudentProfile({ id: 'profile-second', nickname: '第二档案', examYear: 2027 })
  addScore(storage, 'score-second', 610)
  storage.switchStudentProfile(firstId)
  storage.saveScoreRecord({ ...storage.getScoreRecords()[0], totalScore: 660, score: 660 })
  assert.strictEqual(storage.restoreFromRestorePoint(point.id, { operationId: 'profile-restore' }).ok, true)
  assert.strictEqual(storage.getScoreRecords()[0].totalScore, 650)
  storage.switchStudentProfile('profile-second')
  assert.strictEqual(storage.getScoreRecords()[0].totalScore, 610)
}

function testUi() {
  const js = fs.readFileSync(path.join(__dirname, '../pages/restore-points/restore-points.js'), 'utf8')
  const wxml = fs.readFileSync(path.join(__dirname, '../pages/restore-points/restore-points.wxml'), 'utf8')
  assert.match(js, /listRestorePoints/)
  assert.match(js, /restoreFromRestorePoint/)
  assert.match(wxml, /恢复点/)
  assert.match(wxml, /bindtap="restorePoint"/)
  assert.match(wxml, /bindtap="deletePoint"/)
  assert.match(fs.readFileSync(path.join(__dirname, '../pages/data-management/data-management.wxml'), 'utf8'), /管理恢复点/)
}

function testCrossPlatform() {
  testChecksum()
  const spec = JSON.parse(fs.readFileSync(path.join(__dirname, '../docs/rc11_2_restore_point_spec.json'), 'utf8'))
  assert.strictEqual(spec.maxRestorePoints, 10)
  assert.deepStrictEqual(spec.transactionStages, stability.TRANSACTION_STAGES)
}

const suites = {
  storage_architecture: testArchitecture,
  restore_point_model: testModel,
  restore_point_checksum: testChecksum,
  restore_point_creation: testCreation,
  restore_point_limits: testLimits,
  restore_execution: testRestore,
  fault_injection: testFaultInjection,
  idempotency: testIdempotency,
  operation_locks: testLocks,
  version_conflicts: testVersionConflict,
  startup_recovery: testStartupRecovery,
  profile_restore_isolation: testProfileIsolation,
  restore_point_ui: testUi,
  cross_platform_consistency: testCrossPlatform
}

function runSuite(name) {
  if (name === 'full') {
    for (const [suiteName, run] of Object.entries(suites)) {
      run()
      console.log(`RC11-2 ${suiteName} PASSED`)
    }
    return
  }
  assert.ok(suites[name], `unknown RC11-2 suite: ${name}`)
  suites[name]()
  console.log(`RC11-2 ${name} PASSED`)
}

module.exports = { FixedClock, FixedIdGenerator, FakeFaultInjector, runSuite }
