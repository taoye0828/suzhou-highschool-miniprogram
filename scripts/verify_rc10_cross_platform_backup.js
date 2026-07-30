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
assert.strictEqual(flutterValidate.status, 0, flutterValidate.stderr)

console.log('RC10 CROSS PLATFORM BACKUP VERIFY PASSED (微信↔Flutter 双向解析)')
