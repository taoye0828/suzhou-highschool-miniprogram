const assert = require('assert')
const {
  installWxStorage,
  loadStorageFresh,
  read
} = require('./rc9_test_helpers')
const { schools } = require('../data/schools')
const { admissionScores } = require('../data/admission-scores')
const {
  selectReferenceForSchool
} = require('../utils/planning')

installWxStorage()
const storage = loadStorageFresh()
assert.strictEqual(storage.ensureStorageMigrated().ok, true)
const ids = schools.slice(0, 4).map((item) => item.id)

assert.strictEqual(storage.setFavorite(ids[0], true).ok, true)
assert.strictEqual(storage.getFavoriteIdsResult().ids.includes(ids[0]), true)
assert.strictEqual(storage.setFavorite(ids[0], false).ok, true)
assert.strictEqual(storage.getFavoriteIdsResult().ids.includes(ids[0]), false)

assert.strictEqual(storage.saveTargetRecord({
  schoolId: ids[0],
  schoolName: schools[0].name,
  level: 'sprint',
  createdAt: '2026-08-01T08:00:00.000Z'
}).ok, true)
assert.strictEqual(storage.saveTargetRecord({
  schoolId: ids[0],
  schoolName: schools[0].name,
  level: 'safe',
  createdAt: '2026-08-02T08:00:00.000Z'
}).ok, true)
assert.strictEqual(storage.getTargetRecords().length, 1)
assert.strictEqual(storage.getTargetRecords()[0].level, 'safe')

assert.strictEqual(storage.saveComparisonSchoolIds(ids).ok, true)
assert.deepStrictEqual(storage.getComparisonSchoolIds(), ids.slice(0, 3))
assert.strictEqual(storage.saveComparisonSchoolIds([ids[0], ids[0], ids[1]]).ok, true)
assert.deepStrictEqual(storage.getComparisonSchoolIds(), [ids[0], ids[1]])
assert.strictEqual(storage.addRecentViewedSchool(ids[0]).ok, true)
assert.strictEqual(storage.addRecentViewedSchool(ids[1]).ok, true)
assert.deepStrictEqual(storage.getRecentViewedSchoolIds(), [ids[1], ids[0]])

const reference = selectReferenceForSchool(ids[0], 2027, admissionScores)
if (reference) {
  const sameYear = admissionScores.filter((item) =>
    item.schoolId === ids[0] && item.year === reference.year
  )
  assert.strictEqual(reference.minScore, Math.max(...sameYear.map((item) => item.minScore)))
}

const schoolsText = `${read('pages/schools/schools.js')}\n${read('pages/schools/schools.wxml')}`
const detailText = `${read('pages/school-detail/school-detail.js')}\n${read('pages/school-detail/school-detail.wxml')}`
const compareText = `${read('pages/school-compare/school-compare.js')}\n${read('pages/school-compare/school-compare.wxml')}`
const favoritesText = `${read('pages/favorites/favorites.js')}\n${read('pages/favorites/favorites.wxml')}`

for (const text of [schoolsText, detailText, compareText, favoritesText]) {
  assert.ok(text.includes('setFavorite'), '收藏操作必须使用统一 storage')
}
for (const text of [schoolsText, detailText, compareText]) {
  assert.ok(text.includes('saveTargetRecord'), '目标操作必须使用统一 storage')
}
for (const marker of [
  'item.name',
  'item.district',
  'item.schoolType',
  'referenceScoreText',
  'referenceYearText',
  'differenceText',
  'targetLevelText',
  '历史分数线',
  '收藏',
  '加入目标',
  '查看详情'
]) {
  assert.ok(compareText.includes(marker), `对比结果缺少 ${marker}`)
}
assert.ok(schoolsText.includes('comparisonCount'))
assert.ok(schoolsText.includes('最多对比 3 所学校'))
assert.ok(schoolsText.includes('clearComparison'))
assert.ok(compareText.includes("require('../../utils/school')"))
assert.ok(compareText.includes('scoreSummaryForSchool'))
assert.ok(compareText.includes("require('../../utils/storage')"))
assert.strictEqual(compareText.includes('const schools = ['), false)

console.log('RC9 SCHOOL INTEGRATION VERIFY PASSED')
console.log('- 收藏/目标单一数据源、目标去重改级、三校临时对比、最近浏览和最新参考分通过')
