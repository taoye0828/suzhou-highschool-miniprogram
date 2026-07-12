const { schools, withFavoriteState, splitFavoriteIdsByValidity } = require('../../utils/school')
const { getFavoriteIdsResult, setFavorite, replaceFavoriteIds } = require('../../utils/storage')
const { notifyStorageReadResult } = require('../../utils/storage-feedback')

Page({
  data: {
    favorites: [],
    invalidCount: 0
  },

  onShow() { this.refresh() },

  refresh() {
    const favoriteResult = getFavoriteIdsResult()
    notifyStorageReadResult(this, favoriteResult)
    const { valid, invalid } = splitFavoriteIdsByValidity(favoriteResult.ids)
    const cleanupResult = invalid.length ? replaceFavoriteIds(valid) : { ok: true }
    if (!cleanupResult.ok) {
      wx.showToast({ title: cleanupResult.message, icon: 'none' })
    }
    this.setData({
      favorites: withFavoriteState(schools.filter((school) => valid.includes(school.id)), valid),
      invalidCount: cleanupResult.ok ? 0 : invalid.length
    })
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

  cleanInvalidFavorites() {
    const favoriteResult = getFavoriteIdsResult()
    notifyStorageReadResult(this, favoriteResult)
    const { valid } = splitFavoriteIdsByValidity(favoriteResult.ids)
    const result = replaceFavoriteIds(valid)
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    wx.showToast({ title: '已清理', icon: 'success' })
    this.refresh()
  },

  openDetail(event) {
    wx.navigateTo({ url: `/pages/school-detail/school-detail?id=${event.currentTarget.dataset.id}` })
  },

  openSchools() {
    wx.switchTab({ url: '/pages/schools/schools' })
  }
})
