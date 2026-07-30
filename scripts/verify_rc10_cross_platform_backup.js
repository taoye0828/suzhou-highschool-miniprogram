const assert = require('assert')
const { clone, installWxStorage, loadStorageFresh, makeExam } = require('./rc9_test_helpers')

installWxStorage()
const storage = loadStorageFresh()
storage.ensureStorageMigrated()
storage.saveScoreRecord(makeExam('exam', 620))
const backup = require('../utils/backup-restore')
const exported = backup.createBackupEnvelope({ exportedAt: '2026-09-01T00:00:00Z' }).backup
for (const key of [
  'backupFormatVersion', 'storageSchemaVersion', 'appDataVersion', 'exportedAt',
  'sourcePlatform', 'profiles', 'scoreRecords', 'scoreReviews', 'scoreLossReasons',
  'favorites', 'targetSchools', 'stageGoals', 'learningTasks',
  'recommendationSettings', 'onboardingState', 'recentHistory', 'userSettings', 'checksum'
]) assert.ok(Object.hasOwn(exported, key), `备份缺少 ${key}`)
assert.strictEqual(exported.backupFormatVersion, 2)
assert.strictEqual(backup.validateBackupEnvelope(exported).ok, true)
const damaged = clone(exported)
damaged.scoreRecords[0].totalScore = 741
assert.strictEqual(backup.validateBackupEnvelope(damaged).ok, false)
console.log('RC10 CROSS PLATFORM BACKUP VERIFY PASSED')
