const assert = require('assert')
const { installWxStorage, loadStorageFresh, makeExam } = require('./rc9_test_helpers')
const { LOSS_REASON_TYPES } = require('../utils/rc9-models')
const { lossReasonStatistics } = require('../utils/rc10-features')

installWxStorage()
const storage = loadStorageFresh()
storage.ensureStorageMigrated()
storage.saveScoreRecord(makeExam('exam_1', 620))
assert.strictEqual(LOSS_REASON_TYPES.length, 10)
const reason = {
  id: 'loss_1',
  examRecordId: 'exam_1',
  subjectId: 'english',
  subjectName: '英语',
  reasonType: '单词或语法',
  detail: '时态使用错误',
  improvementAction: '订正',
  createdAt: '2026-09-01T09:00:00Z',
  updatedAt: '2026-09-01T09:00:00Z'
}
assert.strictEqual(storage.saveScoreLossReason(reason).ok, true)
assert.strictEqual(storage.getScoreLossReasons().length, 1)
assert.strictEqual(lossReasonStatistics(storage.getScoreLossReasons(), storage.getScoreRecords()).mostFrequent.reasonType, '单词或语法')
assert.strictEqual(storage.deleteScoreLossReason('loss_1').ok, true)
assert.strictEqual(storage.getScoreLossReasons().length, 0)
console.log('RC10 LOSS REASONS VERIFY PASSED')
