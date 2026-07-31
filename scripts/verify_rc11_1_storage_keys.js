const assert = require('assert')
const fs = require('fs')
const path = require('path')
const { walk, installWxStorage, loadStorageFresh, makeExam } = require('./rc9_test_helpers')

const root = path.resolve(__dirname, '..')
const runtimeFiles = ['app.js', 'pages', 'components', 'utils']
  .flatMap(walk)
  .filter((file) => file.endsWith('.js'))
const legacyKeyPattern = /mp1\.|rc8\.learning_target_records\.v1|rc8\.onboarding\.v1/g
const allowedLegacyFile = path.join(root, 'utils/legacy/migration/storage-keys.js')
for (const file of runtimeFiles) {
  const source = fs.readFileSync(file, 'utf8')
  if (file !== allowedLegacyFile) {
    assert.strictEqual(legacyKeyPattern.test(source), false, `legacy key leaked into ${file}`)
    legacyKeyPattern.lastIndex = 0
  }
  if (!file.endsWith('utils/rc9-storage.js')) {
    assert.strictEqual(/wx\.(?:set|get|remove|clear)Storage(?:Sync)?\s*\(/.test(source), false, `direct storage in ${file}`)
  }
}

const harness = installWxStorage({
  'mp1.score_records': [makeExam('legacy-never-revive', 600)]
})
const storage = loadStorageFresh()
assert.strictEqual(storage.ensureStorageMigrated().ok, true)
assert.strictEqual(storage.clearLocalData().ok, true)
assert.deepStrictEqual(storage.getScoreRecords(), [])
assert.strictEqual(harness.memory.has('mp1.score_records'), false)
const snapshot = storage.storageSnapshot().values
assert.strictEqual(snapshot[storage.KEYS.transactionJournal], undefined)
assert.strictEqual(snapshot[storage.KEYS.importSnapshot], undefined)

console.log('RC11-1 STORAGE KEYS PASSED (legacy migration-only, clear no revival)')
