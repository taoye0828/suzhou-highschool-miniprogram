const assert = require('assert')
const {
  installWxStorage,
  loadStorageFresh,
  makeExam,
  clone
} = require('../rc9_test_helpers')

function setup(initial = {}, options = {}) {
  const memoryStorage = installWxStorage(initial, options)
  const storage = loadStorageFresh()
  assert.strictEqual(storage.ensureStorageMigrated().ok, true)
  return { storage, memoryStorage }
}

function byteLength(value) {
  return unescape(encodeURIComponent(JSON.stringify(value))).length
}

function runTest(id, test) {
  const startedAt = Date.now()
  try {
    test()
    console.log(`${id} PASS ${Date.now() - startedAt}ms`)
    return { id, status: 'PASS', durationMs: Date.now() - startedAt }
  } catch (error) {
    console.error(`${id} FAIL ${Date.now() - startedAt}ms ${error.message}`)
    throw error
  }
}

module.exports = {
  assert,
  setup,
  makeExam,
  clone,
  byteLength,
  runTest
}
