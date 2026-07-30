const assert = require('assert')
const {
  clone,
  installWxStorage,
  loadStorageFresh,
  read
} = require('./rc9_test_helpers')

const harness = installWxStorage()
const routes = []
global.wx.switchTab = ({ url }) => routes.push({ type: 'tab', url })
global.wx.navigateTo = ({ url }) => routes.push({ type: 'page', url })
const storage = loadStorageFresh()
assert.strictEqual(storage.ensureStorageMigrated().ok, true)
const onboarding = require('../utils/onboarding')

assert.strictEqual(onboarding.ONBOARDING_STEPS.length, 7)
assert.deepStrictEqual(
  Object.keys(onboarding.FEATURE_TUTORIALS).sort(),
  [
    'backup_restore',
    'home',
    'school_filters',
    'score_records',
    'score_trend',
    'student_profiles',
    'target_planning'
  ]
)
for (const [flow, steps] of Object.entries(onboarding.FEATURE_TUTORIALS)) {
  assert.ok(steps.length >= 1, `${flow} must have steps`)
  assert.ok(steps.every((step) => step.page && step.selector && step.title && step.description))
}

const beforeBusinessData = clone(harness.memory.get(storage.KEYS.profileData))
let overlay = onboarding.onboardingForPage('/pages/home/home', { autoStart: true })
assert.strictEqual(overlay.visible, true)
assert.strictEqual(overlay.step.total, 7)
onboarding.handleOnboardingAction({ detail: { action: 'next' } })
assert.strictEqual(storage.getOnboardingState().currentStep, 1)
assert.ok(routes.some((item) => item.url === '/pages/targets/targets'))
onboarding.handleOnboardingAction({ detail: { action: 'previous' } })
assert.strictEqual(storage.getOnboardingState().currentStep, 0)
onboarding.handleOnboardingAction({ detail: { action: 'skip' } })
assert.strictEqual(storage.getOnboardingState().skipped, true)

onboarding.replayOnboarding('score_trend')
overlay = onboarding.onboardingForPage('/pages/score-trend/score-trend')
assert.strictEqual(overlay.visible, true)
assert.strictEqual(overlay.step.total, 1)
onboarding.handleOnboardingAction({ detail: { action: 'complete' } })
assert.strictEqual(storage.getOnboardingState().completed, true)
assert.deepStrictEqual(harness.memory.get(storage.KEYS.profileData), beforeBusinessData)

const helpText = `${read('pages/help/help.js')}\n${read('pages/help/help.wxml')}`
for (const phrase of [
  '分数线从哪里来',
  '推荐是不是录取预测',
  '数据保存在哪里',
  '如何备份',
  '如何切换学生',
  '为什么某些学校字段不显示',
  '如何清除数据',
  '如何重新播放教程',
  '重播完整 7 步教程'
]) {
  assert.ok(helpText.includes(phrase), `帮助中心缺少：${phrase}`)
}
assert.ok(helpText.includes('不会创建或修改业务数据') ||
  helpText.includes('不会创建成绩、收藏或目标'))

console.log('RC9 ONBOARDING HELP VERIFY PASSED')
console.log('- 首次七步、按功能重播、跳过/完成、跨 Tab 路由、不写业务数据与 8 项 FAQ 通过')
