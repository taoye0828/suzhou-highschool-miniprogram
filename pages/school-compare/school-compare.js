const { schools } = require('../../data/schools')
const { getFavoriteIdsResult } = require('../../utils/storage')
const { notifyStorageReadResult } = require('../../utils/storage-feedback')
const { scoreSummaryForSchool } = require('../../utils/score-analysis')
const { APP_CONFIG } = require('../../config/app-config')

function presentSchool(school, favoriteIds) {
  return {
    ...school,
    tagsText: Array.isArray(school.tags) && school.tags.length ? school.tags.join('、') : '暂未补充',
    addressText: school.address || '暂未补充',
    ownershipText: school.ownership || '暂未补充',
    scoreSummary: scoreSummaryForSchool(school.id),
    favoriteText: favoriteIds.includes(school.id) ? '已收藏' : '未收藏'
  }
}

Page({
  data: {
    selectedIds: [],
    selectedSchools: [],
    availableSchools: schools,
    pickerIndex: 0,
    canAdd: true,
    canCompare: false,
    planningDisclaimer: APP_CONFIG.policy.planningDisclaimer
  },

  onLoad() {
    this.refresh()
  },

  onShow() {
    this.refresh()
  },

  refresh() {
    const favoriteResult = getFavoriteIdsResult()
    notifyStorageReadResult(this, favoriteResult)
    const selectedIds = this.data.selectedIds.filter((id) => schools.some((school) => school.id === id))
    const selectedSchools = selectedIds
      .map((id) => schools.find((school) => school.id === id))
      .filter(Boolean)
      .map((school) => presentSchool(school, favoriteResult.ids))
    const availableSchools = schools.filter((school) => !selectedIds.includes(school.id))
    this.setData({
      selectedIds,
      selectedSchools,
      availableSchools,
      pickerIndex: 0,
      canAdd: selectedSchools.length < 3 && availableSchools.length > 0,
      canCompare: selectedSchools.length >= 2
    })
  },

  onSchoolChange(event) {
    if (this.data.selectedIds.length >= 3) {
      wx.showToast({ title: '最多对比 3 所学校', icon: 'none' })
      return
    }
    const school = this.data.availableSchools[Number(event.detail.value)]
    if (!school || this.data.selectedIds.includes(school.id)) return
    this.setData({ selectedIds: [...this.data.selectedIds, school.id] }, () => this.refresh())
  },

  removeSchool(event) {
    const id = event.currentTarget.dataset.id
    this.setData({
      selectedIds: this.data.selectedIds.filter((item) => item !== id)
    }, () => this.refresh())
  },

  openDetail(event) {
    wx.navigateTo({
      url: `/pages/school-detail/school-detail?id=${event.currentTarget.dataset.id}`
    })
  }
})
