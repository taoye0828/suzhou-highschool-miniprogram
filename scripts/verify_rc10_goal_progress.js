const assert = require('assert')
const { goalProgress } = require('../utils/rc10-features')
const { makeExam } = require('./rc9_test_helpers')

const result = goalProgress([
  { id: 'goal', title: '期中英语达到85分', targetTotalScore: 650, endDate: '2026-09-08', status: 'in_progress' }
], [
  { id: 'task1', title: '任务1', stageGoalId: 'goal', dueDate: '2026-09-05', status: 'completed' },
  { id: 'task2', title: '任务2', stageGoalId: '', dueDate: '2026-09-06', status: 'paused' }
], [makeExam('exam', 620)], new Date('2026-09-01T00:00:00Z'))
assert.strictEqual(result.currentScore, 620)
assert.strictEqual(result.goals[0].scoreGap, 30)
assert.strictEqual(result.completedCount, 1)
assert.strictEqual(result.pausedCount, 1)
assert.strictEqual(result.unlinkedTasks.length, 1)
console.log('RC10 GOAL PROGRESS VERIFY PASSED')
