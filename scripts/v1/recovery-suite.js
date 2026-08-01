const fs = require('fs')
const path = require('path')
const {
  assert,
  setup,
  makeExam,
  byteLength,
  runTest
} = require('./test-helpers')

function run() {
  const results = []

  results.push(runTest('V1-LOCK-006', () => {
    const { storage } = setup()
    const result = storage.saveScoreRecord(makeExam('v1-auto-operation', 650))
    assert.strictEqual(result.ok, true)
    assert.match(result.operationId, /^save_score_/)
    const states = storage.getOperationStates()
    assert.strictEqual(states[result.operationId].operationType, 'save_score')
  }))

  results.push(runTest('V1-LOCK-008', () => {
    const { storage } = setup()
    for (let index = 0; index < 105; index += 1) {
      assert.strictEqual(storage.saveScoreRecord(
        makeExam(`v1-state-${index}`, 600 + index % 100),
        { operationId: `v1-state-op-${index}` }
      ).ok, true)
    }
    const states = storage.getOperationStates()
    assert.ok(Object.keys(states).length <= 100)
    for (const state of Object.values(states)) {
      assert.ok(byteLength(state) <= 2048)
      assert.strictEqual(Object.prototype.hasOwnProperty.call(state, 'result'), false)
      assert.strictEqual(Object.prototype.hasOwnProperty.call(state, 'payload'), false)
    }
  }))

  results.push(runTest('V1-LOCK-009', () => {
    const { storage } = setup()
    const start = Date.parse('2026-08-01T08:00:00.000Z')
    assert.strictEqual(storage.acquireOperationLock({
      operationId: 'v1-expired-owner', operationType: 'write', global: true, nowMs: start
    }).ok, true)
    assert.strictEqual(storage.acquireOperationLock({
      operationId: 'v1-expired-next', operationType: 'write', global: true, nowMs: start + 300001
    }).ok, true)
  }))

  results.push(runTest('V1-LOCK-010', () => {
    const { storage, memoryStorage } = setup()
    const now = Date.parse('2026-08-01T08:10:00.000Z')
    storage.writeStorage(storage.KEYS.restorePointOperationState, {
      'v1-running-owner': {
        operationId: 'v1-running-owner',
        operationType: 'restore',
        status: 'running',
        startedAt: '2026-08-01T08:00:00.000Z'
      }
    })
    storage.writeStorage(storage.KEYS.operationLock, {
      lockId: 'lock_v1-running-owner',
      operationId: 'v1-running-owner',
      operationType: 'restore',
      profileId: '',
      entityId: '',
      global: true,
      acquiredAt: '2026-08-01T08:00:00.000Z',
      expiresAt: '2026-08-01T08:05:00.000Z',
      ownerSessionId: 'fixed-session'
    })
    const blocked = storage.acquireOperationLock({
      operationId: 'v1-running-next', operationType: 'write', global: true, nowMs: now
    })
    assert.strictEqual(blocked.code, storage.ERROR_CODES.STARTUP_RECOVERY_REQUIRED)
    assert.strictEqual(memoryStorage.memory.get(storage.KEYS.operationLock).operationId, 'v1-running-owner')
  }))

  results.push(runTest('V1-LOCK-007', () => {
    const storageSource = fs.readFileSync(path.join(__dirname, '../../utils/rc9-storage.js'), 'utf8')
    assert.doesNotMatch(storageSource, /if\s*\(\s*!operationId\s*\)\s*return\s+action/)
    for (const relative of [
      '../../pages/data-management/data-management.js',
      '../../pages/profile-management/profile-management.js',
      '../../pages/schools/schools.js',
      '../../pages/school-detail/school-detail.js',
      '../../pages/school-compare/school-compare.js',
      '../../pages/score-trend/score-trend.js',
      '../../pages/targets/targets.js'
    ]) {
      assert.match(fs.readFileSync(path.join(__dirname, relative), 'utf8'), /operation-(?:context|options)/)
    }
  }))

  results.push(runTest('V1-RECOVERY-012', () => {
    const { storage } = setup()
    const firstProfileId = storage.getActiveProfile().id
    assert.strictEqual(storage.createStudentProfile({ id: 'v1-delete-profile', nickname: '待恢复档案' }).ok, true)
    assert.strictEqual(storage.saveScoreRecord(makeExam('v1-deleted-profile-score', 610)).ok, true)
    const point = storage.createRestorePoint({
      reason: 'manual',
      profileScope: { type: 'single_profile', profileId: 'v1-delete-profile' },
      operationId: 'v1-deleted-profile-point',
      id: 'v1-deleted-profile-restore'
    })
    assert.strictEqual(point.ok, true)
    assert.strictEqual(storage.switchStudentProfile(firstProfileId).ok, true)
    const deleted = storage.deleteStudentProfile('v1-delete-profile', { operationId: 'v1-delete-profile-op' })
    assert.strictEqual(deleted.ok, true)
    const safety = storage.listRestorePoints().find((item) => item.metadata.operationId === 'v1-delete-profile-op_safety')
    assert.strictEqual(safety.profileScope.type, 'full_user_state')
    assert.strictEqual(storage.restoreFromRestorePoint('v1-deleted-profile-restore', {
      operationId: 'v1-restore-deleted-profile'
    }).ok, true)
    assert.ok(storage.getProfiles().some((item) => item.id === 'v1-delete-profile'))
  }))

  results.push(runTest('V1-RECOVERY-016', () => {
    const { storage } = setup()
    const profile = storage.getActiveProfile()
    assert.strictEqual(storage.updateStudentProfile(profile.id, { favoritesMode: 'shared' }).ok, true)
    assert.strictEqual(storage.setFavorite('suzhou_high_school', true).ok, true)
    const point = storage.createRestorePoint({
      reason: 'manual',
      profileScope: { type: 'single_profile', profileId: profile.id },
      operationId: 'v1-shared-point',
      id: 'v1-shared-restore'
    })
    assert.strictEqual(point.restorePoint.payload.sharedFavoriteSchoolIds.length, 0)
    assert.strictEqual(storage.setFavorite('suzhou_high_school', false).ok, true)
    assert.strictEqual(storage.setFavorite('suzhou_no1_high_school', true).ok, true)
    assert.strictEqual(storage.restoreFromRestorePoint('v1-shared-restore', {
      operationId: 'v1-shared-restore-op'
    }).ok, true)
    assert.deepStrictEqual(storage.getFavoriteIds(), ['suzhou_no1_high_school'])
  }))

  results.push(runTest('V1-RECOVERY-003', () => {
    const { storage } = setup()
    assert.strictEqual(storage.saveScoreRecord(makeExam('v1-restore-warning', 650)).ok, true)
    const point = storage.createRestorePoint({
      reason: 'manual',
      profileScope: { type: 'full_user_state' },
      operationId: 'v1-restore-warning-point',
      id: 'v1-restore-warning-source'
    })
    assert.strictEqual(point.ok, true)
    assert.strictEqual(storage.saveScoreRecord({
      ...storage.getScoreRecords()[0], totalScore: 660, score: 660
    }).ok, true)
    const restored = storage.restoreFromRestorePoint('v1-restore-warning-source', {
      operationId: 'v1-restore-warning-op',
      faultInjector: {
        operationType: 'restore',
        failAtStage: 'cleanup',
        errorCode: 'CLEANUP_FAILED'
      }
    })
    assert.strictEqual(restored.ok, true)
    assert.strictEqual(restored.status, 'committed_with_warning')
    assert.strictEqual(storage.getScoreRecords()[0].totalScore, 650)
  }))

  results.push(runTest('V1-RECOVERY-010', () => {
    const { storage } = setup()
    const first = storage.createRestorePoint({
      reason: 'manual',
      profileScope: { type: 'full_user_state' },
      operationId: 'v1-recreate-point-op',
      id: 'v1-recreate-point'
    })
    assert.strictEqual(first.ok, true)
    assert.strictEqual(storage.deleteRestorePoint('v1-recreate-point', {
      operationId: 'v1-delete-recreate-point'
    }).ok, true)
    const recreated = storage.createRestorePoint({
      reason: 'manual',
      profileScope: { type: 'full_user_state' },
      operationId: 'v1-recreate-point-op',
      id: 'v1-recreate-point'
    })
    assert.strictEqual(recreated.ok, true)
    assert.notStrictEqual(recreated.idempotent, true)
    assert.strictEqual(storage.getRestorePoint('v1-recreate-point').ok, true)
  }))

  results.push(runTest('V1-RECOVERY-013', () => {
    const { storage } = setup()
    assert.strictEqual(storage.saveScoreRecord(makeExam('v1-clear-score', 650)).ok, true)
    const result = storage.clearScoreRecords({ operationId: 'v1-clear-score-op' })
    assert.strictEqual(result.ok, true)
    assert.strictEqual(storage.getScoreRecords().length, 0)
    assert.ok(storage.listRestorePoints().some((item) =>
      item.metadata.operationId === 'v1-clear-score-op_safety'))
  }))

  results.push(runTest('V1-RECOVERY-014', () => {
    const { storage } = setup()
    assert.strictEqual(storage.saveTargetRecord({
      id: 'v1-clear-target',
      schoolId: 'suzhou_high_school',
      schoolName: '江苏省苏州中学校',
      level: 'target',
      createdAt: '2026-08-01T08:00:00.000Z'
    }).ok, true)
    const result = storage.clearTargetRecords({ operationId: 'v1-clear-target-op' })
    assert.strictEqual(result.ok, true)
    assert.strictEqual(storage.getTargetRecords().length, 0)
    assert.ok(storage.listRestorePoints().some((item) =>
      item.metadata.operationId === 'v1-clear-target-op_safety'))
  }))

  results.push(runTest('V1-RECOVERY-015', () => {
    const { storage } = setup()
    assert.strictEqual(storage.saveStageGoalRecord({
      id: 'v1-clear-stage', title: '阶段目标', status: 'not_started', createdAt: '2026-08-01T08:00:00.000Z'
    }).ok, true)
    assert.strictEqual(storage.saveLearningTask({
      id: 'v1-clear-task', title: '学习任务', status: 'not_started', createdAt: '2026-08-01T08:00:00.000Z'
    }).ok, true)
    assert.strictEqual(storage.clearStageGoalRecords({ operationId: 'v1-clear-stage-op' }).ok, true)
    assert.strictEqual(storage.clearLearningTasks({ operationId: 'v1-clear-task-op' }).ok, true)
    assert.strictEqual(storage.getStageGoalRecords().length, 0)
    assert.strictEqual(storage.getLearningTasks().length, 0)
    assert.ok(storage.listRestorePoints().some((item) =>
      item.metadata.operationId === 'v1-clear-stage-op_safety'))
    assert.ok(storage.listRestorePoints().some((item) =>
      item.metadata.operationId === 'v1-clear-task-op_safety'))
  }))

  results.push(runTest('V1-RECOVERY-011', () => {
    const js = fs.readFileSync(path.join(__dirname, '../../pages/data-management/data-management.js'), 'utf8')
    const wxml = fs.readFileSync(path.join(__dirname, '../../pages/data-management/data-management.wxml'), 'utf8')
    assert.match(js, /getStartupRecoveryState/)
    assert.match(js, /resolveStartupRecovery/)
    assert.match(wxml, /未完成数据操作/)
    assert.match(wxml, /useTemporaryData/)
  }))

  return results
}

module.exports = { run }

if (require.main === module) run()
