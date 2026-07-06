const { APP_CONFIG } = require('../../config/app-config')
const { admissionScores } = require('../../data/admission-scores')

const entries = [
  { title: '查学校', subtitle: '搜索和筛选学校基础信息', route: '/pages/schools/schools', tab: true },
  { title: '看数据说明', subtitle: '了解来源、口径和边界', route: '/pages/data-info/data-info', tab: false },
  { title: '学习目标记录', subtitle: '在本机记录阶段目标', route: '/pages/targets/targets', tab: true },
  { title: '我的收藏', subtitle: '查看本机收藏学校', route: '/pages/favorites/favorites', tab: true }
]

Page({
  data: {
    appName: APP_CONFIG.name,
    entries,
    homeTagline: APP_CONFIG.policy.homeTagline,
    homeBoundary: APP_CONFIG.policy.homeBoundary,
    localBoundary: APP_CONFIG.policy.localBoundary,
    admissionScoreCount: admissionScores.length,
    capabilities: APP_CONFIG.policy.currentCapabilities,
    limits: APP_CONFIG.policy.currentLimits,
    usageSteps: APP_CONFIG.policy.usageSteps
  },

  openEntry(event) {
    const { route, tab } = event.currentTarget.dataset
    if (tab) wx.switchTab({ url: route })
    else wx.navigateTo({ url: route })
  }
})
