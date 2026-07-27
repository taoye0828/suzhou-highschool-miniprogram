const { schools } = require('../data/schools')
const { admissionScores } = require('../data/admission-scores')
const { hasScoresForSchool, countScoresBySchoolId } = require('./admission-scores')
const { searchSchools } = require('./school-search')

const SCORE_STATUS_WITH_SCORES = '已收录已核实历史分数线'
const SCORE_STATUS_WITHOUT_SCORES = '暂未收录已核实历史分数线'
const SCORE_RANGES = ['全部', '500以下', '500-600', '600-650', '650以上']

function scoreRangeMatches(referenceScore, scoreRange) {
  if (scoreRange === '全部') return true
  if (!Number.isInteger(referenceScore)) return false
  if (scoreRange === '500以下') return referenceScore < 500
  if (scoreRange === '500-600') return referenceScore >= 500 && referenceScore < 600
  if (scoreRange === '600-650') return referenceScore >= 600 && referenceScore < 650
  if (scoreRange === '650以上') return referenceScore >= 650
  return true
}

function highestReferenceScoreForSchool(schoolId, targetYear) {
  const scores = admissionScores
    .filter((item) => item.schoolId === schoolId && item.year <= targetYear)
    .map((item) => item.minScore)
    .filter(Number.isInteger)
  return scores.length ? Math.max(...scores) : null
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

function filterSchools({
  keyword = '',
  district = '全部',
  schoolType = '全部',
  ownership = '全部',
  tag = '全部',
  scoreStatus = '全部',
  scoreRange = '全部',
  targetLevel = 'all',
  targetRecords = [],
  targetYear = 2027
}) {
  const targetBySchoolId = new Map(
    (Array.isArray(targetRecords) ? targetRecords : [])
      .filter((record) => record && record.schoolId)
      .map((record) => [record.schoolId, record])
  )
  return searchSchools({ schools, keyword }).filter((school) => {
    const hasScores = hasScoresForSchool(school.id)
    const rangeReferenceScore = highestReferenceScoreForSchool(school.id, targetYear)
    const targetRecord = targetBySchoolId.get(school.id)
    return (district === '全部' || school.district === district) &&
      (schoolType === '全部' || school.schoolType === schoolType) &&
      (ownership === '全部' || school.ownership === ownership) &&
      (tag === '全部' || (Array.isArray(school.tags) && school.tags.includes(tag))) &&
      scoreRangeMatches(rangeReferenceScore, scoreRange) &&
      (targetLevel === 'all' || (targetRecord && targetRecord.level === targetLevel)) &&
      (scoreStatus === '全部' ||
        (scoreStatus === SCORE_STATUS_WITH_SCORES && hasScores) ||
        (scoreStatus === SCORE_STATUS_WITHOUT_SCORES && !hasScores))
  })
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
  getSchoolById,
  presentSchool,
  withFavoriteState,
  splitFavoriteIdsByValidity,
  SCORE_STATUS_WITH_SCORES,
  SCORE_STATUS_WITHOUT_SCORES,
  SCORE_RANGES,
  scoreRangeMatches,
  highestReferenceScoreForSchool
}
