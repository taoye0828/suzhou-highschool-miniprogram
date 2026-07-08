const { getFavoriteIdsResult, getTargetRecordsResult, clearLocalData } = require('../../utils/storage')
const { notifyStorageReadResult } = require('../../utils/storage-feedback')
const { APP_CONFIG } = require('../../config/app-config')
const { schools } = require('../../data/schools')
const { admissionScores } = require('../../data/admission-scores')

Page({
  data: {
    appName: APP_CONFIG.name,
    version: APP_CONFIG.version,
    releaseStatus: APP_CONFIG.releaseStatus,
    schoolCount: schools.length,
    scoreCount: admissionScores.length,
    favoriteCount: 0,
    targetCount: 0
  },

  onShow() { this.refreshSummary() },

  refreshSummary() {
    const favoriteResult = getFavoriteIdsResult()
    const targetResult = getTargetRecordsResult()
    notifyStorageReadResult(this, favoriteResult.ok ? targetResult : favoriteResult)
    this.setData({ favoriteCount: favoriteResult.ids.length, targetCount: targetResult.records.length })
  },

  openFavorites() { wx.switchTab({ url: '/pages/favorites/favorites' }) },
  openTargets() { wx.switchTab({ url: '/pages/targets/targets' }) },
  openDataInfo() { wx.navigateTo({ url: '/pages/data-info/data-info' }) },
  openPrivacy() { wx.navigateTo({ url: '/pages/privacy/privacy' }) },
  clearLocalData() {
    wx.showModal({
      title: '清除本地数据',
      content: '将清除收藏、学习目标记录和输入草稿，学校列表不受影响。此操作无法撤销。',
      confirmText: '确认清除',
      confirmColor: '#b42318',
      success: (modalResult) => {
        if (!modalResult.confirm) return
        const storageResult = clearLocalData()
        if (!storageResult.ok) {
          wx.showToast({ title: storageResult.message, icon: 'none' })
          return
        }
        this.refreshSummary()
        wx.showToast({ title: '数据已清除', icon: 'success' })
      },
      fail: () => wx.showToast({ title: '确认窗口打开失败，请重试。', icon: 'none' })
    })
  }
})
