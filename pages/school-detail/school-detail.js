const { getSchoolById, sourceTypeLabel, isDemoSchool } = require('../../utils/school')
const { getFavoriteIdsResult, setFavorite } = require('../../utils/storage')
const { notifyStorageReadResult } = require('../../utils/storage-feedback')
const { mapSearchKeyword, copyText } = require('../../utils/map')
const { APP_CONFIG } = require('../../config/app-config')

Page({
  data: {
    schoolId: '',
    school: null,
    isFavorite: false,
    mapKeyword: '',
    detailNotice: APP_CONFIG.policy.schoolDetailNotice,
    completenessItems: [
      { label: '基础信息', value: '已展示' },
      { label: '来源信息', value: '已标注' },
      { label: '录取分数线', value: '当前版本暂不展示' },
      { label: '地址坐标', value: '当前版本暂不展示' },
      { label: '联系方式', value: '当前版本暂不展示' },
      { label: '路线规划', value: '当前版本暂不提供' }
    ]
  },

  onLoad(options) {
    this.setData({ schoolId: options.id || '' })
    this.refresh()
  },

  onShow() { if (this.data.schoolId) this.refresh() },

  refresh() {
    const school = getSchoolById(this.data.schoolId)
    const favoriteResult = getFavoriteIdsResult()
    notifyStorageReadResult(this, favoriteResult)
    this.setData({
      school: school ? {
        ...school,
        sourceTypeLabel: sourceTypeLabel(school.dataKind),
        isDemo: isDemoSchool(school)
      } : null,
      isFavorite: school ? favoriteResult.ids.includes(school.id) : false,
      mapKeyword: school ? school.mapSearchKeyword || mapSearchKeyword(school.name) : ''
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
    copyText(this.data.school.name, '学校名称已复制')
  },

  copyMapKeyword() {
    copyText(this.data.mapKeyword, '搜索词已复制')
  },

  copySourceLink() {
    copyText(this.data.school.sourceUrl, '来源链接已复制')
  },

  copyOfficialWebsite() {
    copyText(this.data.school.officialWebsite, '官网链接已复制')
  }
})
