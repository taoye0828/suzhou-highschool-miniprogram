const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const { APP_CONFIG, EXAM_TOTAL_SCORE } = require('../config/app-config')
const { schools } = require('../data/schools')
const { admissionScores } = require('../data/admission-scores')
const {
  classifyDifference,
  latestReferenceScore,
  analyzeScore
} = require('../utils/score-analysis')
const { calculateExamCountdown } = require('../utils/countdown')
const { KEYS } = require('../utils/storage')

const expectedPages = [
  'pages/target-analysis/target-analysis',
  'pages/school-compare/school-compare',
  'pages/score-trend/score-trend'
]

function read(relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8')
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name)
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'miniprogram_npm') return []
    return entry.isDirectory() ? walk(full) : [full]
  })
}

assert.ok(['1.6.0', '1.7.0', '1.8.0', '1.9.0', '2.0.0'].includes(APP_CONFIG.version))
assert.strictEqual(APP_CONFIG.countdown.defaultYear, 2027)
assert.strictEqual(APP_CONFIG.targetScore.max, EXAM_TOTAL_SCORE)
assert.deepStrictEqual(
  APP_CONFIG.targetScore.levels.map((item) => item.value),
  ['sprint', 'target', 'safe']
)

const appJson = JSON.parse(read('app.json'))
for (const page of expectedPages) {
  assert.ok(appJson.pages.includes(page), `${page} must be registered`)
  for (const extension of ['js', 'json', 'wxml', 'wxss']) {
    assert.ok(fs.existsSync(path.join(root, `${page}.${extension}`)), `${page}.${extension} must exist`)
  }
}
assert.strictEqual(appJson.tabBar.list.length, 5)
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
const compatibilitySource = [
  read('pages/target-analysis/target-analysis.js'),
  read('pages/target-analysis/target-analysis.wxml')
].join('\n')
for (const phrase of ['targetCenterSegment', '/pages/targets/targets', 'switchTab']) {
  assert.ok(compatibilitySource.includes(phrase), `target-analysis compatibility redirect missing ${phrase}`)
}

assert.strictEqual(schools.length, 55)
assert.strictEqual(admissionScores.length, 146)
assert.strictEqual(admissionScores.filter((item) => item.year === 2025).length, 103)
assert.strictEqual(admissionScores.filter((item) => item.year === 2026).length, 43)
assert.ok(admissionScores.every((item) => item.minScore <= EXAM_TOTAL_SCORE))

assert.strictEqual(classifyDifference(-31), null)
assert.strictEqual(classifyDifference(-30), 'sprint')
assert.strictEqual(classifyDifference(-1), 'sprint')
assert.strictEqual(classifyDifference(0), 'target')
assert.strictEqual(classifyDifference(15), 'target')
assert.strictEqual(classifyDifference(16), 'safe')
assert.strictEqual(
  latestReferenceScore([
    { year: 2025, minScore: 690 },
    { year: 2026, minScore: 675 },
    { year: 2026, minScore: 680 }
  ], 2027).minScore,
  680
)
assert.ok(analyzeScore({ userScore: 650, targetYear: 2027 }).length > 0)

const countdown = calculateExamCountdown(2027, new Date(2026, 6, 25))
assert.strictEqual(countdown.targetDate, '2027-06-17')
assert.strictEqual(countdown.daysRemaining, 327)

assert.ok(KEYS.scoreRecords)
assert.ok(KEYS.examYear)

const targetStorageSource = [
  read('utils/storage.js'),
  read('utils/rc9-storage.js'),
  read('utils/rc9-models.js')
].join('\n')
for (const field of ['schoolId', 'schoolName', 'level']) {
  assert.ok(targetStorageSource.includes(field), `target record must include ${field}`)
}
const schoolDetailSource = read('pages/school-detail/school-detail.js')
assert.ok(schoolDetailSource.includes('saveSchoolTarget'))
assert.ok(schoolDetailSource.includes('saveTargetRecord'))
const targetsPageSource = [
  read('pages/targets/targets.js'),
  read('pages/targets/targets.wxml')
].join('\n')
assert.ok(targetsPageSource.includes('schoolName'))
assert.ok(targetsPageSource.includes('levelLabel'))

const runtimeFiles = ['app.js', 'app.json', 'config', 'data', 'pages', 'utils']
  .flatMap((relative) => {
    const target = path.join(root, relative)
    return fs.statSync(target).isDirectory() ? walk(target) : [target]
  })
  .filter((file) => /\.(?:js|json|wxml|wxss)$/.test(file))

const runtimeText = runtimeFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n')
for (const forbidden of [
  'wx.' + 'login',
  'wx.' + 'request',
  'wx.' + 'cloud',
  'wx.' + 'getLocation',
  'wx.' + 'requestPayment',
  'getPhoneNumber'
]) {
  assert.strictEqual(runtimeText.includes(forbidden), false, `forbidden runtime API: ${forbidden}`)
}
assert.strictEqual(
  APP_CONFIG.policy.planningDisclaimer,
  '历史公开数据整理，仅供目标规划参考。'
)
for (const phrase of [
  '固定历史分差区间',
  '成绩记录和中考目标年份只保存在本机',
  APP_CONFIG.policy.planningDisclaimer
]) {
  assert.ok(runtimeText.includes(phrase), `missing boundary copy: ${phrase}`)
}
assert.ok(read('pages/data-info/data-info.wxml').includes('sections'))

const suspiciousBackups = walk(root)
  .map((file) => path.relative(root, file))
  .filter((relative) => /\.bak(?:_|$)/i.test(path.basename(relative)))
assert.deepStrictEqual(suspiciousBackups, [])

console.log('FINAL-RC6 UPGRADE VERIFY PASSED')
console.log(`- 页面：${expectedPages.length} 个新增页面，tabBar 保持 5 项`)
console.log(`- 数据：${schools.length} 所学校，${admissionScores.length} 条历史分数线`)
console.log('- 本地增强：成绩分析、学校对比、中考倒计时、成绩趋势、目标等级')
