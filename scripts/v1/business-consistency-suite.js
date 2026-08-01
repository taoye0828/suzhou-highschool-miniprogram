const fs = require('fs')
const path = require('path')
const { assert, setup, makeExam, runTest } = require('./test-helpers')
const planning = require('../../utils/planning')
const { localDate, localWeekRange } = require('../../utils/local-date')
const { collectSubjectSeries } = require('../../utils/subject-analysis')
const { scenarioResults } = require('../../utils/rc10-features')
const { FORMAL_SCORE_YEARS, REFERENCE_YEAR_FILTERS } = require('../../utils/school')
const { APP_CONFIG } = require('../../config/app-config')
const { classifyShareError } = require('../../utils/file-share')

function testRepairSnapshotSafety() {
  const source = fs.readFileSync(path.join(__dirname, '../../utils/data-health.js'), 'utf8')
  const restore = source.slice(source.indexOf('function restoreRepairSnapshot'), source.indexOf('module.exports'))
  assert.match(restore, /createRestorePoint/)
  assert.match(restore, /before_restore/)
  assert.match(restore, /operationType: 'restore_repair_snapshot'/)
}

function testExamReviewAtomic() {
  const { storage } = setup()
  const exam = makeExam('atomic-review', 650)
  const result = storage.saveExamWithReview(exam, {
    id: 'review-atomic', examRecordId: exam.id, summary: '复盘', createdAt: exam.createdAt, updatedAt: exam.updatedAt
  }, { operationId: 'atomic-review-save' })
  assert.strictEqual(result.ok, true)
  assert.strictEqual(storage.getScoreRecords().length, 1)
  assert.strictEqual(storage.getScoreReviews().length, 1)
  const page = fs.readFileSync(path.join(__dirname, '../../pages/score-trend/score-trend.js'), 'utf8')
  assert.match(page, /saveExamWithReview/)
}

function testTargetPatchPreservesReference() {
  const { storage } = setup()
  const profileId = storage.getActiveProfile().id
  storage.saveTargetRecord({ id: 'target-a', schoolId: 'suzhou_high_school', schoolName: '江苏省苏州中学校', level: 'target', referenceScore: 650, referenceYear: 2026, profileId })
  const current = storage.getTargetRecords()[0]
  assert.strictEqual(storage.saveTargetRecord({ schoolId: current.schoolId, schoolName: current.schoolName, level: 'sprint', version: current.version }).ok, true)
  const updated = storage.getTargetRecords()[0]
  assert.strictEqual(updated.referenceScore, 650)
  assert.strictEqual(updated.referenceYear, 2026)
}

function testPrimaryTargetDoesNotFallback() {
  assert.strictEqual(planning.selectPrimaryTarget([{ id: 'a', schoolId: 'a', level: 'target' }]), null)
  assert.strictEqual(planning.selectPrimaryTarget([{ id: 'a', schoolId: 'a' }], { primaryTargetId: 'a' }).id, 'a')
}

function testStageGoalDeleteDetachesTask() {
  const { storage } = setup()
  storage.saveLearningTargetRecord({ id: 'goal-a', title: '阶段目标', createdAt: '2026-08-01T00:00:00.000Z' })
  storage.saveLearningTask({ id: 'task-a', title: '学习任务', stageGoalId: 'goal-a', createdAt: '2026-08-01T00:00:00.000Z' })
  assert.strictEqual(storage.deleteLearningTargetRecord('goal-a', { operationId: 'delete-goal-a' }).ok, true)
  assert.strictEqual(storage.getLearningTasks()[0].stageGoalId, '')
}

function testReviewDeleteOnlyExplicitReasons() {
  const { storage } = setup()
  storage.saveScoreRecord(makeExam('exam-a', 650), { operationId: 'exam-a' })
  for (const id of ['review-a', 'review-b']) storage.saveScoreReview({ id, examRecordId: 'exam-a', createdAt: '2026-08-01T00:00:00.000Z' }, { operationId: id })
  storage.saveScoreLossReason({ id: 'reason-a', examRecordId: 'exam-a', reviewId: 'review-a', subjectId: 'math', reasonType: '计算错误', createdAt: '2026-08-01T00:00:00.000Z' }, { operationId: 'reason-a' })
  storage.saveScoreLossReason({ id: 'reason-b', examRecordId: 'exam-a', reviewId: 'review-b', subjectId: 'math', reasonType: '审题错误', createdAt: '2026-08-01T00:00:00.000Z' }, { operationId: 'reason-b' })
  assert.strictEqual(storage.deleteScoreReview('review-a', { operationId: 'delete-review-a' }).ok, true)
  assert.deepStrictEqual(storage.getScoreLossReasons().map((item) => item.id), ['reason-b'])
}

function testTaskUsesExistingReviewId() {
  const page = fs.readFileSync(path.join(__dirname, '../../pages/score-trend/score-trend.js'), 'utf8')
  const createTask = page.slice(page.indexOf('createTaskFromLoss'), page.indexOf('\n  }\n})', page.indexOf('createTaskFromLoss')))
  assert.match(createTask, /sourceReviewId:\s*reason\.reviewId\s*\|\|\s*''/)
  assert.doesNotMatch(createTask, /sourceReviewId:\s*(?:reason\.)?examRecordId/)
}

function testTaskDedupPriority() {
  const { storage } = setup()
  const base = { title: '任务', sourceReviewId: 'review-a', sourceLossReasonId: 'reason-a', createdAt: '2026-08-01T00:00:00.000Z' }
  assert.strictEqual(storage.saveLearningTask({ ...base, id: 'task-1' }, { operationId: 'task-1' }).ok, true)
  const duplicate = storage.saveLearningTask({ ...base, id: 'task-2', sourceReviewId: 'review-b' }, { operationId: 'task-2' })
  assert.strictEqual(duplicate.code, 'DUPLICATE_SOURCE')
}

function testFixedRules() {
  assert.strictEqual(planning.classifyDifference(-20, { sprint: { min: -1, max: -1 } }), 'sprint')
  assert.strictEqual(planning.classifyDifference(5, { safe: { min: 0, max: 10 } }), 'target')
  assert.strictEqual(planning.classifyDifference(16), 'safe')
}

function testFixedRulesHaveNoGap() {
  assert.deepStrictEqual(
    [-31, -30, -1, 0, 15, 16].map((difference) => planning.classifyDifference(difference)),
    [null, 'sprint', 'sprint', 'target', 'target', 'safe']
  )
}

function testScenariosUseFormalRules() {
  const cards = scenarioResults({
    currentScore: 650,
    stageTargetScore: null,
    finalTargetScore: null,
    targetYear: 2026,
    sprintMinDifference: 0,
    sprintMaxDifference: 740,
    targetMinDifference: -740,
    targetMaxDifference: -31,
    safeMinDifference: -30
  })
  assert.strictEqual(cards.length, 1)
  assert.ok(cards[0].results.length > 0)
  for (const item of cards[0].results) {
    assert.strictEqual(item.level, planning.classifyDifference(item.difference))
  }
}

function testRestoreFormalReferenceEntry() {
  const page = fs.readFileSync(path.join(__dirname, '../../pages/targets/targets.js'), 'utf8')
  const template = fs.readFileSync(path.join(__dirname, '../../pages/targets/targets.wxml'), 'utf8')
  assert.match(page, /restoreFormalReferenceScore/)
  assert.match(page, /currentScore:\s*null/)
  assert.match(template, /恢复使用正式参考成绩/)
}

function testLocalDate() {
  const local = new Date(2026, 7, 2, 0, 30, 0)
  assert.strictEqual(localDate(local), '2026-08-02')
  assert.deepStrictEqual(localWeekRange(local), { weekStartDate: '2026-07-27', weekEndDate: '2026-08-02' })
}

function testDynamicYears() {
  assert.deepStrictEqual(FORMAL_SCORE_YEARS, [2026, 2025])
  assert.deepStrictEqual(REFERENCE_YEAR_FILTERS, ['all', 'latest', '2026', '2025'])
}

function testReleaseStatus() {
  assert.strictEqual(APP_CONFIG.releaseStatus, 'V1 功能冻结版')
}

function testDynamicHelpUsesBackupState() {
  const profile = fs.readFileSync(path.join(__dirname, '../../pages/profile/profile.js'), 'utf8')
  assert.match(profile, /hasExportedBackup\(\)/)
}

function testFavoritesReadDoesNotWrite() {
  const favorites = fs.readFileSync(path.join(__dirname, '../../pages/favorites/favorites.js'), 'utf8')
  const refresh = favorites.slice(favorites.indexOf('refresh()'), favorites.indexOf('onKeywordInput'))
  assert.doesNotMatch(refresh, /replaceFavoriteIds/)
  assert.match(favorites, /cleanInvalidFavorites\(\)/)
}

function testHistoricalSubjectMax() {
  const series = collectSubjectSeries([
    makeExam('subject-a', 110, '2026-08-01', { subjectScores: [{ subjectId: 'math', subjectName: '数学', score: 110, maxScore: 120 }] })
  ], [{ subjectId: 'math', subjectName: '数学', maxScore: 100 }])
  assert.strictEqual(series[0].points[0].score, 110)
  assert.strictEqual(series[0].maxScore, 120)
}

function testSubjectConfigVersion() {
  const { storage } = setup()
  storage.saveSubjectConfigs([{ subjectId: 'math', subjectName: '数学', maxScore: 100 }], { operationId: 'subject-1' })
  const first = storage.getSubjectConfigs()[0]
  storage.saveSubjectConfigs([{ ...first, maxScore: 120 }], { operationId: 'subject-2' })
  const second = storage.getSubjectConfigs()[0]
  assert.strictEqual(second.version, first.version + 1)
  assert.strictEqual(second.createdAt, first.createdAt)
  assert.ok(second.updatedAt)
}

function testShareContract() {
  assert.strictEqual(classifyShareError({ errMsg: 'shareFileMessage:fail cancel' }).status, 'cancelled')
  assert.strictEqual(classifyShareError({ errMsg: 'shareFileMessage:fail system error' }).status, 'failed')
  const page = fs.readFileSync(path.join(__dirname, '../../pages/backup-restore/backup-restore.js'), 'utf8')
  assert.match(page, /FileShareAdapter/)
  assert.match(page, /请只发送给可信接收方/)
}

function run() {
  return [
    runTest('V1-RECOVERY-022', testRepairSnapshotSafety),
    runTest('V1-TXN-023', testExamReviewAtomic),
    runTest('V1-DATA-024', testTargetPatchPreservesReference),
    runTest('V1-DATA-025', testPrimaryTargetDoesNotFallback),
    runTest('V1-LEARNING-026', testStageGoalDeleteDetachesTask),
    runTest('V1-LEARNING-027', testReviewDeleteOnlyExplicitReasons),
    runTest('V1-LEARNING-028', testTaskUsesExistingReviewId),
    runTest('V1-LEARNING-029', testTaskDedupPriority),
    runTest('V1-SCHOOL-030', testFixedRules),
    runTest('V1-SCHOOL-031', testFixedRulesHaveNoGap),
    runTest('V1-SCHOOL-032', testScenariosUseFormalRules),
    runTest('V1-SCHOOL-033', testRestoreFormalReferenceEntry),
    runTest('V1-DATA-034', testLocalDate),
    runTest('V1-SCHOOL-035', testDynamicYears),
    runTest('V1-FREEZE-036', testReleaseStatus),
    runTest('V1-DATA-037', testDynamicHelpUsesBackupState),
    runTest('V1-SCHOOL-038', testFavoritesReadDoesNotWrite),
    runTest('V1-TREND-039', testHistoricalSubjectMax),
    runTest('V1-EXAM-040', testSubjectConfigVersion),
    runTest('V1-BACKUP-042', testShareContract)
  ]
}

module.exports = { run }
