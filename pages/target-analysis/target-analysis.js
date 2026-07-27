const { APP_CONFIG, EXAM_TOTAL_SCORE } = require('../../config/app-config')
const { analyzeScore } = require('../../utils/score-analysis')
const {
  getTargetRecordsResult,
  getTargetDraftResult,
  getScoreRecordsResult,
  saveTargetDraft,
  saveTargetRecord,
  saveScoreRecord
} = require('../../utils/storage')
const { notifyStorageReadResult } = require('../../utils/storage-feedback')
const { onboardingForPage, handleOnboardingAction } = require('../../utils/onboarding')

function buildSections(results) {
  return APP_CONFIG.scoreAnalysis.levels.map((level) => ({
    ...level,
    results: results
      .filter((item) => item.level === level.value)
      .slice(0, 5)
      .map((item) => {
        const targetLevel = APP_CONFIG.targetScore.levels.find(
          (candidate) => candidate.value === item.targetLevel
        )
        return {
          ...item,
          targetLevelLabel: targetLevel ? targetLevel.label : ''
        }
      })
  }))
}

Page({
  data: {
    scoreInput: '',
    schoolKeyword: '',
    targetYears: APP_CONFIG.scoreAnalysis.targetYears,
    targetYearIndex: Math.max(
      0,
      APP_CONFIG.scoreAnalysis.targetYears.indexOf(APP_CONFIG.countdown.defaultYear)
    ),
    scoreMax: EXAM_TOTAL_SCORE,
    inputError: '',
    hasAnalyzed: false,
    resultCount: 0,
    sections: buildSections([]),
    currentScore: null,
    scoreSaved: false,
    onboarding: { visible: false, step: null }
  },

  onLoad(options = {}) {
    const raw = String(options.score || '').trim()
    const score = Number(raw)
    if (!/^\d+$/.test(raw) || !Number.isInteger(score) || score < 0 || score > EXAM_TOTAL_SCORE) {
      return
    }
    this.setData({ scoreInput: raw }, () => this.analyze())
  },

  onShow() {
    if (!this.data.scoreInput) {
      const draft = getTargetDraftResult().draft
      const raw = String(draft.currentScore || '').trim()
      if (/^\d+$/.test(raw)) this.setData({ scoreInput: raw })
    }
    this.syncOnboarding()
  },

  onScoreInput(event) {
    this.setData({ scoreInput: event.detail.value, inputError: '' })
  },

  onSchoolKeywordInput(event) {
    this.setData({ schoolKeyword: event.detail.value }, () => {
      if (this.data.hasAnalyzed) this.analyze()
    })
  },

  onTargetYearChange(event) {
    this.setData({
      targetYearIndex: Number(event.detail.value),
      hasAnalyzed: false,
      resultCount: 0,
      sections: buildSections([])
    })
  },

  analyze() {
    const raw = String(this.data.scoreInput || '').trim()
    const score = Number(raw)
    if (!/^\d+$/.test(raw) || !Number.isInteger(score) || score < 0 || score > EXAM_TOTAL_SCORE) {
      this.setData({
        inputError: `成绩必须是 0 至 ${EXAM_TOTAL_SCORE} 的整数。`,
        hasAnalyzed: false,
        resultCount: 0,
        sections: buildSections([])
      })
      return
    }
    const targetYear = this.data.targetYears[this.data.targetYearIndex]
    const targetResult = getTargetRecordsResult()
    notifyStorageReadResult(this, targetResult)
    const results = analyzeScore({
      userScore: score,
      targetYear,
      keyword: this.data.schoolKeyword,
      targetRecords: targetResult.records
    })
    this.setData({
      inputError: '',
      hasAnalyzed: true,
      resultCount: results.length,
      sections: buildSections(results),
      currentScore: score,
      scoreSaved: false
    })
    const draftResult = getTargetDraftResult()
    saveTargetDraft({ ...draftResult.draft, currentScore: raw })
  },

  addTarget(event) {
    const schoolId = event.currentTarget.dataset.id
    const resultItem = this.data.sections
      .flatMap((section) => section.results)
      .find((item) => item.schoolId === schoolId)
    if (!resultItem) return
    const result = saveTargetRecord({
      id: `target_${resultItem.schoolId}`,
      schoolId: resultItem.schoolId,
      schoolName: resultItem.schoolName,
      level: resultItem.level,
      referenceScore: resultItem.schoolScore,
      referenceYear: resultItem.year,
      createdAt: new Date().toISOString()
    })
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    wx.showToast({ title: resultItem.isTargetSchool ? '目标等级已更新' : '已加入我的目标', icon: 'success' })
    this.analyze()
  },

  saveCurrentScore() {
    if (!Number.isInteger(this.data.currentScore)) return
    const now = new Date()
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const existing = getScoreRecordsResult()
    const duplicate = existing.records.some(
      (item) => item.date === date && item.examName === '成绩分析' && item.score === this.data.currentScore
    )
    if (duplicate) {
      this.setData({ scoreSaved: true })
      wx.showToast({ title: '相同成绩今天已保存', icon: 'none' })
      return
    }
    const result = saveScoreRecord({
      id: `analysis_${Date.now()}`,
      date,
      examName: '成绩分析',
      score: this.data.currentScore,
      createdAt: now.toISOString()
    })
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    this.setData({ scoreSaved: true })
    wx.showToast({ title: '成绩已保存', icon: 'success' })
  },

  openScoreTrend() {
    wx.navigateTo({ url: '/pages/score-trend/score-trend' })
  },

  openDetail(event) {
    wx.navigateTo({
      url: `/pages/school-detail/school-detail?id=${event.currentTarget.dataset.id}`
    })
  },

  syncOnboarding() {
    this.setData({
      onboarding: onboardingForPage('/pages/target-analysis/target-analysis')
    })
  },

  onOnboardingAction(event) {
    handleOnboardingAction(event)
    this.syncOnboarding()
  }
})
