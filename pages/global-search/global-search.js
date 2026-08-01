const {
  getScoreRecords,
  getTargetRecords,
  getLearningTasks,
  getSchoolUserStates,
  getActiveProfile
} = require('../../utils/storage')
const { schools } = require('../../data/schools')
const { globalSearchCurrentProfile } = require('../../utils/school-planning')

Page({
  data: {
    keyword: '',
    results: [],
    hasSearched: false,
    activeProfileName: '默认档案'
  },

  onShow() {
    this.setData({ activeProfileName: (getActiveProfile() || {}).nickname || '默认档案' })
    if (this.data.keyword) this.search()
  },

  onKeywordInput(event) {
    this.setData({ keyword: event.detail.value }, () => this.search())
  },

  search() {
    const keyword = String(this.data.keyword || '').trim()
    this.setData({
      results: globalSearchCurrentProfile({
        keyword,
        schools,
        exams: getScoreRecords(),
        targets: getTargetRecords(),
        tasks: getLearningTasks(),
        schoolUserStates: getSchoolUserStates()
      }),
      hasSearched: Boolean(keyword)
    })
  },

  openResult(event) {
    const item = this.data.results.find((result) => result.type === event.currentTarget.dataset.type && result.id === event.currentTarget.dataset.id)
    if (!item) return
    if (item.type === 'school') return wx.navigateTo({ url: `/pages/school-detail/school-detail?id=${item.id}` })
    const app = getApp()
    if (item.type === 'exam') {
      app.globalData.scoreCenterSegment = 'records'
      return wx.switchTab({ url: '/pages/score-trend/score-trend' })
    }
    app.globalData.targetCenterSegment = item.type === 'target' ? 'schools' : 'learning'
    return wx.switchTab({ url: '/pages/targets/targets' })
  }
})
