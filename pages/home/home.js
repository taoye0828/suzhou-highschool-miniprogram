const { schools } = require('../../data/schools')
const { admissionScores } = require('../../data/admission-scores')
const { APP_CONFIG } = require('../../config/app-config')


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
  { title: '看数据说明', subtitle: '了解来源、口径和边界', route: '/pages/data-info/data-info', tab: false },
  { title: '学习目标记录', subtitle: '在本机记录阶段目标', route: '/pages/targets/targets', tab: true },
  { title: '我的收藏', subtitle: '查看本机收藏学校', route: '/pages/favorites/favorites', tab: true }
]

Page({
  data: {
    appName: APP_CONFIG.name,
    entries,
    homeTagline: APP_CONFIG.policy.homeTagline,
    usageSteps: APP_CONFIG.policy.usageSteps,
    scoreStats
  },

  openEntry(event) {
    const { route, tab } = event.currentTarget.dataset
    if (tab) wx.switchTab({ url: route })
    else wx.navigateTo({ url: route })
  }
})
