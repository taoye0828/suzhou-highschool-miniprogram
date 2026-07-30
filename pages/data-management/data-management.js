const {
  getFavoriteIdsResult,
  getTargetRecordsResult,
  getLearningTargetRecordsResult,
  getScoreRecordsResult,
  getActiveProfile,
  getProfiles,
  clearCurrentProfileData,
  clearLocalData
} = require('../../utils/storage')

Page({
  data: {
    favoriteCount: 0,
    targetCount: 0,
    learningTargetCount: 0,
    scoreCount: 0,
    profileCount: 0,
    activeProfileName: '默认档案'
  },

  onShow() {
    this.refresh()
  },

  refresh() {
    this.setData({
      favoriteCount: getFavoriteIdsResult().ids.length,
      targetCount: getTargetRecordsResult().records.length,
      learningTargetCount: getLearningTargetRecordsResult().records.length,
      scoreCount: getScoreRecordsResult().records.length,
      profileCount: getProfiles().length,
      activeProfileName: (getActiveProfile() || {}).nickname || '默认档案'
    })
  },

  confirmTwice({ title, content, finalContent, onConfirm }) {
    wx.showModal({
      title,
      content,
      confirmText: '继续',
      confirmColor: '#b42318',
      success: (first) => {
        if (!first.confirm) return
        wx.showModal({
          title: '再次确认',
          content: finalContent,
          confirmText: '确认清除',
          confirmColor: '#b42318',
          success: (second) => {
            if (second.confirm) onConfirm()
          }
        })
      },
      fail: () => wx.showToast({ title: '确认窗口打开失败，请重试。', icon: 'none' })
    })
  },

  clearCurrentProfile() {
    this.confirmTwice({
      title: '清除当前档案',
      content: `将清除“${this.data.activeProfileName}”的收藏、成绩、复盘、目标和设置，其他档案不受影响。`,
      finalContent: '清除后无法撤销。确认只清除当前档案吗？',
      onConfirm: () => {
        const result = clearCurrentProfileData()
        if (!result.ok) {
          wx.showToast({ title: result.message, icon: 'none' })
          return
        }
        this.refresh()
        wx.showToast({ title: '当前档案已清除', icon: 'success' })
      }
    })
  },

  clearAllLocalData() {
    this.confirmTwice({
      title: '清除全部本地数据',
      content: `将清除 ${this.data.profileCount} 个档案及其收藏、成绩、复盘、目标、设置和教程状态。`,
      finalContent: '全部本地用户数据都将删除，学校正式数据不受影响。确认继续吗？',
      onConfirm: () => {
        const result = clearLocalData()
        if (!result.ok) {
          wx.showToast({ title: result.message, icon: 'none' })
          return
        }
        this.refresh()
        wx.showToast({ title: '全部本地数据已清除', icon: 'success' })
      }
    })
  }
})
