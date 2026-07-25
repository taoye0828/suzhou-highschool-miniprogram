const { schools } = require('../../data/schools')
const { admissionScores } = require('../../data/admission-scores')
const { APP_CONFIG } = require('../../config/app-config')
const { getExamYearResult, saveExamYear } = require('../../utils/storage')
const { notifyStorageReadResult } = require('../../utils/storage-feedback')
const { calculateExamCountdown, examYearOptions } = require('../../utils/countdown')

function uniqueScoreYears() {
  return Array.from(new Set(admissionScores.map((item) => item.year))).sort((left, right) => left - right)
}

const scoreYears = uniqueScoreYears()
const scoreStats = {
  schoolCount: schools.length,
  scoreCount: admissionScores.length,
  yearsText: scoreYears.join('、'),
  verifiedText: `已收录 ${scoreYears.join('、')} 年官方历史分数线`
}

const entries = [
  { title: '查学校', subtitle: '搜索和筛选学校基础信息', route: '/pages/schools/schools', tab: true },
  { title: '成绩分析', subtitle: '按固定历史分差区间查看目标参考', route: '/pages/target-analysis/target-analysis', tab: false },
  { title: '高中对比', subtitle: '选择 2 至 3 所学校横向核对', route: '/pages/school-compare/school-compare', tab: false },
  { title: '成绩趋势', subtitle: '在本机记录考试成绩变化', route: '/pages/score-trend/score-trend', tab: false },
  { title: '看数据说明', subtitle: '了解来源、口径和边界', route: '/pages/data-info/data-info', tab: false },
  { title: '学习目标记录', subtitle: '在本机记录阶段目标', route: '/pages/targets/targets', tab: true },
  { title: '我的收藏', subtitle: '查看本机收藏学校', route: '/pages/favorites/favorites', tab: true }
]

Page({
  data: {
    appName: APP_CONFIG.name,
    entries,
    homeTagline: APP_CONFIG.policy.homeTagline,
    homeBoundary: APP_CONFIG.policy.homeBoundary,
    localBoundary: APP_CONFIG.policy.localBoundary,
    sourceCheckedAt: APP_CONFIG.schoolData.sourceCheckedAt,
    usageSteps: APP_CONFIG.policy.usageSteps,
    scoreStats,
    examYears: [],
    examYearIndex: 0,
    countdown: null
  },

  onLoad() {
    this.refreshCountdown()
  },

  onShow() {
    this.refreshCountdown()
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

  openEntry(event) {
    const { route, tab } = event.currentTarget.dataset
    if (tab) wx.switchTab({ url: route })
    else wx.navigateTo({ url: route })
  }
})
