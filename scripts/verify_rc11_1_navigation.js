const assert = require('assert')
const { readJson, read, installWxStorage } = require('./rc9_test_helpers')
const {
  FakeNavigationObserver,
  installApp,
  loadPage,
  createPageInstance
} = require('./rc11_1_test_harness')

installWxStorage()
const observer = new FakeNavigationObserver()
installApp(observer)
const app = readJson('app.json')
assert.deepStrictEqual(
  app.tabBar.list.map((item) => [item.pagePath, item.text]),
  [
    ['pages/home/home', '首页'],
    ['pages/schools/schools', '学校库'],
    ['pages/score-trend/score-trend', '成绩'],
    ['pages/targets/targets', '目标规划'],
    ['pages/profile/profile', '我的']
  ]
)
assert.strictEqual(app.tabBar.list.length, 5)

const legacy = createPageInstance(loadPage('pages/target-analysis/target-analysis'))
legacy.onLoad()
assert.deepStrictEqual(observer.events, [
  { kind: 'switchTab', url: '/pages/targets/targets' }
])
assert.ok(read('pages/target-analysis/target-analysis.js').includes("targetCenterSegment = 'recommendation'"))
for (const forbidden of ['setStorageSync', 'getStorageSync', 'saveTargetRecord', 'analyzeScore(']) {
  assert.strictEqual(read('pages/target-analysis/target-analysis.js').includes(forbidden), false)
}
const runtime = [
  read('pages/home/home.js'),
  read('pages/schools/schools.js'),
  read('pages/score-trend/score-trend.js'),
  read('pages/targets/targets.js'),
  read('pages/profile/profile.js')
].join('\n')
assert.strictEqual(runtime.includes("switchTab({ url: '/pages/target-analysis/target-analysis'"), false)

console.log('RC11-1 NAVIGATION PASSED (5 tabs, legacy redirect 1 hop)')
