const fs = require('fs')
const path = require('path')
const { assert, setup, runTest, byteLength } = require('./test-helpers')
const { PRODUCT_RULES } = require('../../utils/generated/product-rules')

const ROOT = path.resolve(__dirname, '../..')

function loadHealthFresh() {
  delete require.cache[require.resolve('../../utils/data-health')]
  return require('../../utils/data-health')
}

function profileSnapshot(storage) {
  const snapshot = storage.storageSnapshot()
  const profileId = snapshot.values[storage.KEYS.activeProfileId]
  return { snapshot, profileId, data: snapshot.values[storage.KEYS.profileData][profileId] }
}

function testScoreSchemeRateAndReferenceHealth() {
  const { storage } = setup()
  const { snapshot, profileId, data } = profileSnapshot(storage)
  data.scoreRecords = [{
    id: 'exam-invalid', profileId, examName: '周测', examDate: '2026-08-01', examType: 'weekly_test',
    totalScore: 90, totalMaxScore: 80, scoreRateBasisPoints: 9000, scoreSchemeId: 'missing-scheme',
    scoreSchemeSnapshot: null, examTemplateId: 'missing-template',
    subjectScores: [{ subjectId: 'math', subjectName: '数学', score: 101, maxScore: 100 }],
    createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z', version: 1, schemaVersion: 5
  }]
  data.recommendationSettings.selectedReferenceExamId = 'exam-invalid'
  const report = loadHealthFresh().scanLocalData(snapshot.values)
  const types = new Set(report.issues.map((item) => item.type))
  for (const type of [
    'total_score_exceeds_max', 'subject_score_out_of_range', 'invalid_score_scheme_reference',
    'missing_score_scheme_snapshot', 'score_rate_mismatch', 'invalid_exam_template_reference',
    'ineligible_reference_exam'
  ]) assert.ok(types.has(type), `missing ${type}`)
}

function testLearningLoopReferenceHealth() {
  const { storage } = setup()
  const { snapshot, profileId, data } = profileSnapshot(storage)
  const common = { profileId, createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z', version: 1, schemaVersion: 5 }
  data.scoreReviews = [{ id: 'review-bad', examRecordId: 'missing-exam', ...common }]
  data.scoreLossReasons = [{ id: 'reason-bad', examRecordId: 'missing-exam', reviewId: 'missing-review', ...common }]
  data.mistakeRecords = [{ id: 'mistake-bad', examRecordId: 'missing-exam', linkedTaskIds: ['missing-task'], ...common }]
  data.learningTasks = [{ id: 'task-bad', title: '任务', stageGoalId: 'missing-goal', sourceMistakeRecordId: 'missing-mistake', ...common }]
  data.weeklyPlans = [{ id: 'week-bad', weekStartDate: '2026-07-27', weekEndDate: '2026-08-02', taskItems: ['missing-task'], ...common }]
  data.stageGoals = [{ id: 'goal-bad', title: '目标', metricType: 'unknown_metric', ...common }]
  data.stageReviews = [{ id: 'stage-review-bad', stageGoalId: 'missing-goal', stageGoalSnapshot: {}, ...common }]
  const report = loadHealthFresh().scanLocalData(snapshot.values)
  const types = new Set(report.issues.map((item) => item.type))
  for (const type of [
    'orphan_review', 'orphan_loss_reason', 'orphan_mistake_reference', 'orphan_learning_task',
    'orphan_weekly_plan_task', 'invalid_stage_goal_metric', 'corrupt_stage_review'
  ]) assert.ok(types.has(type), `missing ${type}`)
}

function testSchoolOperationAndVersionHealth() {
  const { storage } = setup()
  const { snapshot, profileId, data } = profileSnapshot(storage)
  data.schoolUserStates = [{
    id: 'school-state', profileId, schoolId: 'missing-school', candidateStatus: 'focused',
    tags: ['重点', '重点'], note: '', createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z', version: 1, schemaVersion: 5
  }]
  data.primaryTargetSchoolId = 'missing-school'
  snapshot.values[storage.KEYS.storageSchemaVersion] = PRODUCT_RULES.storageSchemaVersion + 1
  snapshot.values[storage.KEYS.transactionJournal] = { status: 'writing' }
  snapshot.values[storage.KEYS.cleanupPending] = { transactionId: 'tx' }
  snapshot.values[storage.KEYS.restorePointOperationState] = Object.fromEntries(
    Array.from({ length: 101 }, (_, index) => [`op-${index}`, index === 0
      ? { operationId: `op-${index}`, payload: { full: true }, status: 'committed' }
      : { operationId: `op-${index}`, status: 'committed' }])
  )
  const report = loadHealthFresh().scanLocalData(snapshot.values)
  const types = new Set(report.issues.map((item) => item.type))
  for (const type of [
    'invalid_school_user_state', 'duplicate_school_tag', 'multiple_primary_target',
    'version_incompatible', 'transaction_temp_residue', 'cleanup_pending',
    'operation_state_oversize', 'operation_state_payload'
  ]) assert.ok(types.has(type), `missing ${type}`)
}

function testDuplicateIdentityAndProfileIsolationHealth() {
  const { storage } = setup()
  const { snapshot, profileId, data } = profileSnapshot(storage)
  const common = { profileId: 'other-profile', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z', version: 1, schemaVersion: 5 }
  data.learningTasks = [
    { id: 'duplicate-id', title: '任务一', ...common },
    { id: 'duplicate-id', title: '任务二', ...common }
  ]
  data.mistakeRecords = [{ id: 'duplicate-id', ...common }]
  const report = loadHealthFresh().scanLocalData(snapshot.values)
  const types = new Set(report.issues.map((item) => item.type))
  assert.ok(types.has('duplicate_learning_task'))
  assert.ok(types.has('duplicate_entity_id'))
  assert.ok(types.has('profile_data_mismatch'))
  assert.strictEqual(profileId, 'profile_default')
}

function testRepairCreatesRestorePointFirst() {
  const { storage, memoryStorage } = setup()
  const state = storage.getVersionedState().state
  const profileId = state.activeProfileId
  state.profileData[profileId].favoriteSchoolIds = ['suzhou_high_school', 'suzhou_high_school']
  state.profileData[profileId].schoolUserStates = [{
    id: 'state-1', profileId, schoolId: 'suzhou_high_school', candidateStatus: 'focused',
    tags: ['重点', '重点'], note: '', createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z', version: 1, schemaVersion: 5
  }]
  memoryStorage.memory.set(storage.KEYS.profileData, state.profileData)
  const health = loadHealthFresh()
  const before = health.scanLocalData()
  const result = health.repairSafeIssues({ operationId: 'repair-ui-contract' })
  assert.strictEqual(result.ok, true)
  assert.ok(result.restorePointId)
  assert.ok(storage.getRestorePoint(result.restorePointId).ok)
  assert.ok(result.after.total < before.total)
}

function testCriticalPageContractsAndNoDirectStorage() {
  const pages = [
    'pages/exam-settings/exam-settings',
    'pages/score-trend/score-trend',
    'pages/targets/targets',
    'pages/school-detail/school-detail',
    'pages/reports/reports',
    'pages/data-management/data-management'
  ]
  for (const page of pages) {
    const js = fs.readFileSync(path.join(ROOT, `${page}.js`), 'utf8')
    const wxml = fs.readFileSync(path.join(ROOT, `${page}.wxml`), 'utf8')
    assert.doesNotMatch(js, /wx\.(?:setStorage|setStorageSync|removeStorage|removeStorageSync)/)
    assert.match(js, /loading|checkingData/)
    assert.match(js, /saving|repairingData/)
    assert.match(js, /Error|error|pageError/)
    assert.match(wxml, /disabled=/)
  }
  for (const page of ['exam-settings', 'score-trend', 'targets', 'school-detail']) {
    const js = fs.readFileSync(path.join(ROOT, `pages/${page}/${page}.js`), 'utf8')
    assert.match(js, /VERSION_CONFLICT/)
    assert.match(js, /beginSaving\(\)/)
  }
}

function testSetDataPresentationBudgetContract() {
  const score = fs.readFileSync(path.join(ROOT, 'pages/score-trend/score-trend.js'), 'utf8')
  const targets = fs.readFileSync(path.join(ROOT, 'pages/targets/targets.js'), 'utf8')
  const reports = fs.readFileSync(path.join(ROOT, 'pages/reports/reports.js'), 'utf8')
  assert.match(score, /filteredRecords: recordCards\.slice\(0, 10\)/)
  assert.match(score, /this\._scoreRecords = result\.records/)
  assert.match(targets, /learningTasks\.slice\(0, 10\)/)
  assert.match(targets, /stageReviews[\s\S]*slice\(0, 10\)/)
  assert.match(reports, /fullPreview\.slice\(0, 50000\)/)
  assert.doesNotMatch([score, targets, reports].join('\n'), /setData\s*\(\s*\{[^}]*profileData/)
  assert.ok(byteLength({ preview: '报'.repeat(50000) }) <= PRODUCT_RULES.maxSetDataPayloadBytes)
}

function run() {
  return [
    runTest('V1-DATA-101', testScoreSchemeRateAndReferenceHealth),
    runTest('V1-DATA-102', testLearningLoopReferenceHealth),
    runTest('V1-DATA-103', testSchoolOperationAndVersionHealth),
    runTest('V1-DATA-104', testDuplicateIdentityAndProfileIsolationHealth),
    runTest('V1-DATA-105', testRepairCreatesRestorePointFirst),
    runTest('V1-UI-101', testCriticalPageContractsAndNoDirectStorage),
    runTest('V1-UI-102', testSetDataPresentationBudgetContract)
  ]
}

module.exports = { run }
