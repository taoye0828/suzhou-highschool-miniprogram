const { uniqueValues, filterSchools, withFavoriteState } = require('../../utils/school')
const { getFavoriteIds, setFavorite } = require('../../utils/storage')

Page({
  data: {
    keyword: '',
    districts: uniqueValues('district'),
    schoolTypes: uniqueValues('schoolType'),
    boardingTypes: uniqueValues('boardingType'),
    districtIndex: 0,
    schoolTypeIndex: 0,
    boardingTypeIndex: 0,
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

  onBoardingTypeChange(event) {
    this.setData({ boardingTypeIndex: Number(event.detail.value) }, () => this.refresh())
  },

  resetFilters() {
    this.setData({ keyword: '', districtIndex: 0, schoolTypeIndex: 0, boardingTypeIndex: 0 }, () => this.refresh())
  },

  refresh() {
    const query = {
      keyword: this.data.keyword,
      district: this.data.districts[this.data.districtIndex],
      schoolType: this.data.schoolTypes[this.data.schoolTypeIndex],
      boardingType: this.data.boardingTypes[this.data.boardingTypeIndex]
    }
    const results = withFavoriteState(filterSchools(query), getFavoriteIds())
    this.setData({ results })
  },

  toggleFavorite(event) {
    const { id } = event.currentTarget.dataset
    const item = this.data.results.find((school) => school.id === id)
    if (!item) return
    setFavorite(id, !item.isFavorite)
    wx.showToast({ title: item.isFavorite ? '已取消收藏' : '已收藏', icon: 'success' })
    this.refresh()
  },

  openDetail(event) {
    wx.navigateTo({ url: `/pages/school-detail/school-detail?id=${event.currentTarget.dataset.id}` })
  }
})
