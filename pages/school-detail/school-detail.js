const { getSchoolById } = require('../../utils/school')
const { isFavorite, setFavorite } = require('../../utils/storage')
const { mapSearchKeyword, copyText, showExternalMapGuide } = require('../../utils/map')

Page({
  data: { schoolId: '', school: null, isFavorite: false, mapKeyword: '' },

  onLoad(options) {
    this.setData({ schoolId: options.id || '' })
    this.refresh()
  },

  onShow() { if (this.data.schoolId) this.refresh() },

  refresh() {
    const school = getSchoolById(this.data.schoolId)
    this.setData({
      school: school || null,
      isFavorite: school ? isFavorite(school.id) : false,
      mapKeyword: school ? mapSearchKeyword(school.name) : ''
    })
  },

  toggleFavorite() {
    if (!this.data.school) return
    const nextValue = !this.data.isFavorite
    setFavorite(this.data.school.id, nextValue)
    this.setData({ isFavorite: nextValue })
    wx.showToast({ title: nextValue ? '已收藏' : '已取消收藏', icon: 'success' })
  },

  copySchoolName() {
    copyText(this.data.school.name, '学校名称已复制')
  },

  copyMapKeyword() {
    copyText(this.data.mapKeyword, '搜索词已复制')
  },

  showMapGuide() {
    showExternalMapGuide(this.data.school.name)
  }
})
