const fs = require('fs')
const path = require('path')
const { assert, setup, makeExam, clone, runTest } = require('./test-helpers')
const backupService = require('../../utils/backup-restore')
const stability = require('../../utils/rc11-stability')
const { canonicalJson } = require('../../utils/canonical-json')
const { checksumFor, legacyFnv1a32 } = require('../../utils/checksum')

function seed() {
  const context = setup()
  context.storage.saveScoreRecord(makeExam('backup-score', 650), { operationId: 'backup-seed' })
  return context
}

function testV3Sha256() {
  seed()
  const result = backupService.createBackupEnvelope({ exportedAt: '2026-08-01T09:00:00.000Z' })
  assert.strictEqual(result.ok, true)
  assert.strictEqual(result.backup.backupFormatVersion, 3)
  assert.strictEqual(result.backup.storageSchemaVersion, 5)
  assert.strictEqual(result.backup.checksum.algorithm, 'sha256')
  assert.strictEqual(result.backup.checksum.value, checksumFor(backupService.backupPayload(result.backup)))
  assert.strictEqual(backupService.validateBackupEnvelope(result.backup).ok, true)
}

function testV2Compatibility() {
  seed()
  const v3 = backupService.createBackupEnvelope({ exportedAt: '2026-08-01T09:01:00.000Z' }).backup
  const payload = backupService.backupPayload(v3)
  const v2 = {
    ...clone(v3),
    backupFormatVersion: 2,
    storageSchemaVersion: 4,
    appDataVersion: 'rc10',
    checksum: { algorithm: 'fnv1a32', value: legacyFnv1a32(canonicalJson(payload)) }
  }
  assert.strictEqual(backupService.validateBackupEnvelope(v2).ok, true)
}

function testRepeatedImportNewSafetyPoint() {
  const { storage } = seed()
  const envelope = backupService.createBackupEnvelope({ exportedAt: '2026-08-01T09:02:00.000Z' }).backup
  assert.strictEqual(backupService.importBackupEnvelope(envelope, { mode: 'merge', operationId: 'import-first' }).ok, true)
  assert.strictEqual(backupService.importBackupEnvelope(envelope, { mode: 'merge', operationId: 'import-second' }).ok, true)
  const points = storage.listRestorePoints().filter((item) => item.reason === 'before_import')
  assert.strictEqual(points.length, 2)
  assert.notStrictEqual(points[0].id, points[1].id)
}

function currentPoint() {
  const { storage } = seed()
  const point = storage.createRestorePoint({
    reason: 'manual', profileScope: { type: 'full_user_state' }, operationId: 'gate-point'
  }).restorePoint
  return { storage, point }
}

function assertVersionRejected(field, value) {
  const { point } = currentPoint()
  const changed = clone(point)
  changed[field] = value
  changed.checksum = stability.checksumForRestorePoint(changed)
  assert.strictEqual(stability.validateRestorePoint(changed).code, stability.ERROR_CODES.RESTORE_POINT_VERSION_UNSUPPORTED)
}

function testLegacyRestorePoint() {
  const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, '../../docs/fixtures/rc11_2_restore_point_fixture.json'), 'utf8'))
  assert.strictEqual(stability.validateRestorePoint(fixture).ok, true)
}

function testReferenceIntegrity() {
  const { storage } = currentPoint()
  const state = storage.getVersionedState().state
  const data = state.profileData[state.activeProfileId]
  data.weeklyPlans.push({
    id: 'broken-week', profileId: state.activeProfileId, weekStartDate: '2026-07-27',
    weekEndDate: '2026-08-02', taskItems: ['missing-task'], createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z', version: 1, schemaVersion: 5
  })
  assert.strictEqual(storage.validateRestoreState(state).code, stability.ERROR_CODES.INVALID_PROFILE_REFERENCE)
}

function testLocalSettingsWinMerge() {
  const local = {
    profileId: 'profile_default', recommendationSettings: { districts: ['本机'] },
    scenarioSettings: { currentScore: 620 }, schoolFilters: { favoritesOnly: true }, examYear: 2027
  }
  const incoming = {
    profileId: 'profile_default', recommendationSettings: { districts: ['备份'] },
    scenarioSettings: { currentScore: 700 }, schoolFilters: { favoritesOnly: false }, examYear: 2028
  }
  const merged = backupService.mergeProfileData(local, incoming, 'profile_default')
  assert.deepStrictEqual(merged.recommendationSettings.districts, ['本机'])
  assert.strictEqual(merged.scenarioSettings.currentScore, 620)
  assert.strictEqual(merged.schoolFilters.favoritesOnly, true)
  assert.strictEqual(merged.examYear, 2027)
}

function testCanonicalRules() {
  assert.strictEqual(canonicalJson({ z: -0, a: null, skip: undefined }), '{"a":null,"z":0}')
  assert.throws(() => canonicalJson({ score: Number.NaN }), /finite/)
  const unsafe = JSON.parse('{"__proto__":{"polluted":true}}')
  assert.throws(() => canonicalJson(unsafe), /dangerous object key/)
}

function run() {
  return [
    runTest('V1-BACKUP-001', testV3Sha256),
    runTest('V1-BACKUP-002', testV2Compatibility),
    runTest('V1-BACKUP-009', testRepeatedImportNewSafetyPoint),
    runTest('V1-RECOVERY-018', () => assertVersionRejected('storageSchemaVersion', 99)),
    runTest('V1-RECOVERY-019', () => assertVersionRejected('backupFormatVersion', 99)),
    runTest('V1-RECOVERY-020', () => assertVersionRejected('appDataVersion', 'future')),
    runTest('V1-RECOVERY-V1', testLegacyRestorePoint),
    runTest('V1-DATA-021', testReferenceIntegrity),
    runTest('V1-BACKUP-041', testLocalSettingsWinMerge),
    runTest('V1-BACKUP-043', testCanonicalRules)
  ]
}

module.exports = { run }
