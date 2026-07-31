const assert = require('assert')
const {
  setupProfile,
  fixtures,
  loadPage,
  createPageInstance
} = require('./rc11_1_test_harness')
const { schools } = require('../data/schools')
const { read } = require('./rc9_test_helpers')

assert.ok(read('docs/rc11_1_refresh_matrix.md').includes('新增成绩'))
const { storage } = setupProfile(fixtures.profile)
const home = createPageInstance(loadPage('pages/home/home'))
const scores = createPageInstance(loadPage('pages/score-trend/score-trend'))
const targets = createPageInstance(loadPage('pages/targets/targets'))
const schoolsPage = createPageInstance(loadPage('pages/schools/schools'))
const profile = createPageInstance(loadPage('pages/profile/profile'))

assert.strictEqual(storage.saveScoreRecord(fixtures.firstExam).ok, true)
for (const page of [home, scores, targets, schoolsPage, profile]) page.onShow()
assert.strictEqual(home.data.latestScoreText, '650 分')
assert.strictEqual(scores.data.records.length, 1)
assert.strictEqual(targets.data.currentScoreText, '650 分')
assert.strictEqual(profile.data.scoreRecordCount, 1)

assert.strictEqual(storage.setFavorite(schools[0].id, true).ok, true)
schoolsPage.onShow()
profile.onShow()
assert.strictEqual(schoolsPage.data.results.find((item) => item.id === schools[0].id).isFavorite, true)
assert.strictEqual(profile.data.favoriteCount, 1)

console.log('RC11-1 REFRESH MATRIX PASSED (five tab onShow consumers)')
