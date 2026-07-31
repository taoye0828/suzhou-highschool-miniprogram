const assert = require('assert')
const {
  FakeFileAdapter,
  FakeShareAdapter,
  setupProfile,
  fixtures
} = require('./rc11_1_test_harness')
const { clone } = require('./rc9_test_helpers')
const { schools } = require('../data/schools')

const { storage, memoryStorage } = setupProfile(fixtures.profile)
const backup = require('../utils/backup-restore')
const files = new FakeFileAdapter()
const shares = new FakeShareAdapter()
const schoolA = schools[0]
const schoolB = schools[1]

assert.strictEqual(storage.saveScoreRecord(fixtures.firstExam).ok, true)
assert.strictEqual(storage.saveTargetRecord({
  schoolId: schoolA.id,
  schoolName: schoolA.name,
  level: 'target',
  createdAt: fixtures.firstExam.createdAt
}).ok, true)
assert.strictEqual(storage.saveLearningTargetRecord({
  id: 'stage-a',
  title: '阶段目标A',
  status: 'in_progress',
  createdAt: fixtures.firstExam.createdAt
}).ok, true)

assert.strictEqual(storage.createStudentProfile({
  id: 'profile-second',
  nickname: '第二档案',
  examYear: 2027
}).ok, true)
assert.deepStrictEqual(storage.getScoreRecords(), [])
assert.strictEqual(storage.saveScoreRecord({
  id: 'exam-second-profile',
  examName: '第二档案月考',
  examDate: '2026-09-20',
  totalScore: 610,
  createdAt: fixtures.firstExam.createdAt
}).ok, true)
assert.strictEqual(storage.saveTargetRecord({
  schoolId: schoolB.id,
  schoolName: schoolB.name,
  level: 'safe',
  createdAt: fixtures.firstExam.createdAt
}).ok, true)
assert.strictEqual(storage.saveLearningTargetRecord({
  id: 'stage-b',
  title: '阶段目标B',
  status: 'in_progress',
  createdAt: fixtures.firstExam.createdAt
}).ok, true)

assert.strictEqual(storage.switchStudentProfile(fixtures.profile.id).ok, true)
assert.deepStrictEqual(storage.getScoreRecords().map((item) => item.totalScore), [650])
assert.deepStrictEqual(storage.getTargetRecords().map((item) => item.schoolId), [schoolA.id])
assert.strictEqual(storage.switchStudentProfile('profile-second').ok, true)
assert.deepStrictEqual(storage.getScoreRecords().map((item) => item.totalScore), [610])
assert.deepStrictEqual(storage.getTargetRecords().map((item) => item.schoolId), [schoolB.id])

const exported = backup.createBackupEnvelope({ exportedAt: '2026-11-10T02:00:00.000Z' })
assert.strictEqual(exported.ok, true)
files.write('rc11-backup.json', JSON.stringify(exported.backup))
shares.share(exported.backup)
assert.strictEqual(exported.backup.profiles.length, 2)
assert.strictEqual(backup.backupPreview(exported.backup).profileCount, 2)
assert.strictEqual(shares.shared.length, 1)

assert.strictEqual(storage.clearCurrentProfileData().ok, true)
assert.strictEqual(storage.switchStudentProfile(fixtures.profile.id).ok, true)
assert.deepStrictEqual(storage.getScoreRecords().map((item) => item.totalScore), [650])

const beforeBroken = clone(storage.getVersionedState().state)
assert.strictEqual(backup.importBackupEnvelope('{broken', { mode: 'overwrite' }).ok, false)
assert.deepStrictEqual(storage.getVersionedState().state, beforeBroken)
const badChecksum = clone(exported.backup)
badChecksum.checksum.value = '00000000'
assert.strictEqual(backup.importBackupEnvelope(badChecksum, { mode: 'overwrite' }).ok, false)
assert.deepStrictEqual(storage.getVersionedState().state, beforeBroken)

assert.strictEqual(
  backup.importBackupEnvelope(JSON.parse(files.read('rc11-backup.json')), { mode: 'overwrite' }).ok,
  true
)
assert.strictEqual(storage.getProfiles().length, 2)
assert.strictEqual(storage.switchStudentProfile('profile-second').ok, true)
assert.deepStrictEqual(storage.getScoreRecords().map((item) => item.totalScore), [610])
assert.strictEqual(new Set(storage.getScoreRecords().map((item) => item.id)).size, 1)
assert.strictEqual(new Set(storage.getTargetRecords().map((item) => item.schoolId)).size, 1)
assert.strictEqual(new Set(storage.getStageGoalRecords().map((item) => item.id)).size, 1)
assert.strictEqual(storage.getScoreRecords()[0].profileId, 'profile-second')
assert.strictEqual(memoryStorage.memory.has(storage.KEYS.transactionJournal), false)

console.log('RC11-1 MULTI PROFILE BACKUP JOURNEY PASSED')
