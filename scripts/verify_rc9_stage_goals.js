const assert = require('assert')
const {
  installWxStorage,
  loadStorageFresh,
  makeExam
} = require('./rc9_test_helpers')
const {
  normalizeStageGoal,
  STAGE_GOAL_STATUSES
} = require('../utils/rc9-models')

installWxStorage()
const storage = loadStorageFresh()
assert.strictEqual(storage.ensureStorageMigrated().ok, true)
assert.deepStrictEqual(
  STAGE_GOAL_STATUSES,
  ['not_started', 'in_progress', 'completed', 'paused']
)

const goal = normalizeStageGoal({
  id: 'stage_1',
  title: '下一阶段',
  startDate: '2026-09-01',
  endDate: '2026-10-01',
  targetTotalScore: 680,
  targetSubjects: [{
    subjectId: 'subject_custom',
    subjectName: '用户科目',
    targetScore: 130
  }],
  weeklyTasks: ['复盘一次', '整理错题'],
  status: 'in_progress',
  notes: '不含敏感信息',
  isDraft: false,
  createdAt: '2026-08-01T08:00:00.000Z'
})
assert.ok(goal)
assert.strictEqual(storage.saveStageGoalRecord(goal).ok, true)
assert.strictEqual(storage.getStageGoalRecords()[0].status, 'in_progress')
assert.strictEqual(storage.saveScoreRecord(makeExam('current', 650)).ok, true)
assert.strictEqual(goal.targetTotalScore - storage.getScoreRecords()[0].totalScore, 30)

assert.strictEqual(storage.saveStageGoalRecord({
  ...goal,
  status: 'paused',
  notes: '暂停后可恢复'
}).ok, true)
assert.strictEqual(storage.getStageGoalRecords()[0].status, 'paused')
assert.strictEqual(storage.deleteStageGoalRecord('stage_1').ok, true)
assert.deepStrictEqual(storage.getStageGoalRecords(), [])

assert.strictEqual(storage.saveStageGoalRecord({ ...goal, id: 'draft', isDraft: true }).ok, true)
assert.strictEqual(storage.clearStageGoalRecords().ok, true)
assert.deepStrictEqual(storage.getStageGoalRecords(), [])

console.log('RC9 STAGE GOALS VERIFY PASSED')
console.log('- 完整字段、四状态、草稿、编辑、删除、分别清空及成绩差距通过')
