const { assert, setup, makeExam, runTest } = require('./test-helpers')
const { loadStorageFresh } = require('../rc9_test_helpers')
const { PRODUCT_RULES } = require('../../utils/generated/product-rules')

function v4Fixture() {
  const { storage, memoryStorage } = setup()
  const profile = storage.getActiveProfile()
  storage.saveScoreRecord(makeExam('legacy-650', 650), { operationId: 'seed-legacy-score' })
  const state = storage.getVersionedState().state
  const data = JSON.parse(JSON.stringify(state.profileData[profile.id]))
  for (const field of ['examTemplates', 'scoreSchemes', 'mistakeRecords', 'weeklyPlans', 'stageReviews', 'schoolUserStates']) {
    delete data[field]
  }
  for (const record of data.scoreRecords) {
    for (const field of [
      'scoreSchemeId', 'scoreSchemeName', 'scoreSchemeSnapshot', 'totalMaxScore', 'metricType',
      'admissionScaleMax', 'eligibilityRuleId', 'scoreRateBasisPoints', 'migrationSource'
    ]) delete record[field]
    record.schemaVersion = 4
  }
  memoryStorage.memory.set(storage.KEYS.storageSchemaVersion, 4)
  memoryStorage.memory.set(storage.KEYS.profileData, { [profile.id]: data })
  memoryStorage.memory.set(storage.KEYS.dataRevision, 7)
  return { memoryStorage, keys: storage.KEYS, profileId: profile.id }
}

function testV4ToV5() {
  const fixture = v4Fixture()
  const storage = loadStorageFresh()
  const migration = storage.ensureStorageMigrated()
  assert.strictEqual(migration.ok, true)
  assert.deepStrictEqual(migration.applied, ['v4 → v5'])
  assert.strictEqual(fixture.memoryStorage.memory.get(fixture.keys.storageSchemaVersion), 5)
  assert.strictEqual(fixture.memoryStorage.memory.get(fixture.keys.dataRevision), 8)
  const data = storage.getVersionedState().state.profileData[fixture.profileId]
  for (const field of ['examTemplates', 'scoreSchemes', 'mistakeRecords', 'weeklyPlans', 'stageReviews', 'schoolUserStates']) {
    assert.deepStrictEqual(data[field], [])
  }
  const record = data.scoreRecords[0]
  assert.strictEqual(record.totalScore, 650)
  assert.strictEqual(record.totalMaxScore, 740)
  assert.strictEqual(record.scoreRateBasisPoints, 8784)
  assert.strictEqual(record.eligibilityRuleId, 'legacy_740_total')
  assert.strictEqual(record.scoreSchemeSnapshot.totalMaxScore, 740)
  assert.ok(storage.listRestorePoints().some((item) => item.reason === 'before_migration'))
}

function testIdempotent() {
  const fixture = v4Fixture()
  const storage = loadStorageFresh()
  assert.strictEqual(storage.ensureStorageMigrated().ok, true)
  const first = JSON.stringify(storage.getVersionedState().state)
  const second = storage.ensureStorageMigrated()
  assert.deepStrictEqual(second.applied, [])
  assert.strictEqual(JSON.stringify(storage.getVersionedState().state), first)
  assert.strictEqual(storage.listRestorePoints().filter((item) => item.reason === 'before_migration').length, 1)
}

function testHigherVersionRejected() {
  const fixture = v4Fixture()
  fixture.memoryStorage.memory.set(fixture.keys.storageSchemaVersion, PRODUCT_RULES.storageSchemaVersion + 1)
  const result = loadStorageFresh().ensureStorageMigrated()
  assert.strictEqual(result.ok, false)
  assert.match(result.message, /高于当前支持/)
}

function run() {
  return [
    runTest('V1-MIGRATION-001', testV4ToV5),
    runTest('V1-MIGRATION-002', testIdempotent),
    runTest('V1-MIGRATION-003', testHigherVersionRejected)
  ]
}

module.exports = { run }
