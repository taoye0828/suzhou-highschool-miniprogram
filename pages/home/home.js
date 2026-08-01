const { APP_CONFIG } = require('../../config/app-config')
const {
  getExamYearResult,
  saveExamYear,
  getScoreRecordsResult,
  getTargetRecordsResult,
  getLearningTargetRecordsResult,
  getPrimaryTargetSchoolId
} = require('../../utils/storage')
const { notifyStorageReadResult } = require('../../utils/storage-feedback')
const { calculateExamCountdown, examYearOptions } = require('../../utils/countdown')
const { onboardingForPage, handleOnboardingAction } = require('../../utils/onboarding')
const {
  sortScoreRecords,
  selectLatestScoreRecord,
  selectCurrentScore,
  selectPrimaryTarget,
  selectReferenceForSchool,
  selectGap,
  formatDifference
} = require('../../utils/planning')
const { admissionScores } = require('../../data/admission-scores')
const { summarizeScoreRecords } = require('../../utils/score-trend')
const { operationOptions } = require('../../utils/operation-context')

function importantStageGoal(records) {
  const rank = { in_progress: 0, not_started: 1, paused: 2, completed: 3 }
  return (Array.isArray(records) ? records : [])
    .filter((item) => !item.isDraft && item.status !== 'completed')
    .slice()
    .sort((left, right) => {
      const status = (rank[left.status] ?? 99) - (rank[right.status] ?? 99)
      if (status !== 0) return status
      const leftDate = left.endDate || '9999-12-31'
      const rightDate = right.endDate || '9999-12-31'
      return leftDate.localeCompare(rightDate) || left.id.localeCompare(right.id)
    })[0] || null
}

Page({
  data: {
    examYears: [],
    examYearIndex: 0,
    countdown: null,
    hasScores: false,
    hasTarget: false,
    hasStageGoal: false,
    latestExamName: '',
    latestExamDate: '',
    latestScoreText: '',
    scoreChangeText: '',
    trendSummary: '',
    primaryTargetName: '',
    targetLevelLabel: '',
    targetReferenceText: '',
    targetDifferenceText: '',
    stageGoalTitle: '',
    stageGoalDeadline: '',
    stageGoalProgressText: '',
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
    const stageResult = getLearningTargetRecordsResult()
    const yearResult = getExamYearResult()
    const failed = [scoreResult, targetResult, stageResult, yearResult].find((item) => !item.ok)
    notifyStorageReadResult(this, failed || scoreResult)
    const scores = sortScoreRecords(scoreResult.records)
    const latest = selectLatestScoreRecord(scores)
    const recommendationCurrent = selectCurrentScore(scores, {}, {
      requireRecommendationEligible: true,
      allowDraftFallback: false
    })
    const previous = scores.length > 1 ? scores[scores.length - 2] : null
    const change = latest && previous ? latest.score - previous.score : null
    const primary = selectPrimaryTarget(targetResult.records, {
      primaryTargetId: getPrimaryTargetSchoolId()
    })
    const reference = primary
      ? selectReferenceForSchool(primary.schoolId, yearResult.year, admissionScores)
      : null
    const gap = selectGap(recommendationCurrent.score, reference)
    const stageGoal = importantStageGoal(stageResult.records)
    const targetScore = stageGoal && stageGoal.targetTotalScore
    const targetGap = latest && Number.isInteger(targetScore) ? targetScore - latest.score : null
    const summary = summarizeScoreRecords(scores)
    this.setData({
      hasScores: Boolean(latest),
      hasTarget: Boolean(primary),
      hasStageGoal: Boolean(stageGoal),
      latestExamName: latest ? latest.examName : '',
      latestExamDate: latest ? latest.examDate || latest.date : '',
      latestScoreText: latest ? `${latest.score} 分` : '',
      scoreChangeText: change === null
        ? '首次记录，暂无上次成绩'
        : change > 0
          ? `比上次提高 ${change} 分`
          : change < 0
            ? `比上次下降 ${Math.abs(change)} 分`
            : '与上次持平',
      trendSummary: latest
        ? `${summary.recentRecords.length} 次记录 · 平均 ${summary.averageText} · ${summary.changeValueText}`
        : '',
      primaryTargetName: primary ? primary.schoolName : '',
      targetLevelLabel: primary
        ? (APP_CONFIG.targetScore.levels.find((item) => item.value === primary.level) || {}).label || '目标'
        : '',
      targetReferenceText: reference ? `${reference.minScore} 分（${reference.year} 年）` : '暂无有效参考分',
      targetDifferenceText: formatDifference(gap.difference),
      stageGoalTitle: stageGoal ? stageGoal.title : '',
      stageGoalDeadline: stageGoal && stageGoal.endDate ? stageGoal.endDate : '未设置截止日期',
      stageGoalProgressText: targetGap === null
        ? '记录成绩后查看目标差距'
        : targetGap > 0
          ? `距离阶段总分目标还有 ${targetGap} 分`
          : targetGap === 0
            ? '当前成绩达到阶段总分目标'
            : `当前成绩高于阶段目标 ${Math.abs(targetGap)} 分`
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
    const result = saveExamYear(year, operationOptions('save_exam_year', year))
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    this.setData({
      examYearIndex: index,
      countdown: calculateExamCountdown(year)
    })
    this.refreshOverview()
    wx.showToast({ title: '目标年份已保存在本机', icon: 'success' })
  },

  openScoreCenter() {
    getApp().globalData.scoreCenterSegment = 'records'
    wx.switchTab({ url: '/pages/score-trend/score-trend' })
  },

  openRecommendations() {
    getApp().globalData.targetCenterSegment = 'recommendation'
    wx.switchTab({ url: '/pages/targets/targets' })
  },

  openTargetPlanning() {
    getApp().globalData.targetCenterSegment = 'schools'
    wx.switchTab({ url: '/pages/targets/targets' })
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
