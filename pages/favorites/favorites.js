const { schools, withFavoriteState } = require('../../utils/school')
const { getFavoriteIdsResult, setFavorite } = require('../../utils/storage')
const { notifyStorageReadResult } = require('../../utils/storage-feedback')

Page({
  data: { favorites: [] },

  onShow() { this.refresh() },

  refresh() {
    const favoriteResult = getFavoriteIdsResult()
    notifyStorageReadResult(this, favoriteResult)
    const ids = favoriteResult.ids
    this.setData({ favorites: withFavoriteState(schools.filter((school) => ids.includes(school.id)), ids) })
  },

  removeFavorite(event) {
    const result = setFavorite(event.currentTarget.dataset.id, false)
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    wx.showToast({ title: '已取消收藏', icon: 'success' })
    this.refresh()
  },

  openDetail(event) {
    wx.navigateTo({ url: `/pages/school-detail/school-detail?id=${event.currentTarget.dataset.id}` })
  }
})
