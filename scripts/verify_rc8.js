const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')
const appJson = JSON.parse(read('app.json'))
const projectConfig = JSON.parse(read('project.config.json'))
const { APP_CONFIG, EXAM_TOTAL_SCORE } = require('../config/app-config')
const { schools } = require('../data/schools')
const { admissionScores } = require('../data/admission-scores')
const trend = require('../utils/score-trend')
const analysis = require('../utils/score-analysis')

assert.ok(['1.8.0', '1.9.0', '2.0.0'].includes(APP_CONFIG.version))
assert.deepStrictEqual(
  appJson.tabBar.list.map((item) => [item.pagePath, item.text]),
  [
    ['pages/home/home', '首页'],
    ['pages/schools/schools', '学校库'],
    ['pages/score-trend/score-trend', '成绩'],
    ['pages/targets/targets', '目标规划'],
    ['pages/profile/profile', '我的']
  ]
)
assert.strictEqual(appJson.tabBar.list.some((item) => item.pagePath.includes('favorites')), false)
assert.ok(appJson.pages.includes('pages/data-management/data-management'))

const targetsText = `${read('pages/targets/targets.js')}\n${read('pages/targets/targets.wxml')}`
for (const phrase of ['目标学校', '阶段目标', 'learningRecords', 'saveLearningTarget']) {
  assert.ok(targetsText.includes(phrase), `target planning missing ${phrase}`)
}

const profileText = `${read('pages/profile/profile.js')}\n${read('pages/profile/profile.wxml')}`
for (const phrase of ['收藏汇总', '备份与恢复', '数据管理', '帮助与反馈']) {
  assert.ok(profileText.includes(phrase), `profile missing ${phrase}`)
}

const dataManagementText = `${read('pages/data-management/data-management.js')}\n${read('pages/data-management/data-management.wxml')}`
assert.ok(dataManagementText.includes('clearLocalData'))
assert.ok(dataManagementText.includes('清除全部本地数据'))

const forbiddenPageText = [
  'pages/home/home.wxml',
  'pages/favorites/favorites.wxml',
  'pages/target-analysis/target-analysis.wxml',
  'pages/score-trend/score-trend.wxml',
  'pages/school-compare/school-compare.wxml',
  'pages/targets/targets.wxml',
  'pages/profile/profile.wxml'
].map(read).join('\n')
for (const phrase of [
  '使用边界',
  '分析口径',
  '版本 1.7.0',
  '高中目标规划完整升级版',
  '内置数据核对日期',
  '在本机收藏范围内智能搜索',
  '使用已收录历史分数线和固定分差区间整理目标参考',
  '学校 55',
  '历史分数线 146',
  '目标学校和等级仅保存在本机',
  '数据概况'
]) {
  assert.strictEqual(forbiddenPageText.includes(phrase), false, `redundant runtime phrase: ${phrase}`)
}
assert.ok(read('config/app-config.js').includes('历史分数线怎么理解'))
assert.ok(read('pages/privacy/privacy.wxml').includes('sections'))

function record(id, date, score, createdAt = `${date}T08:00:00.000Z`) {
  return { id, date, examName: id, score, createdAt }
}

for (const count of [0, 1, 2, 3, 10, 11]) {
  const records = Array.from(
    { length: count },
    (_, index) => record(
      `score_${String(index).padStart(2, '0')}`,
      `2026-09-${String(index + 1).padStart(2, '0')}`,
      600 + index
    )
  )
  const prepared = trend.prepareScoreTrendData(records, { width: 320, height: 280, padding: 38 })
  assert.strictEqual(prepared.visibleRecords.length, Math.min(count, 10))
  assert.strictEqual(prepared.visibleTrendPoints.length, Math.min(count, 10))
  assert.deepStrictEqual(
    prepared.visibleTrendPoints.map((item) => item.id),
    prepared.visibleRecords.map((item) => item.id)
  )
  assert.ok(
    prepared.visibleTrendPoints.every(
      (item) => item.x >= 38 && item.x <= 282 && item.y >= 38 && item.y <= 242
    )
  )
}

const duplicateScores = [
  record('first_740', '2026-09-01', 740, '2026-09-01T08:00:00.000Z'),
  record('second_740', '2026-09-01', 740, '2026-09-01T09:00:00.000Z'),
  record('third_650', '2026-09-02', 650)
]
const duplicatePrepared = trend.prepareScoreTrendData(duplicateScores, { width: 320, height: 280, padding: 38 })
assert.deepStrictEqual(
  duplicatePrepared.visibleRecords.map((item) => item.id),
  ['first_740', 'second_740', 'third_650']
)
assert.strictEqual(duplicatePrepared.visibleTrendPoints.length, 3)
assert.strictEqual(duplicatePrepared.visibleTrendPoints[0].y, duplicatePrepared.visibleTrendPoints[1].y)
assert.ok(duplicatePrepared.visibleTrendPoints[2].y > duplicatePrepared.visibleTrendPoints[1].y)
assert.strictEqual(duplicatePrepared.statistics.highest, 740)
assert.strictEqual(duplicatePrepared.statistics.lowest, 650)
assert.strictEqual(duplicatePrepared.statistics.average, 710)
assert.strictEqual(duplicatePrepared.statistics.change, -90)

assert.strictEqual(analysis.classifyDifference(-31), null)
assert.strictEqual(analysis.classifyDifference(-30), 'sprint')
assert.strictEqual(analysis.classifyDifference(-1), 'sprint')
assert.strictEqual(analysis.classifyDifference(0), 'target')
assert.strictEqual(analysis.classifyDifference(15), 'target')
assert.strictEqual(analysis.classifyDifference(16), 'safe')

const sampleSchools = [
  { id: 'sprint30', name: '冲刺三十', district: '姑苏区', schoolType: '普通高中' },
  { id: 'sprint1', name: '冲刺一', district: '姑苏区', schoolType: '普通高中' },
  { id: 'target0', name: '目标零', district: '吴中区', schoolType: '普通高中' },
  { id: 'target15', name: '目标十五', district: '吴中区', schoolType: '普通高中' },
  { id: 'safe16', name: '保底十六', district: '相城区', schoolType: '普通高中' },
  { id: 'no_score', name: '无分数学校', district: '相城区', schoolType: '普通高中' }
]
const sampleScores = [
  { id: 'sprint30', schoolId: 'sprint30', year: 2026, minScore: 680 },
  { id: 'sprint1', schoolId: 'sprint1', year: 2026, minScore: 651 },
  { id: 'target0', schoolId: 'target0', year: 2026, minScore: 650 },
  { id: 'target15', schoolId: 'target15', year: 2026, minScore: 635 },
  { id: 'safe16', schoolId: 'safe16', year: 2026, minScore: 634 }
]
const recommendations = analysis.analyzeScore({
  userScore: 650,
  targetYear: 2027,
  schools: sampleSchools,
  scores: sampleScores
})
assert.deepStrictEqual(
  recommendations.map((item) => item.level),
  ['sprint', 'sprint', 'target', 'target', 'safe']
)
assert.strictEqual(new Set(recommendations.map((item) => item.schoolId)).size, recommendations.length)
assert.ok(recommendations.every((item) => sampleSchools.some((school) => school.id === item.schoolId)))
for (const score of [0, 1, 650, 739, 740]) {
  assert.doesNotThrow(() => analysis.analyzeScore({ userScore: score, targetYear: 2027 }))
}
for (const score of [-1, 650.5, 741]) {
  assert.throws(() => analysis.analyzeScore({ userScore: score, targetYear: 2027 }))
}

const memory = new Map()
const routes = []
global.wx = {
  getStorageSync: (key) => memory.get(key),
  setStorageSync: (key, value) => memory.set(key, value),
  removeStorageSync: (key) => memory.delete(key),
  switchTab: ({ url }) => routes.push(url)
}
const storage = require('../utils/storage')
const onboarding = require('../utils/onboarding')
assert.strictEqual(storage.ensureStorageMigrated().ok, true)

assert.strictEqual(storage.saveTargetRecord({
  id: 'target_school',
  schoolId: schools[0].id,
  schoolName: schools[0].name,
  level: 'sprint',
  referenceScore: 650,
  referenceYear: 2026,
  createdAt: '2026-07-27T00:00:00.000Z'
}).ok, true)
assert.strictEqual(storage.saveTargetRecord({
  id: 'target_school_updated',
  schoolId: schools[0].id,
  schoolName: schools[0].name,
  level: 'safe',
  referenceScore: 620,
  referenceYear: 2026,
  createdAt: '2026-07-27T01:00:00.000Z'
}).ok, true)
assert.strictEqual(storage.getTargetRecords().length, 1)
assert.strictEqual(storage.getTargetRecords()[0].level, 'safe')
assert.strictEqual(storage.getTargetRecords()[0].referenceScore, 620)

assert.strictEqual(storage.saveLearningTargetRecord({
  id: 'learning_1',
  stage: '下次月考',
  targetScore: 680,
  note: '复盘数学',
  createdAt: '2026-07-27T00:00:00.000Z'
}).ok, true)
assert.strictEqual(storage.getLearningTargetRecords().length, 1)

const businessKeys = [
  storage.KEYS.profiles,
  storage.KEYS.activeProfileId,
  storage.KEYS.profileData,
  storage.KEYS.sharedFavorites,
  storage.KEYS.storageSchemaVersion
]
const existingBusinessValues = new Map(businessKeys.map((key) => [key, memory.get(key)]))
let overlay = onboarding.onboardingForPage('/pages/home/home', { autoStart: true })
assert.strictEqual(overlay.visible, true)
assert.strictEqual(onboarding.ONBOARDING_STEPS.length, 7)
onboarding.handleOnboardingAction({ detail: { action: 'next' } })
assert.strictEqual(storage.getOnboardingState().currentStep, 1)
onboarding.handleOnboardingAction({ detail: { action: 'previous' } })
assert.strictEqual(storage.getOnboardingState().currentStep, 0)
onboarding.handleOnboardingAction({ detail: { action: 'skip' } })
assert.strictEqual(storage.getOnboardingState().skipped, true)
onboarding.replayOnboarding()
for (let index = 0; index < 6; index += 1) {
  onboarding.handleOnboardingAction({ detail: { action: 'next' } })
}
onboarding.handleOnboardingAction({ detail: { action: 'complete' } })
assert.strictEqual(storage.getOnboardingState().completed, true)
for (const key of businessKeys) assert.deepStrictEqual(memory.get(key), existingBusinessValues.get(key))
assert.ok(routes.includes('/pages/targets/targets'))

assert.strictEqual(projectConfig.appid, 'wxc2a2a94f767438dd')
assert.strictEqual(schools.length, 55)
assert.strictEqual(admissionScores.length, 146)
assert.strictEqual(admissionScores.filter((item) => item.year === 2025).length, 103)
assert.strictEqual(admissionScores.filter((item) => item.year === 2026).length, 43)
assert.strictEqual(EXAM_TOTAL_SCORE, 740)
assert.ok(admissionScores.every((item) => item.minScore <= EXAM_TOTAL_SCORE))

const runtime = [
  'app.js',
  'app.json',
  'config/app-config.js',
  ...fs.readdirSync(path.join(root, 'utils')).map((name) => `utils/${name}`)
].filter((relative) => /\.(?:js|json)$/.test(relative)).map(read).join('\n')
for (const marker of [
  'wx.' + 'login',
  'wx.' + 'cloud',
  'wx.' + 'request',
  'requestPayment',
  'getLocation',
  'getPhoneNumber',
  'openai',
  '保证录取',
  '一定考上',
  '录取成功率',
  '精准预测'
]) {
  assert.strictEqual(runtime.toLowerCase().includes(marker.toLowerCase()), false, marker)
}

console.log('RC8 VERIFY PASSED')
console.log('- 导航与入口：5 Tab、收藏/对比/数据管理/教程入口通过')
console.log('- 页面精简：指定冗余运行时文案已移除')
console.log('- 趋势：0/1/2/3/10/11、740/740/650、同日、排序、统计、坐标与 ID 一致通过')
console.log('- 推荐：0/1/650/739/740、边界、互斥、排序、schoolId、目标更新通过')
console.log('- 教程：7 步、首次、上一步、下一步、跳过、重播、完成且不写业务数据通过')
console.log('- 数据与安全：55、146、2025=103、2026=43、740、AppID、纯本地边界通过')
