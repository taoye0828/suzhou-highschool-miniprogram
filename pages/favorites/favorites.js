const { schools, withFavoriteState } = require('../../utils/school')
const { getFavoriteIds, setFavorite } = require('../../utils/storage')

Page({
  data: { favorites: [] },

  onShow() { this.refresh() },

  refresh() {
    const ids = getFavoriteIds()
    this.setData({ favorites: withFavoriteState(schools.filter((school) => ids.includes(school.id)), ids) })
  },

  removeFavorite(event) {
    setFavorite(event.currentTarget.dataset.id, false)
    wx.showToast({ title: '已取消收藏', icon: 'success' })
    this.refresh()
  },

  openDetail(event) {
    wx.navigateTo({ url: `/pages/school-detail/school-detail?id=${event.currentTarget.dataset.id}` })
  }
})
