const {
  getFavoriteIdsResult,
  getTargetRecordsResult,
  getScoreRecordsResult,
  getExamYearResult
} = require('../../utils/storage')
const { notifyStorageReadResult } = require('../../utils/storage-feedback')
const { APP_CONFIG } = require('../../config/app-config')
const { replayOnboarding } = require('../../utils/onboarding')

Page({
  data: {
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

  openFavorites() { wx.navigateTo({ url: '/pages/favorites/favorites' }) },
  openTargets() { wx.switchTab({ url: '/pages/targets/targets' }) },
  openTargetAnalysis() { wx.switchTab({ url: '/pages/target-analysis/target-analysis' }) },
  openSchoolCompare() { wx.navigateTo({ url: '/pages/school-compare/school-compare' }) },
  openScoreTrend() { wx.navigateTo({ url: '/pages/score-trend/score-trend' }) },
  openDataInfo() { wx.navigateTo({ url: '/pages/data-info/data-info' }) },
  openPrivacy() { wx.navigateTo({ url: '/pages/privacy/privacy' }) },
  openDataManagement() { wx.navigateTo({ url: '/pages/data-management/data-management' }) },
  replayOnboarding() {
    replayOnboarding()
    wx.switchTab({ url: '/pages/home/home' })
  }
})
