const assert = require('assert')
const {
  normalizeSubjectConfig,
  normalizeExamRecord
} = require('../utils/rc9-models')
const {
  collectSubjectSeries,
  analyzeSubjects
} = require('../utils/subject-analysis')

assert.strictEqual(normalizeSubjectConfig({}), null)
const math = normalizeSubjectConfig({
  subjectId: 'math',
  subjectName: '用户自定义科目',
  maxScore: 150,
  includedInTotal: true,
  displayOrder: 1,
  configVersion: 1
})
assert.strictEqual(math.maxScore, 150)
assert.strictEqual(normalizeSubjectConfig({ subjectName: '无效', maxScore: 0 }), null)

const base = {
  id: 'subject_exam',
  examName: '学科考试',
  examDate: '2026-09-01',
  totalScore: 650,
  createdAt: '2026-09-01T08:00:00.000Z'
}
assert.ok(normalizeExamRecord(base))
assert.ok(normalizeExamRecord({
  ...base,
  id: 'partial',
  subjectScores: [{ ...math, score: 120 }]
}))
assert.ok(normalizeExamRecord({ ...base, id: 'empty', subjectScores: [] }))
assert.deepStrictEqual(
  normalizeExamRecord({
    ...base,
    id: 'over-subject',
    subjectScores: [{ ...math, score: 151 }]
  }).subjectScores,
  []
)
for (const totalScore of [-1, 741, 650.5, 'abc']) {
  assert.strictEqual(normalizeExamRecord({ ...base, id: String(totalScore), totalScore }), null)
}

const records = [100, 110, 120, 130].map((score, index) => normalizeExamRecord({
  ...base,
  id: `trend_${index}`,
  examDate: `2026-09-0${index + 1}`,
  createdAt: `2026-09-0${index + 1}T08:00:00.000Z`,
  totalScore: 600 + index,
  subjectScores: [{ ...math, score }]
}))
const series = collectSubjectSeries(records).find((item) => item.subjectId === 'math').points
assert.strictEqual(series.length, 4)
assert.deepStrictEqual(series.map((item) => item.score), [100, 110, 120, 130])
const analysis = analyzeSubjects(records, [math])
assert.ok(analysis.subjects.some((item) => item.subjectId === 'math'))
assert.ok(
  analysis.subjects[0].conclusions.some((item) => item.code === 'recent_three_rising')
)

console.log('RC9 SUBJECT SCORES VERIFY PASSED')
console.log('- 可配置科目、空/部分学科、满分边界、最近趋势与确定性结论通过')
