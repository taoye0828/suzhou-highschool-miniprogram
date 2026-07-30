const assert = require('assert')
const { clone, installWxStorage, loadStorageFresh, makeExam } = require('./rc9_test_helpers')

const memory = installWxStorage().memory
const storage = loadStorageFresh()
assert.strictEqual(storage.ensureStorageMigrated().ok, true)
assert.strictEqual(storage.saveScoreRecord(makeExam('before', 620)).ok, true)
const before = clone(storage.getVersionedState().state)
const originalWrite = global.wx.setStorageSync
let failed = false
global.wx.setStorageSync = (key, value) => {
  if (!failed && key === storage.KEYS.profileData) {
    failed = true
    throw new Error('simulated low storage')
  }
  return originalWrite(key, value)
}
const result = storage.saveScoreRecord(makeExam('should_not_persist', 630))
assert.strictEqual(result.ok, false)
assert.ok(result.message.includes('原数据已保留'))
assert.deepStrictEqual(storage.getVersionedState().state, before)
assert.strictEqual(memory.has(storage.KEYS.transactionJournal), false)
const priorProfiles = memory.get(storage.KEYS.profiles)
memory.set(storage.KEYS.transactionJournal, {
  transactionId: 'interrupted',
  keys: [storage.KEYS.profiles],
  before: { [storage.KEYS.profiles]: priorProfiles }
})
memory.set(storage.KEYS.profiles, [])
assert.strictEqual(storage.ensureStorageMigrated().ok, true)
assert.deepStrictEqual(memory.get(storage.KEYS.profiles), priorProfiles)
assert.strictEqual(memory.has(storage.KEYS.transactionJournal), false)
console.log('RC10 TRANSACTIONAL STORAGE VERIFY PASSED')
