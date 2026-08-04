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

assert.strictEqual(onboarding.ONBOARDING_STEPS.length, 5)
assert.deepStrictEqual(
  onboarding.ONBOARDING_STEPS.map((step) => step.title),
  [
    '欢迎使用苏程记录',
    '输入当前成绩',
    '生成学校参考',
    '搜索学校',
    '查看学校信息'
  ]
)
assert.strictEqual(onboarding.FEATURE_TUTORIALS.target_planning.length, 2)
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
assert.strictEqual(overlay.step.total, 5)
onboarding.handleOnboardingAction({ detail: { action: 'next' } })
assert.strictEqual(storage.getOnboardingState().currentStep, 1)
assert.ok(routes.some((item) => item.url === '/pages/targets/targets'))
onboarding.handleOnboardingAction({ detail: { action: 'previous' } })
assert.strictEqual(storage.getOnboardingState().currentStep, 0)
onboarding.handleOnboardingAction({ detail: { action: 'skip' } })
assert.strictEqual(storage.getOnboardingState().skipped, true)

onboarding.replayOnboarding('full')
for (let index = 0; index < onboarding.ONBOARDING_STEPS.length - 1; index += 1) {
  onboarding.handleOnboardingAction({ detail: { action: 'next' } })
}
assert.strictEqual(storage.getOnboardingState().currentStep, 4)
overlay = onboarding.onboardingForPage('/pages/schools/schools')
assert.strictEqual(overlay.visible, true)
assert.strictEqual(overlay.step.index, 4)
assert.strictEqual(overlay.step.total, 5)
assert.strictEqual(overlay.step.title, '查看学校信息')
onboarding.handleOnboardingAction({ detail: { action: 'previous' } })
assert.strictEqual(storage.getOnboardingState().currentStep, 3)
onboarding.handleOnboardingAction({ detail: { action: 'next' } })
assert.strictEqual(storage.getOnboardingState().currentStep, 4)
onboarding.handleOnboardingAction({ detail: { action: 'next' } })
assert.strictEqual(storage.getOnboardingState().completed, true)
assert.strictEqual(storage.getOnboardingState().active, false)
assert.strictEqual(storage.getOnboardingState().currentStep, 4)

onboarding.replayOnboarding('full')
storage.saveOnboardingState({
  ...storage.getOnboardingState(),
  completed: false,
  currentStep: 6,
  active: true
})
overlay = onboarding.onboardingForPage('/pages/home/home')
assert.strictEqual(overlay.visible, false)
assert.strictEqual(overlay.step, null)
assert.strictEqual(storage.getOnboardingState().completed, true)
assert.strictEqual(storage.getOnboardingState().active, false)
assert.strictEqual(storage.getOnboardingState().currentStep, 4)

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
  '苏程记录会进行录取预测吗',
  '数据保存在哪里',
  '如何备份',
  '如何切换学生',
  '为什么某些学校字段不显示',
  '如何清除数据',
  '如何重新播放教程',
  '当前提供志愿填报建议吗',
  '历史分数线仅用于目标规划参考',
  '重播完整 5 步教程'
]) {
  assert.ok(helpText.includes(phrase), `帮助中心缺少：${phrase}`)
}
assert.ok(helpText.includes('不会创建或修改业务数据') ||
  helpText.includes('不会创建成绩、收藏或目标'))

const onboardingSource = read('utils/onboarding.js')
const tutorialMarkup = [
  read('pages/home/home.wxml'),
  read('pages/targets/targets.wxml'),
  read('pages/score-trend/score-trend.wxml')
].join('\n')
const tutorialRuntimeSource = `${onboardingSource}\n${tutorialMarkup}\n${read('config/app-config.js')}`
for (const removed of [
  '建立目标规划',
  '记录成绩变化',
  '.onboarding-target-planning',
  '.onboarding-trend-entry'
]) {
  assert.ok(!tutorialRuntimeSource.includes(removed), `正式运行代码仍包含已删除项：${removed}`)
}
const overlaySource = `${read('components/onboarding-overlay/onboarding-overlay.js')}\n${read('components/onboarding-overlay/onboarding-overlay.wxml')}`
assert.ok(overlaySource.includes("action: isLast ? 'complete' : 'next'"))
assert.ok(overlaySource.includes("step.index === step.total - 1 ? '开始使用' : '下一步'"))
assert.ok(read('pages/targets/targets.wxml').includes('目标学校'))
assert.ok(read('pages/score-trend/score-trend.wxml').includes('bindtap="saveRecord"'))
assert.ok(read('pages/score-trend/score-trend.wxml').includes('趋势'))

console.log('RC9 ONBOARDING HELP VERIFY PASSED')
console.log('- 首次五步、按功能重播、5→4→5、旧索引收口、跳过/完成、跨 Tab 路由、不写业务数据与 FAQ 通过')
