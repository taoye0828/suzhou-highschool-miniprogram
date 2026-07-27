const { APP_CONFIG, EXAM_TOTAL_SCORE } = require('../../config/app-config')
const {
  getExamYearResult,
  saveExamYear,
  getScoreRecordsResult,
  getTargetRecordsResult,
  getTargetDraftResult,
  saveTargetDraft
} = require('../../utils/storage')
const { notifyStorageReadResult } = require('../../utils/storage-feedback')
const { calculateExamCountdown, examYearOptions } = require('../../utils/countdown')
const { searchSchools, normalizeSearchText } = require('../../utils/school-search')
const { onboardingForPage, handleOnboardingAction } = require('../../utils/onboarding')

Page({
  data: {
    examYears: [],
    examYearIndex: 0,
    countdown: null,
    scoreInput: '',
    scoreInputError: '',
    scoreMax: EXAM_TOTAL_SCORE,
    schoolKeyword: '',
    schoolSearchActive: false,
    schoolSearchResults: [],
    latestScoreText: '尚未记录',
    scoreChangeText: '暂无上次成绩可比较',
    targetCount: 0,
    onboarding: { visible: false, step: null }
  },

  onLoad() {
    this.refreshCountdown()
  },

  onShow() {
    this.refreshCountdown()
    this.refreshOverview()
    this.syncOnboarding()
  },

  refreshOverview() {
    const scoreResult = getScoreRecordsResult()
    const targetResult = getTargetRecordsResult()
    const scores = scoreResult.records
    const latest = scores.length ? scores[scores.length - 1].score : null
    const previous = scores.length > 1 ? scores[scores.length - 2].score : null
    const change = latest !== null && previous !== null ? latest - previous : null
    this.setData({
      latestScoreText: latest === null ? '尚未记录' : `${latest} 分`,
      scoreChangeText: change === null
        ? '暂无上次成绩可比较'
        : change > 0
          ? `比上次提高 ${change} 分`
          : change < 0
            ? `比上次下降 ${Math.abs(change)} 分`
            : '与上次持平',
      targetCount: targetResult.records.length
    })
  },

  refreshCountdown() {
    const yearResult = getExamYearResult()
    notifyStorageReadResult(this, yearResult)
    const years = examYearOptions(yearResult.year)
    const yearIndex = Math.max(0, years.indexOf(yearResult.year))
    this.setData({
      examYears: years,
      examYearIndex: yearIndex,
      countdown: calculateExamCountdown(years[yearIndex])
    })
  },

  onExamYearChange(event) {
    const index = Number(event.detail.value)
    const year = this.data.examYears[index]
    const result = saveExamYear(year)
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    this.setData({
      examYearIndex: index,
      countdown: calculateExamCountdown(year)
    })
    wx.showToast({ title: '目标年份已保存在本机', icon: 'success' })
  },

  onSchoolKeywordInput(event) {
    const schoolKeyword = event.detail.value
    const schoolSearchActive = Boolean(normalizeSearchText(schoolKeyword))
    this.setData({
      schoolKeyword,
      schoolSearchActive,
      schoolSearchResults: schoolSearchActive
        ? searchSchools({ keyword: schoolKeyword, limit: 5 })
        : []
    })
  },

  onScoreInput(event) {
    this.setData({
      scoreInput: event.detail.value,
      scoreInputError: ''
    })
  },

  startScoreAnalysis() {
    const raw = String(this.data.scoreInput || '').trim()
    const score = Number(raw)
    if (!/^\d+$/.test(raw) || !Number.isInteger(score) || score < 0 || score > EXAM_TOTAL_SCORE) {
      this.setData({ scoreInputError: `成绩必须是 0 至 ${EXAM_TOTAL_SCORE} 的整数。` })
      return
    }
    const draftResult = getTargetDraftResult()
    const saveResult = saveTargetDraft({ ...draftResult.draft, currentScore: raw })
    if (!saveResult.ok) {
      wx.showToast({ title: saveResult.message, icon: 'none' })
      return
    }
    wx.switchTab({ url: '/pages/target-analysis/target-analysis' })
  },

  openSchoolResult(event) {
    wx.navigateTo({
      url: `/pages/school-detail/school-detail?id=${event.currentTarget.dataset.id}`
    })
  },

  openEntry(event) {
    const { route, tab } = event.currentTarget.dataset
    if (tab) wx.switchTab({ url: route })
    else wx.navigateTo({ url: route })
  },

  openSchools() {
    wx.switchTab({ url: '/pages/schools/schools' })
  },

  syncOnboarding() {
    this.setData({
      onboarding: onboardingForPage('/pages/home/home', { autoStart: true })
    })
  },

  onOnboardingAction(event) {
    handleOnboardingAction(event)
    this.syncOnboarding()
  }
})
