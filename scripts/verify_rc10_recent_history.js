const assert = require('assert')
const { installWxStorage, loadStorageFresh } = require('./rc9_test_helpers')

installWxStorage()
const storage = loadStorageFresh()
storage.ensureStorageMigrated()
for (let index = 0; index < 25; index += 1) {
  storage.recordRecentHistory('viewedSchools', { id: `school_${index}`, schoolId: `school_${index}` })
}
for (let index = 0; index < 12; index += 1) {
  storage.recordRecentHistory('schoolFilters', { id: `filter_${index}`, filters: { index } })
}
assert.strictEqual(storage.getRecentHistory().viewedSchools.length, 20)
assert.strictEqual(storage.getRecentHistory().schoolFilters.length, 10)
assert.strictEqual(storage.clearRecentHistory('schoolFilters').ok, true)
assert.strictEqual(storage.getRecentHistory().schoolFilters.length, 0)
assert.strictEqual(storage.getRecentHistory().viewedSchools.length, 20)
console.log('RC10 RECENT HISTORY VERIFY PASSED')
