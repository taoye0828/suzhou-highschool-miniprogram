const { schools } = require('../../data/schools')
const {
  getFavoriteIdsResult,
  getTargetRecordsResult,
  getTargetDraftResult,
  getScoreRecordsResult,
  getExamYearResult
} = require('../../utils/storage')
const { notifyStorageReadResult } = require('../../utils/storage-feedback')
const { scoreSummaryForSchool, referenceForSchool } = require('../../utils/score-analysis')
const { APP_CONFIG } = require('../../config/app-config')
const { searchSchools, normalizeSearchText } = require('../../utils/school-search')

function currentScoreFrom(scoreRecords, draft) {
  const latest = Array.isArray(scoreRecords) && scoreRecords.length
    ? scoreRecords[scoreRecords.length - 1].score
    : Number(String(draft && draft.currentScore || '').trim())
  return Number.isInteger(latest) && latest >= 0 && latest <= APP_CONFIG.targetScore.max
    ? latest
    : null
}

function presentSchool(school, favoriteIds, targetRecord, currentScore, targetYear) {
  const reference = referenceForSchool(school.id, targetYear)
  const gap = reference && currentScore !== null ? reference.minScore - currentScore : null
  const targetLevel = APP_CONFIG.targetScore.levels.find(
    (item) => targetRecord && item.value === targetRecord.level
  )
  return {
    ...school,
    tagsText: Array.isArray(school.tags) && school.tags.length ? school.tags.join('、') : '暂未补充',
    addressText: school.address || '暂未补充',
    ownershipText: school.ownership || '暂未补充',
    scoreSummary: scoreSummaryForSchool(school.id),
    favoriteText: favoriteIds.includes(school.id) ? '已收藏' : '未收藏',
    targetLevelText: targetLevel ? targetLevel.label : '未设置',
    referenceScoreText: reference ? `${reference.minScore} 分` : '暂未收录',
    referenceYearText: reference ? `${reference.year} 年` : '—',
    currentScoreText: currentScore === null ? '尚未记录' : `${currentScore} 分`,
    gapText: gap === null
      ? '待记录成绩后计算'
      : gap > 0
        ? `还有 ${gap} 分`
        : gap === 0
          ? '与历史参考分持平'
          : `高于历史参考分 ${Math.abs(gap)} 分`
  }
}

Page({
  data: {
    selectedIds: [],
    selectedSchools: [],
    availableSchools: schools,
    schoolKeyword: '',
    schoolSearchActive: false,
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
    const targetResult = getTargetRecordsResult()
    const scoreResult = getScoreRecordsResult()
    const draftResult = getTargetDraftResult()
    const yearResult = getExamYearResult()
    const failedResult = [favoriteResult, targetResult, scoreResult, draftResult, yearResult]
      .find((result) => !result.ok)
    notifyStorageReadResult(this, failedResult || favoriteResult)
    const targetBySchoolId = new Map(
      targetResult.records.map((record) => [record.schoolId, record])
    )
    const currentScore = currentScoreFrom(scoreResult.records, draftResult.draft)
    const selectedIds = this.data.selectedIds.filter((id) => schools.some((school) => school.id === id))
    const selectedSchools = selectedIds
      .map((id) => schools.find((school) => school.id === id))
      .filter(Boolean)
      .map((school) => presentSchool(
        school,
        favoriteResult.ids,
        targetBySchoolId.get(school.id),
        currentScore,
        yearResult.year
      ))
    const schoolSearchActive = Boolean(normalizeSearchText(this.data.schoolKeyword))
    const availableSchools = searchSchools({
      schools: schools.filter((school) => !selectedIds.includes(school.id)),
      keyword: this.data.schoolKeyword
    })
    this.setData({
      selectedIds,
      selectedSchools,
      availableSchools,
      schoolSearchActive,
      pickerIndex: 0,
      canAdd: selectedSchools.length < 3 && availableSchools.length > 0,
      canCompare: selectedSchools.length >= 1
    })
  },

  onSchoolKeywordInput(event) {
    this.setData({ schoolKeyword: event.detail.value }, () => this.refresh())
  },

  onSchoolChange(event) {
    if (this.data.selectedIds.length >= 3) {
      wx.showToast({ title: '最多对比 3 所学校', icon: 'none' })
      return
    }
    const school = this.data.availableSchools[Number(event.detail.value)]
    if (!school || this.data.selectedIds.includes(school.id)) return
    this.setData({
      selectedIds: [...this.data.selectedIds, school.id],
      schoolKeyword: ''
    }, () => this.refresh())
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
