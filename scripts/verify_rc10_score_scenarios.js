const assert = require('assert')
const { scenarioResults, validScenarioScore } = require('../utils/rc10-features')

assert.strictEqual(validScenarioScore(0), 0)
assert.strictEqual(validScenarioScore(740), 740)
assert.throws(() => validScenarioScore(-1))
assert.throws(() => validScenarioScore(741))
assert.throws(() => validScenarioScore(620.5))
const scores = [
  { id: 'a', schoolId: 'a', year: 2026, minScore: 650 },
  { id: 'b', schoolId: 'b', year: 2026, minScore: 620 },
  { id: 'c', schoolId: 'c', year: 2026, minScore: 600 }
]
const schools = [
  { id: 'a', name: 'A', district: '一区', schoolType: '普通高中' },
  { id: 'b', name: 'B', district: '一区', schoolType: '普通高中' },
  { id: 'c', name: 'C', district: '一区', schoolType: '普通高中' }
]
const scenarios = scenarioResults({
  currentScore: 620,
  stageTargetScore: 635,
  finalTargetScore: 660,
  targetYear: 2027,
  districts: [],
  schoolTypes: [],
  referenceYears: []
}, { schools, scores, limitPerLevel: 10 })
assert.deepStrictEqual(scenarios.map((item) => item.key), ['current', 'stage', 'final'])
assert.strictEqual(scenarios[0].results.find((item) => item.schoolId === 'a').level, 'sprint')
assert.strictEqual(scenarios[1].improvementFromCurrent, 15)
assert.strictEqual(scenarios[2].improvementFromCurrent, 40)
console.log('RC10 SCORE SCENARIOS VERIFY PASSED')
