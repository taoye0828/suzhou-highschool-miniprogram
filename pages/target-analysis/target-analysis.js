const { APP_CONFIG, EXAM_TOTAL_SCORE } = require('../../config/app-config')
const { analyzeScore } = require('../../utils/score-analysis')
const { getTargetRecordsResult } = require('../../utils/storage')
const { notifyStorageReadResult } = require('../../utils/storage-feedback')

function buildSections(results) {
  return APP_CONFIG.scoreAnalysis.levels.map((level) => ({
    ...level,
    results: results
      .filter((item) => item.level === level.value)
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
    analysisNotice: APP_CONFIG.policy.scoreAnalysisNotice,
    planningDisclaimer: APP_CONFIG.policy.planningDisclaimer
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
      sections: buildSections(results)
    })
  },

  openDetail(event) {
    wx.navigateTo({
      url: `/pages/school-detail/school-detail?id=${event.currentTarget.dataset.id}`
    })
  }
})
