const { uniqueValues, filterSchools, withFavoriteState } = require('../../utils/school')
const { getFavoriteIdsResult, setFavorite } = require('../../utils/storage')
const { notifyStorageReadResult } = require('../../utils/storage-feedback')

Page({
  data: {
    keyword: '',
    districts: uniqueValues('district'),
    schoolTypes: uniqueValues('schoolType'),
    ownerships: uniqueValues('ownership'),
    scoreStatuses: ['全部', '已收录分数线', '未收录分数线'],
    districtIndex: 0,
    schoolTypeIndex: 0,
    ownershipIndex: 0,
    scoreStatusIndex: 0,
    results: []
  },

  onLoad() { this.refresh() },
  onShow() { this.refresh() },

  onKeywordInput(event) {
    this.setData({ keyword: event.detail.value }, () => this.refresh())
  },

  onDistrictChange(event) {
    this.setData({ districtIndex: Number(event.detail.value) }, () => this.refresh())
  },

  onSchoolTypeChange(event) {
    this.setData({ schoolTypeIndex: Number(event.detail.value) }, () => this.refresh())
  },

  onOwnershipChange(event) {
    this.setData({ ownershipIndex: Number(event.detail.value) }, () => this.refresh())
  },

  onScoreStatusChange(event) {
    this.setData({ scoreStatusIndex: Number(event.detail.value) }, () => this.refresh())
  },

  resetFilters() {
    this.setData({
      keyword: '',
      districtIndex: 0,
      schoolTypeIndex: 0,
      ownershipIndex: 0,
      scoreStatusIndex: 0
    }, () => this.refresh())
  },

  refresh() {
    const query = {
      keyword: this.data.keyword,
      district: this.data.districts[this.data.districtIndex],
      schoolType: this.data.schoolTypes[this.data.schoolTypeIndex],
      ownership: this.data.ownerships[this.data.ownershipIndex],
      scoreStatus: this.data.scoreStatuses[this.data.scoreStatusIndex]
    }
    const favoriteResult = getFavoriteIdsResult()
    notifyStorageReadResult(this, favoriteResult)
    const results = withFavoriteState(filterSchools(query), favoriteResult.ids)
    this.setData({ results })
  },

  toggleFavorite(event) {
    const { id } = event.currentTarget.dataset
    const item = this.data.results.find((school) => school.id === id)
    if (!item) return
    const result = setFavorite(id, !item.isFavorite)
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    wx.showToast({ title: item.isFavorite ? '已取消收藏' : '已收藏', icon: 'success' })
    this.refresh()
  },

  openDetail(event) {
    wx.navigateTo({ url: `/pages/school-detail/school-detail?id=${event.currentTarget.dataset.id}` })
  }
})
