const assert = require('assert')
const {
  installWxStorage,
  loadStorageFresh,
  makeExam
} = require('./rc9_test_helpers')
const { schools } = require('../data/schools')

const harness = installWxStorage({
  'mp1.score_records': [makeExam('legacy_should_not_revive', 600)]
})
const storage = loadStorageFresh()
assert.strictEqual(storage.ensureStorageMigrated().ok, true)
const defaultId = storage.getActiveProfile().id
assert.strictEqual(storage.saveScoreRecord(makeExam('current_exam', 650)).ok, true)
assert.strictEqual(storage.setFavorite(schools[0].id, true).ok, true)
const second = storage.createStudentProfile({ nickname: '保留档案' })
assert.strictEqual(second.ok, true)
assert.strictEqual(storage.saveScoreRecord(makeExam('second_exam', 680)).ok, true)

assert.strictEqual(storage.switchStudentProfile(defaultId).ok, true)
assert.strictEqual(storage.clearCurrentProfileData().ok, true)
assert.deepStrictEqual(storage.getScoreRecords(), [])
assert.deepStrictEqual(storage.getFavoriteIds(), [])
assert.strictEqual(storage.switchStudentProfile(second.profile.id).ok, true)
assert.deepStrictEqual(storage.getScoreRecords().map((item) => item.id), ['second_exam'])

assert.strictEqual(storage.clearLocalData().ok, true)
assert.strictEqual(storage.isVersionedStorageActive(), true)
assert.strictEqual(storage.getProfiles().length, 1)
assert.deepStrictEqual(storage.getScoreRecords(), [])
assert.deepStrictEqual(storage.getTargetRecords(), [])
assert.deepStrictEqual(storage.getStageGoalRecords(), [])
assert.deepStrictEqual(storage.getFavoriteIds(), [])
assert.strictEqual(harness.memory.has('mp1.score_records'), false)
assert.ok(harness.memory.has(storage.KEYS.clearMarker))

const repeated = storage.ensureStorageMigrated()
assert.strictEqual(repeated.ok, true)
assert.deepStrictEqual(storage.getScoreRecords(), [])

console.log('RC9 CLEAR DATA VERIFY PASSED')
console.log('- 当前档案隔离清除、全部原子清除、空状态重建与旧数据不复活通过')
