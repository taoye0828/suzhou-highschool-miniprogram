const assert = require('assert')
const {
  installWxStorage,
  loadStorageFresh
} = require('./rc9_test_helpers')

const legacy = {
  'mp1.favorite_school_ids': ['suzhou_high_school'],
  'mp1.score_records': [
    {
      id: 'legacy_score',
      date: '2026-06-01',
      examName: '旧版月考',
      score: 620,
      createdAt: '2026-06-01T08:00:00.000Z',
      unknownField: 'must-stay'
    },
    {
      id: 'damaged_score',
      date: 'not-a-date',
      examName: '损坏记录',
      score: 600
    }
  ],
  'mp1.target_records': [{
    id: 'legacy_target',
    schoolId: 'suzhou_high_school',
    schoolName: '江苏省苏州中学校',
    level: 'challenge',
    createdAt: '2026-06-01T08:00:00.000Z'
  }],
  'rc8.learning_target_records.v1': [{
    id: 'legacy_stage',
    stage: '期中目标',
    targetScore: 650,
    note: '保留旧备注',
    createdAt: '2026-06-01T08:00:00.000Z'
  }],
  'mp1.exam_year': 2027,
  'rc8.onboarding.v1': {
    version: 1,
    completed: true
  }
}

const harness = installWxStorage(legacy)
let storage = loadStorageFresh()
const migrated = storage.ensureStorageMigrated()
assert.strictEqual(migrated.ok, true)
assert.strictEqual(migrated.fromVersion, 1)
assert.strictEqual(migrated.toVersion, 5)
assert.deepStrictEqual(migrated.applied, ['v1 → v2', 'v2 → v3', 'v3 → v4', 'v4 → v5'])
assert.strictEqual(storage.STORAGE_SCHEMA_VERSION, 5)
assert.strictEqual(storage.getProfiles().length, 1)
assert.strictEqual(storage.getScoreRecords().length, 1)
assert.strictEqual(storage.getScoreRecords()[0].legacyExtensions.unknownField, 'must-stay')
assert.strictEqual(storage.getTargetRecords()[0].level, 'sprint')
assert.strictEqual(storage.getLearningTargetRecords()[0].title, '期中目标')
assert.strictEqual(storage.getFavoriteIds()[0], 'suzhou_high_school')
assert.strictEqual(storage.getExamYear(), 2027)
assert.ok(harness.memory.has(storage.KEYS.migrationBackup))

const repeated = storage.ensureStorageMigrated()
assert.strictEqual(repeated.ok, true)
assert.deepStrictEqual(repeated.applied, [])
assert.strictEqual(storage.getScoreRecords().length, 1)

const currentSnapshot = storage.storageSnapshot().values
const { migrateStorageSnapshot } = require('../utils/storage-migration')
const currentMigration = migrateStorageSnapshot(currentSnapshot, { keys: storage.KEYS })
assert.strictEqual(currentMigration.ok, true)
assert.deepStrictEqual(currentMigration.applied, [])
assert.strictEqual(currentMigration.state.version, 5)

installWxStorage(legacy, { failWriteKey: 'rc9.student_profiles.v4' })
storage = loadStorageFresh()
const failed = storage.ensureStorageMigrated()
assert.strictEqual(failed.ok, false)
assert.strictEqual(storage.isVersionedStorageActive(), false)
assert.strictEqual(storage.getScoreRecordsResult().ok, false)
assert.deepStrictEqual(storage.getScoreRecords(), [])
assert.strictEqual(
  harness.memory.get('mp1.score_records')[0].id,
  'legacy_score',
  '迁移失败时原始旧数据必须保留，但正式页面不得回退读取'
)

console.log('RC9 STORAGE MIGRATION VERIFY PASSED')
console.log('- v1 → v2 → v3 → v4 → v5、损坏项隔离、安全 legacyExtensions、幂等与失败回滚通过')
