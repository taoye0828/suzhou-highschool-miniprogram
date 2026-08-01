const { schools, withFavoriteState, splitFavoriteIdsByValidity } = require('../../utils/school')
const { getFavoriteIdsResult, setFavorite, replaceFavoriteIds } = require('../../utils/storage')
const { notifyStorageReadResult } = require('../../utils/storage-feedback')
const { searchSchools, normalizeSearchText } = require('../../utils/school-search')
const { operationOptions } = require('../../utils/operation-context')

Page({
  data: {
    favorites: [],
    invalidCount: 0,
    keyword: '',
    hasFavoriteSchools: false,
    searchActive: false
  },

  onShow() { this.refresh() },

  refresh() {
    const favoriteResult = getFavoriteIdsResult()
    notifyStorageReadResult(this, favoriteResult)
    const { valid, invalid } = splitFavoriteIdsByValidity(favoriteResult.ids)
    this._favoriteSchools = withFavoriteState(
      schools.filter((school) => valid.includes(school.id)),
      valid
    )
    this.setData({
      invalidCount: invalid.length,
      hasFavoriteSchools: this._favoriteSchools.length > 0
    }, () => this.applySearch())
  },

  onKeywordInput(event) {
    this.setData({ keyword: event.detail.value }, () => this.applySearch())
  },

  applySearch() {
    const searchActive = Boolean(normalizeSearchText(this.data.keyword))
    this.setData({
      searchActive,
      favorites: searchSchools({
        schools: this._favoriteSchools || [],
        keyword: this.data.keyword
      })
    })
  },

  removeFavorite(event) {
    const id = event.currentTarget.dataset.id
    const result = setFavorite(id, false, operationOptions('set_favorite', id))
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
    const result = replaceFavoriteIds(valid, operationOptions('replace_favorites', 'favoriteSchoolIds'))
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
