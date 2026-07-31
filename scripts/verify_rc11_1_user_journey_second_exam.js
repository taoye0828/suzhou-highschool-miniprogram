const assert = require('assert')
const {
  FixedClock,
  setupProfile,
  fixtures,
  loadPage,
  createPageInstance
} = require('./rc11_1_test_harness')
const { prepareScoreTrendData } = require('../utils/score-trend')
const { schools } = require('../data/schools')

const clock = new FixedClock('2026-11-10T10:00:00+08:00')
const { storage, repository, memoryStorage } = setupProfile(fixtures.profile)
const school = schools.find((item) => item.id === 'suzhou_high_school') || schools[0]

assert.strictEqual(storage.saveScoreRecord(fixtures.firstExam).ok, true)
assert.strictEqual(storage.saveScoreRecord(fixtures.secondExam).ok, true)
assert.deepStrictEqual(repository.scores().map((item) => item.id), [
  fixtures.firstExam.id,
  fixtures.secondExam.id
])
const geometry = prepareScoreTrendData(repository.scores(), {
  width: 390,
  height: 280,
  padding: 38
})
assert.deepStrictEqual(geometry.visibleRecords.map((item) => item.examName), [
  '第一次月考',
  '期中考试'
])
assert.deepStrictEqual(geometry.visibleTrendPoints.map((item) => item.x), [38, 352])
assert.ok(geometry.visibleTrendPoints.every((point) => Math.abs(point.x - point.x) <= 1))

assert.strictEqual(storage.saveScoreReview({
  id: 'review-exam-midterm',
  examRecordId: fixtures.secondExam.id,
  summary: '复盘期中考试',
  improvementNotes: '完成后复查条件',
  createdAt: clock.nowIso()
}).ok, true)
assert.strictEqual(storage.saveScoreLossReason({
  id: 'reason-exam-midterm-math',
  examRecordId: fixtures.secondExam.id,
  subjectId: 'math',
  subjectName: '数学',
  reasonType: '审题错误',
  detail: '遗漏题目条件',
  improvementAction: '完成后预留时间检查题目条件',
  createdAt: clock.nowIso()
}).ok, true)
assert.strictEqual(storage.saveLearningTargetRecord({
  id: 'stage-midterm',
  title: '期中后阶段目标',
  startDate: '2026-11-10',
  endDate: '2026-12-31',
  targetTotalScore: 680,
  status: 'in_progress',
  createdAt: clock.nowIso()
}).ok, true)
assert.strictEqual(storage.saveLearningTask({
  id: 'task-review-math',
  title: '每周完成两次审题专项检查练习',
  status: 'in_progress',
  subjectId: 'math',
  subjectName: '数学',
  sourceExamId: fixtures.secondExam.id,
  sourceReviewId: 'review-exam-midterm',
  sourceLossReasonId: 'reason-exam-midterm-math',
  sourceReasonType: '审题错误',
  stageGoalId: 'stage-midterm',
  weeklyTarget: 2,
  createdAt: clock.nowIso()
}).ok, true)

assert.strictEqual(storage.saveTargetRecord({
  schoolId: school.id,
  schoolName: school.name,
  level: 'target',
  createdAt: clock.nowIso()
}).ok, true)
const targets = createPageInstance(loadPage('pages/targets/targets'))
targets.onShow()
assert.strictEqual(targets.data.currentScoreText, '660 分')
assert.strictEqual(targets.data.learningTasks[0].profileId, fixtures.profile.id)
assert.strictEqual(targets.data.learningTasks[0].sourceAvailable, true)

assert.strictEqual(storage.saveScoreRecord({ ...fixtures.secondExam, totalScore: 665 }).ok, true)
const home = createPageInstance(loadPage('pages/home/home'))
home.onShow()
targets.onShow()
assert.strictEqual(home.data.latestScoreText, '665 分')
assert.strictEqual(targets.data.currentScoreText, '665 分')
assert.strictEqual(repository.scores().filter((item) => item.id === fixtures.secondExam.id).length, 1)

assert.strictEqual(storage.deleteScoreRecord(fixtures.secondExam.id).ok, true)
assert.strictEqual(repository.tasks().length, 1)
targets.onShow()
assert.strictEqual(targets.data.learningTasks[0].sourceAvailable, false)
assert.strictEqual(
  targets.data.learningTasks[0].sourceStatusText,
  '来源记录已删除，任务继续保留'
)
assert.strictEqual(memoryStorage.memory.has(storage.KEYS.transactionJournal), false)

console.log('RC11-1 SECOND EXAM JOURNEY PASSED x=[38,352] label-error=0')
