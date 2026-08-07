const { getActiveProfile, getExamYear } = require('../../utils/storage')

Page({
  data: {
    profileName: '默认档案',
    examYear: 2027
  },

  onShow() {
    const profile = getActiveProfile()
    this.setData({
      profileName: profile ? profile.nickname : '默认档案',
      examYear: Number(getExamYear()) || (profile && profile.examYear) || 2027
    })
  },

  openProfiles() {
    wx.navigateTo({ url: '/pages/profile-management/profile-management' })
  },

  openBackupRestore() {
    wx.navigateTo({ url: '/pages/backup-restore/backup-restore' })
  },

  openHelp() {
    wx.navigateTo({ url: '/pages/help/help' })
  },

  openPrivacy() {
    wx.navigateTo({ url: '/pages/privacy/privacy' })
  }
})
