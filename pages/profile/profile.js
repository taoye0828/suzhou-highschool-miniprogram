const {
  getFavoriteIdsResult,
  getTargetRecordsResult,
  getScoreRecordsResult,
  getExamYearResult,
  clearLocalData
} = require('../../utils/storage')
const { notifyStorageReadResult } = require('../../utils/storage-feedback')
const { APP_CONFIG } = require('../../config/app-config')
const { schools } = require('../../data/schools')
const { admissionScores } = require('../../data/admission-scores')

Page({
  data: {
    appName: APP_CONFIG.name,
    version: APP_CONFIG.version,
    releaseStatus: APP_CONFIG.releaseStatus,
    sourceCheckedAt: APP_CONFIG.schoolData.sourceCheckedAt,
    schoolCount: schools.length,
    scoreCount: admissionScores.length,
    favoriteCount: 0,
    targetCount: 0,
    scoreRecordCount: 0,
    examYear: APP_CONFIG.countdown.defaultYear
  },

  onShow() { this.refreshSummary() },

  refreshSummary() {
    const favoriteResult = getFavoriteIdsResult()
    const targetResult = getTargetRecordsResult()
    const scoreResult = getScoreRecordsResult()
    const examYearResult = getExamYearResult()
    const firstFailure = [favoriteResult, targetResult, scoreResult, examYearResult].find((item) => !item.ok)
    notifyStorageReadResult(this, firstFailure || { ok: true })
    this.setData({
      favoriteCount: favoriteResult.ids.length,
      targetCount: targetResult.records.length,
      scoreRecordCount: scoreResult.records.length,
      examYear: examYearResult.year
    })
  },

  openFavorites() { wx.switchTab({ url: '/pages/favorites/favorites' }) },
  openTargets() { wx.switchTab({ url: '/pages/targets/targets' }) },
  openTargetAnalysis() { wx.navigateTo({ url: '/pages/target-analysis/target-analysis' }) },
  openSchoolCompare() { wx.navigateTo({ url: '/pages/school-compare/school-compare' }) },
  openScoreTrend() { wx.navigateTo({ url: '/pages/score-trend/score-trend' }) },
  openDataInfo() { wx.navigateTo({ url: '/pages/data-info/data-info' }) },
  openPrivacy() { wx.navigateTo({ url: '/pages/privacy/privacy' }) },
  clearLocalData() {
    wx.showModal({
      title: '清除本地数据',
      content: '将清除收藏、学习目标、成绩记录、目标年份和输入草稿，学校列表不受影响。此操作无法撤销。',
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
