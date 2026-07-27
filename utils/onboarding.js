const { APP_CONFIG } = require('../config/app-config')
const { getOnboardingState, saveOnboardingState } = require('./storage')

const ONBOARDING_STEPS = [
  {
    page: '/pages/home/home',
    selector: '.onboarding-home-overview',
    title: '欢迎使用',
    description: '这里可以查看中考倒计时和你的规划概览。'
  },
  {
    page: '/pages/target-analysis/target-analysis',
    selector: '.onboarding-score-input',
    title: '输入当前成绩',
    description: '输入总分后，可以查看冲刺、目标和保底学校。'
  },
  {
    page: '/pages/target-analysis/target-analysis',
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
    page: '/pages/target-analysis/target-analysis',
    selector: '.onboarding-trend-entry',
    title: '记录成绩变化',
    description: '每次考试后保存成绩，可以查看最近 10 次变化。'
  }
]

function initialState() {
  return {
    version: APP_CONFIG.onboarding.version,
    completed: false,
    skipped: false,
    currentStep: 0,
    active: true
  }
}

function ensureOnboardingStarted() {
  const state = getOnboardingState()
  if (state.version === APP_CONFIG.onboarding.version && (state.completed || state.skipped)) return state
  if (state.version === APP_CONFIG.onboarding.version && state.active) return state
  const next = initialState()
  saveOnboardingState(next)
  return next
}

function replayOnboarding() {
  const next = initialState()
  saveOnboardingState(next)
  return next
}

function onboardingForPage(pagePath, { autoStart = false } = {}) {
  const state = autoStart ? ensureOnboardingStarted() : getOnboardingState()
  const step = ONBOARDING_STEPS[state.currentStep]
  return {
    visible: Boolean(state.active && step && step.page === pagePath),
    step: step ? { ...step, index: state.currentStep, total: ONBOARDING_STEPS.length } : null
  }
}

function updateStep(currentStep) {
  const state = getOnboardingState()
  const stepIndex = Math.max(0, Math.min(ONBOARDING_STEPS.length - 1, currentStep))
  const next = { ...state, version: APP_CONFIG.onboarding.version, currentStep: stepIndex, active: true }
  saveOnboardingState(next)
  return ONBOARDING_STEPS[stepIndex]
}

function completeOnboarding() {
  return saveOnboardingState({
    version: APP_CONFIG.onboarding.version,
    completed: true,
    skipped: false,
    currentStep: ONBOARDING_STEPS.length - 1,
    active: false
  })
}

function skipOnboarding() {
  return saveOnboardingState({
    version: APP_CONFIG.onboarding.version,
    completed: false,
    skipped: true,
    currentStep: getOnboardingState().currentStep,
    active: false
  })
}

function routeToStep(step) {
  if (!step) return
  wx.switchTab({ url: step.page })
}

function handleOnboardingAction(event) {
  const action = event.detail && event.detail.action
  const state = getOnboardingState()
  if (action === 'skip') return skipOnboarding()
  if (action === 'complete' || (action === 'next' && state.currentStep >= ONBOARDING_STEPS.length - 1)) {
    return completeOnboarding()
  }
  const delta = action === 'previous' ? -1 : 1
  routeToStep(updateStep(state.currentStep + delta))
  return { ok: true }
}

module.exports = {
  ONBOARDING_STEPS,
  ensureOnboardingStarted,
  replayOnboarding,
  onboardingForPage,
  handleOnboardingAction,
  completeOnboarding,
  skipOnboarding
}
