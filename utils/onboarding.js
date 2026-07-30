const { APP_CONFIG } = require('../config/app-config')
const { getOnboardingState, saveOnboardingState } = require('./storage')

const ONBOARDING_STEPS = [
  {
    page: '/pages/home/home',
    selector: '.onboarding-home-overview',
    title: `欢迎使用${APP_CONFIG.name}`,
    description: '这里可以查看中考倒计时和你的规划概览。'
  },
  {
    page: '/pages/targets/targets',
    selector: '.onboarding-score-input',
    title: '输入当前成绩',
    description: '输入总分后，可以查看冲刺、目标和保底学校。'
  },
  {
    page: '/pages/targets/targets',
    selector: '.onboarding-analyze-button',
    title: '生成学校参考',
    description: '系统会根据历史分数线整理具体学校参考。'
  },
  {
    page: '/pages/schools/schools',
    selector: '.onboarding-school-search',
    title: '搜索学校',
    description: '输入完整名称或简称，例如“南航”，即可查找学校。'
  },
  {
    page: '/pages/schools/schools',
    selector: '.onboarding-school-card',
    title: '查看学校信息',
    description: '打开学校详情，可以查看历史分数线并加入目标。'
  },
  {
    page: '/pages/targets/targets',
    selector: '.onboarding-target-planning',
    title: '建立目标规划',
    description: '把具体学校设为冲刺、目标或保底。'
  },
  {
    page: '/pages/score-trend/score-trend',
    selector: '.onboarding-trend-entry',
    title: '记录成绩变化',
    description: '每次考试后保存成绩，可以查看最近 10 次变化。'
  }
]

const FEATURE_TUTORIALS = {
  home: [ONBOARDING_STEPS[0]],
  school_filters: [
    ONBOARDING_STEPS[3],
    ONBOARDING_STEPS[4]
  ],
  score_records: [{
    page: '/pages/score-trend/score-trend',
    selector: '.onboarding-score-form',
    title: '记录一次考试',
    description: '可只填总分，也可添加学科成绩和考试复盘。'
  }],
  score_trend: [{
    page: '/pages/score-trend/score-trend',
    selector: '.onboarding-score-trend',
    title: '查看成绩趋势',
    description: '总分、学科和考试标签使用同一批记录与同一横坐标。'
  }],
  target_planning: [
    ONBOARDING_STEPS[1],
    ONBOARDING_STEPS[2],
    ONBOARDING_STEPS[5]
  ],
  backup_restore: [{
    page: '/pages/backup-restore/backup-restore',
    selector: '.onboarding-backup',
    title: '备份与恢复',
    description: '先预览导出范围；导入时先校验，再选择合并或覆盖。'
  }],
  student_profiles: [{
    page: '/pages/profile/profile',
    selector: '.onboarding-profile',
    title: '切换学生档案',
    description: '每个档案的成绩、复盘、目标和学习计划彼此独立。'
  }]
}

function tutorialSteps(flow = 'full') {
  return flow === 'full' ? ONBOARDING_STEPS : (FEATURE_TUTORIALS[flow] || ONBOARDING_STEPS)
}

function initialState(flow = 'full') {
  return {
    version: APP_CONFIG.onboarding.version,
    completed: false,
    skipped: false,
    currentStep: 0,
    active: true,
    flow
  }
}

function ensureOnboardingStarted() {
  const state = getOnboardingState()
  if (state.version === APP_CONFIG.onboarding.version && (state.completed || state.skipped)) return state
  if (state.version === APP_CONFIG.onboarding.version && state.active) return state
  const next = initialState('full')
  saveOnboardingState(next)
  return next
}

function replayOnboarding(flow = 'full') {
  const next = initialState(flow)
  saveOnboardingState(next)
  return next
}

function onboardingForPage(pagePath, { autoStart = false } = {}) {
  const state = autoStart ? ensureOnboardingStarted() : getOnboardingState()
  const steps = tutorialSteps(state.flow)
  const step = steps[state.currentStep]
  return {
    visible: Boolean(state.active && step && step.page === pagePath),
    step: step ? { ...step, index: state.currentStep, total: steps.length } : null
  }
}

function updateStep(currentStep) {
  const state = getOnboardingState()
  const steps = tutorialSteps(state.flow)
  const stepIndex = Math.max(0, Math.min(steps.length - 1, currentStep))
  const next = { ...state, version: APP_CONFIG.onboarding.version, currentStep: stepIndex, active: true }
  saveOnboardingState(next)
  return steps[stepIndex]
}

function completeOnboarding() {
  const state = getOnboardingState()
  const steps = tutorialSteps(state.flow)
  return saveOnboardingState({
    version: APP_CONFIG.onboarding.version,
    completed: true,
    skipped: false,
    currentStep: steps.length - 1,
    active: false,
    flow: state.flow
  })
}

function skipOnboarding() {
  return saveOnboardingState({
    version: APP_CONFIG.onboarding.version,
    completed: false,
    skipped: true,
    currentStep: getOnboardingState().currentStep,
    active: false,
    flow: getOnboardingState().flow
  })
}

function routeToStep(step) {
  if (!step) return
  const tabPages = [
    '/pages/home/home',
    '/pages/schools/schools',
    '/pages/score-trend/score-trend',
    '/pages/targets/targets',
    '/pages/profile/profile'
  ]
  if (tabPages.includes(step.page)) wx.switchTab({ url: step.page })
  else wx.navigateTo({ url: step.page })
}

function handleOnboardingAction(event) {
  const action = event.detail && event.detail.action
  const state = getOnboardingState()
  const steps = tutorialSteps(state.flow)
  if (action === 'skip') return skipOnboarding()
  if (action === 'complete' || (action === 'next' && state.currentStep >= steps.length - 1)) {
    return completeOnboarding()
  }
  const delta = action === 'previous' ? -1 : 1
  routeToStep(updateStep(state.currentStep + delta))
  return { ok: true }
}

module.exports = {
  ONBOARDING_STEPS,
  FEATURE_TUTORIALS,
  tutorialSteps,
  ensureOnboardingStarted,
  replayOnboarding,
  onboardingForPage,
  handleOnboardingAction,
  completeOnboarding,
  skipOnboarding
}
