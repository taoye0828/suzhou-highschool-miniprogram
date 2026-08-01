const { APP_CONFIG } = require('../config/app-config')
const { schools } = require('../data/schools')
const { admissionScores } = require('../data/admission-scores')
const { hasScoresForSchool, countScoresBySchoolId } = require('./admission-scores')
const { searchSchools } = require('./school-search')
const {
  referenceScoreValue,
  selectLatestReference,
  calculateDifference,
  classifyDifference
} = require('./planning')

const SCORE_STATUS_WITH_SCORES = '已收录已核实历史分数线'
const SCORE_STATUS_WITHOUT_SCORES = '暂未收录已核实历史分数线'
const SCORE_RANGES = ['全部', '500以下', '500-600', '600-650', '650以上']
const FORMAL_SCORE_YEARS = [...new Set(admissionScores.map((item) => item.year).filter(Number.isInteger))]
  .sort((left, right) => right - left)
const REFERENCE_YEAR_FILTERS = ['all', 'latest', ...FORMAL_SCORE_YEARS.map(String)]
const SCHOOL_SORTS = [
  'default',
  'name',
  'district',
  'referenceScoreAsc',
  'referenceScoreDesc',
  'differenceAsc',
  'differenceDesc',
  'closest'
]
const SCHOOL_SORT_OPTIONS = [
  { value: 'default', label: '默认排序' },
  { value: 'name', label: '学校名称' },
  { value: 'district', label: '所在区域' },
  { value: 'referenceScoreDesc', label: '参考分从高到低' },
  { value: 'referenceScoreAsc', label: '参考分从低到高' },
  { value: 'closest', label: '与当前成绩最接近' },
  { value: 'differenceDesc', label: '当前分差从高到低' },
  { value: 'differenceAsc', label: '当前分差从低到高' }
]

function scoreRangeMatches(referenceScore, scoreRange) {
  if (scoreRange === '全部' || !scoreRange) return true
  if (!Number.isInteger(referenceScore)) return false
  if (scoreRange === '500以下') return referenceScore < 500
  if (scoreRange === '500-600') return referenceScore >= 500 && referenceScore < 600
  if (scoreRange === '600-650') return referenceScore >= 600 && referenceScore < 650
  if (scoreRange === '650以上') return referenceScore >= 650
  return true
}

function listValues(value) {
  const source = Array.isArray(value)
    ? value
    : value === undefined || value === null || value === '' || value === '全部' || value === 'all'
      ? []
      : [value]
  return [...new Set(source.map((item) => String(item || '').trim()).filter((item) => {
    return item && item !== '全部' && item !== 'all'
  }))]
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined)
}

function selectedSet(...values) {
  return new Set(listValues(firstDefined(...values)))
}

function highestReferenceScoreForSchool(schoolId, targetYear) {
  const reference = selectLatestReference(admissionScores, { schoolId, targetYear })
  return reference ? referenceScoreValue(reference) : null
}

function referenceForSchoolFilter(schoolId, options) {
  const rawYear = firstDefined(
    options.referenceYears,
    options.referenceYear,
    options.scoreYears,
    options.scoreYear,
    'all'
  )
  const yearValues = listValues(rawYear)
  const exactYears = yearValues
    .map(Number)
    .filter((year) => FORMAL_SCORE_YEARS.includes(year))
  const targetYear = Number.isInteger(options.targetYear) ? options.targetYear : 2027
  return selectLatestReference(admissionScores, {
    schoolId,
    targetYear,
    exactYear: exactYears.length === 1 ? exactYears[0] : undefined,
    allowedYears: exactYears.length > 1 ? exactYears : undefined
  })
}

function uniqueValues(field) {
  return ['全部', ...new Set(schools.map((school) => school[field]).filter(Boolean))]
}

function uniqueTags() {
  return ['全部', ...new Set(schools.flatMap((school) => Array.isArray(school.tags) ? school.tags : []))]
}

function sourceTypeLabel(sourceType) {
  return sourceType || '公开来源'
}

function compactAddress(address) {
  if (!address) return ''
  return address.length > 18 ? `${address.slice(0, 18)}...` : address
}

function targetMap(records) {
  return new Map(
    (Array.isArray(records) ? records : [])
      .filter((record) => record && record.schoolId)
      .map((record) => [record.schoolId, record])
  )
}

function compareNullable(left, right, direction = 1) {
  const leftMissing = !Number.isFinite(left)
  const rightMissing = !Number.isFinite(right)
  if (leftMissing || rightMissing) {
    if (leftMissing && rightMissing) return 0
    return leftMissing ? 1 : -1
  }
  return (left - right) * direction
}

function firstFinite(...values) {
  const value = values.find(Number.isFinite)
  return Number.isFinite(value) ? value : null
}

function sortCatalog(items, sortBy) {
  if (!sortBy || sortBy === 'default') return items
  return items.slice().sort((left, right) => {
    let compare = 0
    if (sortBy === 'name') {
      compare = left.name.localeCompare(right.name, 'zh-Hans-CN')
    } else if (sortBy === 'district') {
      compare = String(left.district || '').localeCompare(String(right.district || ''), 'zh-Hans-CN')
    } else if (sortBy === 'referenceScoreAsc') {
      compare = compareNullable(left.referenceScore, right.referenceScore)
    } else if (sortBy === 'referenceScoreDesc') {
      compare = compareNullable(left.referenceScore, right.referenceScore, -1)
    } else if (sortBy === 'differenceAsc') {
      compare = compareNullable(left.difference, right.difference)
    } else if (sortBy === 'differenceDesc') {
      compare = compareNullable(left.difference, right.difference, -1)
    } else if (sortBy === 'closest') {
      compare = compareNullable(
        Number.isFinite(left.difference) ? Math.abs(left.difference) : null,
        Number.isFinite(right.difference) ? Math.abs(right.difference) : null
      )
    }
    return compare !== 0 ? compare : left.sourceIndex - right.sourceIndex
  })
}

function filterSchoolCatalog(options = {}) {
  const rawReferenceYears = firstDefined(
    options.referenceYears,
    options.referenceYear,
    options.scoreYears,
    options.scoreYear,
    'all'
  )
  const selectedReferenceYears = listValues(rawReferenceYears)
  const requiresReference = selectedReferenceYears.some((value) => {
    return value === 'latest' || FORMAL_SCORE_YEARS.includes(Number(value))
  })
  const districts = selectedSet(options.districts, options.regions, options.district)
  const schoolTypes = selectedSet(options.schoolTypes, options.types, options.schoolType)
  const ownerships = selectedSet(options.ownerships, options.ownership)
  const tags = selectedSet(options.tags, options.tag)
  const matchLevels = selectedSet(options.matchLevels, options.matchLevel, options.scoreMatch)
  const targetLevels = selectedSet(options.targetLevels, options.targetLevel)
  const favoriteIds = selectedSet(options.favoriteIds)
  const targets = targetMap(options.targetRecords)
  const onlyFavorites = options.onlyFavorites === true || options.favoriteOnly === true
  const onlyTargets = options.onlyTargets === true || options.targetOnly === true
  const excludeTargets = options.excludeTargets === true || options.excludeTargetSchools === true
  const selectedMinReferenceScore = firstFinite(
    options.minReferenceScore,
    options.referenceScoreMin,
    options.minScore
  )
  const selectedMaxReferenceScore = firstFinite(
    options.maxReferenceScore,
    options.referenceScoreMax,
    options.maxScore
  )
  const minReferenceScore = selectedMinReferenceScore === null ? -Infinity : selectedMinReferenceScore
  const maxReferenceScore = selectedMaxReferenceScore === null ? Infinity : selectedMaxReferenceScore
  const currentScore = Number.isFinite(options.currentScore) ? options.currentScore : null

  const rows = searchSchools({ schools, keyword: options.keyword || '' })
    .map((school, sourceIndex) => {
      const reference = referenceForSchoolFilter(school.id, options)
      const referenceScore = reference ? referenceScoreValue(reference) : null
      const difference = calculateDifference(currentScore, referenceScore)
      const targetRecord = targets.get(school.id) || null
      return {
        ...school,
        sourceIndex,
        reference,
        referenceScore,
        referenceYear: reference ? reference.year : null,
        difference,
        gap: difference === null ? null : -difference,
        matchLevel: difference === null ? null : classifyDifference(difference, options.gapRules),
        isFavorite: favoriteIds.has(school.id),
        isTargetSchool: Boolean(targetRecord),
        targetLevel: targetRecord ? targetRecord.level : '',
        targetRecord
      }
    })
    .filter((school) => {
      const hasScores = hasScoresForSchool(school.id)
      return (!districts.size || districts.has(String(school.district || ''))) &&
        (!schoolTypes.size || schoolTypes.has(String(school.schoolType || ''))) &&
        (!ownerships.size || ownerships.has(String(school.ownership || ''))) &&
        (!tags.size || (Array.isArray(school.tags) && school.tags.some((tag) => tags.has(tag)))) &&
        (!requiresReference || Boolean(school.reference)) &&
        school.referenceScore >= minReferenceScore &&
        school.referenceScore <= maxReferenceScore &&
        scoreRangeMatches(school.referenceScore, options.scoreRange) &&
        (!matchLevels.size || (school.matchLevel && matchLevels.has(school.matchLevel))) &&
        (!onlyFavorites || school.isFavorite) &&
        (!onlyTargets || school.isTargetSchool) &&
        (!excludeTargets || !school.isTargetSchool) &&
        (!targetLevels.size || (school.targetLevel && targetLevels.has(school.targetLevel))) &&
        (options.scoreStatus === undefined ||
          options.scoreStatus === '全部' ||
          (options.scoreStatus === SCORE_STATUS_WITH_SCORES && hasScores) ||
          (options.scoreStatus === SCORE_STATUS_WITHOUT_SCORES && !hasScores))
    })

  return sortCatalog(rows, options.sortBy || options.sort || 'default')
}

function filterSchools(options = {}) {
  return filterSchoolCatalog(options).map((item) => {
    const {
      sourceIndex,
      reference,
      referenceScore,
      referenceYear,
      difference,
      gap,
      matchLevel,
      isFavorite,
      isTargetSchool,
      targetLevel,
      targetRecord,
      ...school
    } = item
    return school
  })
}

function buildSchoolFilterOptions() {
  const actualYears = [...new Set(admissionScores.map((item) => item.year).filter(Number.isInteger))]
    .sort((left, right) => right - left)
  return {
    districts: [...new Set(schools.map((school) => school.district).filter(Boolean))],
    schoolTypes: [...new Set(schools.map((school) => school.schoolType).filter(Boolean))],
    referenceYears: [
      { value: 'all', label: '全部' },
      { value: 'latest', label: '最新年份' },
      ...actualYears.map((year) => ({ value: String(year), label: `${year} 年` }))
    ],
    matchLevels: APP_CONFIG.targetScore.levels.map((item) => ({ ...item })),
    targetLevels: APP_CONFIG.targetScore.levels.map((item) => ({ ...item })),
    sorts: SCHOOL_SORTS.slice(),
    sortOptions: SCHOOL_SORT_OPTIONS.map((item) => ({ ...item }))
  }
}

function getSchoolById(id) {
  return schools.find((school) => school.id === id)
}

function presentSchool(school, favoriteIds = []) {
  const scoreCount = countScoresBySchoolId(school.id)
  return {
    ...school,
    sourceTypeLabel: sourceTypeLabel(school.sourceType),
    addressShort: compactAddress(school.address),
    hasAdmissionScores: scoreCount > 0,
    admissionScoreCount: scoreCount,
    admissionScoreBadge: scoreCount > 0 ? SCORE_STATUS_WITH_SCORES : SCORE_STATUS_WITHOUT_SCORES,
    isFavorite: favoriteIds.includes(school.id)
  }
}

function withFavoriteState(items, favoriteIds) {
  return items.map((school) => presentSchool(school, favoriteIds))
}

function splitFavoriteIdsByValidity(ids) {
  const validIds = new Set(schools.map((school) => school.id))
  return (Array.isArray(ids) ? ids : []).reduce((result, id) => {
    if (validIds.has(id)) result.valid[result.valid.length] = id
    else result.invalid[result.invalid.length] = id
    return result
  }, { valid: [], invalid: [] })
}

module.exports = {
  schools,
  uniqueValues,
  uniqueTags,
  sourceTypeLabel,
  filterSchools,
  filterSchoolCatalog,
  buildSchoolFilterOptions,
  getSchoolById,
  presentSchool,
  withFavoriteState,
  splitFavoriteIdsByValidity,
  SCORE_STATUS_WITH_SCORES,
  SCORE_STATUS_WITHOUT_SCORES,
  SCORE_RANGES,
  REFERENCE_YEAR_FILTERS,
  FORMAL_SCORE_YEARS,
  SCHOOL_SORTS,
  SCHOOL_SORT_OPTIONS,
  scoreRangeMatches,
  highestReferenceScoreForSchool,
  referenceForSchoolFilter,
  applySchoolFilters: filterSchoolCatalog,
  filterSchoolRows: filterSchoolCatalog,
  getSchoolFilterOptions: buildSchoolFilterOptions
}
