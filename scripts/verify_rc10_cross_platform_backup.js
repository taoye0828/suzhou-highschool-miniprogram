const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')
const { clone, installWxStorage, loadStorageFresh, makeExam } = require('./rc9_test_helpers')

installWxStorage()
const storage = loadStorageFresh()
storage.ensureStorageMigrated()
storage.saveScoreRecord(makeExam('exam', 620))
const backup = require('../utils/backup-restore')
const currentExport = backup.createBackupEnvelope({ exportedAt: '2026-09-01T00:00:00Z' }).backup
for (const key of [
  'backupFormatVersion', 'storageSchemaVersion', 'appDataVersion', 'exportedAt',
  'sourcePlatform', 'profiles', 'scoreRecords', 'scoreReviews', 'scoreLossReasons',
  'favorites', 'targetSchools', 'stageGoals', 'learningTasks',
  'recommendationSettings', 'onboardingState', 'recentHistory', 'userSettings', 'checksum'
]) assert.ok(Object.hasOwn(currentExport, key), `备份缺少 ${key}`)
assert.strictEqual(currentExport.backupFormatVersion, 3)
assert.strictEqual(backup.validateBackupEnvelope(currentExport).ok, true)
const payload = clone(backup.backupPayload(currentExport))
for (const profile of payload.profiles) {
  const data = payload.profileData[profile.id]
  for (const field of ['examTemplates', 'scoreSchemes', 'mistakeRecords', 'weeklyPlans', 'stageReviews', 'schoolUserStates', 'legacyExtensions']) {
    delete data[field]
  }
  for (const record of data.scoreRecords) {
    for (const field of [
      'examType', 'scoreSchemeId', 'scoreSchemeName', 'scoreSchemeSnapshot', 'totalMaxScore',
      'metricType', 'admissionScaleMax', 'eligibilityRuleId', 'scoreRateBasisPoints',
      'migrationSource', 'legacyExtensions'
    ]) delete record[field]
    record.schemaVersion = 4
  }
}
payload.scoreRecords = payload.profiles.flatMap((profile) => payload.profileData[profile.id].scoreRecords)
const exported = {
  ...clone(currentExport),
  ...payload,
  backupFormatVersion: 2,
  storageSchemaVersion: 4,
  appDataVersion: 'rc10',
  checksum: {
    algorithm: 'fnv1a32',
    value: backup.checksumForPayload(payload, 'fnv1a32')
  }
}
assert.strictEqual(backup.validateBackupEnvelope(exported).ok, true)
const damaged = clone(currentExport)
damaged.scoreRecords[0].totalScore = 741
assert.strictEqual(backup.validateBackupEnvelope(damaged).ok, false)

const flutterRoot = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', 'suzhou_highschool_app'))
const flutterTool = path.join(flutterRoot, 'tool', 'rc10_backup_interop.dart')
assert.ok(fs.existsSync(flutterTool), `Flutter 互解析工具不存在：${flutterTool}`)
const bridgePath = path.join(os.tmpdir(), `suzhou_rc10_backup_interop_${process.pid}.json`)

const flutterExport = spawnSync(
  'flutter',
  [
    'test',
    'tool/rc10_backup_interop.dart',
    '--reporter=compact',
    '--dart-define=RC10_INTEROP_MODE=emit',
    `--dart-define=RC10_INTEROP_PATH=${bridgePath}`
  ],
  { cwd: flutterRoot, encoding: 'utf8' }
)
assert.strictEqual(flutterExport.status, 0, flutterExport.stderr)
const flutterEnvelope = JSON.parse(fs.readFileSync(bridgePath, 'utf8'))
assert.strictEqual(flutterEnvelope.sourcePlatform, 'flutter')
assert.strictEqual(backup.validateBackupEnvelope(flutterEnvelope).ok, true)

fs.writeFileSync(bridgePath, JSON.stringify(exported))
const flutterValidate = spawnSync(
  'flutter',
  [
    'test',
    'tool/rc10_backup_interop.dart',
    '--reporter=compact',
    '--dart-define=RC10_INTEROP_MODE=validate',
    `--dart-define=RC10_INTEROP_PATH=${bridgePath}`
  ],
  { cwd: flutterRoot, encoding: 'utf8' }
)
assert.strictEqual(flutterValidate.status, 0, `${flutterValidate.stderr}\n${flutterValidate.stdout}`)

console.log('RC10 CROSS PLATFORM BACKUP COMPATIBILITY VERIFY PASSED (仅验证既有 Backup v2 互解析；未修改 Flutter)')
