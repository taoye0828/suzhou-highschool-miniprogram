const {
  getFavoriteIdsResult,
  getTargetRecordsResult,
  getLearningTargetRecordsResult,
  getScoreRecordsResult,
  clearLocalData
} = require('../../utils/storage')

Page({
  data: {
    favoriteCount: 0,
    targetCount: 0,
    learningTargetCount: 0,
    scoreCount: 0
  },

  onShow() {
    this.refresh()
  },

  refresh() {
    this.setData({
      favoriteCount: getFavoriteIdsResult().ids.length,
      targetCount: getTargetRecordsResult().records.length,
      learningTargetCount: getLearningTargetRecordsResult().records.length,
      scoreCount: getScoreRecordsResult().records.length
    })
  },

  clearAllLocalData() {
    wx.showModal({
      title: '清除全部本地数据',
      content: '将清除收藏、目标学校、阶段目标、成绩记录、中考年份、输入草稿和新手教程状态。学校正式数据不受影响。此操作无法撤销。',
      confirmText: '确认清除',
      confirmColor: '#b42318',
      success: (modalResult) => {
        if (!modalResult.confirm) return
        const result = clearLocalData()
        if (!result.ok) {
          wx.showToast({ title: result.message, icon: 'none' })
          return
        }
        this.refresh()
        wx.showToast({ title: '本地数据已清除', icon: 'success' })
      },
      fail: () => wx.showToast({ title: '确认窗口打开失败，请重试。', icon: 'none' })
    })
  }
})
