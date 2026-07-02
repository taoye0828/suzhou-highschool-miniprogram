const { getFavoriteIds, getTargetRecords, clearLocalDemoData } = require('../../utils/storage')

Page({
  data: { version: '1.0.0-mp1', favoriteCount: 0, targetCount: 0 },

  onShow() { this.refreshSummary() },

  refreshSummary() {
    this.setData({ favoriteCount: getFavoriteIds().length, targetCount: getTargetRecords().length })
  },

  openDataInfo() { wx.navigateTo({ url: '/pages/data-info/data-info' }) },
  openPrivacy() { wx.navigateTo({ url: '/pages/privacy/privacy' }) },
  openFavorites() { wx.switchTab({ url: '/pages/favorites/favorites' }) },
  openTargets() { wx.switchTab({ url: '/pages/targets/targets' }) },

  clearLocalData() {
    wx.showModal({
      title: '清除本地演示数据',
      content: '将清除本机收藏、目标记录和输入草稿。内置学校库不会被删除，此操作无法撤销。',
      confirmText: '确认清除',
      confirmColor: '#b42318',
      success: (result) => {
        if (!result.confirm) return
        clearLocalDemoData()
        this.refreshSummary()
        wx.showToast({ title: '本地数据已清除', icon: 'success' })
      }
    })
  }
})
