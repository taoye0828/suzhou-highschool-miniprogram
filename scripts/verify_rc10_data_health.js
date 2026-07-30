const assert = require('assert')
const { installWxStorage, loadStorageFresh } = require('./rc9_test_helpers')

const installed = installWxStorage()
const storage = loadStorageFresh()
storage.ensureStorageMigrated()
const state = storage.getVersionedState().state
const data = state.profileData.profile_default
data.favoriteSchoolIds = ['suzhou_high_school', 'suzhou_high_school']
data.recentViewedSchoolIds = ['missing_school']
installed.memory.set(storage.KEYS.profileData, data ? { profile_default: data } : {})
installed.memory.set(storage.KEYS.transactionJournal, { status: 'writing' })
delete require.cache[require.resolve('../utils/data-health')]
const health = require('../utils/data-health')
const before = health.scanLocalData()
assert.ok(before.issues.some((item) => item.type === 'duplicate_favorite'))
assert.ok(before.issues.some((item) => item.type === 'transaction_temp_residue'))
const repaired = health.repairSafeIssues()
assert.strictEqual(repaired.ok, true)
assert.ok(repaired.after.total < before.total)
assert.ok(installed.memory.has(storage.KEYS.repairSnapshot))
console.log('RC10 DATA HEALTH VERIFY PASSED')
