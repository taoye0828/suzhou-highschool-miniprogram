const assert = require('assert')
const {
  installWxStorage,
  loadStorageFresh,
  read
} = require('./rc9_test_helpers')
const { schools } = require('../data/schools')
const {
  buildSchoolFilterOptions,
  filterSchoolCatalog
} = require('../utils/school')

const options = buildSchoolFilterOptions()
const actualDistricts = [...new Set(schools.map((item) => item.district).filter(Boolean))]
const actualTypes = [...new Set(schools.map((item) => item.schoolType).filter(Boolean))]
assert.deepStrictEqual(new Set(options.districts), new Set(actualDistricts))
assert.deepStrictEqual(new Set(options.schoolTypes), new Set(actualTypes))
assert.deepStrictEqual(
  new Set(options.districts),
  new Set(['姑苏区', '工业园区', '高新区', '吴中区', '吴江区', '相城区', '常熟'])
)
assert.strictEqual(options.districts.includes('其他'), false)
assert.deepStrictEqual(
  options.referenceYears.map((item) => item.value),
  ['all', 'latest', '2026', '2025']
)

const districtOr = filterSchoolCatalog({
  districts: ['工业园区', '姑苏区'],
  schoolTypes: ['普通高中'],
  referenceYears: ['latest'],
  targetYear: 2027
})
assert.ok(districtOr.length > 0)
assert.ok(districtOr.every((item) => ['工业园区', '姑苏区'].includes(item.district)))
assert.ok(districtOr.every((item) => item.schoolType === '普通高中'))
assert.ok(districtOr.some((item) => item.district === '工业园区'))
assert.ok(districtOr.some((item) => item.district === '姑苏区'))

const year2026 = filterSchoolCatalog({
  referenceYears: [2026],
  targetYear: 2027
})
assert.ok(year2026.length > 0)
assert.ok(year2026.every((item) => item.referenceYear === 2026))

const bounded = filterSchoolCatalog({
  minReferenceScore: 650,
  maxReferenceScore: 680,
  targetYear: 2027
})
assert.ok(bounded.length > 0)
assert.ok(bounded.every((item) => item.referenceScore >= 650 && item.referenceScore <= 680))

const targetMatches = filterSchoolCatalog({
  currentScore: 650,
  matchLevels: ['target'],
  targetYear: 2027
})
assert.ok(targetMatches.length > 0)
assert.ok(targetMatches.every((item) => item.matchLevel === 'target'))
assert.ok(targetMatches.every((item) => item.difference >= 0 && item.difference <= 15))

const favoriteId = year2026[0].id
const targetId = year2026.find((item) => item.id !== favoriteId).id
const favoriteOnly = filterSchoolCatalog({
  favoriteIds: [favoriteId],
  onlyFavorites: true,
  targetYear: 2027
})
assert.deepStrictEqual(favoriteOnly.map((item) => item.id), [favoriteId])
const targetOnly = filterSchoolCatalog({
  targetRecords: [{
    schoolId: targetId,
    schoolName: schools.find((item) => item.id === targetId).name,
    level: 'sprint'
  }],
  onlyTargets: true,
  targetLevels: ['sprint'],
  targetYear: 2027
})
assert.deepStrictEqual(targetOnly.map((item) => item.id), [targetId])

const combined = filterSchoolCatalog({
  keyword: '南航',
  districts: ['工业园区', '姑苏区'],
  referenceYears: [2026],
  currentScore: 650,
  targetYear: 2027
})
assert.ok(combined.length > 0)
assert.ok(combined.every((item) => ['工业园区', '姑苏区'].includes(item.district)))
assert.ok(combined.every((item) => item.referenceYear === 2026))
assert.deepStrictEqual(filterSchoolCatalog({ keyword: '__不存在的学校__' }), [])
assert.strictEqual(filterSchoolCatalog({}).length, 55)

installWxStorage()
const storage = loadStorageFresh()
assert.strictEqual(storage.ensureStorageMigrated().ok, true)
const persisted = {
  keyword: '南航',
  districts: ['工业园区', '姑苏区'],
  schoolTypes: ['普通高中'],
  referenceMode: 'latest',
  referenceYears: [],
  matchLevels: ['target'],
  targetLevels: ['sprint'],
  minReferenceScore: 600,
  maxReferenceScore: 700,
  favoritesOnly: true,
  targetsOnly: false,
  sortBy: 'difference'
}
assert.strictEqual(storage.saveSchoolFilters(persisted).ok, true)
assert.deepStrictEqual(storage.getSchoolFilters(), persisted)
assert.strictEqual(storage.saveSchoolFilters({}).ok, true)
assert.deepStrictEqual(storage.getSchoolFilters().districts, [])

const pageText = `${read('pages/schools/schools.js')}\n${read('pages/schools/schools.wxml')}`
for (const marker of [
  '所在区域',
  '成绩匹配',
  '参考分',
  '更多筛选',
  '只看收藏',
  '只看目标学校',
  '重置全部',
  'filterSummary',
  'clearOneFilter'
]) {
  assert.ok(pageText.includes(marker), `学校库缺少 ${marker}`)
}
for (const banned of [
  '住宿未核实',
  '信息未核实',
  '数据待核实',
  '地址未核实',
  '电话未核实',
  'needs_review',
  'unverified',
  '内部审核状态'
]) {
  assert.strictEqual(pageText.includes(banned), false, `学校库出现 ${banned}`)
}

console.log('RC9 SCHOOL FILTERS VERIFY PASSED')
console.log('- 真实选项、同类 OR/跨类 AND、年份/分数/成绩/收藏/目标/搜索组合、持久化与重置通过')
