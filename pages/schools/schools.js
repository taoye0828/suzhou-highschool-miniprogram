const {
  buildSchoolFilterOptions,
  filterSchoolCatalog,
  getSchoolById
} = require('../../utils/school')
const {
  getFavoriteIdsResult,
  getTargetRecordsResult,
  getTargetDraftResult,
  getScoreRecordsResult,
  getExamYearResult,
  ensureStorageMigrated,
  getSchoolFilters,
  saveSchoolFilters,
  getComparisonSchoolIds,
  saveComparisonSchoolIds,
  setFavorite,
  saveTargetRecord,
  addRecentViewedSchool,
  getSchoolUserStates,
  getPrimaryTargetSchoolId,
  getRecentViewedSchoolIds,
  getRecentHistory
} = require('../../utils/storage')
const { notifyStorageReadResult } = require('../../utils/storage-feedback')
const { APP_CONFIG } = require('../../config/app-config')
const { onboardingForPage, handleOnboardingAction } = require('../../utils/onboarding')
const { selectCurrentScore, formatDifference } = require('../../utils/planning')
const { operationOptions } = require('../../utils/operation-context')
const {
  CANDIDATE_STATUS_LABELS,
  enrichSchoolUserData,
  filterByUserPlanning
} = require('../../utils/school-planning')

const MAX_COMPARE_SCHOOLS = 3
const FILTER_OPTIONS = buildSchoolFilterOptions()
const LEVEL_OPTIONS = APP_CONFIG.targetScore.levels.map((item) => ({ ...item }))
const LEVEL_LABELS = Object.fromEntries(LEVEL_OPTIONS.map((item) => [item.value, item.label]))
const SORT_OPTIONS = [
  { value: 'name', catalogValue: 'name', label: '学校名称' },
  { value: 'reference_desc', catalogValue: 'referenceScoreDesc', label: '参考分从高到低' },
  { value: 'reference_asc', catalogValue: 'referenceScoreAsc', label: '参考分从低到高' },
  { value: 'difference', catalogValue: 'closest', label: '与当前成绩最接近' }
]
const CANDIDATE_STATUS_OPTIONS = Object.entries(CANDIDATE_STATUS_LABELS).map(([value, label]) => ({ value, label }))

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map((value) => String(value || '').trim())
    .filter(Boolean))]
}

function checkedOptions(options, selectedValues) {
  const selected = new Set(uniqueStrings(selectedValues))
  return options.map((item) => {
    const option = typeof item === 'string' ? { value: item, label: item } : item
    return { ...option, checked: selected.has(String(option.value)) }
  })
}

function scoreInput(value) {
  return Number.isInteger(value) ? String(value) : ''
}

function parseScoreInput(value) {
  const text = String(value === undefined || value === null ? '' : value).trim()
  if (!text) return { valid: true, value: null }
  if (!/^\d+$/.test(text)) return { valid: false, value: null }
  const score = Number(text)
  return {
    valid: Number.isInteger(score) && score >= 0 && score <= APP_CONFIG.targetScore.max,
    value: score
  }
}

function normalizedStoredFilters(value) {
  const source = value && typeof value === 'object' ? value : {}
  const referenceYears = (Array.isArray(source.referenceYears) ? source.referenceYears : [])
    .map(Number)
    .filter((year) => Number.isInteger(year))
  const referenceMode = source.referenceMode === 'latest'
    ? 'latest'
    : referenceYears.length
      ? 'years'
      : 'all'
  const sortIndex = Math.max(0, SORT_OPTIONS.findIndex((item) => item.value === source.sortBy))
  return {
    keyword: typeof source.keyword === 'string' ? source.keyword : '',
    selectedDistricts: uniqueStrings(source.districts),
    selectedSchoolTypes: uniqueStrings(source.schoolTypes),
    referenceMode,
    selectedReferenceYears: referenceYears,
    selectedMatchLevels: uniqueStrings(source.matchLevels),
    selectedTargetLevels: uniqueStrings(source.targetLevels),
    minScoreInput: scoreInput(source.minReferenceScore),
    maxScoreInput: scoreInput(source.maxReferenceScore),
    favoritesOnly: Boolean(source.favoritesOnly),
    targetsOnly: Boolean(source.targetsOnly),
    selectedCandidateStatuses: uniqueStrings(source.candidateStatuses),
    selectedUserTags: uniqueStrings(source.userTags),
    hasNoteOnly: Boolean(source.hasNoteOnly),
    recentViewedOnly: Boolean(source.recentViewedOnly),
    recentComparedOnly: Boolean(source.recentComparedOnly),
    primaryOnly: Boolean(source.primaryOnly),
    sortIndex
  }
}

function filtersForStorage(data, bounds) {
  return {
    keyword: String(data.keyword || '').trim(),
    districts: uniqueStrings(data.selectedDistricts),
    schoolTypes: uniqueStrings(data.selectedSchoolTypes),
    referenceMode: data.referenceMode,
    referenceYears: data.referenceMode === 'years'
      ? data.selectedReferenceYears.map(Number).filter(Number.isInteger)
      : [],
    matchLevels: uniqueStrings(data.selectedMatchLevels),
    targetLevels: uniqueStrings(data.selectedTargetLevels),
    minReferenceScore: bounds.min,
    maxReferenceScore: bounds.max,
    favoritesOnly: Boolean(data.favoritesOnly),
    targetsOnly: Boolean(data.targetsOnly),
    candidateStatuses: uniqueStrings(data.selectedCandidateStatuses),
    userTags: uniqueStrings(data.selectedUserTags),
    hasNoteOnly: Boolean(data.hasNoteOnly),
    recentViewedOnly: Boolean(data.recentViewedOnly),
    recentComparedOnly: Boolean(data.recentComparedOnly),
    primaryOnly: Boolean(data.primaryOnly),
    sortBy: SORT_OPTIONS[data.sortIndex] ? SORT_OPTIONS[data.sortIndex].value : 'name'
  }
}

function referenceFilterValue(data) {
  if (data.referenceMode === 'latest') return ['latest']
  if (data.referenceMode === 'years') return data.selectedReferenceYears
  return ['all']
}

function targetLevelIndex(level) {
  const index = LEVEL_OPTIONS.findIndex((item) => item.value === level)
  return index < 0 ? LEVEL_OPTIONS.findIndex((item) => item.value === 'target') : index
}

function presentSchool(school, comparisonIds) {
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
    referenceText: referenceScore === null ? '' : `${referenceScore} 分`,
    referenceYearText: referenceYear === null ? '' : `${referenceYear} 年`,
    hasDifference: Number.isFinite(school.difference),
    differenceText: formatDifference(school.difference),
    matchLevelText: school.matchLevel ? LEVEL_LABELS[school.matchLevel] || '' : '',
    targetLevelText,
    targetStatusText: school.isTargetSchool ? `${targetLevelText}目标` : '未加入目标',
    targetLevelIndex: targetLevelIndex(school.targetLevel),
    isCompared: comparisonIds.includes(school.id)
  }
}

function buildActiveFilters(data) {
  const active = []
  const addArray = (kind, values, prefix = '') => {
    uniqueStrings(values).forEach((value) => active.push({
      kind,
      value,
      label: `${prefix}${value}`
    }))
  }
  if (String(data.keyword || '').trim()) {
    active.push({ kind: 'keyword', value: '', label: `搜索：${String(data.keyword).trim()}` })
  }
  addArray('district', data.selectedDistricts)
  addArray('schoolType', data.selectedSchoolTypes)
  if (data.referenceMode === 'latest') {
    active.push({ kind: 'referenceMode', value: 'latest', label: '有最新参考分' })
  } else if (data.referenceMode === 'years') {
    data.selectedReferenceYears.forEach((year) => active.push({
      kind: 'referenceYear',
      value: String(year),
      label: `${year} 年参考分`
    }))
  }
  addArray(
    'matchLevel',
    data.selectedMatchLevels,
    '成绩匹配：'
  )
  active.forEach((item) => {
    if (item.kind === 'matchLevel') item.label = `成绩匹配：${LEVEL_LABELS[item.value] || item.value}`
  })
  if (String(data.minScoreInput || '').trim()) {
    active.push({ kind: 'minScore', value: '', label: `参考分 ≥ ${data.minScoreInput}` })
  }
  if (String(data.maxScoreInput || '').trim()) {
    active.push({ kind: 'maxScore', value: '', label: `参考分 ≤ ${data.maxScoreInput}` })
  }
  if (data.favoritesOnly) active.push({ kind: 'favoritesOnly', value: '', label: '只看收藏' })
  if (data.targetsOnly) active.push({ kind: 'targetsOnly', value: '', label: '只看目标学校' })
  uniqueStrings(data.selectedCandidateStatuses).forEach((value) => active.push({ kind: 'candidateStatus', value, label: `候选：${CANDIDATE_STATUS_LABELS[value] || value}` }))
  addArray('userTag', data.selectedUserTags, '标签：')
  if (data.hasNoteOnly) active.push({ kind: 'hasNoteOnly', value: '', label: '有个人备注' })
  if (data.recentViewedOnly) active.push({ kind: 'recentViewedOnly', value: '', label: '最近浏览' })
  if (data.recentComparedOnly) active.push({ kind: 'recentComparedOnly', value: '', label: '最近对比' })
  if (data.primaryOnly) active.push({ kind: 'primaryOnly', value: '', label: '主要目标' })
  uniqueStrings(data.selectedTargetLevels).forEach((value) => active.push({
    kind: 'targetLevel',
    value,
    label: `目标等级：${LEVEL_LABELS[value] || value}`
  }))
  if (SORT_OPTIONS[data.sortIndex] && SORT_OPTIONS[data.sortIndex].value !== 'name') {
    active.push({ kind: 'sort', value: '', label: SORT_OPTIONS[data.sortIndex].label })
  }
  return active.map((item, index) => ({
    ...item,
    id: `${item.kind}:${item.value}:${index}`
  }))
}

function buildFilterSummary(data, resultCount, currentScore) {
  const parts = []
  const keyword = String(data.keyword || '').trim()
  if (keyword) parts.push(`搜索“${keyword}”`)
  if (data.selectedDistricts.length) parts.push(data.selectedDistricts.join('或'))
  if (data.selectedSchoolTypes.length) parts.push(data.selectedSchoolTypes.join('或'))
  if (data.referenceMode === 'latest') parts.push('有最新参考分')
  if (data.referenceMode === 'years') {
    parts.push(`${data.selectedReferenceYears.join('或')}参考分`)
  }
  const minScore = String(data.minScoreInput || '').trim()
  const maxScore = String(data.maxScoreInput || '').trim()
  if (minScore || maxScore) {
    parts.push(minScore && maxScore
      ? `参考分 ${minScore}–${maxScore}`
      : minScore
        ? `参考分不低于 ${minScore}`
        : `参考分不高于 ${maxScore}`)
  }
  if (data.selectedMatchLevels.length) {
    const matchText = data.selectedMatchLevels.map((value) => LEVEL_LABELS[value] || value).join('或')
    parts.push(currentScore === null ? `${matchText}（待记录成绩）` : `当前 ${currentScore} 分 · ${matchText}`)
  }
  if (data.favoritesOnly) parts.push('只看收藏')
  if (data.targetsOnly) parts.push('只看目标学校')
  if (data.selectedCandidateStatuses.length) parts.push(data.selectedCandidateStatuses.map((value) => CANDIDATE_STATUS_LABELS[value] || value).join('或'))
  if (data.selectedUserTags.length) parts.push(`标签 ${data.selectedUserTags.join('或')}`)
  if (data.hasNoteOnly) parts.push('有个人备注')
  if (data.recentViewedOnly) parts.push('最近浏览')
  if (data.recentComparedOnly) parts.push('最近对比')
  if (data.primaryOnly) parts.push('主要目标')
  if (data.selectedTargetLevels.length) {
    parts.push(`${data.selectedTargetLevels.map((value) => LEVEL_LABELS[value] || value).join('或')}目标`)
  }
  return `${parts.length ? parts.join(' · ') : '全部学校'} · 共 ${resultCount} 所`
}

Page({
  data: {
    keyword: '',
    districtOptions: checkedOptions(FILTER_OPTIONS.districts, []),
    schoolTypeOptions: checkedOptions(FILTER_OPTIONS.schoolTypes, []),
    referenceYearOptions: checkedOptions(FILTER_OPTIONS.referenceYears, ['all']),
    matchLevelOptions: checkedOptions(FILTER_OPTIONS.matchLevels, []),
    targetLevelOptions: checkedOptions(FILTER_OPTIONS.targetLevels, []),
    selectedDistricts: [],
    selectedSchoolTypes: [],
    referenceMode: 'all',
    selectedReferenceYears: [],
    selectedMatchLevels: [],
    selectedTargetLevels: [],
    minScoreInput: '',
    maxScoreInput: '',
    favoritesOnly: false,
    targetsOnly: false,
    candidateStatusOptions: checkedOptions(CANDIDATE_STATUS_OPTIONS, []),
    userTagOptions: [],
    selectedCandidateStatuses: [],
    selectedUserTags: [],
    hasNoteOnly: false,
    recentViewedOnly: false,
    recentComparedOnly: false,
    primaryOnly: false,
    sortOptions: SORT_OPTIONS,
    sortIndex: 0,
    moreFiltersVisible: false,
    filterError: '',
    filterSummary: '全部学校',
    activeFilters: [],
    hasActiveFilters: false,
    currentScore: null,
    currentScoreText: '尚未记录成绩',
    results: [],
    comparisonIds: [],
    comparisonCount: 0,
    comparisonNames: '',
    hasComparisonSelection: false,
    onboarding: { visible: false, step: null }
  },

  onLoad() {
    this.ensureStorageReady()
    this.loadStoredFilters()
  },

  onShow() {
    this.ensureStorageReady()
    this.loadStoredFilters()
  },

  ensureStorageReady() {
    const result = ensureStorageMigrated()
    if (!result.ok) {
      wx.showToast({ title: result.message || '本地数据初始化失败，请重试。', icon: 'none' })
    }
  },

  onKeywordInput(event) {
    this.setData({ keyword: event.detail.value }, () => this.refresh())
  },

  onKeywordCommit() {
    this.persistFilters()
  },

  onDistrictsChange(event) {
    this.setData({ selectedDistricts: event.detail.value }, () => this.persistFilters())
  },

  onSchoolTypesChange(event) {
    this.setData({ selectedSchoolTypes: event.detail.value }, () => this.persistFilters())
  },

  onMatchLevelsChange(event) {
    this.setData({ selectedMatchLevels: event.detail.value }, () => this.persistFilters())
  },

  onTargetLevelsChange(event) {
    this.setData({ selectedTargetLevels: event.detail.value }, () => this.persistFilters())
  },

  onReferenceYearTap(event) {
    const value = String(event.currentTarget.dataset.value)
    if (value === 'all') {
      this.setData({ referenceMode: 'all', selectedReferenceYears: [] }, () => this.persistFilters())
      return
    }
    if (value === 'latest') {
      this.setData({ referenceMode: 'latest', selectedReferenceYears: [] }, () => this.persistFilters())
      return
    }
    const year = Number(value)
    if (!Number.isInteger(year)) return
    const selected = new Set(this.data.referenceMode === 'years'
      ? this.data.selectedReferenceYears.map(Number)
      : [])
    if (selected.has(year)) selected.delete(year)
    else selected.add(year)
    const years = [...selected].sort((left, right) => right - left)
    this.setData({
      referenceMode: years.length ? 'years' : 'all',
      selectedReferenceYears: years
    }, () => this.persistFilters())
  },

  onMinScoreInput(event) {
    this.setData({ minScoreInput: event.detail.value }, () => this.refresh())
  },

  onMaxScoreInput(event) {
    this.setData({ maxScoreInput: event.detail.value }, () => this.refresh())
  },

  onScoreRangeCommit() {
    this.persistFilters()
  },

  onFavoritesOnlyChange(event) {
    this.setData({ favoritesOnly: Boolean(event.detail.value) }, () => this.persistFilters())
  },

  onTargetsOnlyChange(event) {
    this.setData({ targetsOnly: Boolean(event.detail.value) }, () => this.persistFilters())
  },

  onCandidateStatusesChange(event) {
    this.setData({ selectedCandidateStatuses: event.detail.value }, () => this.persistFilters())
  },

  onUserTagsChange(event) {
    this.setData({ selectedUserTags: event.detail.value }, () => this.persistFilters())
  },

  onUserPlanningSwitch(event) {
    const field = event.currentTarget.dataset.field
    if (!['hasNoteOnly', 'recentViewedOnly', 'recentComparedOnly', 'primaryOnly'].includes(field)) return
    this.setData({ [field]: Boolean(event.detail.value) }, () => this.persistFilters())
  },

  onSortChange(event) {
    this.setData({ sortIndex: Number(event.detail.value) }, () => this.persistFilters())
  },

  toggleMoreFilters() {
    this.setData({ moreFiltersVisible: !this.data.moreFiltersVisible })
  },

  clearOneFilter(event) {
    const { kind, value } = event.currentTarget.dataset
    const removeValue = (values) => values.filter((item) => String(item) !== String(value))
    const changes = {}
    if (kind === 'keyword') changes.keyword = ''
    if (kind === 'district') changes.selectedDistricts = removeValue(this.data.selectedDistricts)
    if (kind === 'schoolType') changes.selectedSchoolTypes = removeValue(this.data.selectedSchoolTypes)
    if (kind === 'referenceMode') {
      changes.referenceMode = 'all'
      changes.selectedReferenceYears = []
    }
    if (kind === 'referenceYear') {
      const years = this.data.selectedReferenceYears.filter((year) => String(year) !== String(value))
      changes.referenceMode = years.length ? 'years' : 'all'
      changes.selectedReferenceYears = years
    }
    if (kind === 'matchLevel') changes.selectedMatchLevels = removeValue(this.data.selectedMatchLevels)
    if (kind === 'minScore') changes.minScoreInput = ''
    if (kind === 'maxScore') changes.maxScoreInput = ''
    if (kind === 'favoritesOnly') changes.favoritesOnly = false
    if (kind === 'targetsOnly') changes.targetsOnly = false
    if (kind === 'candidateStatus') changes.selectedCandidateStatuses = removeValue(this.data.selectedCandidateStatuses)
    if (kind === 'userTag') changes.selectedUserTags = removeValue(this.data.selectedUserTags)
    if (kind === 'hasNoteOnly') changes.hasNoteOnly = false
    if (kind === 'recentViewedOnly') changes.recentViewedOnly = false
    if (kind === 'recentComparedOnly') changes.recentComparedOnly = false
    if (kind === 'primaryOnly') changes.primaryOnly = false
    if (kind === 'targetLevel') changes.selectedTargetLevels = removeValue(this.data.selectedTargetLevels)
    if (kind === 'sort') changes.sortIndex = 0
    this.setData(changes, () => this.persistFilters())
  },

  resetFilters() {
    this.setData(normalizedStoredFilters({}), () => this.persistFilters())
  },

  loadStoredFilters() {
    this.setData(normalizedStoredFilters(getSchoolFilters()), () => {
      this.refresh()
      this.syncOnboarding()
    })
  },

  scoreBounds() {
    const minResult = parseScoreInput(this.data.minScoreInput)
    const maxResult = parseScoreInput(this.data.maxScoreInput)
    if (!minResult.valid || !maxResult.valid) {
      return { valid: false, min: null, max: null, message: '参考分需填写 0 至 740 的整数。' }
    }
    if (minResult.value !== null && maxResult.value !== null && minResult.value > maxResult.value) {
      return { valid: false, min: null, max: null, message: '参考分下限不能高于上限。' }
    }
    return { valid: true, min: minResult.value, max: maxResult.value, message: '' }
  },

  persistFilters() {
    const bounds = this.scoreBounds()
    if (!bounds.valid) {
      this.setData({ filterError: bounds.message })
      this.refresh()
      return
    }
    const result = saveSchoolFilters(
      filtersForStorage(this.data, bounds),
      operationOptions('save_school_filters', 'schoolFilters')
    )
    if (!result.ok) {
      wx.showToast({ title: result.message || '筛选保存失败，请重试。', icon: 'none' })
    }
    this.refresh()
  },

  refresh() {
    const favoriteResult = getFavoriteIdsResult()
    const targetResult = getTargetRecordsResult()
    const scoreResult = getScoreRecordsResult()
    const draftResult = getTargetDraftResult()
    const yearResult = getExamYearResult()
    const schoolUserStates = getSchoolUserStates()
    const primarySchoolId = getPrimaryTargetSchoolId()
    const failedResult = [favoriteResult, targetResult, scoreResult, draftResult, yearResult]
      .find((result) => !result.ok)
    notifyStorageReadResult(this, failedResult || favoriteResult)
    const current = selectCurrentScore(scoreResult.records, draftResult.draft, {
      requireRecommendationEligible: true
    })
    const bounds = this.scoreBounds()
    const sort = SORT_OPTIONS[this.data.sortIndex] || SORT_OPTIONS[0]
    const comparisonIds = getComparisonSchoolIds()
      .filter((id) => typeof id === 'string' && getSchoolById(id))
      .slice(0, MAX_COMPARE_SCHOOLS)
    const query = {
      keyword: this.data.keyword,
      districts: this.data.selectedDistricts,
      schoolTypes: this.data.selectedSchoolTypes,
      referenceYears: referenceFilterValue(this.data),
      matchLevels: this.data.selectedMatchLevels,
      targetLevels: this.data.selectedTargetLevels,
      minReferenceScore: bounds.valid ? bounds.min : null,
      maxReferenceScore: bounds.valid ? bounds.max : null,
      onlyFavorites: this.data.favoritesOnly,
      onlyTargets: this.data.targetsOnly,
      favoriteIds: favoriteResult.ids,
      targetRecords: targetResult.records,
      currentScore: current.score,
      targetYear: yearResult.year,
      sortBy: sort.catalogValue
    }
    const recentComparedIds = [...new Set(getRecentHistory().schoolComparisons.flatMap((item) => item.schoolIds || []))]
    const enriched = bounds.valid
      ? filterSchoolCatalog(query).map((school) => enrichSchoolUserData(school, schoolUserStates, targetResult.records, primarySchoolId))
      : []
    const results = bounds.valid
      ? filterByUserPlanning(enriched, {
          candidateStatuses: this.data.selectedCandidateStatuses,
          tags: this.data.selectedUserTags,
          hasNoteOnly: this.data.hasNoteOnly,
          recentViewedOnly: this.data.recentViewedOnly,
          recentComparedOnly: this.data.recentComparedOnly,
          primaryOnly: this.data.primaryOnly,
          recentViewedSchoolIds: getRecentViewedSchoolIds(),
          recentComparedSchoolIds: recentComparedIds
        }).map((school) => presentSchool(school, comparisonIds))
      : []
    const activeFilters = buildActiveFilters(this.data)
    const comparisonNames = comparisonIds
      .map((id) => getSchoolById(id))
      .filter(Boolean)
      .map((school) => school.name)
      .join('、')
    this.setData({
      districtOptions: checkedOptions(FILTER_OPTIONS.districts, this.data.selectedDistricts),
      schoolTypeOptions: checkedOptions(FILTER_OPTIONS.schoolTypes, this.data.selectedSchoolTypes),
      referenceYearOptions: FILTER_OPTIONS.referenceYears.map((item) => ({
        ...item,
        checked: item.value === 'all'
          ? this.data.referenceMode === 'all'
          : item.value === 'latest'
            ? this.data.referenceMode === 'latest'
            : this.data.referenceMode === 'years' &&
              this.data.selectedReferenceYears.includes(Number(item.value))
      })),
      matchLevelOptions: checkedOptions(FILTER_OPTIONS.matchLevels, this.data.selectedMatchLevels),
      targetLevelOptions: checkedOptions(FILTER_OPTIONS.targetLevels, this.data.selectedTargetLevels),
      candidateStatusOptions: checkedOptions(CANDIDATE_STATUS_OPTIONS, this.data.selectedCandidateStatuses),
      userTagOptions: checkedOptions([...new Set(schoolUserStates.flatMap((item) => item.tags))].sort(), this.data.selectedUserTags),
      filterError: bounds.message,
      currentScore: current.score,
      currentScoreText: current.score === null ? '尚未记录成绩' : `当前成绩 ${current.score} 分`,
      results,
      filterSummary: buildFilterSummary(this.data, results.length, current.score),
      activeFilters,
      hasActiveFilters: activeFilters.length > 0,
      comparisonIds,
      comparisonCount: comparisonIds.length,
      comparisonNames,
      hasComparisonSelection: comparisonIds.length > 0
    })
  },

  toggleFavorite(event) {
    const { id } = event.currentTarget.dataset
    const item = this.data.results.find((school) => school.id === id)
    if (!item) return
    const result = setFavorite(
      id,
      !item.isFavorite,
      operationOptions('set_favorite', id)
    )
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    wx.showToast({ title: item.isFavorite ? '已取消收藏' : '已收藏', icon: 'success' })
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
    const school = this.data.results.find((item) => item.id === id)
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

  toggleCompare(event) {
    const id = event.currentTarget.dataset.id
    const selected = new Set(this.data.comparisonIds)
    if (selected.has(id)) {
      selected.delete(id)
    } else {
      if (selected.size >= MAX_COMPARE_SCHOOLS) {
        wx.showToast({ title: '最多对比 3 所学校', icon: 'none' })
        return
      }
      selected.add(id)
    }
    const result = saveComparisonSchoolIds(
      [...selected],
      operationOptions('save_school_comparison', 'comparisonSchoolIds')
    )
    if (!result.ok) {
      wx.showToast({ title: result.message || '对比选择保存失败。', icon: 'none' })
      return
    }
    this.refresh()
  },

  clearComparison() {
    const result = saveComparisonSchoolIds(
      [],
      operationOptions('save_school_comparison', 'comparisonSchoolIds')
    )
    if (!result.ok) {
      wx.showToast({ title: result.message || '清空对比选择失败。', icon: 'none' })
      return
    }
    this.refresh()
  },

  openComparison() {
    if (!this.data.comparisonCount) return
    wx.navigateTo({ url: '/pages/school-compare/school-compare' })
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
    wx.navigateTo({ url: `/pages/school-detail/school-detail?id=${id}` })
  },

  noop() {
    // Used to keep card-level navigation from handling nested controls.
  },

  syncOnboarding() {
    this.setData({
      onboarding: onboardingForPage('/pages/schools/schools')
    })
  },

  onOnboardingAction(event) {
    handleOnboardingAction(event)
    this.syncOnboarding()
  }
})
