const assert = require('assert')
const {
  installWxStorage,
  loadStorageFresh,
  makeExam,
  read
} = require('./rc9_test_helpers')
const {
  prepareScoreTrendData,
  summarizeScoreRecords
} = require('../utils/score-trend')
const {
  sortScoreRecords,
  selectLatestScoreRecord
} = require('../utils/planning')

installWxStorage()
const storage = loadStorageFresh()
assert.strictEqual(storage.ensureStorageMigrated().ok, true)

const sameDate = [
  makeExam('c', 630, '2026-09-01', { createdAt: '2026-09-01T09:00:00.000Z' }),
  makeExam('b', 620, '2026-09-01', { createdAt: '2026-09-01T08:00:00.000Z' }),
  makeExam('a', 610, '2026-09-01', { createdAt: '2026-09-01T08:00:00.000Z' })
]
for (const record of sameDate) assert.strictEqual(storage.saveScoreRecord(record).ok, true)
assert.deepStrictEqual(storage.getScoreRecords().map((item) => item.id), ['a', 'b', 'c'])
assert.strictEqual(selectLatestScoreRecord(storage.getScoreRecords()).id, 'c')

const recordB = storage.getScoreRecords().find((item) => item.id === 'b')
assert.strictEqual(storage.saveScoreRecord({
  ...recordB,
  totalScore: 625,
  notes: '编辑后保留'
}).ok, true)
assert.strictEqual(storage.getScoreRecords().find((item) => item.id === 'b').totalScore, 625)
assert.strictEqual(storage.deleteScoreRecord('a').ok, true)
assert.deepStrictEqual(storage.getScoreRecords().map((item) => item.id), ['b', 'c'])
assert.strictEqual(storage.saveScoreRecord(makeExam('max', 740, '2026-09-02')).ok, true)
assert.strictEqual(storage.saveScoreRecord(makeExam('over', 741, '2026-09-03')).ok, false)
assert.strictEqual(storage.saveScoreRecord(makeExam('negative', -1, '2026-09-03')).ok, false)

function records(count) {
  return Array.from({ length: count }, (_, index) => makeExam(
    `point_${index}`,
    600 + index,
    `2026-10-${String(index + 1).padStart(2, '0')}`
  ))
}
for (const width of [320, 375, 390, 414, 430]) {
  for (const count of [0, 1, 2, 3, 5, 9, 10, 11]) {
    const prepared = prepareScoreTrendData(records(count), {
      width,
      height: 280,
      padding: 38
    })
    assert.strictEqual(prepared.visibleRecords.length, Math.min(count, 10))
    assert.strictEqual(prepared.visibleTrendPoints.length, Math.min(count, 10))
    if (count === 1) assert.strictEqual(prepared.visibleTrendPoints[0].x, width / 2)
    if (count >= 2) {
      assert.strictEqual(prepared.visibleTrendPoints[0].x, 38)
      assert.strictEqual(prepared.visibleTrendPoints.at(-1).x, width - 38)
    }
  }
}
const summary = summarizeScoreRecords([
  makeExam('first', 620, '2026-09-01'),
  makeExam('second', 650, '2026-09-02')
])
assert.strictEqual(summary.highest, 650)
assert.strictEqual(summary.lowest, 620)
assert.strictEqual(summary.average, 635)
assert.strictEqual(summary.change, 30)
assert.deepStrictEqual(
  sortScoreRecords(sameDate).map((item) => item.id),
  ['a', 'b', 'c']
)

const pageText = `${read('pages/score-trend/score-trend.js')}\n${read('pages/score-trend/score-trend.wxml')}`
for (const marker of [
  '记录',
  '趋势',
  '复盘',
  'saveRecord',
  'editRecord',
  'deleteRecord',
  'copyRecordTemplate',
  'recordKeyword',
  'recordDateFilter',
  'filteredRecords',
  'visibleTrendPoints',
  'subjectConclusions',
  'reviewOptions',
  'onShow'
]) {
  assert.ok(pageText.includes(marker), `成绩中心缺少 ${marker}`)
}
assert.strictEqual(pageText.includes('width: 10%'), false)
assert.strictEqual(pageText.includes('index / 10'), false)

assert.strictEqual(storage.clearScoreRecords().ok, true)
assert.deepStrictEqual(storage.getScoreRecords(), [])

console.log('RC9 SCORE CENTER VERIFY PASSED')
console.log('- 新增/编辑/删除/清空、稳定排序、搜索日期入口、0/1/2/3/5/9/10/11 趋势与统计通过')
