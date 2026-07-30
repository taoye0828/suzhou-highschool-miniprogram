const assert = require('assert')
const {
  installWxStorage,
  loadStorageFresh,
  makeExam,
  read
} = require('./rc9_test_helpers')

installWxStorage()
const storage = loadStorageFresh()
assert.strictEqual(storage.ensureStorageMigrated().ok, true)
const original = makeExam('review_1', 650, '2026-09-01', {
  classRank: 8,
  gradeRank: 36,
  improvementNotes: '复习计划执行较好',
  lossNotes: '审题不够仔细',
  nextActions: '整理错题',
  notes: '本机备注',
  unknownField: 'preserve-me'
})
assert.strictEqual(storage.saveScoreRecord(original).ok, true)
let saved = storage.getScoreRecords()[0]
assert.strictEqual(saved.classRank, 8)
assert.strictEqual(saved.gradeRank, 36)
assert.strictEqual(saved.lossNotes, '审题不够仔细')

assert.strictEqual(storage.saveScoreRecord({
  ...saved,
  totalScore: 660,
  lossNotes: '已完成错题分类'
}).ok, true)
saved = storage.getScoreRecords()[0]
assert.strictEqual(saved.totalScore, 660)
assert.strictEqual(saved.unknownField, 'preserve-me')
assert.strictEqual(saved.lossNotes, '已完成错题分类')

assert.strictEqual(storage.saveScoreRecord({ ...original, id: 'bad-rank', classRank: -1 }).ok, true)
assert.strictEqual(storage.getScoreRecords().find((item) => item.id === 'bad-rank').classRank, null)

const pageText = `${read('pages/score-trend/score-trend.js')}\n${read('pages/score-trend/score-trend.wxml')}`
for (const marker of [
  'improvementNotes',
  'lossNotes',
  'nextActions',
  'classRank',
  'gradeRank',
  'copy'
]) {
  assert.ok(pageText.toLowerCase().includes(marker.toLowerCase()), `成绩中心缺少 ${marker}`)
}

console.log('RC9 EXAM REVIEW VERIFY PASSED')
console.log('- 复盘字段、可选排名、编辑保留未知字段与复制入口通过')
