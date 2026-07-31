const {
  getFavoriteIdsResult,
  getTargetRecordsResult,
  getLearningTargetRecordsResult,
  getLearningTasks,
  getScoreReviews,
  getScoreLossReasons,
  getScoreRecordsResult,
  getRecentHistory,
  clearRecentHistory,
  getActiveProfile,
  getProfiles,
  clearCurrentProfileData,
  clearLocalData
} = require('../../utils/storage')
const {
  scanLocalData,
  repairSafeIssues,
  restoreRepairSnapshot
} = require('../../utils/data-health')

Page({
  data: {
    favoriteCount: 0,
    targetCount: 0,
    learningTargetCount: 0,
    scoreCount: 0,
    reviewCount: 0,
    lossReasonCount: 0,
    learningTaskCount: 0,
    profileCount: 0,
    activeProfileName: '默认档案',
    recentCount: 0,
    healthReport: null,
    repairResult: null
  },

  onShow() {
    this.refresh()
  },

  refresh() {
    const recentHistory = getRecentHistory()
    this.setData({
      favoriteCount: getFavoriteIdsResult().ids.length,
      targetCount: getTargetRecordsResult().records.length,
      learningTargetCount: getLearningTargetRecordsResult().records.length,
      scoreCount: getScoreRecordsResult().records.length,
      reviewCount: getScoreReviews().length,
      lossReasonCount: getScoreLossReasons().length,
      learningTaskCount: getLearningTasks().length,
      profileCount: getProfiles().length,
      activeProfileName: (getActiveProfile() || {}).nickname || '默认档案',
      recentCount: Object.values(recentHistory).reduce((sum, items) => sum + items.length, 0)
    })
  },

  runDataCheck() {
    const report = scanLocalData()
    if (!report.ok) {
      wx.showToast({ title: report.message || '数据检查失败，原数据未修改。', icon: 'none' })
      return
    }
    this.setData({ healthReport: report, repairResult: null })
  },

  repairSafeData() {
    wx.showModal({
      title: '安全修复本地数据',
      content: '只处理可明确判断的重复收藏、旧 Schema 标记、无效最近引用和事务临时标记。修复前会创建快照；无法判断的成绩、学校和档案归属不会自动修改。',
      confirmText: '创建快照并修复',
      success: (modal) => {
        if (!modal.confirm) return
        const result = repairSafeIssues()
        if (!result.ok) {
          wx.showToast({ title: result.message || '修复失败，原数据已保留。', icon: 'none' })
          return
        }
        this.setData({ healthReport: result.after, repairResult: result })
        this.refresh()
      }
    })
  },

  restoreBeforeRepair() {
    const result = restoreRepairSnapshot()
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    this.runDataCheck()
    this.refresh()
    wx.showToast({ title: '已恢复修复前快照', icon: 'success' })
  },

  clearRecentOperations() {
    const result = clearRecentHistory()
    if (!result.ok) {
      wx.showToast({ title: result.message || '清除失败，原记录已保留。', icon: 'none' })
      return
    }
    this.refresh()
    wx.showToast({ title: '最近操作已清除', icon: 'success' })
  },

  openRestorePoints() {
    wx.navigateTo({ url: '/pages/restore-points/restore-points' })
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
