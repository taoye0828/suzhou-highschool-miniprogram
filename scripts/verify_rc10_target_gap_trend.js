const assert = require('assert')
const { targetGapTrajectory } = require('../utils/rc10-features')
const { calculateChartPoints } = require('../utils/score-trend')
const { makeExam } = require('./rc9_test_helpers')

const scores = [620, 635, 650, 660].map((score, index) =>
  makeExam(`e${index}`, score, `2026-0${index + 1}-01`, { createdAt: `2026-0${index + 1}-01T08:00:00Z` })
)
const trend = targetGapTrajectory(scores, 655)
assert.deepStrictEqual(trend.points.map((item) => item.difference), [-35, -20, -5, 5])
const points = calculateChartPoints(trend.points, 390, 280, 38)
assert.deepStrictEqual(points.map((item) => item.x), trend.points.map((item, index) => index === 0 ? 38 : 38 + (390 - 76) * index / 3))
assert.strictEqual(calculateChartPoints([scores[0]], 390, 280, 38)[0].x, 195)
console.log('RC10 TARGET GAP TREND VERIFY PASSED')
