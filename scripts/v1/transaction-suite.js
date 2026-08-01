const {
  assert,
  setup,
  makeExam,
  runTest
} = require('./test-helpers')

function run() {
  const results = []

  results.push(runTest('V1-TXN-001', () => {
    const { storage } = setup()
    const result = storage.atomicWrite({ test_key: 1 }, {
      operationType: 'v1_validate',
      operationId: 'v1-txn-validate',
      faultInjector: { operationType: 'v1_validate', failAtStage: 'validate', errorCode: 'VALIDATION_FAILED' }
    })
    assert.strictEqual(result.status, 'aborted')
    assert.strictEqual(result.committed, false)
    assert.strictEqual(result.recoveryRequired, false)
  }))

  results.push(runTest('V1-TXN-008', () => {
    const { storage, memoryStorage } = setup()
    const original = global.wx.setStorageSync
    let journalWrites = 0
    global.wx.setStorageSync = (key, value) => {
      if (key === storage.KEYS.transactionJournal) {
        journalWrites += 1
        if (journalWrites === 2) throw new Error('committed journal unavailable')
      }
      return original(key, value)
    }
    const result = storage.atomicWrite({ v1_committed_value: { value: 1 } }, {
      operationType: 'v1_committed_journal',
      operationId: 'v1-txn-committed-journal'
    })
    global.wx.setStorageSync = original
    assert.strictEqual(result.ok, true)
    assert.strictEqual(result.status, 'committed_with_warning')
    assert.strictEqual(result.committed, true)
    assert.deepStrictEqual(memoryStorage.memory.get('v1_committed_value'), { value: 1 })
  }))

  results.push(runTest('V1-TXN-010', () => {
    const { storage, memoryStorage } = setup()
    const original = global.wx.removeStorageSync
    global.wx.removeStorageSync = (key) => {
      if (key === storage.KEYS.transactionJournal) throw new Error('journal cleanup unavailable')
      return original(key)
    }
    const result = storage.atomicWrite({ v1_cleanup_value: 2 }, {
      operationType: 'v1_cleanup',
      operationId: 'v1-txn-cleanup'
    })
    global.wx.removeStorageSync = original
    assert.strictEqual(result.status, 'committed_with_warning')
    assert.strictEqual(result.committed, true)
    assert.strictEqual(memoryStorage.memory.get('v1_cleanup_value'), 2)
  }))

  results.push(runTest('V1-TXN-011', () => {
    const { storage, memoryStorage } = setup()
    storage.writeStorage('v1_remove_target', { before: true })
    const original = global.wx.removeStorageSync
    global.wx.removeStorageSync = (key) => {
      if (key === storage.KEYS.transactionJournal) throw new Error('journal cleanup unavailable')
      return original(key)
    }
    const result = storage.atomicRemove(['v1_remove_target'], { v1_remove_marker: true }, {
      operationType: 'v1_remove',
      operationId: 'v1-txn-remove'
    })
    global.wx.removeStorageSync = original
    assert.strictEqual(result.status, 'committed_with_warning')
    assert.strictEqual(memoryStorage.memory.has('v1_remove_target'), false)
    assert.strictEqual(memoryStorage.memory.get('v1_remove_marker'), true)
    assert.strictEqual(storage.recoverInterruptedTransaction().ok, true)
    assert.strictEqual(storage.recoverInterruptedTransaction().ok, true)
    assert.strictEqual(memoryStorage.memory.has('v1_remove_target'), false)
  }))

  results.push(runTest('V1-TXN-012', () => {
    const { storage } = setup()
    const before = storage.getDataRevision()
    const exam = makeExam('v1-revision-score', 650)
    const first = storage.saveScoreRecord(exam, { operationId: 'v1-revision-op' })
    const afterFirst = storage.getDataRevision()
    const second = storage.saveScoreRecord(exam, { operationId: 'v1-revision-op' })
    assert.strictEqual(first.ok, true)
    assert.strictEqual(second.idempotent, true)
    assert.strictEqual(afterFirst, before + 1)
    assert.strictEqual(storage.getDataRevision(), afterFirst)
  }))

  return results
}

module.exports = { run }

if (require.main === module) run()
