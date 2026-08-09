const assert = require('assert')
const {
  clone,
  installWxStorage,
  loadStorageFresh,
  makeExam
} = require('./rc9_test_helpers')
const { APP_CONFIG } = require('../config/app-config')
const { schools } = require('../data/schools')
const { PRODUCT_RULES } = require('../utils/generated/product-rules')

function refreshChecksum(backup, envelope) {
  envelope.backup.checksum.value = backup.checksumForPayload(
    backup.backupPayload(envelope.backup),
    envelope.backup.checksum.algorithm
  )
  return envelope.backup
}

console.log('DUAL-FINAL: 验证档案、成绩和备份安全边界...')

assert.strictEqual(PRODUCT_RULES.limits.maxProfiles, 10)
assert.strictEqual(PRODUCT_RULES.limits.maxExamRecordsPerProfile, APP_CONFIG.scoreRecord.maxRecords)
assert.strictEqual(PRODUCT_RULES.limits.maxExamRecordsPerProfile, 100)
assert.strictEqual(PRODUCT_RULES.limits.maxTargetRecordsPerProfile, APP_CONFIG.targetScore.maxRecords)

installWxStorage()
let storage = loadStorageFresh()
assert.strictEqual(storage.ensureStorageMigrated().ok, true)
for (let index = 1; index < PRODUCT_RULES.limits.maxProfiles; index += 1) {
  assert.strictEqual(storage.createStudentProfile({ nickname: `档案 ${index}` }).ok, true)
}
const profilesBeforeOverflow = storage.getProfiles()
const profileOverflow = storage.createStudentProfile({ nickname: '第 11 个档案' })
assert.strictEqual(profileOverflow.ok, false)
assert.strictEqual(profileOverflow.code, 'LIMIT_EXCEEDED')
assert.match(profileOverflow.message, /最多创建 10 个学生档案/)
assert.deepStrictEqual(storage.getProfiles(), profilesBeforeOverflow)
console.log('✓ 第 11 个档案明确拒绝，原 10 个档案不变')

installWxStorage()
storage = loadStorageFresh()
assert.strictEqual(storage.ensureStorageMigrated().ok, true)
for (let index = 0; index < APP_CONFIG.scoreRecord.maxRecords; index += 1) {
  assert.strictEqual(
    storage.saveScoreRecord(makeExam(`limit-${index}`, index % 741)).ok,
    true
  )
}
const scoreIdsBeforeOverflow = storage.getScoreRecords().map((item) => item.id).sort()
const scoreOverflow = storage.saveScoreRecord(makeExam('limit-100', 700))
assert.strictEqual(scoreOverflow.ok, false)
assert.strictEqual(scoreOverflow.code, 'LIMIT_EXCEEDED')
assert.match(scoreOverflow.message, /最多记录 100 次考试/)
assert.deepStrictEqual(storage.getScoreRecords().map((item) => item.id).sort(), scoreIdsBeforeOverflow)

const recordToEdit = storage.getScoreRecords().find((item) => item.id === 'limit-99')
const editAtLimit = storage.saveScoreRecord({
  ...recordToEdit,
  totalScore: 701,
  score: 701,
  expectedVersion: recordToEdit.version
})
assert.strictEqual(editAtLimit.ok, true)
assert.strictEqual(storage.getScoreRecords().length, APP_CONFIG.scoreRecord.maxRecords)
assert.strictEqual(storage.getScoreRecords().find((item) => item.id === 'limit-99').totalScore, 701)

const examWithReviewOverflow = storage.saveExamWithReview(
  makeExam('limit-review-overflow', 702),
  {
    id: 'limit-review-overflow',
    examRecordId: 'limit-review-overflow',
    summary: '不应写入',
    createdAt: '2026-09-01T08:00:00.000Z',
    updatedAt: '2026-09-01T08:00:00.000Z'
  }
)
assert.strictEqual(examWithReviewOverflow.ok, false)
assert.strictEqual(examWithReviewOverflow.code, 'LIMIT_EXCEEDED')
assert.strictEqual(storage.getScoreRecords().length, APP_CONFIG.scoreRecord.maxRecords)
assert.strictEqual(storage.getScoreReviews().length, 0)
console.log('✓ 第 101 条成绩明确拒绝且原 100 条不变；满额时仍可编辑已有成绩')

installWxStorage()
storage = loadStorageFresh()
assert.strictEqual(storage.ensureStorageMigrated().ok, true)
for (let index = 0; index < APP_CONFIG.targetScore.maxRecords; index += 1) {
  assert.strictEqual(storage.saveTargetRecord({
    id: `target-limit-${index}`,
    schoolId: `school-${index}`,
    schoolName: `学校 ${index}`,
    createdAt: '2026-08-07T00:00:00.000Z'
  }).ok, true)
}
const targetIdsBeforeOverflow = storage.getTargetRecords().map((item) => item.id).sort()
const targetOverflow = storage.saveTargetRecord({
  id: 'target-limit-100',
  schoolId: 'school-100',
  schoolName: '第 101 所学校',
  createdAt: '2026-08-07T00:00:00.000Z'
})
assert.strictEqual(targetOverflow.ok, false)
assert.strictEqual(targetOverflow.code, 'LIMIT_EXCEEDED')
assert.deepStrictEqual(storage.getTargetRecords().map((item) => item.id).sort(), targetIdsBeforeOverflow)
const targetToEdit = storage.getTargetRecords().find((item) => item.schoolId === 'school-99')
assert.strictEqual(storage.saveTargetRecord({
  ...targetToEdit,
  schoolName: '学校 99（已编辑）',
  expectedVersion: targetToEdit.version
}).ok, true)
assert.strictEqual(storage.getTargetRecords().length, APP_CONFIG.targetScore.maxRecords)
console.log('✓ 第 101 所目标学校明确拒绝且原 100 所不变；满额时仍可编辑已有目标')

installWxStorage()
storage = loadStorageFresh()
assert.strictEqual(storage.ensureStorageMigrated().ok, true)
delete require.cache[require.resolve('../utils/backup-restore')]
const backup = require('../utils/backup-restore')
const envelope = backup.createBackupEnvelope({ exportedAt: '2026-08-05T00:00:00.000Z' })
assert.strictEqual(envelope.ok, true)
const profileId = envelope.backup.activeProfileId

envelope.backup.profileData[profileId].scoreRecords = Array.from(
  { length: APP_CONFIG.scoreRecord.maxRecords + 1 },
  (_, index) => makeExam(`backup-${index}`, index % 741)
)
envelope.backup.checksum.value = backup.checksumForPayload(
  backup.backupPayload(envelope.backup),
  envelope.backup.checksum.algorithm
)
const scoreBackupOverflow = backup.validateBackupEnvelope(envelope.backup)
assert.strictEqual(scoreBackupOverflow.ok, false)
assert.ok(scoreBackupOverflow.errors.some((message) => message.includes('考试记录超过数量限制')))

const targetEnvelope = backup.createBackupEnvelope({ exportedAt: '2026-08-05T00:00:00.000Z' })
assert.strictEqual(targetEnvelope.ok, true)
targetEnvelope.backup.profileData[profileId].targetRecords = Array.from(
  { length: APP_CONFIG.targetScore.maxRecords + 1 },
  (_, index) => ({ id: `target-${index}`, schoolId: `school-${index}` })
)
targetEnvelope.backup.checksum.value = backup.checksumForPayload(
  backup.backupPayload(targetEnvelope.backup),
  targetEnvelope.backup.checksum.algorithm
)
const targetBackupOverflow = backup.validateBackupEnvelope(targetEnvelope.backup)
assert.strictEqual(targetBackupOverflow.ok, false)
assert.ok(targetBackupOverflow.errors.some((message) => message.includes('目标学校超过数量限制')))
console.log('✓ 含 101 条成绩或 101 个目标学校的备份在导入前拒绝')

installWxStorage()
storage = loadStorageFresh()
assert.strictEqual(storage.ensureStorageMigrated().ok, true)
for (let index = 1; index < PRODUCT_RULES.limits.maxProfiles; index += 1) {
  assert.strictEqual(storage.createStudentProfile({ nickname: `合并档案 ${index}` }).ok, true)
}
let mergeBackup = require('../utils/backup-restore')
let mergeEnvelope = mergeBackup.createBackupEnvelope({ exportedAt: '2026-08-08T00:00:00.000Z' })
const sourceProfile = mergeEnvelope.backup.profiles[0]
const sourceData = mergeEnvelope.backup.profileData[sourceProfile.id]
const incomingProfileId = 'merge-profile-11'
mergeEnvelope.backup.profiles = [{ ...sourceProfile, id: incomingProfileId, nickname: '第 11 个合并档案' }]
mergeEnvelope.backup.activeProfileId = incomingProfileId
mergeEnvelope.backup.profileData = {
  [incomingProfileId]: { ...clone(sourceData), profileId: incomingProfileId }
}
refreshChecksum(mergeBackup, mergeEnvelope)
let stateBeforeMerge = clone(storage.getVersionedState().state)
let restorePointsBeforeMerge = clone(storage.listRestorePoints())
let mergeOverflow = mergeBackup.importBackupEnvelope(mergeEnvelope.backup, { mode: 'merge' })
assert.strictEqual(mergeOverflow.ok, false)
assert.strictEqual(mergeOverflow.code, 'LIMIT_EXCEEDED')
assert.deepStrictEqual(storage.getVersionedState().state, stateBeforeMerge)
assert.deepStrictEqual(storage.listRestorePoints(), restorePointsBeforeMerge)

installWxStorage()
storage = loadStorageFresh()
assert.strictEqual(storage.ensureStorageMigrated().ok, true)
mergeBackup = require('../utils/backup-restore')
mergeEnvelope = mergeBackup.createBackupEnvelope({ exportedAt: '2026-08-08T00:00:00.000Z' })
const scoreProfileId = mergeEnvelope.backup.activeProfileId
mergeEnvelope.backup.profileData[scoreProfileId].scoreRecords = [makeExam('merge-score-101', 700)]
refreshChecksum(mergeBackup, mergeEnvelope)
for (let index = 0; index < PRODUCT_RULES.limits.maxExamRecordsPerProfile; index += 1) {
  assert.strictEqual(storage.saveScoreRecord(makeExam(`local-merge-score-${index}`, index % 741)).ok, true)
}
stateBeforeMerge = clone(storage.getVersionedState().state)
restorePointsBeforeMerge = clone(storage.listRestorePoints())
mergeOverflow = mergeBackup.importBackupEnvelope(mergeEnvelope.backup, { mode: 'merge' })
assert.strictEqual(mergeOverflow.ok, false)
assert.strictEqual(mergeOverflow.code, 'LIMIT_EXCEEDED')
assert.deepStrictEqual(storage.getVersionedState().state, stateBeforeMerge)
assert.deepStrictEqual(storage.listRestorePoints(), restorePointsBeforeMerge)

installWxStorage()
storage = loadStorageFresh()
assert.strictEqual(storage.ensureStorageMigrated().ok, true)
mergeBackup = require('../utils/backup-restore')
mergeEnvelope = mergeBackup.createBackupEnvelope({ exportedAt: '2026-08-08T00:00:00.000Z' })
const targetProfileId = mergeEnvelope.backup.activeProfileId
mergeEnvelope.backup.profileData[targetProfileId].targetRecords = [{
  id: 'merge-target-101',
  schoolId: schools[0].id,
  schoolName: schools[0].name,
  createdAt: '2026-08-08T00:00:00.000Z'
}]
refreshChecksum(mergeBackup, mergeEnvelope)
for (let index = 0; index < PRODUCT_RULES.limits.maxTargetRecordsPerProfile; index += 1) {
  assert.strictEqual(storage.saveTargetRecord({
    id: `local-merge-target-${index}`,
    schoolId: `legacy-school-${index}`,
    schoolName: `历史学校 ${index}`,
    createdAt: '2026-08-08T00:00:00.000Z'
  }).ok, true)
}
stateBeforeMerge = clone(storage.getVersionedState().state)
restorePointsBeforeMerge = clone(storage.listRestorePoints())
mergeOverflow = mergeBackup.importBackupEnvelope(mergeEnvelope.backup, { mode: 'merge' })
assert.strictEqual(mergeOverflow.ok, false)
assert.strictEqual(mergeOverflow.code, 'LIMIT_EXCEEDED')
assert.deepStrictEqual(storage.getVersionedState().state, stateBeforeMerge)
assert.deepStrictEqual(storage.listRestorePoints(), restorePointsBeforeMerge)
console.log('✓ 合并后第 11 档案、第 101 成绩、第 101 目标均前置拒绝，且不创建恢复点')

installWxStorage()
storage = loadStorageFresh()
assert.strictEqual(storage.ensureStorageMigrated().ok, true)
const fileBackup = require('../utils/backup-restore')
let statCalls = 0
let readCalls = 0
global.wx.getFileSystemManager = () => ({
  statSync() {
    statCalls += 1
    return { size: PRODUCT_RULES.limits.maxImportFileBytes + 1 }
  },
  readFileSync() {
    readCalls += 1
    throw new Error('超大文件不应被读取')
  }
})
const oversizedFile = fileBackup.readBackupFile('/tmp/oversized-backup.json')
assert.strictEqual(oversizedFile.ok, false)
assert.strictEqual(oversizedFile.code, 'FILE_TOO_LARGE')
assert.strictEqual(statCalls, 1)
assert.strictEqual(readCalls, 0)

const validContent = JSON.stringify(fileBackup.createBackupEnvelope({
  exportedAt: '2026-08-05T00:00:00.000Z'
}).backup)
global.wx.getFileSystemManager = () => ({
  statSync() {
    return { size: Buffer.byteLength(validContent, 'utf8') }
  },
  readFileSync() {
    readCalls += 1
    return validContent
  }
})
const validFile = fileBackup.readBackupFile('/tmp/valid-backup.json')
assert.strictEqual(validFile.ok, true)
assert.strictEqual(readCalls, 1)
console.log('✓ 4 MB 上限在 readFileSync 前检查；正常大小备份仍可读取校验')

console.log('DUAL-FINAL HARDENING VERIFY PASSED')
