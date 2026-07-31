const assert = require('assert')
const { setupProfile, fixtures } = require('./rc11_1_test_harness')
const { schools } = require('../data/schools')

const { storage, repository } = setupProfile(fixtures.profile)
const school = schools[0]
assert.strictEqual(storage.setFavorite(school.id, true).ok, true)
assert.strictEqual(storage.saveTargetRecord({
  schoolId: school.id,
  schoolName: school.name,
  level: 'target',
  createdAt: fixtures.firstExam.createdAt
}).ok, true)
assert.strictEqual(storage.saveScoreRecord(fixtures.firstExam).ok, true)
assert.strictEqual(storage.saveScoreReview({
  id: 'review-single',
  examRecordId: fixtures.firstExam.id,
  createdAt: fixtures.firstExam.createdAt
}).ok, true)
assert.strictEqual(storage.saveScoreLossReason({
  id: 'reason-single',
  examRecordId: fixtures.firstExam.id,
  subjectId: 'math',
  reasonType: '审题错误',
  createdAt: fixtures.firstExam.createdAt
}).ok, true)
assert.strictEqual(storage.saveLearningTask({
  id: 'task-single',
  title: '审题练习',
  sourceExamId: fixtures.firstExam.id,
  sourceReviewId: 'review-single',
  sourceLossReasonId: 'reason-single',
  sourceReasonType: '审题错误',
  createdAt: fixtures.firstExam.createdAt
}).ok, true)
assert.deepStrictEqual(storage.getFavoriteIds(), [school.id])
assert.strictEqual(repository.targets().length, 1)
assert.strictEqual(repository.scores().length, 1)
assert.strictEqual(storage.getScoreReviews().length, 1)
assert.strictEqual(storage.getScoreLossReasons().length, 1)
assert.strictEqual(repository.tasks().length, 1)
const state = storage.getVersionedState().state
assert.strictEqual(Object.keys(state.profileData).length, 1)
assert.strictEqual(state.profileData[fixtures.profile.id].profileId, fixtures.profile.id)
assert.strictEqual(new Set(repository.targets().map((item) => item.schoolId)).size, 1)

console.log('RC11-1 SINGLE DATA SOURCES PASSED')
