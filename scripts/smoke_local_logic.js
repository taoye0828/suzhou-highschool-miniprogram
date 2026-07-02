const assert = require('assert')

const memory = new Map()
global.wx = {
  getStorageSync: (key) => memory.get(key),
  setStorageSync: (key, value) => memory.set(key, value),
  removeStorageSync: (key) => memory.delete(key)
}

const storage = require('../utils/storage')
const school = require('../utils/school')

assert.strictEqual(storage.getFavoriteIds().length, 0)
storage.setFavorite('demo_001', true)
assert.strictEqual(storage.isFavorite('demo_001'), true)
storage.setFavorite('demo_001', false)
assert.strictEqual(storage.isFavorite('demo_001'), false)

storage.saveTargetRecord({ id: 'target_1', createdAt: '2026-07-02T00:00:00.000Z' })
storage.saveTargetRecord({ id: 'target_2', createdAt: '2026-07-02T01:00:00.000Z' })
assert.deepStrictEqual(storage.getTargetRecords().map((item) => item.id), ['target_2', 'target_1'])
storage.deleteTargetRecord('target_1')
assert.deepStrictEqual(storage.getTargetRecords().map((item) => item.id), ['target_2'])

storage.saveTargetDraft({ currentScore: '500', targetScore: '550', note: '复盘数学' })
assert.strictEqual(storage.getTargetDraft().targetScore, '550')

assert.ok(school.filterSchools({ keyword: '示例高中 A' }).some((item) => item.id === 'demo_001'))
assert.ok(school.filterSchools({ district: '吴江区' }).every((item) => item.district === '吴江区'))
assert.ok(school.filterSchools({ schoolType: '公办示例' }).every((item) => item.schoolType === '公办示例'))
assert.ok(school.filterSchools({ boardingType: '走读示例' }).every((item) => item.boardingType === '走读示例'))

storage.clearLocalDemoData()
assert.strictEqual(storage.getFavoriteIds().length, 0)
assert.strictEqual(storage.getTargetRecords().length, 0)
assert.deepStrictEqual(storage.getTargetDraft(), {})

console.log('MP1 LOCAL LOGIC SMOKE PASSED')
