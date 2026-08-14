const { getTargetRecords } = require('../../utils/storage')
const { selectLatestReference, referenceScoreValue } = require('../../utils/planning')
const { publicDataService, effectiveContent } = require('../../utils/public-data-service')

const SORTS = [
  { value: 'default', label: '默认' },
  { value: 'desc', label: '参考分高到低' },
  { value: 'asc', label: '参考分低到高' }
]

function uniqueOptions(items, field) {
  return ['全部', ...new Set(items.map((item) => item[field]).filter(Boolean))]
}

function yearOptions(scores) {
  return ['最新', ...new Set(scores.map((item) => Number(item.year)).filter(Number.isInteger).sort((a, b) => b - a))]
}

function keywordMatches(school, keyword) {
  if (!keyword) return true
  const values = [school.name, ...(Array.isArray(school.aliases) ? school.aliases : [])]
  return values.some((value) => String(value || '').toLowerCase().includes(keyword))
}

function referenceFor(scores, schoolId, year) {
  const options = { schoolId }
  if (Number.isInteger(year)) options.exactYear = year
  return selectLatestReference(scores, options)
}

function selectedValue(values, index) {
  return Array.isArray(values) && values[index] !== undefined ? values[index] : values[0]
}

Page({
  data: {
    keyword: '',
    districts: ['全部'],
    districtIndex: 0,
    schoolTypes: ['全部'],
    schoolTypeIndex: 0,
    years: ['最新'],
    yearIndex: 0,
    sorts: SORTS,
    sortIndex: 0,
    minScore: '',
    maxScore: '',
    showMoreFilters: false,
    schoolRows: []
  },

  onLoad() {
    this.unsubscribePublicData = publicDataService.subscribe((snapshot) => this.applyPublicData(snapshot))
    this.applyPublicData(publicDataService.getSnapshot())
  },

  onShow() {
    this.applyPublicData(publicDataService.getSnapshot())
  },

  onUnload() {
    if (this.unsubscribePublicData) this.unsubscribePublicData()
  },

  applyPublicData(snapshot) {
    const oldDistrict = selectedValue(this.data.districts, this.data.districtIndex)
    const oldSchoolType = selectedValue(this.data.schoolTypes, this.data.schoolTypeIndex)
    const oldYear = selectedValue(this.data.years, this.data.yearIndex)
    this.publicSchools = Array.isArray(snapshot.schools) ? snapshot.schools : []
    this.publicScores = Array.isArray(snapshot.scores) ? snapshot.scores : []
    this.publicImages = Array.isArray(snapshot.images) ? snapshot.images : []
    this.displaySettings = effectiveContent(snapshot.content).display
    const districts = uniqueOptions(this.publicSchools, 'district')
    const schoolTypes = uniqueOptions(this.publicSchools, 'schoolType')
    const years = yearOptions(this.publicScores)
    const requestedYear = oldYear === '最新' && Number.isInteger(this.displaySettings.defaultHistoryYear)
      ? this.displaySettings.defaultHistoryYear : oldYear
    this.setData({
      districts,
      districtIndex: Math.max(0, districts.indexOf(oldDistrict)),
      schoolTypes,
      schoolTypeIndex: Math.max(0, schoolTypes.indexOf(oldSchoolType)),
      years,
      yearIndex: Math.max(0, years.indexOf(requestedYear))
    })
    this.refresh()
  },

  refresh() {
    const schools = this.publicSchools || []
    const scores = this.publicScores || []
    const images = this.publicImages || []
    const keyword = String(this.data.keyword || '').trim().toLowerCase()
    const district = selectedValue(this.data.districts, this.data.districtIndex)
    const schoolType = selectedValue(this.data.schoolTypes, this.data.schoolTypeIndex)
    const selectedYear = selectedValue(this.data.years, this.data.yearIndex)
    const minScore = this.data.minScore === '' ? null : Number(this.data.minScore)
    const maxScore = this.data.maxScore === '' ? null : Number(this.data.maxScore)
    const targetIds = new Set(getTargetRecords().map((item) => item.schoolId))
    const covers = new Map()
    images.slice().sort((left, right) => Number(Boolean(right.isCover)) - Number(Boolean(left.isCover)) || Number(left.sortOrder || 0) - Number(right.sortOrder || 0))
      .forEach((image) => { if (!covers.has(image.schoolId)) covers.set(image.schoolId, image.thumbnailUrl || image.publicUrl || '') })
    let rows = schools.map((school, sourceIndex) => {
      const reference = referenceFor(scores, school.id, selectedYear)
      return {
        id: school.id,
        name: school.name,
        district: school.district || '未注明',
        schoolType: school.schoolType || '未注明',
        thumbnailUrl: covers.get(school.id) || '',
        referenceScore: reference ? referenceScoreValue(reference) : null,
        referenceYear: reference ? reference.year : null,
        referenceText: reference ? `${referenceScoreValue(reference)} 分` : '暂无已核实分数',
        yearText: reference ? `${reference.year} 年` : '',
        isTarget: targetIds.has(school.id),
        sortOrder: Number(school.sortOrder || 0),
        sourceIndex,
        matchesKeyword: keywordMatches(school, keyword)
      }
    }).filter((row) => row.matchesKeyword &&
      (district === '全部' || row.district === district) &&
      (schoolType === '全部' || row.schoolType === schoolType) &&
      (minScore === null || (Number.isFinite(row.referenceScore) && row.referenceScore >= minScore)) &&
      (maxScore === null || (Number.isFinite(row.referenceScore) && row.referenceScore <= maxScore)))

    const sort = SORTS[this.data.sortIndex].value
    if (sort !== 'default') {
      rows = rows.slice().sort((left, right) => {
        if (!Number.isFinite(left.referenceScore)) return 1
        if (!Number.isFinite(right.referenceScore)) return -1
        return sort === 'desc' ? right.referenceScore - left.referenceScore : left.referenceScore - right.referenceScore
      })
    } else if (this.displaySettings && this.displaySettings.schoolDefaultSort === 'name') {
      rows = rows.slice().sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
    } else {
      rows = rows.slice().sort((left, right) => left.sortOrder - right.sortOrder || left.sourceIndex - right.sourceIndex)
    }
    this.setData({ schoolRows: rows })
  },

  onImageError(event) {
    const schoolId = event.currentTarget.dataset.id
    this.setData({ schoolRows: this.data.schoolRows.map((row) => row.id === schoolId ? { ...row, thumbnailUrl: '' } : row) })
  },

  onKeywordInput(event) { this.setData({ keyword: event.detail.value }); this.refresh() },
  onDistrictChange(event) { this.setData({ districtIndex: Number(event.detail.value) }); this.refresh() },
  toggleMoreFilters() { this.setData({ showMoreFilters: !this.data.showMoreFilters }) },
  onSchoolTypeChange(event) { this.setData({ schoolTypeIndex: Number(event.detail.value) }); this.refresh() },
  onYearChange(event) { this.setData({ yearIndex: Number(event.detail.value) }); this.refresh() },
  onSortChange(event) { this.setData({ sortIndex: Number(event.detail.value) }); this.refresh() },
  onMinScoreInput(event) { this.setData({ minScore: event.detail.value }) },
  onMaxScoreInput(event) { this.setData({ maxScore: event.detail.value }) },

  applyScoreRange() {
    const min = this.data.minScore === '' ? null : Number(this.data.minScore)
    const max = this.data.maxScore === '' ? null : Number(this.data.maxScore)
    if ((min !== null && (!Number.isInteger(min) || min < 0 || min > 740)) ||
        (max !== null && (!Number.isInteger(max) || max < 0 || max > 740)) ||
        (min !== null && max !== null && min > max)) {
      wx.showToast({ title: '请输入 0 至 740 的有效分数范围', icon: 'none' })
      return
    }
    this.refresh()
  },

  resetFilters() {
    this.setData({ districtIndex: 0, schoolTypeIndex: 0, yearIndex: 0, sortIndex: 0, minScore: '', maxScore: '' })
    this.refresh()
  },

  openSchool(event) {
    wx.navigateTo({ url: `/pages/school-detail/school-detail?id=${encodeURIComponent(event.currentTarget.dataset.id)}` })
  }
})
