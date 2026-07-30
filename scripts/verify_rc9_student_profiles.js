const assert = require('assert')
const {
  installWxStorage,
  loadStorageFresh,
  makeExam
} = require('./rc9_test_helpers')
const { schools } = require('../data/schools')

installWxStorage()
const storage = loadStorageFresh()
assert.strictEqual(storage.ensureStorageMigrated().ok, true)
const defaultId = storage.getActiveProfile().id
assert.strictEqual(storage.saveScoreRecord(makeExam('default_exam', 620)).ok, true)
assert.strictEqual(storage.saveTargetRecord({
  schoolId: schools[0].id,
  schoolName: schools[0].name,
  level: 'target',
  createdAt: '2026-08-01T08:00:00.000Z'
}).ok, true)
assert.strictEqual(storage.saveStageGoalRecord({
  id: 'default_stage',
  title: '默认档案目标',
  targetTotalScore: 650,
  status: 'in_progress',
  createdAt: '2026-08-01T08:00:00.000Z'
}).ok, true)
assert.strictEqual(storage.setFavorite(schools[0].id, true).ok, true)

const created = storage.createStudentProfile({ nickname: '第二档案' })
assert.strictEqual(created.ok, true)
const secondId = created.profile.id
assert.notStrictEqual(secondId, defaultId)
assert.deepStrictEqual(storage.getScoreRecords(), [])
assert.deepStrictEqual(storage.getTargetRecords(), [])
assert.deepStrictEqual(storage.getStageGoalRecords(), [])
assert.deepStrictEqual(storage.getFavoriteIds(), [])
assert.strictEqual(storage.saveScoreRecord(makeExam('second_exam', 680)).ok, true)
assert.strictEqual(storage.saveTargetRecord({
  schoolId: schools[1].id,
  schoolName: schools[1].name,
  level: 'sprint',
  createdAt: '2026-08-02T08:00:00.000Z'
}).ok, true)

assert.strictEqual(storage.switchStudentProfile(defaultId).ok, true)
assert.deepStrictEqual(storage.getScoreRecords().map((item) => item.id), ['default_exam'])
assert.deepStrictEqual(storage.getTargetRecords().map((item) => item.schoolId), [schools[0].id])
assert.strictEqual(storage.switchStudentProfile(secondId).ok, true)
assert.deepStrictEqual(storage.getScoreRecords().map((item) => item.id), ['second_exam'])

assert.strictEqual(storage.updateStudentProfile(secondId, { favoritesMode: 'shared' }).ok, true)
assert.strictEqual(storage.setFavorite(schools[2].id, true).ok, true)
assert.deepStrictEqual(storage.getFavoriteIds(), [schools[2].id])
assert.strictEqual(storage.switchStudentProfile(defaultId).ok, true)
assert.deepStrictEqual(storage.getFavoriteIds(), [schools[0].id])
assert.strictEqual(storage.updateStudentProfile(defaultId, { favoritesMode: 'shared' }).ok, true)
assert.deepStrictEqual(storage.getFavoriteIds(), [schools[2].id])

const backup = require('../utils/backup-restore')
const exported = backup.createBackupEnvelope({
  exportedAt: '2026-07-29T12:00:00.000Z'
})
assert.strictEqual(exported.ok, true)
assert.strictEqual(exported.backup.profiles.length, 2)
assert.strictEqual(storage.clearLocalData().ok, true)
assert.strictEqual(backup.importBackupEnvelope(exported.backup, { mode: 'overwrite' }).ok, true)
assert.strictEqual(storage.getProfiles().length, 2)
assert.strictEqual(storage.switchStudentProfile(secondId).ok, true)
assert.deepStrictEqual(storage.getScoreRecords().map((item) => item.id), ['second_exam'])

assert.strictEqual(storage.deleteStudentProfile(secondId).ok, true)
assert.strictEqual(storage.getProfiles().length, 1)
assert.strictEqual(storage.deleteStudentProfile(defaultId).ok, false)

console.log('RC9 STUDENT PROFILES VERIFY PASSED')
console.log('- 双档案成绩/目标/阶段目标隔离、独立/共享收藏、切换与删除通过')
