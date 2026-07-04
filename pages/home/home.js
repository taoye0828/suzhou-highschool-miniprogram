const { APP_CONFIG } = require('../../config/app-config')

const entries = [
  { title: '学校库', subtitle: '搜索和筛选学校', route: '/pages/schools/schools', tab: true },
  { title: '收藏', subtitle: '查看收藏的学校', route: '/pages/favorites/favorites', tab: true },
  { title: '目标记录', subtitle: '记录阶段学习目标', route: '/pages/targets/targets', tab: true },
  { title: '数据说明', subtitle: '查看数据来源和边界', route: '/pages/data-info/data-info', tab: false }
]

Page({
  data: {
    appName: APP_CONFIG.name,
    entries,
    homeTagline: APP_CONFIG.policy.homeTagline,
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
