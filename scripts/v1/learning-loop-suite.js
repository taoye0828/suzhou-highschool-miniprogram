const fs = require('fs')
const path = require('path')
const { assert, setup, clone, runTest } = require('./test-helpers')
const {
  weekRange,
  copyWeeklyPlanToNextWeek,
  goalProgressValue,
  createStageReviewSnapshot
} = require('../../utils/learning-loop')

const NOW = '2026-08-01T08:00:00.000Z'

function mistake(id = 'mistake-1') {
  return {
    id, examRecordId: 'exam-1', reviewId: 'review-1', subjectId: 'math', subjectName: '数学',
    questionType: '计算题', knowledgePoint: '二次函数', lostScore: 6, reasonType: '计算错误',
    detail: '符号错误', corrected: false, repeatedErrorConfirmed: false,
    improvementAction: '每周复算两题', linkedTaskIds: [], notes: '', createdAt: NOW, updatedAt: NOW
  }
}

function task(id = 'task-1') {
  return {
    id, title: '复算二次函数错题', subjectId: 'math', subjectName: '数学', sourceExamId: 'exam-1',
    sourceReviewId: 'review-1', sourceTitleSnapshot: '数学 · 二次函数', startDate: '2026-08-01',
    dueDate: '2026-08-14', weeklyTarget: 2, status: 'not_started', createdAt: NOW, updatedAt: NOW
  }
}

function testMistakeCrudAndUserConfirmedRepeat() {
  const { storage } = setup()
  const created = storage.saveMistakeRecord(mistake(), { operationId: 'mistake-create' })
  assert.strictEqual(created.ok, true)
  assert.strictEqual(created.record.repeatedErrorConfirmed, false)
  const updated = storage.saveMistakeRecord({
    ...created.record, repeatedErrorConfirmed: true, corrected: true, correctedDate: '2026-08-02',
    expectedVersion: created.record.version
  }, { operationId: 'mistake-update' })
  assert.strictEqual(updated.ok, true)
  assert.strictEqual(updated.record.repeatedErrorConfirmed, true)
  assert.strictEqual(Object.prototype.hasOwnProperty.call(updated.record, 'image'), false)
  assert.strictEqual(storage.deleteMistakeRecord('mistake-1', { operationId: 'mistake-delete' }).ok, true)
}

function testMistakeTaskBidirectionalAtomicLink() {
  const { storage } = setup()
  const linked = storage.saveMistakeWithTask(mistake(), task(), { operationId: 'mistake-task-link' })
  assert.strictEqual(linked.ok, true)
  assert.deepStrictEqual(storage.getMistakeRecords()[0].linkedTaskIds, ['task-1'])
  assert.strictEqual(storage.getLearningTasks()[0].sourceMistakeRecordId, 'mistake-1')
  const duplicate = storage.saveMistakeWithTask(storage.getMistakeRecords()[0], task('task-2'), { operationId: 'mistake-task-duplicate' })
  assert.strictEqual(duplicate.code, 'DUPLICATE_SOURCE')
}

function testTaskDeleteUnlinksMistakeAndSourceDeleteKeepsTask() {
  const { storage } = setup()
  assert.strictEqual(storage.saveMistakeWithTask(mistake(), task(), { operationId: 'link-delete' }).ok, true)
  assert.strictEqual(storage.deleteLearningTask('task-1', { operationId: 'task-delete' }).ok, true)
  assert.deepStrictEqual(storage.getMistakeRecords()[0].linkedTaskIds, [])
  assert.strictEqual(storage.saveMistakeWithTask(storage.getMistakeRecords()[0], task('task-2'), { operationId: 'link-again' }).ok, true)
  assert.strictEqual(storage.deleteMistakeRecord('mistake-1', { operationId: 'source-delete' }).ok, true)
  assert.strictEqual(storage.getLearningTasks()[0].id, 'task-2')
}

function testWeeklyPlanDatesCopyAndDeleteRules() {
  const { storage } = setup()
  assert.deepStrictEqual(weekRange('2026-08-01'), { weekStartDate: '2026-07-27', weekEndDate: '2026-08-02' })
  assert.strictEqual(storage.saveLearningTask(task(), { operationId: 'weekly-task' }).ok, true)
  const plan = {
    id: 'weekly-1', ...weekRange('2026-08-01'), title: '本周计划', taskItems: ['task-1'], notes: '',
    createdAt: NOW, updatedAt: NOW
  }
  assert.strictEqual(storage.saveWeeklyPlan(plan, { operationId: 'weekly-plan' }).ok, true)
  const copy = copyWeeklyPlanToNextWeek(plan, 'weekly-2', '2026-08-03T08:00:00.000Z')
  assert.deepStrictEqual([copy.weekStartDate, copy.weekEndDate, copy.taskItems[0]], ['2026-08-03', '2026-08-09', 'task-1'])
  assert.strictEqual(storage.saveWeeklyPlan(copy, { operationId: 'weekly-copy' }).ok, true)
  assert.strictEqual(storage.deleteWeeklyPlan('weekly-1', { operationId: 'weekly-delete' }).ok, true)
  assert.strictEqual(storage.getLearningTasks().length, 1)
}

function testMultiMetricGoalValuesAndEmptyState() {
  const scores = [{
    id: 'exam-1', examDate: '2026-08-01', totalScore: 80, totalMaxScore: 100, scoreRateBasisPoints: 8000,
    subjectScores: [{ subjectId: 'math', subjectName: '数学', score: 72, maxScore: 100 }]
  }]
  assert.strictEqual(goalProgressValue({ id: 'g1', metricType: 'total_score' }, scores, []).value, 80)
  assert.strictEqual(goalProgressValue({ id: 'g2', metricType: 'subject_score', metricSubjectId: 'math' }, scores, []).value, 72)
  assert.strictEqual(goalProgressValue({ id: 'g3', metricType: 'score_rate' }, scores, []).text, '80.00%')
  assert.strictEqual(goalProgressValue({ id: 'g4', metricType: 'task_completion' }, scores, []).text, '暂无可比较记录')
  assert.strictEqual(goalProgressValue({ id: 'g5', metricType: 'task_completion' }, [], [
    { id: 'a', stageGoalId: 'g5', status: 'completed' }, { id: 'b', stageGoalId: 'g5', status: 'in_progress' }
  ]).value, 50)
}

function testStageReviewSnapshotIsImmutable() {
  const goal = { id: 'goal-1', title: '阶段目标', metricType: 'total_score', startDate: '2026-08-01', endDate: '2026-08-31' }
  const scores = [{ id: 'exam-1', examName: '月考', examDate: '2026-08-02', totalScore: 650, totalMaxScore: 740 }]
  const tasks = [{ id: 'task-1', title: '订正', stageGoalId: 'goal-1', status: 'completed' }]
  const review = createStageReviewSnapshot(goal, scores, tasks, '本阶段完成', 'review-1', NOW)
  goal.title = '后来修改'
  scores[0].totalScore = 700
  tasks[0].title = '后来修改'
  assert.strictEqual(review.stageGoalSnapshot.title, '阶段目标')
  assert.strictEqual(review.examSummarySnapshot.items[0].totalScore, 650)
  assert.strictEqual(review.taskSummarySnapshot.items[0].title, '订正')
}

function testStorageEntitiesVersionAndProfileIsolation() {
  const { storage } = setup()
  const plan = { id: 'p1', ...weekRange('2026-08-01'), title: '计划', taskItems: [], createdAt: NOW, updatedAt: NOW }
  const created = storage.saveWeeklyPlan(plan, { operationId: 'profile-plan' })
  assert.strictEqual(storage.saveWeeklyPlan({ ...created.record, title: '冲突', expectedVersion: 99 }, { operationId: 'profile-plan-conflict' }).code, 'VERSION_CONFLICT')
  assert.strictEqual(storage.createStudentProfile({ id: 'profile-two', nickname: '档案二' }).ok, true)
  assert.strictEqual(storage.switchStudentProfile('profile-two').ok, true)
  assert.strictEqual(storage.getWeeklyPlans().length, 0)
  assert.strictEqual(storage.getMistakeRecords().length, 0)
  assert.strictEqual(storage.getStageReviews().length, 0)
}

function testFormalEntriesAndNoDirectStorage() {
  const score = fs.readFileSync(path.join(__dirname, '../../pages/score-trend/score-trend.wxml'), 'utf8')
  const targets = fs.readFileSync(path.join(__dirname, '../../pages/targets/targets.wxml'), 'utf8')
  assert.match(score, /错题记录/)
  assert.match(score, /createTaskFromMistake/)
  assert.match(targets, /周学习计划/)
  assert.match(targets, /阶段复盘/)
  assert.match(targets, /暂无可比较记录|currentMetricText/)
  for (const file of ['score-trend', 'targets']) {
    const source = fs.readFileSync(path.join(__dirname, `../../pages/${file}/${file}.js`), 'utf8')
    assert.doesNotMatch(source, /wx\.(?:setStorage|setStorageSync|removeStorage|removeStorageSync)/)
  }
}

function run() {
  return [
    runTest('V1-LEARNING-001', testMistakeCrudAndUserConfirmedRepeat),
    runTest('V1-LEARNING-002', testMistakeTaskBidirectionalAtomicLink),
    runTest('V1-LEARNING-003', testTaskDeleteUnlinksMistakeAndSourceDeleteKeepsTask),
    runTest('V1-LEARNING-004', testWeeklyPlanDatesCopyAndDeleteRules),
    runTest('V1-LEARNING-005', testMultiMetricGoalValuesAndEmptyState),
    runTest('V1-LEARNING-006', testStageReviewSnapshotIsImmutable),
    runTest('V1-LEARNING-007', testStorageEntitiesVersionAndProfileIsolation),
    runTest('V1-LEARNING-008', testFormalEntriesAndNoDirectStorage)
  ]
}

module.exports = { run }
