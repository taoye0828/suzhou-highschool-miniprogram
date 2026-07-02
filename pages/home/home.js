const { APP_CONFIG } = require('../../config/app-config')

const entries = [
  { title: '学校库', subtitle: '搜索与筛选本地学校样本', route: '/pages/schools/schools', tab: true },
  { title: '收藏', subtitle: '查看保存在本机的收藏', route: '/pages/favorites/favorites', tab: true },
  { title: '目标记录', subtitle: '保存学习目标和备注', route: '/pages/targets/targets', tab: true },
  { title: '数据说明', subtitle: '了解数据范围和使用边界', route: '/pages/data-info/data-info', tab: false },
  { title: '隐私说明', subtitle: '了解本地存储与隐私边界', route: '/pages/privacy/privacy', tab: false }
]

Page({
  data: { entries, homeSummary: APP_CONFIG.policy.homeSummary },

  openEntry(event) {
    const { route, tab } = event.currentTarget.dataset
    if (tab) wx.switchTab({ url: route })
    else wx.navigateTo({ url: route })
  }
})
