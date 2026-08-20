const { publicDataService, activeAnnouncements, publishedDateText } = require('../../utils/public-data-service')
const { shareConfig } = require('../../utils/share')

Page({
  data: {
    announcement: null,
    notFound: false
  },

  onLoad(options) {
    try {
      this.announcementId = decodeURIComponent(String(options && options.id || ''))
    } catch (error) {
      this.announcementId = ''
    }
    this.unsubscribePublicData = publicDataService.subscribe((snapshot) => this.applyPublicData(snapshot))
    this.applyPublicData(publicDataService.getSnapshot())
  },

  onUnload() {
    if (this.unsubscribePublicData) this.unsubscribePublicData()
  },

  applyPublicData(snapshot) {
    const item = activeAnnouncements(snapshot).find((row) => row.id === this.announcementId) || null
    if (!item) {
      wx.setNavigationBarTitle({ title: '公告不存在' })
      this.setData({ announcement: null, notFound: true })
      return
    }
    wx.setNavigationBarTitle({ title: item.title })
    this.setData({
      announcement: {
        ...item,
        hasSchool: Boolean(item.schoolId),
        dateText: publishedDateText(item.publishTime || item.startsAt || item.createdAt),
        updatedText: publishedDateText(item.updatedAt)
      },
      notFound: false
    })
  },

  onShareAppMessage() {
    return shareConfig('pages/announcement-detail/announcement-detail', `id=${encodeURIComponent(this.announcementId || '')}`)
  },

  onShareTimeline() {
    return shareConfig('pages/announcement-detail/announcement-detail', `id=${encodeURIComponent(this.announcementId || '')}`)
  },

  openSchool() {
    const schoolId = this.data.announcement && this.data.announcement.schoolId
    if (schoolId) wx.navigateTo({ url: `/pages/school-detail/school-detail?id=${encodeURIComponent(schoolId)}` })
  },

  goHome() {
    wx.switchTab({ url: '/pages/home/home' })
  }
})
