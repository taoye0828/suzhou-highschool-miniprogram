const { EXAM_TOTAL_SCORE } = require('../config/app-config')
const { schools: defaultSchools } = require('../data/schools')
const { admissionScores: defaultScores } = require('../data/admission-scores')
const { searchSchools } = require('./school-search')
const {
  DEFAULT_LEVEL_RULES,
  validReference,
  referenceScoreValue,
  selectLatestReference,
  normalizeLevelRules,
  classifyDifference: classifyPlanningDifference
} = require('./planning')

const LEVEL_ORDER = ['sprint', 'target', 'safe']

function isValidReferenceScore(item) {
  return validReference(item)
}

function latestReferenceScore(scores, targetYear, options = {}) {
  return selectLatestReference(scores, { ...options, targetYear })
}

function classifyDifference(difference, rules = DEFAULT_LEVEL_RULES) {
  return classifyPlanningDifference(difference, rules)
}

function cleanValues(value) {
  const source = Array.isArray(value)
    ? value
    : value === undefined || value === null || value === '' || value === '全部'
      ? []
      : [value]
  return [...new Set(source.map((item) => String(item || '').trim()).filter(Boolean))]
}

function valueSet(primary, fallback) {
  return new Set(cleanValues(primary === undefined ? fallback : primary))
}

function finiteSetting(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function recommendationRules(settings = {}) {
  const source = settings.rules || settings.gapRules || settings.customGapRules || {}
  const base = normalizeLevelRules(source)
  const rules = {
    sprint: {
      min: finiteSetting(settings.sprintMinDifference, base.sprint.min),
      max: finiteSetting(settings.sprintMaxDifference, base.sprint.max)
    },
    target: {
      min: finiteSetting(settings.targetMinDifference, base.target.min),
      max: finiteSetting(settings.targetMaxDifference, base.target.max)
    },
    safe: {
      min: finiteSetting(settings.safeMinDifference, base.safe.min),
      max: settings.safeMaxDifference === Infinity
        ? Infinity
        : finiteSetting(settings.safeMaxDifference, base.safe.max)
    }
  }
  return normalizeLevelRules(rules)
}

function levelLimit(settings, level) {
  const value = settings.limitPerLevel === undefined
    ? settings.levelLimits
    : settings.limitPerLevel
  if (Number.isInteger(value) && value >= 0) return value
  if (value && typeof value === 'object' && Number.isInteger(value[level]) && value[level] >= 0) {
    return value[level]
  }
  return 5
}

function applyLevelLimits(results, settings) {
  if (!results.length) return results
  const counters = new Map()
  return results.filter((item) => {
    const limit = levelLimit(settings, item.level)
    if (limit === null) return true
    const count = counters.get(item.level) || 0
    counters.set(item.level, count + 1)
    return count < limit
  })
}

function analyzeScore(options = {}) {
  const {
    userScore,
    targetYear,
    schools = defaultSchools,
    scores = defaultScores,
    keyword = '',
    targetRecords = []
  } = options
  if (!Number.isInteger(userScore) || userScore < 0 || userScore > EXAM_TOTAL_SCORE) {
    throw new TypeError(`userScore must be an integer from 0 to ${EXAM_TOTAL_SCORE}`)
  }
  if (!Number.isInteger(targetYear)) throw new TypeError('targetYear must be an integer')

  const settings = {
    ...(options.settings && typeof options.settings === 'object' ? options.settings : {}),
    ...(options.filters && typeof options.filters === 'object' ? options.filters : {}),
    ...options
  }
  const districts = valueSet(settings.districts, settings.regions || settings.district)
  const schoolTypes = valueSet(settings.schoolTypes, settings.schoolType)
  const favoriteIds = valueSet(settings.favoriteIds)
  const includeFavoriteState = settings.favoriteIds !== undefined
  const favoriteOnly = settings.favoriteOnly === true ||
    settings.favoritesOnly === true ||
    settings.onlyFavorites === true
  const excludeTargetSchools = settings.excludeTargetSchools === true ||
    settings.excludeTargets === true
  const selectedReferenceYears = cleanValues(settings.referenceYears)
    .map(Number)
    .filter((year) => Number.isInteger(year) && year >= 2000 && year <= 2200)
  const only2026 = settings.only2026 === true ||
    settings.require2026 === true ||
    Number(settings.referenceYear) === 2026
  const exactReferenceYear = Number.isInteger(Number(settings.referenceYear)) &&
    [2025, 2026].includes(Number(settings.referenceYear))
    ? Number(settings.referenceYear)
    : only2026
      ? 2026
      : selectedReferenceYears.length === 1
        ? selectedReferenceYears[0]
        : null
  const allowedReferenceYears = exactReferenceYear === null && selectedReferenceYears.length > 1
    ? selectedReferenceYears
    : null
  const allow2025Fallback = settings.allow2025Fallback !== false
  const minReferenceScore = Number.isFinite(settings.minReferenceScore)
    ? settings.minReferenceScore
    : -Infinity
  const maxReferenceScore = Number.isFinite(settings.maxReferenceScore)
    ? settings.maxReferenceScore
    : Infinity
  const rules = recommendationRules(settings)

  const scoreGroups = new Map()
  for (const item of Array.isArray(scores) ? scores : []) {
    if (!isValidReferenceScore(item) || item.year > targetYear) continue
    scoreGroups.set(item.schoolId, [...(scoreGroups.get(item.schoolId) || []), item])
  }

  const targetBySchoolId = new Map(
    (Array.isArray(targetRecords) ? targetRecords : [])
      .filter((record) => record && record.schoolId)
      .map((record) => [record.schoolId, record])
  )

  const results = searchSchools({ schools, keyword }).flatMap((school) => {
    if (districts.size && !districts.has(String(school.district || ''))) return []
    if (schoolTypes.size && !schoolTypes.has(String(school.schoolType || ''))) return []
    if (favoriteOnly && !favoriteIds.has(school.id)) return []

    const targetRecord = targetBySchoolId.get(school.id)
    if (excludeTargetSchools && targetRecord) return []
    const reference = latestReferenceScore(scoreGroups.get(school.id), targetYear, {
      exactYear: exactReferenceYear,
      allowedYears: allowedReferenceYears
    })
    if (!reference) return []
    if (!allow2025Fallback && targetYear >= 2026 && reference.year < 2026) return []
    const schoolScore = referenceScoreValue(reference)
    if (schoolScore < minReferenceScore || schoolScore > maxReferenceScore) return []

    const difference = userScore - schoolScore
    const level = classifyDifference(difference, rules)
    if (!level) return []
    const improvement = Math.max(0, -difference)
    return [{
      schoolId: school.id,
      schoolName: school.name,
      district: school.district || '—',
      schoolType: school.schoolType || '—',
      userScore,
      year: reference.year,
      schoolScore,
      difference,
      differenceText: difference < 0
        ? `距参考分还差 ${Math.abs(difference)} 分`
        : difference === 0
          ? '与参考分一致'
          : `高于参考分 ${difference} 分`,
      gap: schoolScore - userScore,
      improvement,
      improvementText: improvement > 0
        ? `需要提升 ${improvement} 分`
        : '当前已达到或高于该历史参考分',
      ...(includeFavoriteState ? { isFavorite: favoriteIds.has(school.id) } : {}),
      isTargetSchool: Boolean(targetRecord),
      targetLevel: targetRecord ? targetRecord.level : '',
      level
    }]
  }).sort((left, right) => {
    const levelCompare = LEVEL_ORDER.indexOf(left.level) - LEVEL_ORDER.indexOf(right.level)
    if (levelCompare !== 0) return levelCompare
    const differenceCompare = left.level === 'sprint'
      ? right.difference - left.difference
      : left.level === 'safe'
        ? left.difference - right.difference
        : Math.abs(left.difference) - Math.abs(right.difference)
    return differenceCompare !== 0
      ? differenceCompare
      : left.schoolName.localeCompare(right.schoolName, 'zh-Hans-CN')
  })

  return applyLevelLimits(results, settings)
}

function referenceForSchool(schoolId, targetYear, scores = defaultScores, options = {}) {
  return latestReferenceScore(
    (Array.isArray(scores) ? scores : []).filter((item) => item.schoolId === schoolId),
    targetYear,
    options
  )
}

function scoreSummaryForSchool(schoolId, scores = defaultScores) {
  const maxByYear = new Map()
  for (const item of Array.isArray(scores) ? scores : []) {
    if (item.schoolId !== schoolId || !isValidReferenceScore(item)) continue
    const score = referenceScoreValue(item)
    const current = maxByYear.get(item.year)
    if (current === undefined || score > current) maxByYear.set(item.year, score)
  }
  const years = Array.from(maxByYear.keys()).sort((left, right) => right - left).slice(0, 3)
  return years.length
    ? years.map((year) => `${year} 年 ${maxByYear.get(year)} 分`).join('；')
    : '暂未收录'
}

module.exports = {
  LEVEL_ORDER,
  DEFAULT_LEVEL_RULES,
  isValidReferenceScore,
  latestReferenceScore,
  referenceForSchool,
  classifyDifference,
  recommendationRules,
  analyzeScore,
  analyzeScoreWithSettings: analyzeScore,
  analyzeRecommendations: analyzeScore,
  recommendSchools: analyzeScore,
  scoreSummaryForSchool
}
