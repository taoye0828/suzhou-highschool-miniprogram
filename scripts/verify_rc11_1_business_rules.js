const assert = require('assert')
const { admissionScores } = require('../data/admission-scores')
const {
  classifyDifference,
  calculateDifference,
  selectReferenceForSchool,
  sortScoreRecords
} = require('../utils/planning')
const { prepareScoreTrendData } = require('../utils/score-trend')

assert.strictEqual(classifyDifference(-30), 'sprint')
assert.strictEqual(classifyDifference(-1), 'sprint')
assert.strictEqual(classifyDifference(0), 'target')
assert.strictEqual(classifyDifference(15), 'target')
assert.strictEqual(classifyDifference(16), 'safe')
assert.strictEqual(calculateDifference(650, 660), -10)
const ref = selectReferenceForSchool('suzhou_high_school', 2027, admissionScores)
assert.strictEqual(ref.year, 2026)
assert.ok(selectReferenceForSchool('suzhou_high_school', 2025, admissionScores).year <= 2025)
const records = Array.from({ length: 11 }, (_, index) => ({
  id: `r-${String(index).padStart(2, '0')}`,
  examName: `考试${index}`,
  examDate: `2026-10-${String(index + 1).padStart(2, '0')}`,
  createdAt: `2026-10-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`,
  totalScore: 600 + index
})).reverse()
assert.strictEqual(sortScoreRecords(records)[0].id, 'r-00')
const trend = prepareScoreTrendData(records, { width: 390, height: 280, padding: 38 })
assert.strictEqual(trend.visibleRecords.length, 10)
assert.deepStrictEqual(trend.visibleTrendPoints.map((item) => item.x).slice(0, 2), [38, 72.88888888888889])
assert.strictEqual(prepareScoreTrendData(records.slice(0, 1), { width: 390 }).visibleTrendPoints[0].x, 195)
assert.ok(records.every((record) => record.totalScore <= 740))

console.log('RC11-1 BUSINESS RULES PASSED')
