const { getSchoolById, presentSchool } = require('../../utils/school')
const { getFavoriteIdsResult, setFavorite } = require('../../utils/storage')
const { notifyStorageReadResult } = require('../../utils/storage-feedback')
const { mapSearchKeyword, copyText } = require('../../utils/map')
const {
  EMPTY_SCORE_TEXT,
  SCORE_SAFETY_NOTICE,
  groupScoresByYear
} = require('../../utils/admission-scores')
const { APP_CONFIG } = require('../../config/app-config')

Page({
  data: {
    schoolId: '',
    school: null,
    scoreGroups: [],
    isFavorite: false,
    mapKeyword: '',
    emptyScoreText: EMPTY_SCORE_TEXT,
    scoreSafetyNotice: SCORE_SAFETY_NOTICE,
    detailNotice: APP_CONFIG.policy.schoolDetailNotice
  },

  onLoad(options) {
    this.setData({ schoolId: options.id || '' })
    this.refresh()
  },

  onShow() {
    if (this.data.schoolId) this.refresh()
  },

  refresh() {
    const school = getSchoolById(this.data.schoolId)
    const favoriteResult = getFavoriteIdsResult()
    notifyStorageReadResult(this, favoriteResult)
    this.setData({
      school: school ? presentSchool(school, favoriteResult.ids) : null,
      isFavorite: school ? favoriteResult.ids.includes(school.id) : false,
      scoreGroups: school ? groupScoresByYear(school.id) : [],
      mapKeyword: school ? mapSearchKeyword(school.name) : ''
    })
  },

  toggleFavorite() {
    if (!this.data.school) return
    const nextValue = !this.data.isFavorite
    const result = setFavorite(this.data.school.id, nextValue)
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    this.setData({ isFavorite: nextValue })
    wx.showToast({ title: nextValue ? '已收藏' : '已取消收藏', icon: 'success' })
  },

  copySchoolName() {
    copyText(this.data.school && this.data.school.name, '学校名称已复制')
  },

  copyAddress() {
    copyText(this.data.school && this.data.school.address, '地址已复制')
  },

  copyMapKeyword() {
    copyText(this.data.mapKeyword, '地图搜索词已复制')
  },

  copySourceLink() {
    copyText(this.data.school && this.data.school.sourceUrl, '来源链接已复制')
  },

  copyOfficialWebsite() {
    copyText(this.data.school && this.data.school.officialWebsite, '官网链接已复制')
  },

  copyScoreSource(event) {
    copyText(event.currentTarget.dataset.url, '分数线来源链接已复制')
  },

  openSchools() {
    wx.switchTab({ url: '/pages/schools/schools' })
  }
})
