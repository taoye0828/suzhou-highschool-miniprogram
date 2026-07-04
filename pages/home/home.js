const { APP_CONFIG } = require('../../config/app-config')

const entries = [
  { title: '学校库', subtitle: '搜索和筛选学校', route: '/pages/schools/schools', tab: true },
  { title: '收藏', subtitle: '查看收藏的学校', route: '/pages/favorites/favorites', tab: true },
  { title: '目标记录', subtitle: '记录学习目标', route: '/pages/targets/targets', tab: true }
]

Page({
  data: { entries, homeTagline: APP_CONFIG.policy.homeTagline },

  openEntry(event) {
    const { route, tab } = event.currentTarget.dataset
    if (tab) wx.switchTab({ url: route })
    else wx.navigateTo({ url: route })
  }
})
