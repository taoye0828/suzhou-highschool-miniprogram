const {
  schools,
  filterSchoolCatalog
} = require('../../utils/school')
const {
  getFavoriteIdsResult,
  getTargetRecordsResult,
  getTargetDraftResult,
  getScoreRecordsResult,
  getExamYearResult,
  getScenarioSettings,
  ensureStorageMigrated,
  getComparisonSchoolIds,
  saveComparisonSchoolIds,
  setFavorite,
  saveTargetRecord,
  addRecentViewedSchool
} = require('../../utils/storage')
const { notifyStorageReadResult } = require('../../utils/storage-feedback')
const { scoreSummaryForSchool } = require('../../utils/score-analysis')
const { APP_CONFIG } = require('../../config/app-config')
const { searchSchools, normalizeSearchText } = require('../../utils/school-search')
const { selectCurrentScore, formatDifference } = require('../../utils/planning')
const { operationOptions } = require('../../utils/operation-context')

const MAX_COMPARE_SCHOOLS = 3
const LEVEL_OPTIONS = APP_CONFIG.targetScore.levels.map((item) => ({ ...item }))
const LEVEL_LABELS = Object.fromEntries(LEVEL_OPTIONS.map((item) => [item.value, item.label]))

function targetLevelIndex(level) {
  const index = LEVEL_OPTIONS.findIndex((item) => item.value === level)
  return index < 0 ? LEVEL_OPTIONS.findIndex((item) => item.value === 'target') : index
}

function presentSchool(school, scenarios = {}) {
  const historyText = scoreSummaryForSchool(school.id)
  const referenceScore = Number.isInteger(school.referenceScore)
    ? school.referenceScore
    : null
  const referenceYear = Number.isInteger(school.referenceYear)
    ? school.referenceYear
    : null
  const targetLevelText = school.targetLevel ? LEVEL_LABELS[school.targetLevel] || '目标' : ''
  return {
    ...school,
    hasDistrict: Boolean(school.district),
    hasSchoolType: Boolean(school.schoolType),
    hasOwnership: Boolean(school.ownership),
    hasCampus: Boolean(school.campus),
    hasReference: referenceScore !== null,
    referenceScoreText: referenceScore === null ? '' : `${referenceScore} 分`,
    referenceYearText: referenceYear === null ? '' : `${referenceYear} 年`,
    hasDifference: Number.isFinite(school.difference),
    differenceText: formatDifference(school.difference),
    stageDifferenceText: Number.isInteger(scenarios.stageTargetScore) && referenceScore !== null
      ? formatDifference(scenarios.stageTargetScore - referenceScore)
      : '',
    finalDifferenceText: Number.isInteger(scenarios.finalTargetScore) && referenceScore !== null
      ? formatDifference(scenarios.finalTargetScore - referenceScore)
      : '',
    hasScoreHistory: historyText !== '暂未收录',
    scoreSummary: historyText,
    targetLevelText,
    targetStatusText: school.isTargetSchool ? `${targetLevelText}目标` : '未加入目标',
    targetLevelIndex: targetLevelIndex(school.targetLevel)
    ,
    officialSource: school.sourceUrl || '',
    userNotes: school.targetRecord && school.targetRecord.notes || ''
  }
}

Page({
  data: {
    selectedIds: [],
    selectedSchools: [],
    availableSchools: schools,
    targetLevelOptions: LEVEL_OPTIONS,
    schoolKeyword: '',
    schoolSearchActive: false,
    pickerIndex: 0,
    canAdd: true,
    canCompare: false,
    currentScoreText: '尚未记录成绩'
  },

  onLoad() {
    this.ensureStorageReady()
    this.loadSelection()
  },

  onShow() {
    this.ensureStorageReady()
    this.loadSelection()
  },

  ensureStorageReady() {
    const result = ensureStorageMigrated()
    if (!result.ok) {
      wx.showToast({ title: result.message || '本地数据初始化失败，请重试。', icon: 'none' })
    }
  },

  loadSelection() {
    const validIds = new Set(schools.map((school) => school.id))
    const selectedIds = getComparisonSchoolIds()
      .filter((id) => validIds.has(id))
      .slice(0, MAX_COMPARE_SCHOOLS)
    this.setData({ selectedIds }, () => this.refresh())
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
    const current = selectCurrentScore(scoreResult.records, draftResult.draft, {
      requireRecommendationEligible: true
    })
    const selectedIds = this.data.selectedIds.filter((id) => schools.some((school) => school.id === id))
    const catalogById = new Map(filterSchoolCatalog({
      favoriteIds: favoriteResult.ids,
      targetRecords: targetResult.records,
      currentScore: current.score,
      targetYear: yearResult.year,
      referenceYears: ['all'],
      sortBy: 'default'
    }).map((school) => [school.id, school]))
    const selectedSchools = selectedIds
      .map((id) => catalogById.get(id))
      .filter(Boolean)
      .map((school) => presentSchool(school, getScenarioSettings()))
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
      canCompare: selectedSchools.length >= 2,
      currentScoreText: current.score === null ? '尚未记录成绩' : `当前成绩 ${current.score} 分`
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
    this.saveSelection([...this.data.selectedIds, school.id], { clearKeyword: true })
  },

  removeSchool(event) {
    const id = event.currentTarget.dataset.id
    this.saveSelection(this.data.selectedIds.filter((item) => item !== id))
  },

  moveSchool(event) {
    const id = event.currentTarget.dataset.id
    const direction = Number(event.currentTarget.dataset.direction)
    const index = this.data.selectedIds.indexOf(id)
    const nextIndex = index + direction
    if (index < 0 || nextIndex < 0 || nextIndex >= this.data.selectedIds.length) return
    const ids = this.data.selectedIds.slice()
    const temporary = ids[index]
    ids[index] = ids[nextIndex]
    ids[nextIndex] = temporary
    this.saveSelection(ids)
  },

  clearSelection() {
    this.saveSelection([])
  },

  saveSelection(ids, { clearKeyword = false } = {}) {
    const result = saveComparisonSchoolIds(
      ids.slice(0, MAX_COMPARE_SCHOOLS),
      operationOptions('save_school_comparison', 'comparisonSchoolIds')
    )
    if (!result.ok) {
      wx.showToast({ title: result.message || '对比选择保存失败。', icon: 'none' })
      return
    }
    this.setData({
      selectedIds: ids.slice(0, MAX_COMPARE_SCHOOLS),
      ...(clearKeyword ? { schoolKeyword: '' } : {})
    }, () => this.refresh())
  },

  toggleFavorite(event) {
    const id = event.currentTarget.dataset.id
    const school = this.data.selectedSchools.find((item) => item.id === id)
    if (!school) return
    const result = setFavorite(
      id,
      !school.isFavorite,
      operationOptions('set_favorite', id)
    )
    if (!result.ok) {
      wx.showToast({ title: result.message || '收藏状态保存失败。', icon: 'none' })
      return
    }
    wx.showToast({ title: school.isFavorite ? '已取消收藏' : '已收藏', icon: 'success' })
    this.refresh()
  },

  addTarget(event) {
    this.saveTargetLevel(event.currentTarget.dataset.id, 'target')
  },

  onTargetLevelChange(event) {
    const option = LEVEL_OPTIONS[Number(event.detail.value)]
    if (!option) return
    this.saveTargetLevel(event.currentTarget.dataset.id, option.value)
  },

  saveTargetLevel(id, level) {
    const school = this.data.selectedSchools.find((item) => item.id === id)
    if (!school) return
    const now = new Date().toISOString()
    const result = saveTargetRecord({
      id: school.targetRecord && school.targetRecord.id || `target_${school.id}`,
      schoolId: school.id,
      schoolName: school.name,
      level,
      referenceScore: school.referenceScore,
      referenceYear: school.referenceYear,
      createdAt: school.targetRecord && school.targetRecord.createdAt || now,
      updatedAt: now
    }, operationOptions('save_target', school.id))
    if (!result.ok) {
      wx.showToast({ title: result.message || '目标学校保存失败。', icon: 'none' })
      return
    }
    wx.showToast({
      title: school.isTargetSchool ? '目标等级已更新' : '已加入目标学校',
      icon: 'success'
    })
    this.refresh()
  },

  openDetail(event) {
    const id = event.currentTarget.dataset.id
    const recentResult = addRecentViewedSchool(
      id,
      operationOptions('record_recent_school', id)
    )
    if (recentResult && !recentResult.ok) {
      wx.showToast({ title: recentResult.message || '最近浏览保存失败。', icon: 'none' })
    }
    wx.navigateTo({
      url: `/pages/school-detail/school-detail?id=${id}`
    })
  },

  openSchoolLibrary() {
    wx.switchTab({ url: '/pages/schools/schools' })
  },

  noop() {
    // Used to keep card-level navigation from handling nested controls.
  }
})
