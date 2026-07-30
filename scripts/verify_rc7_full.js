const assert = require('assert')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const { APP_CONFIG, EXAM_TOTAL_SCORE } = require('../config/app-config')
const { schools } = require('../data/schools')
const { admissionScores } = require('../data/admission-scores')
const { searchSchools } = require('../utils/school-search')
const { analyzeScore, latestReferenceScore } = require('../utils/score-analysis')
const {
  SCORE_RANGES,
  filterSchools,
  highestReferenceScoreForSchool
} = require('../utils/school')
const { summarizeScoreRecords, chartPoints } = require('../utils/score-trend')

function read(relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8')
}

function sha256(relative) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(root, relative))).digest('hex')
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name)
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'miniprogram_npm') {
      return []
    }
    return entry.isDirectory() ? walk(full) : [full]
  })
}

assert.ok(['1.7.0', '1.8.0', '1.9.0', '2.0.0'].includes(APP_CONFIG.version))
assert.deepStrictEqual(
  APP_CONFIG.targetScore.levels.map((item) => item.value),
  ['sprint', 'target', 'safe']
)
assert.strictEqual(APP_CONFIG.scoreRecord.maxRecords, 100)

for (const [keyword, expectedId] of [
  ['南航', 'nuaa_suzhou_affiliated_high_school'],
  ['十中', 'suzhou_no10_high_school'],
  ['南 航', 'nuaa_suzhou_affiliated_high_school']
]) {
  assert.ok(searchSchools({ keyword }).some((school) => school.id === expectedId), keyword)
}
assert.ok(searchSchools({ keyword: '园区' }).some((school) => school.district === '工业园区'))

for (const score of [0, 650, 740]) {
  assert.doesNotThrow(() => analyzeScore({ userScore: score, targetYear: 2027 }))
}
assert.throws(
  () => analyzeScore({ userScore: 741, targetYear: 2027 }),
  /0 to 740/
)

const memory = new Map()
global.wx = {
  getStorageSync: (key) => memory.get(key),
  setStorageSync: (key, value) => memory.set(key, value),
  removeStorageSync: (key) => memory.delete(key)
}
const storagePath = require.resolve('../utils/storage')
let storage = require(storagePath)

for (const [index, level] of ['sprint', 'target', 'safe'].entries()) {
  const school = schools[index]
  assert.strictEqual(storage.saveTargetRecord({
    id: `target_${school.id}`,
    schoolId: school.id,
    schoolName: school.name,
    level,
    createdAt: `2026-07-27T00:00:0${index}.000Z`
  }).ok, true)
}
assert.deepStrictEqual(
  new Set(storage.getTargetRecords().map((record) => record.level)),
  new Set(['sprint', 'target', 'safe'])
)

memory.set(storage.KEYS.targets, [{
  id: 'target_legacy',
  schoolId: 'legacy',
  schoolName: '旧版冲刺目标',
  level: 'challenge',
  createdAt: '2026-07-01T00:00:00.000Z'
}])
assert.strictEqual(storage.getTargetRecords()[0].level, 'sprint')

assert.strictEqual(storage.clearTargetRecords().ok, true)
for (const [index, score] of [0, 650, 740].entries()) {
  assert.strictEqual(storage.saveScoreRecord({
    id: `boundary_${index}`,
    date: `2026-09-0${index + 1}`,
    examName: `边界成绩 ${score}`,
    score,
    createdAt: `2026-09-0${index + 1}T08:00:00.000Z`
  }).ok, true)
}
assert.strictEqual(storage.saveScoreRecord({
  id: 'invalid_741',
  date: '2026-09-04',
  examName: '越界成绩',
  score: 741,
  createdAt: '2026-09-04T08:00:00.000Z'
}).ok, false)

delete require.cache[storagePath]
storage = require(storagePath)
assert.deepStrictEqual(storage.getScoreRecords().map((record) => record.score), [0, 650, 740])
assert.strictEqual(storage.deleteScoreRecord('boundary_1').ok, true)
assert.deepStrictEqual(storage.getScoreRecords().map((record) => record.score), [0, 740])
assert.strictEqual(storage.clearScoreRecords().ok, true)
assert.deepStrictEqual(storage.getScoreRecords(), [])

for (let index = 0; index < 105; index += 1) {
  assert.strictEqual(storage.saveScoreRecord({
    id: `limit_${index}`,
    date: '2026-10-01',
    examName: `第 ${index + 1} 次考试`,
    score: 500 + index,
    createdAt: new Date(Date.UTC(2026, 9, 1, 0, 0, index)).toISOString()
  }).ok, true)
}
assert.strictEqual(storage.getScoreRecords().length, 100)

const shortSummary = summarizeScoreRecords(storage.getScoreRecords().slice(0, 3))
assert.strictEqual(shortSummary.recentRecords.length, 3)
const trendRecords = Array.from({ length: 12 }, (_, index) => ({
  id: `trend_${index}`,
  date: `2026-10-${String(index + 1).padStart(2, '0')}`,
  createdAt: `2026-10-${String(index + 1).padStart(2, '0')}T08:00:00.000Z`,
  score: 600 + index * 5
}))
const trendSummary = summarizeScoreRecords(trendRecords)
assert.strictEqual(trendSummary.recentRecords.length, 10)
assert.strictEqual(trendSummary.highestText, '655 分')
assert.strictEqual(trendSummary.lowestText, '610 分')
assert.strictEqual(trendSummary.averageText, '632.5 分')
assert.strictEqual(trendSummary.changeText, '650 → 655')
assert.strictEqual(trendSummary.changeValueText, '提升 +5 分')
assert.strictEqual(chartPoints(trendSummary.recentRecords, 640, 280).length, 10)

assert.deepStrictEqual(SCORE_RANGES, ['全部', '500以下', '500-600', '600-650', '650以上'])
assert.strictEqual(highestReferenceScoreForSchool('nuaa_suzhou_affiliated_high_school', 2027), 583)
assert.deepStrictEqual(
  latestReferenceScore([
    { id: 'older_high', year: 2025, minScore: 690 },
    { id: 'latest_low', year: 2026, minScore: 675 },
    { id: 'latest_high', year: 2026, minScore: 680 },
    { id: 'future', year: 2028, minScore: 700 }
  ], 2027),
  { id: 'latest_high', year: 2026, minScore: 680 }
)
const combinedResults = filterSchools({
  keyword: '南航',
  scoreRange: '650以上',
  targetYear: 2027,
  referenceYears: [2025]
})
assert.ok(combinedResults.some((school) => school.id === 'nuaa_suzhou_affiliated_high_school'))
const targetFiltered = filterSchools({
  targetLevel: 'sprint',
  targetRecords: [{
    schoolId: 'suzhou_high_school',
    schoolName: '江苏省苏州中学校',
    level: 'sprint'
  }],
  targetYear: 2027
})
assert.deepStrictEqual(targetFiltered.map((school) => school.id), ['suzhou_high_school'])

const homeText = [read('pages/home/home.js'), read('pages/home/home.wxml')].join('\n')
for (const phrase of [
  '中考倒计时',
  'latestExamName',
  'latestExamDate',
  'latestScoreText',
  'scoreChangeText',
  'primaryTargetName',
  'targetReferenceText',
  'targetDifferenceText',
  'stageGoalTitle',
  'stageGoalDeadline',
  'openScoreCenter',
  'openRecommendations',
  'openTargetPlanning'
]) {
  assert.ok(homeText.includes(phrase), `home missing ${phrase}`)
}
for (const phrase of ['RC6', 'RC7', '开发说明', '技术说明', '测试说明']) {
  assert.strictEqual(read('pages/home/home.wxml').includes(phrase), false)
}

const trendText = [
  read('pages/score-trend/score-trend.js'),
  read('pages/score-trend/score-trend.wxml')
].join('\n')
for (const phrase of ['DEFAULT_LIMIT', 'createCanvasContext', '最高分', '最低分', '平均分']) {
  assert.ok(
    trendText.includes(phrase) || read('utils/score-trend.js').includes(phrase),
    `trend missing ${phrase}`
  )
}

const compareText = [
  read('pages/school-compare/school-compare.js'),
  read('pages/school-compare/school-compare.wxml')
].join('\n')
for (const phrase of ['最多对比 3 所学校', '目标状态', '历史分数线', '最新参考分', '当前分差']) {
  assert.ok(compareText.includes(phrase), `compare missing ${phrase}`)
}
assert.ok(compareText.includes('selectedSchools.length >= 2'))

const detailText = [
  read('pages/school-detail/school-detail.js'),
  read('pages/school-detail/school-detail.wxml')
].join('\n')
for (const phrase of ['我的目标分析', 'currentScoreText', 'referenceScoreText', 'gapText', 'targetLevelText']) {
  assert.ok(detailText.includes(phrase), `detail missing ${phrase}`)
}

const projectConfig = JSON.parse(read('project.config.json'))
assert.strictEqual(projectConfig.appid, 'wx17e903f81714736f')
assert.strictEqual(schools.length, 55)
assert.strictEqual(admissionScores.length, 146)
assert.strictEqual(admissionScores.filter((item) => item.year === 2025).length, 103)
assert.strictEqual(admissionScores.filter((item) => item.year === 2026).length, 43)
assert.ok(admissionScores.every((item) => item.minScore <= EXAM_TOTAL_SCORE))
assert.strictEqual(sha256('data/schools.js'), 'c185182c8dd8577b3165278c16014dbff98249585cf76bd1182b6ea1581d62f2')
assert.strictEqual(sha256('data/admission-scores.js'), '0d6257cd336dee5afe853d6c4d9ece68e1cefe2bb56a652cb8f8c651a14ccf88')

const runtimeText = ['app.js', 'app.json', 'config', 'data', 'pages', 'utils']
  .flatMap((relative) => {
    const target = path.join(root, relative)
    return fs.statSync(target).isDirectory() ? walk(target) : [target]
  })
  .filter((file) => /\.(?:js|json|wxml|wxss)$/.test(file))
  .map((file) => fs.readFileSync(file, 'utf8'))
  .join('\n')
for (const forbidden of [
  'wx.' + 'login',
  'wx.' + 'request',
  'wx.' + 'cloud',
  'wx.' + 'getLocation',
  'wx.' + 'requestPayment',
  'getPhoneNumber',
  '保证录取',
  '预测录取',
  '一定录取'
]) {
  assert.strictEqual(runtimeText.includes(forbidden), false, `forbidden runtime marker: ${forbidden}`)
}

console.log('RC7-FULL VERIFY PASSED')
console.log('- 搜索：南航、十中、园区、空格关键词通过')
console.log('- 成绩：0、650、740 有效，741 拒绝；新增、重启读取、删除、清空、100 条上限通过')
console.log('- 趋势：少于 10 条与最近 10 条、最高/最低/平均/变化、原生 Canvas 通过')
console.log('- 目标：sprint/target/safe、旧 challenge 兼容、历史参考目标与详情分析卡通过')
console.log('- 对比与筛选：1 至 3 所约束、分数范围、目标类型、南航 + 650以上组合通过')
console.log('- 数据与边界：55 所、146 条、2025=103、2026=43、740、AppID 与纯本地边界通过')
