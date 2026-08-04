const assert = require('assert')
const {
  read,
  readJson
} = require('./rc9_test_helpers')

const appJson = readJson('app.json')
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
assert.strictEqual(appJson.tabBar.list.length, 5)
for (const page of [
  'pages/profile-management/profile-management',
  'pages/backup-restore/backup-restore',
  'pages/help/help',
  'pages/target-analysis/target-analysis'
]) {
  assert.ok(appJson.pages.includes(page), `${page} 未注册`)
}
assert.strictEqual(
  appJson.tabBar.list.some((item) => item.pagePath === 'pages/target-analysis/target-analysis'),
  false
)

const home = `${read('pages/home/home.js')}\n${read('pages/home/home.wxml')}`
for (const marker of [
  '中考倒计时',
  'latestExamName',
  'latestScoreText',
  '主要目标',
  '当前阶段目标',
  'openScoreCenter',
  'openRecommendations',
  'openTargetPlanning'
]) {
  assert.ok(home.includes(marker), `首页缺少 ${marker}`)
}
for (const removed of [
  'onScoreInput',
  'startScoreAnalysis',
  'onSchoolKeywordInput',
  'openSchoolResult',
  '55所学校统计',
  '146条分数线'
]) {
  assert.strictEqual(home.includes(removed), false, `首页仍有重复实现 ${removed}`)
}

const scoreCenter = `${read('pages/score-trend/score-trend.js')}\n${read('pages/score-trend/score-trend.wxml')}`
for (const marker of ['记录', '趋势', '复盘', 'saveScoreRecord', 'visibleTrendPoints']) {
  assert.ok(scoreCenter.includes(marker), `成绩中心缺少 ${marker}`)
}

const targetCenter = `${read('pages/targets/targets.js')}\n${read('pages/targets/targets.wxml')}`
for (const marker of ['推荐', '目标学校', '学习目标', 'saveTargetRecord', 'saveLearningTargetRecord']) {
  assert.ok(targetCenter.includes(marker), `目标规划缺少 ${marker}`)
}

const compatibility = `${read('pages/target-analysis/target-analysis.js')}\n${read('pages/target-analysis/target-analysis.wxml')}`
assert.ok(compatibility.includes("targetCenterSegment = 'recommendation'"))
assert.ok(compatibility.includes('/pages/targets/targets'))
assert.strictEqual(compatibility.includes('analyzeScore'), false)

const profile = `${read('pages/profile/profile.js')}\n${read('pages/profile/profile.wxml')}`
for (const marker of [
  '当前档案',
  'openProfiles',
  '最近浏览',
  '收藏汇总',
  '备份与恢复',
  '数据管理',
  '帮助与反馈',
  '数据说明',
  '隐私说明',
  '默认目标年份'
]) {
  assert.ok(profile.includes(marker), `我的缺少 ${marker}`)
}

console.log('RC9 NAVIGATION FUSION VERIFY PASSED')
console.log('- 五个 Tab、首页总览、成绩三段、目标三段、兼容跳转与我的低频管理归属通过')
