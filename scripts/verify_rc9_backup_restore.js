const assert = require('assert')
const {
  clone,
  installWxStorage,
  loadStorageFresh,
  makeExam
} = require('./rc9_test_helpers')
const { schools } = require('../data/schools')

installWxStorage()
const storage = loadStorageFresh()
assert.strictEqual(storage.ensureStorageMigrated().ok, true)
assert.strictEqual(storage.saveScoreRecord(makeExam('local_exam', 620, '2026-09-01')).ok, true)
assert.strictEqual(storage.saveTargetRecord({
  schoolId: schools[0].id,
  schoolName: schools[0].name,
  level: 'target',
  createdAt: '2026-08-01T08:00:00.000Z'
}).ok, true)
assert.strictEqual(storage.setFavorite(schools[0].id, true).ok, true)

const backup = require('../utils/backup-restore')
const exported = backup.createBackupEnvelope({
  exportedAt: '2026-07-29T12:00:00.000Z'
})
assert.strictEqual(exported.ok, true)
assert.strictEqual(exported.backup.format, 'suzhou-highschool-local-backup')
assert.strictEqual(exported.backup.storageSchemaVersion, 5)
assert.strictEqual(exported.backup.backupFormatVersion, 3)
assert.strictEqual(exported.backup.checksum.algorithm, 'sha256')
assert.strictEqual(backup.validateBackupEnvelope(exported.backup).ok, true)
assert.strictEqual(backup.backupPreview(exported.backup).scoreCount, 1)

const checksumDamage = clone(exported.backup)
checksumDamage.profileData.profile_default.scoreRecords[0].totalScore = 741
checksumDamage.scoreRecords[0].totalScore = 741
assert.ok(
  backup.validateBackupEnvelope(checksumDamage).errors.includes('校验摘要不匹配，文件可能已损坏。')
)

const structurallyInvalid = clone(exported.backup)
structurallyInvalid.profileData.profile_default.scoreRecords[0].examDate = 'bad-date'
structurallyInvalid.scoreRecords[0].examDate = 'bad-date'
structurallyInvalid.checksum.value = backup.checksumForPayload(backup.backupPayload(structurallyInvalid))
const invalidResult = backup.validateBackupEnvelope(structurallyInvalid)
assert.strictEqual(invalidResult.ok, false)
assert.ok(invalidResult.errors.some((item) => item.includes('结构无效的考试记录')))
const beforeInvalidImport = clone(storage.getVersionedState().state)
assert.strictEqual(backup.importBackupEnvelope(structurallyInvalid, { mode: 'merge' }).ok, false)
assert.deepStrictEqual(storage.getVersionedState().state, beforeInvalidImport)

const incoming = clone(exported.backup)
const defaultData = incoming.profileData.profile_default
defaultData.scoreRecords[0] = {
  ...defaultData.scoreRecords[0],
  totalScore: 630,
  score: 630,
  updatedAt: '2026-10-01T08:00:00.000Z'
}
defaultData.scoreRecords.push(makeExam('incoming_exam', 680, '2026-10-02'))
defaultData.targetRecords.push({
  id: `target_${schools[1].id}`,
  schoolId: schools[1].id,
  schoolName: schools[1].name,
  level: 'sprint',
  createdAt: '2026-09-01T08:00:00.000Z',
  updatedAt: '2026-09-01T08:00:00.000Z',
  profileId: 'profile_default',
  schemaVersion: 5
})
incoming.scoreRecords = incoming.profiles.flatMap((profile) => incoming.profileData[profile.id].scoreRecords)
incoming.targetSchools = incoming.profiles.flatMap((profile) => incoming.profileData[profile.id].targetRecords)
incoming.checksum.value = backup.checksumForPayload(backup.backupPayload(incoming))
assert.strictEqual(backup.validateBackupEnvelope(incoming).ok, true)
assert.strictEqual(backup.importBackupEnvelope(incoming, { mode: 'merge' }).ok, true)
assert.deepStrictEqual(
  storage.getScoreRecords().map((item) => [item.id, item.totalScore]),
  [['local_exam', 630], ['incoming_exam', 680]]
)
assert.strictEqual(new Set(storage.getTargetRecords().map((item) => item.schoolId)).size, 2)
assert.ok(storage.storageSnapshot().values[storage.KEYS.importSnapshot])

assert.strictEqual(backup.importBackupEnvelope(exported.backup, { mode: 'overwrite' }).ok, true)
assert.deepStrictEqual(storage.getScoreRecords().map((item) => item.id), ['local_exam'])
assert.deepStrictEqual(storage.getTargetRecords().map((item) => item.schoolId), [schools[0].id])

const duplicate = clone(exported.backup)
duplicate.profileData.profile_default.scoreRecords.push(
  clone(duplicate.profileData.profile_default.scoreRecords[0])
)
duplicate.scoreRecords = duplicate.profiles.flatMap((profile) => duplicate.profileData[profile.id].scoreRecords)
duplicate.checksum.value = backup.checksumForPayload(backup.backupPayload(duplicate))
assert.strictEqual(backup.validateBackupEnvelope(duplicate).ok, false)

console.log('RC9 BACKUP RESTORE VERIFY PASSED')
console.log('- 版本/摘要/字段校验、预览、合并、覆盖、导入前快照与失败不改现有数据通过')
