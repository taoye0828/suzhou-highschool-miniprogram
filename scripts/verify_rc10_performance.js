const assert = require('assert')
const { performance } = require('perf_hooks')
const { sortScoreRecords, prepareScoreTrendData } = require('../utils/score-trend')
const {
  scenarioResults,
  lossReasonStatistics,
  goalProgress,
  targetGapTrajectory
} = require('../utils/rc10-features')
const { filterSchoolCatalog } = require('../utils/school')
const { mergeProfileData } = require('../utils/backup-restore')
const { schools } = require('../data/schools')
const { LOSS_REASON_TYPES } = require('../utils/rc9-models')
const { installWxStorage, loadStorageFresh } = require('./rc9_test_helpers')

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
assert.strictEqual(sortScoreRecords(records(100)).length, 100)
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

const profiles3x100 = Array.from(
  { length: 3 },
  (_, index) => records(100, `profile_${index}`)
).flat()
const profiles5x200 = Array.from(
  { length: 5 },
  (_, index) => records(200, `large_profile_${index}`)
).flat()
const startProfiles = performance.now()
for (var profileIndex = 0; profileIndex < 5; profileIndex += 1) {
  const profileId = `large_profile_${profileIndex}`
  const isolated = profiles5x200.filter((item) => item.profileId === profileId)
  assert.strictEqual(isolated.length, 200)
  assert.strictEqual(targetGapTrajectory(isolated, 650).points.length, 10)
}
assert.strictEqual(
  profiles3x100.filter((item) => item.profileId === 'profile_2').length,
  100
)
const profileDataMs = performance.now() - startProfiles

const stageGoals = Array.from({ length: 100 }, (_, index) => ({
  id: `goal_${index}`,
  title: `阶段目标 ${index}`,
  targetTotalScore: 600 + index % 100,
  status: ['not_started', 'in_progress', 'completed', 'paused'][index % 4],
  endDate: '2027-06-17'
}))
const learningTasks = Array.from({ length: 500 }, (_, index) => ({
  id: `task_${index}`,
  profileId: 'profile_default',
  title: `长学习任务 ${index} ${'练习并订正'.repeat(20)}`,
  stageGoalId: index % 5 === 0 ? '' : `goal_${index % 100}`,
  dueDate: '2027-06-17',
  status: ['not_started', 'in_progress', 'completed', 'paused'][index % 4],
  notes: '本地长备注'.repeat(100)
}))
const reviews = Array.from({ length: 100 }, (_, index) => ({
  id: `review_${index}`,
  examRecordId: `profile_default_${index}`,
  profileId: 'profile_default'
}))
const lossReasons = Array.from({ length: 500 }, (_, index) => ({
  id: `reason_${index}`,
  examRecordId: `profile_default_${index % 100}`,
  profileId: 'profile_default',
  subjectId: `subject_${index % 8}`,
  reasonType: LOSS_REASON_TYPES[index % LOSS_REASON_TYPES.length],
  detail: '本地失分说明'.repeat(80),
  updatedAt: new Date(2026, 0, index % 28 + 1, 8, index % 60).toISOString()
}))
const startGoals = performance.now()
const progress = goalProgress(stageGoals, learningTasks, records(100))
const statistics = lossReasonStatistics(lossReasons, records(100))
assert.strictEqual(progress.goals.length, 100)
assert.strictEqual(progress.completedCount, 125)
assert.strictEqual(progress.unlinkedTasks.length, 100)
assert.strictEqual(statistics.total, 500)
assert.strictEqual(reviews.length, 100)
const goalsMs = performance.now() - startGoals

const startFilters = performance.now()
for (var filterIndex = 0; filterIndex < 100; filterIndex += 1) {
  filterSchoolCatalog({
    keyword: filterIndex % 2 ? '中学' : '',
    districts: filterIndex % 3 ? [] : ['姑苏区'],
    currentScore: 620 + filterIndex % 30,
    referenceYears: filterIndex % 2 ? [2025] : [2026]
  })
}
const filtersMs = performance.now() - startFilters

const merged = mergeProfileData(
  {
    profileId: 'profile_default',
    scoreRecords: records(500),
    stageGoals,
    learningTasks,
    scoreReviews: reviews,
    scoreLossReasons: lossReasons,
    recentViewedSchoolIds: schools.slice(0, 20).map((item) => item.id)
  },
  {
    profileId: 'profile_default',
    scoreRecords: records(500).map((item) => ({
      ...item,
      updatedAt: '2026-12-31T00:00:00.000Z'
    })),
    stageGoals,
    learningTasks,
    scoreReviews: reviews,
    scoreLossReasons: lossReasons
  },
  'profile_default'
)
assert.strictEqual(merged.scoreRecords.length, 500)
assert.strictEqual(merged.learningTasks.length, 500)
assert.strictEqual(merged.recentViewedSchoolIds.length, 20)

installWxStorage()
const storage = loadStorageFresh()
assert.strictEqual(storage.ensureStorageMigrated().ok, true)
const profileIds = [storage.getActiveProfile().id]
for (var createIndex = 1; createIndex < 5; createIndex += 1) {
  const created = storage.createStudentProfile({ nickname: `性能档案 ${createIndex}` })
  assert.strictEqual(created.ok, true)
  profileIds.push(created.profile.id)
}
const startSwitch = performance.now()
for (var switchIndex = 0; switchIndex < 50; switchIndex += 1) {
  assert.strictEqual(
    storage.switchStudentProfile(profileIds[switchIndex % profileIds.length]).ok,
    true
  )
}
const switchMs = performance.now() - startSwitch

for (const duration of [
  sortMs,
  trendMs,
  scenarioMs,
  profileDataMs,
  goalsMs,
  filtersMs,
  switchMs
]) {
  assert.ok(duration < 1000)
}
console.log(
  'RC10 PERFORMANCE VERIFY PASSED ' +
  `sort100+500=${sortMs.toFixed(2)}ms ` +
  `trend500=${trendMs.toFixed(2)}ms ` +
  `scenarios=${scenarioMs.toFixed(2)}ms ` +
  `profiles3x100+5x200=${profileDataMs.toFixed(2)}ms ` +
  `goals100+tasks500+reviews100+reasons500=${goalsMs.toFixed(2)}ms ` +
  `filters100=${filtersMs.toFixed(2)}ms ` +
  `switchProfiles50=${switchMs.toFixed(2)}ms`
)
