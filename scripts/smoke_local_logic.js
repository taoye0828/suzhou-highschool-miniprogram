const assert = require('assert')
const { APP_CONFIG } = require('../config/app-config')

const originalConsoleError = console.error
const expectedErrorLogs = []
console.error = (...values) => expectedErrorLogs.push(values.join(' '))

const memory = new Map()
let readFailure = false
let writeFailure = false
let removeFailure = false
global.wx = {
  getStorageSync: (key) => {
    if (readFailure) throw new Error('simulated read failure')
    return memory.get(key)
  },
  setStorageSync: (key, value) => {
    if (writeFailure) throw new Error('simulated quota failure')
    memory.set(key, value)
  },
  removeStorageSync: (key) => {
    if (removeFailure) throw new Error('simulated remove failure')
    memory.delete(key)
  }
}

const storage = require('../utils/storage')
const school = require('../utils/school')

function target(id, createdAt = '2026-07-02T00:00:00.000Z') {
  return { id, currentScore: 500, targetScore: 550, note: '复盘数学', createdAt }
}

assert.strictEqual(storage.getFavoriteIds().length, 0)
assert.strictEqual(storage.setFavorite('demo_001', true).ok, true)
assert.strictEqual(storage.isFavorite('demo_001'), true)
assert.strictEqual(storage.setFavorite('demo_001', false).ok, true)
assert.strictEqual(storage.isFavorite('demo_001'), false)
assert.strictEqual(storage.setFavorite('', true).ok, false)

assert.strictEqual(storage.saveTargetRecord(target('target_1')).ok, true)
assert.strictEqual(storage.saveTargetRecord(target('target_2', '2026-07-02T01:00:00.000Z')).ok, true)
assert.deepStrictEqual(storage.getTargetRecords().map((item) => item.id), ['target_2', 'target_1'])
assert.strictEqual(storage.deleteTargetRecord('target_1').ok, true)
assert.deepStrictEqual(storage.getTargetRecords().map((item) => item.id), ['target_2'])

memory.set(storage.KEYS.targets, [
  {},
  { id: 'broken', currentScore: 500, targetScore: 550, createdAt: 123 },
  { id: 'empty-score', currentScore: '', targetScore: '', createdAt: '2026-07-02T00:00:00.000Z' },
  target('valid')
])
assert.deepStrictEqual(storage.getTargetRecords().map((item) => item.id), ['valid'])

memory.set(storage.KEYS.targets, Array.from({ length: 120 }, (_, index) => target(`record_${index}`, new Date(2026, 6, 2, 0, index).toISOString())))
assert.strictEqual(storage.getTargetRecords().length, APP_CONFIG.targetScore.maxRecords)

writeFailure = true
assert.strictEqual(storage.saveTargetRecord(target('quota_failure')).ok, false)
assert.strictEqual(storage.saveTargetDraft({ currentScore: '500' }).ok, false)
writeFailure = false

readFailure = true
const recordsBeforeReadFailure = memory.get(storage.KEYS.targets)
assert.strictEqual(storage.getTargetRecordsResult().ok, false)
assert.deepStrictEqual(storage.getTargetRecords(), [])
assert.strictEqual(storage.saveTargetRecord(target('must_not_overwrite')).ok, false)
assert.strictEqual(memory.get(storage.KEYS.targets), recordsBeforeReadFailure)
assert.strictEqual(storage.getFavoriteIdsResult().ok, false)
assert.deepStrictEqual(storage.getFavoriteIds(), [])
assert.strictEqual(storage.setFavorite('demo_001', true).ok, false)
readFailure = false

assert.strictEqual(storage.saveTargetDraft({ currentScore: '500', targetScore: '550', note: '复盘数学' }).ok, true)
assert.strictEqual(storage.getTargetDraft().targetScore, '550')
memory.set(storage.KEYS.targetDraft, [])
assert.deepStrictEqual(storage.getTargetDraft(), {})

removeFailure = true
assert.strictEqual(storage.clearLocalDemoData().ok, false)
removeFailure = false
assert.strictEqual(storage.clearLocalDemoData().ok, true)
assert.strictEqual(storage.getFavoriteIds().length, 0)
assert.strictEqual(storage.getTargetRecords().length, 0)
assert.deepStrictEqual(storage.getTargetDraft(), {})

assert.ok(school.filterSchools({ keyword: '示例高中 A' }).some((item) => item.id === 'demo_001'))
assert.ok(school.filterSchools({ district: '吴江区' }).every((item) => item.district === '吴江区'))
assert.ok(school.filterSchools({ schoolType: '公办（示例）' }).every((item) => item.schoolType === '公办（示例）'))
assert.ok(school.filterSchools({ boardingType: '走读（示例）' }).every((item) => item.boardingType === '走读（示例）'))

assert.ok(expectedErrorLogs.length >= 7)
console.error = originalConsoleError
console.log('MP1 LOCAL LOGIC SMOKE PASSED')
