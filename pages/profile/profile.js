const {
  getFavoriteIdsResult,
  getTargetRecordsResult,
  getLearningTargetRecordsResult,
  getScoreRecordsResult,
  getExamYearResult,
  getActiveProfile,
  getRecentViewedSchoolIds,
  getLearningTasks,
  getProfiles,
  saveExamYear
} = require('../../utils/storage')
const { scanLocalData } = require('../../utils/data-health')
const { dynamicHelpForContext, dismissDynamicHelp } = require('../../utils/onboarding')
const { notifyStorageReadResult } = require('../../utils/storage-feedback')
const { APP_CONFIG } = require('../../config/app-config')
const { examYearOptions } = require('../../utils/countdown')
const { schools } = require('../../data/schools')
const { operationOptions } = require('../../utils/operation-context')
const { hasExportedBackup } = require('../../utils/backup-restore')

Page({
  data: {
    activeProfile: null,
    favoriteCount: 0,
    targetCount: 0,
    learningTargetCount: 0,
    scoreRecordCount: 0,
    examYear: APP_CONFIG.countdown.defaultYear,
    examYears: [],
    examYearIndex: 0,
    recentSchools: [],
    dynamicHelp: null
  },

  onShow() { this.refreshSummary() },

  refreshSummary() {
    const favoriteResult = getFavoriteIdsResult()
    const targetResult = getTargetRecordsResult()
    const stageResult = getLearningTargetRecordsResult()
    const scoreResult = getScoreRecordsResult()
    const examYearResult = getExamYearResult()
    const firstFailure = [
      favoriteResult,
      targetResult,
      stageResult,
      scoreResult,
      examYearResult
    ].find((item) => !item.ok)
    notifyStorageReadResult(this, firstFailure || { ok: true })
    const examYears = examYearOptions(examYearResult.year)
    const recentIds = getRecentViewedSchoolIds()
    const learningTaskCount = getLearningTasks().length
    const health = scanLocalData()
    this.setData({
      activeProfile: getActiveProfile(),
      favoriteCount: favoriteResult.ids.length,
      targetCount: targetResult.records.length,
      learningTargetCount: stageResult.records.length,
      scoreRecordCount: scoreResult.records.length,
      examYear: examYearResult.year,
      examYears,
      examYearIndex: Math.max(0, examYears.indexOf(examYearResult.year)),
      recentSchools: recentIds
        .map((id) => schools.find((school) => school.id === id))
        .filter(Boolean)
        .slice(0, 5),
      dynamicHelp: dynamicHelpForContext({
        scoreCount: scoreResult.records.length,
        targetCount: targetResult.records.length,
        stageGoalCount: stageResult.records.length,
        learningTaskCount,
        profileCount: getProfiles().length,
        hasUsedMultipleProfiles: getProfiles().length <= 1,
        hasBackup: hasExportedBackup(),
        healthIssueCount: health.ok ? health.total : 0,
        inCompareMode: false
      })
    })
  },

  openFavorites() { wx.navigateTo({ url: '/pages/favorites/favorites' }) },
  openProfiles() { wx.navigateTo({ url: '/pages/profile-management/profile-management' }) },
  openBackupRestore() { wx.navigateTo({ url: '/pages/backup-restore/backup-restore' }) },
  openHelp() { wx.navigateTo({ url: '/pages/help/help' }) },
  openDataInfo() { wx.navigateTo({ url: '/pages/data-info/data-info' }) },
  openPrivacy() { wx.navigateTo({ url: '/pages/privacy/privacy' }) },
  openDataManagement() { wx.navigateTo({ url: '/pages/data-management/data-management' }) },
  openExamSettings() { wx.navigateTo({ url: '/pages/exam-settings/exam-settings' }) },
  openReports() { wx.navigateTo({ url: '/pages/reports/reports' }) },

  openRecentSchool(event) {
    wx.navigateTo({
      url: `/pages/school-detail/school-detail?id=${event.currentTarget.dataset.id}`
    })
  },

  dismissDynamicHelp() {
    if (!this.data.dynamicHelp) return
    const current = this.data.dynamicHelp
    this.setData({ dynamicHelp: null })
    const result = dismissDynamicHelp(current.id)
    if (result.ok) return
    this.setData({ dynamicHelp: current })
    wx.showToast({
      title: result.message || '关闭提示失败，请重试',
      icon: 'none'
    })
  },

  onExamYearChange(event) {
    const index = Number(event.detail.value)
    const year = this.data.examYears[index]
    const result = saveExamYear(year, operationOptions('save_exam_year', year))
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    this.setData({ examYear: year, examYearIndex: index })
    wx.showToast({ title: '默认目标年份已保存', icon: 'success' })
  }
})
