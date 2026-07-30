Page({
  onLoad() {
    this.openTargetRecommendations()
  },

  onShow() {
    if (!this._redirecting) this.openTargetRecommendations()
  },

  openTargetRecommendations() {
    this._redirecting = true
    const app = getApp()
    if (app && app.globalData) {
      app.globalData.targetCenterSegment = 'recommendation'
    }
    wx.switchTab({
      url: '/pages/targets/targets',
      fail: () => {
        wx.reLaunch({
          url: '/pages/targets/targets',
          fail: () => {
            this._redirecting = false
            wx.showToast({ title: '目标规划打开失败，请从底部导航进入。', icon: 'none' })
          }
        })
      }
    })
  }
})
