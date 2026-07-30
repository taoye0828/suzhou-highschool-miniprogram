const assert = require('assert')
const { installWxStorage, loadStorageFresh } = require('./rc9_test_helpers')

installWxStorage()
const storage = loadStorageFresh()
storage.ensureStorageMigrated()
const task = {
  id: 'task_1',
  title: '每周完成英语语法专项练习并订正',
  subjectId: 'english',
  sourceExamId: 'exam_1',
  sourceReviewId: 'review_exam_1',
  sourceReasonType: '单词或语法',
  stageGoalId: '',
  startDate: '2026-09-01',
  dueDate: '2026-09-30',
  weeklyTarget: 3,
  status: 'not_started',
  createdAt: '2026-09-01T09:00:00Z',
  updatedAt: '2026-09-01T09:00:00Z'
}
assert.strictEqual(storage.saveLearningTask(task).ok, true)
assert.strictEqual(storage.saveLearningTask({ ...task, id: 'task_2' }).code, 'DUPLICATE_SOURCE')
assert.strictEqual(storage.saveLearningTask({ ...task, status: 'completed' }, { allowDuplicateSource: true }).ok, true)
assert.strictEqual(storage.getLearningTasks()[0].status, 'completed')
console.log('RC10 LEARNING TASKS VERIFY PASSED')
