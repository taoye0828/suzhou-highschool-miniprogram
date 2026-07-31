const assert = require('assert')
const {
  FixedClock,
  FixedIdGenerator,
  setupProfile,
  fixtures,
  loadPage,
  createPageInstance
} = require('./rc11_1_test_harness')
const { schools } = require('../data/schools')

const clock = new FixedClock('2026-09-20T10:00:00+08:00')
const ids = new FixedIdGenerator([fixtures.firstExam.id, 'stage-first'])
const { storage, repository, memoryStorage } = setupProfile(fixtures.profile)
const school = schools.find((item) => item.id === 'suzhou_high_school') || schools[0]

assert.strictEqual(storage.saveScoreRecord({
  ...fixtures.firstExam,
  id: ids.next(),
  profileId: fixtures.profile.id
}).ok, true)
assert.strictEqual(repository.scores().length, 1)
assert.strictEqual(repository.scores()[0].profileId, fixtures.profile.id)

const home = createPageInstance(loadPage('pages/home/home'))
home.onLoad()
home.onShow()
assert.strictEqual(home.data.latestScoreText, '650 分')
assert.strictEqual(home.data.latestExamName, '第一次月考')

const targetsBefore = createPageInstance(loadPage('pages/targets/targets'))
targetsBefore.onShow()
assert.strictEqual(targetsBefore.data.recommendationScoreInput, '650')
assert.strictEqual(targetsBefore.data.recommendationScoreSource, '来自最近一次考试：第一次月考')

const detail = createPageInstance(loadPage('pages/school-detail/school-detail'))
detail.onLoad({ id: school.id })
detail.toggleFavorite()
detail.onTargetLevelChange({ detail: { value: '1' } })
detail.saveSchoolTarget()
assert.strictEqual(storage.setPrimaryTargetSchool(school.id).ok, true)
assert.strictEqual(storage.saveLearningTargetRecord({
  id: ids.next(),
  title: '第一次月考后阶段目标',
  startDate: '2026-09-20',
  endDate: '2026-11-10',
  targetTotalScore: 660,
  status: 'in_progress',
  createdAt: clock.nowIso()
}).ok, true)

const schoolsPage = createPageInstance(loadPage('pages/schools/schools'))
schoolsPage.onLoad()
schoolsPage.onShow()
const schoolCard = schoolsPage.data.results.find((item) => item.id === school.id)
assert.strictEqual(schoolCard.isFavorite, true)
assert.strictEqual(schoolCard.isTargetSchool, true)
assert.strictEqual(storage.getFavoriteIds().filter((id) => id === school.id).length, 1)
assert.strictEqual(storage.getTargetRecords().filter((item) => item.schoolId === school.id).length, 1)

home.onShow()
assert.strictEqual(home.data.primaryTargetName, school.name)
assert.strictEqual(home.data.stageGoalTitle, '第一次月考后阶段目标')

const restarted = require('./rc9_test_helpers').loadStorageFresh()
assert.strictEqual(restarted.ensureStorageMigrated().ok, true)
assert.deepStrictEqual(restarted.getScoreRecords().map((item) => item.id), [fixtures.firstExam.id])
assert.deepStrictEqual(restarted.getFavoriteIds(), [school.id])
assert.deepStrictEqual(restarted.getTargetRecords().map((item) => item.schoolId), [school.id])
assert.strictEqual(restarted.getActiveProfile().id, fixtures.profile.id)
assert.strictEqual(memoryStorage.memory.has(restarted.KEYS.transactionJournal), false)

console.log('RC11-1 FIRST USE JOURNEY PASSED')
