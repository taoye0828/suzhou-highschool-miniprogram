const assert = require('assert')
const { performance } = require('perf_hooks')
const { sortScoreRecords, prepareScoreTrendData } = require('../utils/score-trend')
const { scenarioResults } = require('../utils/rc10-features')
const { schools } = require('../data/schools')

function records(count, profileId = 'profile_default') {
  return Array.from({ length: count }, (_, index) => ({
    id: `${profileId}_${index}`,
    examName: `长考试名称 ${index} `.repeat(4),
    examDate: `2026-${String(index % 12 + 1).padStart(2, '0')}-${String(index % 28 + 1).padStart(2, '0')}`,
    createdAt: new Date(2026, index % 12, index % 28 + 1, 8, index % 60).toISOString(),
    score: index % 741,
    totalScore: index % 741,
    profileId
  }))
}

const startSort = performance.now()
assert.strictEqual(sortScoreRecords(records(500)).length, 500)
const sortMs = performance.now() - startSort
const startTrend = performance.now()
assert.strictEqual(prepareScoreTrendData(records(500)).visibleRecords.length, 10)
const trendMs = performance.now() - startTrend
const startScenario = performance.now()
scenarioResults({
  currentScore: 620,
  stageTargetScore: 650,
  finalTargetScore: 680,
  targetYear: 2027,
  districts: [],
  schoolTypes: [],
  referenceYears: []
}, { schools, limitPerLevel: 10 })
const scenarioMs = performance.now() - startScenario
assert.ok(sortMs < 1000 && trendMs < 1000 && scenarioMs < 1000)
console.log(`RC10 PERFORMANCE VERIFY PASSED sort500=${sortMs.toFixed(2)}ms trend500=${trendMs.toFixed(2)}ms scenarios=${scenarioMs.toFixed(2)}ms`)
