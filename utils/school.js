const { schools } = require('../data/schools')
const { hasScoresForSchool, countScoresBySchoolId } = require('./admission-scores')

const SCORE_STATUS_WITH_SCORES = '已收录已核实历史分数线'
const SCORE_STATUS_WITHOUT_SCORES = '暂未收录已核实历史分数线'

function uniqueValues(field) {
  return ['全部', ...new Set(schools.map((school) => school[field]).filter(Boolean))]
}

function sourceTypeLabel(sourceType) {
  return sourceType || '公开来源'
}

function compactAddress(address) {
  if (!address) return ''
  return address.length > 18 ? `${address.slice(0, 18)}...` : address
}

function searchableValues(school) {
  return [
    school.name,
    ...(Array.isArray(school.aliases) ? school.aliases : []),
    school.district,
    school.schoolType,
    school.ownership,
    school.address,
    school.campus,
    ...(Array.isArray(school.tags) ? school.tags : []),
    ...(Array.isArray(school.features) ? school.features : []),
    ...(Array.isArray(school.programs) ? school.programs : [])
  ].filter(Boolean)
}

function filterSchools({
  keyword = '',
  district = '全部',
  schoolType = '全部',
  ownership = '全部',
  scoreStatus = '全部'
}) {
  const query = keyword.trim().toLowerCase()
  return schools.filter((school) => {
    const hasScores = hasScoresForSchool(school.id)
    const searchable = searchableValues(school).join(' ').toLowerCase()
    return (!query || searchable.includes(query)) &&
      (district === '全部' || school.district === district) &&
      (schoolType === '全部' || school.schoolType === schoolType) &&
      (ownership === '全部' || school.ownership === ownership) &&
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
    if (validIds.has(id)) result.valid.push(id)
    else result.invalid.push(id)
    return result
  }, { valid: [], invalid: [] })
}

module.exports = {
  schools,
  uniqueValues,
  sourceTypeLabel,
  filterSchools,
  getSchoolById,
  presentSchool,
  withFavoriteState,
  splitFavoriteIdsByValidity,
  SCORE_STATUS_WITH_SCORES,
  SCORE_STATUS_WITHOUT_SCORES
}
