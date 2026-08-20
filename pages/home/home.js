const {
  getActiveProfile,
  getScoreRecords,
  getTargetRecords,
  getExamYear
} = require('../../utils/storage')
const { calculateExamCountdown } = require('../../utils/countdown')
const {
  publicDataService,
  activeAnnouncements,
  effectiveContent,
  publishedDateText
} = require('../../utils/public-data-service')
const { shareConfig } = require('../../utils/share')

function orderedScores(records) {
  return (Array.isArray(records) ? records : []).slice().sort((left, right) => {
    const dateCompare = String(left.examDate || left.date || '').localeCompare(String(right.examDate || right.date || ''))
    return dateCompare || String(left.createdAt || '').localeCompare(String(right.createdAt || ''))
  })
}

Page({
  data: {
    profileName: '默认档案',
    examYear: 2027,
    countdown: null,
    latestScore: null,
    targetCount: 0,
    targetNames: '',
    announcements: [],
    publicNotice: '',
    showUpdatedAt: false,
    dataUpdatedAt: ''
  },

  onShareAppMessage() {
    return shareConfig('pages/home/home')
  },

  onShareTimeline() {
    return shareConfig('pages/home/home')
  },

  onLoad() {
    this.unsubscribePublicData = publicDataService.subscribe((snapshot) => this.applyPublicData(snapshot))
    this.applyPublicData(publicDataService.getSnapshot())
  },

  onShow() {
    const profile = getActiveProfile()
    const examYear = Number(getExamYear()) || (profile && profile.examYear) || 2027
    const scores = orderedScores(getScoreRecords())
    const targets = getTargetRecords()
    const latest = scores.length ? scores[scores.length - 1] : null
    this.setData({
      profileName: profile ? profile.nickname : '默认档案',
      examYear,
      countdown: calculateExamCountdown(examYear),
      latestScore: latest ? {
        examName: latest.examName,
        examDate: latest.examDate || latest.date,
        totalScore: latest.totalScore === undefined ? latest.score : latest.totalScore
      } : null,
      targetCount: targets.length,
      targetNames: targets.slice(0, 3).map((item) => item.schoolName).join('、')
    })
  },

  onUnload() {
    if (this.unsubscribePublicData) this.unsubscribePublicData()
  },

  applyPublicData(snapshot) {
    const content = effectiveContent(snapshot && snapshot.content)
    const announcements = activeAnnouncements(snapshot).slice(0, 5).map((item) => ({
      ...item,
      dateText: publishedDateText(item.publishTime || item.startsAt || item.createdAt)
    }))
    this.setData({
      announcements,
      publicNotice: content.display.publicNotice,
      showUpdatedAt: content.display.showUpdatedAt && Boolean(publishedDateText(snapshot && snapshot.publishedAt)),
      dataUpdatedAt: publishedDateText(snapshot && snapshot.publishedAt)
    })
  },

  openProfiles() {
    wx.navigateTo({ url: '/pages/profile-management/profile-management' })
  },

  openScores() {
    wx.switchTab({ url: '/pages/score-trend/score-trend' })
  },

  openTargets() {
    wx.switchTab({ url: '/pages/targets/targets' })
  },

  openSchools() {
    wx.switchTab({ url: '/pages/schools/schools' })
  },

  openAnnouncement(event) {
    const id = String(event.currentTarget.dataset.id || '')
    if (id) wx.navigateTo({ url: `/pages/announcement-detail/announcement-detail?id=${encodeURIComponent(id)}` })
  }
})
