const { performance } = require('perf_hooks')
const { assert, setup, runTest, byteLength } = require('./test-helpers')
const { PRODUCT_RULES } = require('../../utils/generated/product-rules')
const { globalSearchCurrentProfile } = require('../../utils/school-planning')
const { createReportSnapshot, reportToText, reportToJson } = require('../../utils/report-export')
const { checksumFor } = require('../../utils/checksum')
const { schools } = require('../../data/schools')

const NOW = '2026-08-01T08:00:00.000Z'

function measure(action, runs = 7) {
  const durations = []
  for (let index = 0; index < runs; index += 1) {
    const started = performance.now()
    action()
    durations.push(performance.now() - started)
  }
  const sorted = durations.slice().sort((left, right) => left - right)
  return {
    median: sorted[Math.floor(sorted.length / 2)],
    max: Math.max(...durations),
    durations
  }
}

function assertBudget(name, metrics, medianBudget, maxBudget) {
  console.log(`${name} median=${metrics.median.toFixed(2)}ms max=${metrics.max.toFixed(2)}ms`)
  assert.ok(metrics.median <= medianBudget, `${name} median ${metrics.median} > ${medianBudget}`)
  assert.ok(metrics.max <= maxBudget, `${name} max ${metrics.max} > ${maxBudget}`)
}

function maxProfileData(profileId = 'profile_default') {
  const snapshot = {
    ...PRODUCT_RULES.builtInScoreSchemes[0],
    version: 1,
    schemaVersion: 5
  }
  const common = { profileId, createdAt: NOW, updatedAt: NOW, version: 1, schemaVersion: 5 }
  const scoreRecords = Array.from({ length: PRODUCT_RULES.limits.maxExamRecordsPerProfile }, (_, index) => ({
    id: `exam-${index}`, examName: `考试 ${index}`, examDate: '2026-08-01', date: '2026-08-01',
    totalScore: 650, score: 650, totalMaxScore: 740, examType: 'monthly_exam',
    scoreSchemeId: snapshot.id, scoreSchemeName: snapshot.name, scoreSchemeSnapshot: snapshot,
    metricType: 'full_total', admissionScaleMax: 740, eligibilityRuleId: snapshot.eligibilityRuleId,
    scoreRateBasisPoints: 8784, subjectScores: [], ...common
  }))
  const stageGoals = Array.from({ length: PRODUCT_RULES.limits.maxStageGoalsPerProfile }, (_, index) => ({
    id: `goal-${index}`, title: `阶段目标 ${index}`, metricType: 'total_score', targetValue: 660,
    targetTotalScore: 660, targetSubjects: [], weeklyTasks: [], status: 'in_progress', notes: '', ...common
  }))
  const learningTasks = Array.from({ length: PRODUCT_RULES.limits.maxLearningTasksPerProfile }, (_, index) => ({
    id: `task-${index}`, title: `学习任务 ${index}`, status: 'not_started', notes: '', ...common
  }))
  const mistakeRecords = Array.from({ length: PRODUCT_RULES.limits.maxMistakeRecordsPerProfile }, (_, index) => ({
    id: `mistake-${index}`, linkedTaskIds: [], tags: [], notes: '', ...common
  }))
  const weeklyPlans = Array.from({ length: PRODUCT_RULES.limits.maxWeeklyPlansPerProfile }, (_, index) => ({
    id: `week-${index}`, weekStartDate: '2026-07-27', weekEndDate: '2026-08-02',
    title: `周计划 ${index}`, taskItems: [], notes: '', ...common
  }))
  const stageReviews = Array.from({ length: PRODUCT_RULES.limits.maxStageReviewsPerProfile }, (_, index) => ({
    id: `stage-review-${index}`, stageGoalId: `goal-${index}`, stageGoalSnapshot: { id: `goal-${index}`, title: `阶段目标 ${index}` },
    startDataSnapshot: {}, endDataSnapshot: {}, taskSummarySnapshot: { total: 0, items: [] },
    examSummarySnapshot: { total: 0, items: [] }, summary: '', ...common
  }))
  return {
    profileId,
    favoriteSchoolIds: [],
    scoreRecords,
    scoreReviews: [],
    scoreLossReasons: [],
    targetRecords: schools.slice(0, 55).map((school) => ({ id: `target-${school.id}`, schoolId: school.id, schoolName: school.name, level: 'target', ...common })),
    stageGoals,
    learningTasks,
    examTemplates: Array.from({ length: PRODUCT_RULES.limits.maxCustomExamTemplatesPerProfile }, (_, index) => ({
      id: `template-${index}`, name: `模板 ${index}`, examType: 'custom', scoreSchemeId: snapshot.id, ...common
    })),
    scoreSchemes: [],
    mistakeRecords,
    weeklyPlans,
    stageReviews,
    schoolUserStates: schools.slice(0, 55).map((school) => ({
      id: `state-${school.id}`, schoolId: school.id, candidateStatus: 'focused', tags: ['重点'], note: '', ...common
    })),
    recommendationSettings: {}, scenarioSettings: {}, schoolFilters: {}, comparisonSchoolIds: [],
    recentViewedSchoolIds: [], recentHistory: {}, subjectConfigs: [], primaryTargetSchoolId: null,
    examYear: 2027, targetDraft: {}, legacyExtensions: {}, schemaVersion: 5
  }
}

function testSearchBudget() {
  const data = maxProfileData()
  const metrics = measure(() => globalSearchCurrentProfile({
    keyword: '任务 1999',
    schools,
    exams: data.scoreRecords,
    targets: data.targetRecords,
    tasks: data.learningTasks,
    schoolUserStates: data.schoolUserStates
  }), 11)
  assertBudget('search', metrics, PRODUCT_RULES.performanceBudgetsMs.searchMedian, PRODUCT_RULES.performanceBudgetsMs.searchMax)
}

function testReportBudget() {
  const data = maxProfileData()
  const metrics = measure(() => {
    const snapshot = createReportSnapshot('score_stage', { id: 'profile_default', nickname: '默认档案' }, data, NOW)
    reportToText(snapshot)
    reportToJson(snapshot)
  }, 7)
  assertBudget('report', metrics, PRODUCT_RULES.performanceBudgetsMs.reportMedian, PRODUCT_RULES.performanceBudgetsMs.reportMax)
}

function testBackupChecksumBudget() {
  const { storage, memoryStorage } = setup()
  const state = storage.getVersionedState().state
  state.profileData[state.activeProfileId] = maxProfileData(state.activeProfileId)
  memoryStorage.memory.set(storage.KEYS.profileData, state.profileData)
  delete require.cache[require.resolve('../../utils/backup-restore')]
  const { createBackupEnvelope } = require('../../utils/backup-restore')
  const metrics = measure(() => {
    const result = createBackupEnvelope({ exportedAt: NOW })
    assert.strictEqual(result.ok, true)
    assert.match(result.backup.checksum.value, /^[0-9a-f]{64}$/)
  }, 3)
  assertBudget('backup', metrics, PRODUCT_RULES.performanceBudgetsMs.backupMedian, PRODUCT_RULES.performanceBudgetsMs.backupMax)
}

function testHealthBudget() {
  const { storage } = setup()
  const state = storage.getVersionedState().state
  state.profileData[state.activeProfileId] = maxProfileData(state.activeProfileId)
  const values = storage.storageSnapshot().values
  values[storage.KEYS.profileData] = state.profileData
  delete require.cache[require.resolve('../../utils/data-health')]
  const { scanLocalData } = require('../../utils/data-health')
  const metrics = measure(() => assert.strictEqual(scanLocalData(values).ok, true), 5)
  assertBudget('health', metrics, PRODUCT_RULES.performanceBudgetsMs.healthMedian, PRODUCT_RULES.performanceBudgetsMs.healthMax)
}

function testSetDataPayloadBudget() {
  const longText = '复'.repeat(1000)
  const scorePagePayload = {
    records: Array.from({ length: 500 }, (_, index) => ({ id: `e-${index}`, examName: `考试${index}`, examDate: '2026-08-01', version: 1 })),
    filteredRecords: Array.from({ length: 10 }, (_, index) => ({
      id: `e-${index}`, examName: `考试${index}`, improvementNotes: longText,
      lossNotes: longText, nextActions: longText, notes: longText
    })),
    reviewDraft: { improvementNotes: longText, lossNotes: longText, nextActions: longText, notes: longText }
  }
  const targetPagePayload = {
    learningTasks: Array.from({ length: 10 }, (_, index) => ({ id: `t-${index}`, title: longText, notes: longText })),
    learningRecords: Array.from({ length: 10 }, (_, index) => ({ id: `g-${index}`, title: longText, notes: longText })),
    weeklyPlans: Array.from({ length: 10 }, (_, index) => ({ id: `w-${index}`, title: longText, taskItems: [] })),
    stageReviews: Array.from({ length: 10 }, (_, index) => ({ id: `r-${index}`, summary: longText }))
  }
  const reportPagePayload = { reportPreview: '报'.repeat(50000) }
  const sizes = [scorePagePayload, targetPagePayload, reportPagePayload].map(byteLength)
  console.log(`setData payload bytes=${sizes.join(',')}`)
  for (const size of sizes) assert.ok(size <= PRODUCT_RULES.maxSetDataPayloadBytes, `${size} > ${PRODUCT_RULES.maxSetDataPayloadBytes}`)
  assert.match(checksumFor({ sizes }), /^[0-9a-f]{64}$/)
}

function run() {
  return [
    runTest('V1-PERF-001', testSearchBudget),
    runTest('V1-PERF-002', testReportBudget),
    runTest('V1-PERF-003', testBackupChecksumBudget),
    runTest('V1-PERF-004', testHealthBudget),
    runTest('V1-PERF-005', testSetDataPayloadBudget)
  ]
}

module.exports = { run, maxProfileData, measure }
