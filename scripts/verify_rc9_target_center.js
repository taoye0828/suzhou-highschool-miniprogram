const assert = require('assert')
const {
  installWxStorage,
  loadStorageFresh,
  makeExam,
  read
} = require('./rc9_test_helpers')
const { analyzeScore } = require('../utils/score-analysis')
const {
  DEFAULT_RECOMMENDATION_SETTINGS
} = require('../utils/rc9-models')
const {
  selectReferenceForSchool,
  selectGapTrajectory
} = require('../utils/planning')
const { schools } = require('../data/schools')
const { admissionScores } = require('../data/admission-scores')

const defaultResults = analyzeScore({ userScore: 650, targetYear: 2027 })
const explicitDefaults = analyzeScore({
  userScore: 650,
  targetYear: 2027,
  settings: DEFAULT_RECOMMENDATION_SETTINGS
})
assert.deepStrictEqual(explicitDefaults, defaultResults)
for (const level of ['sprint', 'target', 'safe']) {
  assert.ok(defaultResults.filter((item) => item.level === level).length <= 5)
}

const sampleSchools = Array.from({ length: 18 }, (_, index) => ({
  id: `school_${index}`,
  name: `样本学校 ${String(index).padStart(2, '0')}`,
  district: index % 2 ? '区域甲' : '区域乙',
  schoolType: index % 3 ? '普通高中' : '高级中学'
}))
const referenceScores = [
  680, 675, 670, 665, 660, 655,
  650, 648, 646, 644, 642, 640,
  634, 630, 625, 620, 615, 610
]
const sampleScores = sampleSchools.map((school, index) => ({
  id: `score_${index}`,
  schoolId: school.id,
  year: 2026,
  minScore: referenceScores[index]
}))
const limited = analyzeScore({
  userScore: 650,
  targetYear: 2027,
  schools: sampleSchools,
  scores: sampleScores
})
assert.deepStrictEqual(
  ['sprint', 'target', 'safe'].map((level) =>
    limited.filter((item) => item.level === level).length
  ),
  [5, 5, 5]
)

const fallbackSchools = [{
  id: 'fallback',
  name: '回退学校',
  district: '区域甲',
  schoolType: '普通高中'
}]
const fallbackScores = [
  { id: 'old', schoolId: 'fallback', year: 2025, minScore: 640 },
  { id: 'future', schoolId: 'fallback', year: 2028, minScore: 700 }
]
assert.strictEqual(analyzeScore({
  userScore: 650,
  targetYear: 2027,
  schools: fallbackSchools,
  scores: fallbackScores
})[0].year, 2025)
assert.deepStrictEqual(analyzeScore({
  userScore: 650,
  targetYear: 2027,
  schools: fallbackSchools,
  scores: fallbackScores,
  settings: { allow2025Fallback: false }
}), [])
assert.deepStrictEqual(analyzeScore({
  userScore: 650,
  targetYear: 2027,
  schools: fallbackSchools,
  scores: fallbackScores,
  settings: { require2026: true }
}), [])

const multiReference = selectReferenceForSchool('same', 2027, [
  { id: '2025-high', schoolId: 'same', year: 2025, minScore: 700 },
  { id: '2026-low', schoolId: 'same', year: 2026, minScore: 660 },
  { id: '2026-high', schoolId: 'same', year: 2026, minScore: 680 }
])
assert.strictEqual(multiReference.id, '2026-high')

const favoriteFiltered = analyzeScore({
  userScore: 650,
  targetYear: 2027,
  schools: sampleSchools,
  scores: sampleScores,
  settings: {
    favoritesOnly: true,
    favoriteIds: ['school_0', 'school_7']
  }
})
assert.deepStrictEqual(
  new Set(favoriteFiltered.map((item) => item.schoolId)),
  new Set(['school_0', 'school_7'])
)
const excludedTarget = analyzeScore({
  userScore: 650,
  targetYear: 2027,
  schools: sampleSchools,
  scores: sampleScores,
  targetRecords: [{ schoolId: 'school_0' }],
  settings: { excludeTargetSchools: true }
})
assert.strictEqual(excludedTarget.some((item) => item.schoolId === 'school_0'), false)

installWxStorage()
const storage = loadStorageFresh()
assert.strictEqual(storage.ensureStorageMigrated().ok, true)
const targetSchool = schools.find((school) =>
  selectReferenceForSchool(school.id, 2027, admissionScores)
)
assert.ok(targetSchool)
assert.strictEqual(storage.saveTargetRecord({
  schoolId: targetSchool.id,
  schoolName: targetSchool.name,
  level: 'sprint',
  createdAt: '2026-08-01T08:00:00.000Z'
}).ok, true)
assert.strictEqual(storage.saveTargetRecord({
  schoolId: targetSchool.id,
  schoolName: targetSchool.name,
  level: 'target',
  createdAt: '2026-08-02T08:00:00.000Z'
}).ok, true)
assert.strictEqual(storage.getTargetRecords().length, 1)
assert.strictEqual(storage.setPrimaryTargetSchool(targetSchool.id).ok, true)
assert.strictEqual(storage.getPrimaryTargetSchoolId(), targetSchool.id)

for (const [index, score] of [620, 635, 650, 660].entries()) {
  assert.strictEqual(storage.saveScoreRecord(makeExam(
    `trajectory_${index}`,
    score,
    `2026-09-0${index + 1}`
  )).ok, true)
}
const fixedReference = { year: 2026, minScore: 655 }
assert.deepStrictEqual(
  selectGapTrajectory(storage.getScoreRecords(), fixedReference)
    .map((item) => item.difference),
  [-35, -20, -5, 5]
)
assert.strictEqual(storage.getTargetRecords()[0].level, 'target')

const pageText = `${read('pages/targets/targets.js')}\n${read('pages/targets/targets.wxml')}`
for (const marker of [
  '历史分差参考',
  '目标学校',
  '学习目标',
  'setPrimaryTargetSchool',
  '分差轨迹',
  'visibleTrendPoints',
  'recommendationSettings',
  'targetSubjects',
  'weeklyTasks',
  'isDraft'
]) {
  assert.ok(pageText.includes(marker), `目标规划缺少 ${marker}`)
}
for (const forbidden of ['录取概率', '成功率', '保证录取', '精准预测']) {
  assert.strictEqual(pageText.includes(forbidden), false)
}

console.log('RC9 TARGET CENTER VERIFY PASSED')
console.log('- 默认推荐、每类 5 所、2026/2025 回退、筛选、目标去重/主要目标与 -35/-20/-5/+5 轨迹通过')
