const { schools } = require('../../data/schools')
const { admissionScores } = require('../../data/admission-scores')
const { getTargetRecords } = require('../../utils/storage')
const { selectLatestReference, referenceScoreValue } = require('../../utils/planning')

const DISTRICTS = ['全部', ...new Set(schools.map((item) => item.district).filter(Boolean))]
const SCHOOL_TYPES = ['全部', ...new Set(schools.map((item) => item.schoolType).filter(Boolean))]
const YEARS = ['最新', ...new Set(admissionScores.map((item) => item.year).filter(Number.isInteger).sort((a, b) => b - a))]
const SORTS = [
  { value: 'default', label: '默认' },
  { value: 'desc', label: '参考分高到低' },
  { value: 'asc', label: '参考分低到高' }
]

function keywordMatches(school, keyword) {
  if (!keyword) return true
  const values = [school.name, ...(Array.isArray(school.aliases) ? school.aliases : [])]
  return values.some((value) => String(value || '').toLowerCase().includes(keyword))
}

function referenceFor(schoolId, year) {
  const options = { schoolId }
  if (Number.isInteger(year)) options.exactYear = year
  return selectLatestReference(admissionScores, options)
}

Page({
  data: {
    keyword: '',
    districts: DISTRICTS,
    districtIndex: 0,
    schoolTypes: SCHOOL_TYPES,
    schoolTypeIndex: 0,
    years: YEARS,
    yearIndex: 0,
    sorts: SORTS,
    sortIndex: 0,
    minScore: '',
    maxScore: '',
    showMoreFilters: false,
    schoolRows: []
  },

  onShow() {
    this.refresh()
  },

  refresh() {
    const keyword = String(this.data.keyword || '').trim().toLowerCase()
    const district = DISTRICTS[this.data.districtIndex]
    const schoolType = SCHOOL_TYPES[this.data.schoolTypeIndex]
    const selectedYear = YEARS[this.data.yearIndex]
    const minScore = this.data.minScore === '' ? null : Number(this.data.minScore)
    const maxScore = this.data.maxScore === '' ? null : Number(this.data.maxScore)
    const targetIds = new Set(getTargetRecords().map((item) => item.schoolId))
    let rows = schools.map((school, sourceIndex) => {
      const reference = referenceFor(school.id, selectedYear)
      return {
        id: school.id,
        name: school.name,
        district: school.district || '未注明',
        schoolType: school.schoolType || '未注明',
        referenceScore: reference ? referenceScoreValue(reference) : null,
        referenceYear: reference ? reference.year : null,
        referenceText: reference ? `${referenceScoreValue(reference)} 分` : '暂无已核实分数',
        yearText: reference ? `${reference.year} 年` : '',
        isTarget: targetIds.has(school.id),
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
        return sort === 'desc'
          ? right.referenceScore - left.referenceScore
          : left.referenceScore - right.referenceScore
      })
    }
    this.setData({ schoolRows: rows })
  },

  onKeywordInput(event) {
    this.setData({ keyword: event.detail.value })
    this.refresh()
  },

  onDistrictChange(event) {
    this.setData({ districtIndex: Number(event.detail.value) })
    this.refresh()
  },

  toggleMoreFilters() {
    this.setData({ showMoreFilters: !this.data.showMoreFilters })
  },

  onSchoolTypeChange(event) {
    this.setData({ schoolTypeIndex: Number(event.detail.value) })
    this.refresh()
  },

  onYearChange(event) {
    this.setData({ yearIndex: Number(event.detail.value) })
    this.refresh()
  },

  onSortChange(event) {
    this.setData({ sortIndex: Number(event.detail.value) })
    this.refresh()
  },

  onMinScoreInput(event) {
    this.setData({ minScore: event.detail.value })
  },

  onMaxScoreInput(event) {
    this.setData({ maxScore: event.detail.value })
  },

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
    this.setData({
      districtIndex: 0,
      schoolTypeIndex: 0,
      yearIndex: 0,
      sortIndex: 0,
      minScore: '',
      maxScore: ''
    })
    this.refresh()
  },

  openSchool(event) {
    wx.navigateTo({ url: `/pages/school-detail/school-detail?id=${encodeURIComponent(event.currentTarget.dataset.id)}` })
  }
})
