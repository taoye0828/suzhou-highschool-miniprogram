const {
  uniqueValues,
  uniqueTags,
  filterSchools,
  withFavoriteState,
  SCORE_RANGES,
  SCORE_STATUS_WITH_SCORES,
  SCORE_STATUS_WITHOUT_SCORES
} = require('../../utils/school')
const {
  getFavoriteIdsResult,
  getTargetRecordsResult,
  getExamYearResult,
  setFavorite
} = require('../../utils/storage')
const { notifyStorageReadResult } = require('../../utils/storage-feedback')
const { APP_CONFIG } = require('../../config/app-config')

const TARGET_FILTERS = [
  { value: 'all', label: '全部' },
  ...APP_CONFIG.targetScore.levels
]

Page({
  data: {
    keyword: '',
    districts: uniqueValues('district'),
    schoolTypes: uniqueValues('schoolType'),
    ownerships: uniqueValues('ownership'),
    tags: uniqueTags(),
    scoreStatuses: ['全部', SCORE_STATUS_WITH_SCORES, SCORE_STATUS_WITHOUT_SCORES],
    scoreRanges: SCORE_RANGES,
    targetFilters: TARGET_FILTERS,
    districtIndex: 0,
    schoolTypeIndex: 0,
    ownershipIndex: 0,
    tagIndex: 0,
    scoreStatusIndex: 0,
    scoreRangeIndex: 0,
    targetFilterIndex: 0,
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

  onTagChange(event) {
    this.setData({ tagIndex: Number(event.detail.value) }, () => this.refresh())
  },

  onScoreStatusChange(event) {
    this.setData({ scoreStatusIndex: Number(event.detail.value) }, () => this.refresh())
  },

  onScoreRangeChange(event) {
    this.setData({ scoreRangeIndex: Number(event.detail.value) }, () => this.refresh())
  },

  onTargetFilterChange(event) {
    this.setData({ targetFilterIndex: Number(event.detail.value) }, () => this.refresh())
  },

  resetFilters() {
    this.setData({
      keyword: '',
      districtIndex: 0,
      schoolTypeIndex: 0,
      ownershipIndex: 0,
      tagIndex: 0,
      scoreStatusIndex: 0,
      scoreRangeIndex: 0,
      targetFilterIndex: 0
    }, () => this.refresh())
  },

  refresh() {
    const targetResult = getTargetRecordsResult()
    const yearResult = getExamYearResult()
    const query = {
      keyword: this.data.keyword,
      district: this.data.districts[this.data.districtIndex],
      schoolType: this.data.schoolTypes[this.data.schoolTypeIndex],
      ownership: this.data.ownerships[this.data.ownershipIndex],
      tag: this.data.tags[this.data.tagIndex],
      scoreStatus: this.data.scoreStatuses[this.data.scoreStatusIndex],
      scoreRange: this.data.scoreRanges[this.data.scoreRangeIndex],
      targetLevel: this.data.targetFilters[this.data.targetFilterIndex].value,
      targetRecords: targetResult.records,
      targetYear: yearResult.year
    }
    const favoriteResult = getFavoriteIdsResult()
    const failedResult = [favoriteResult, targetResult, yearResult].find((result) => !result.ok)
    notifyStorageReadResult(this, failedResult || favoriteResult)
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
