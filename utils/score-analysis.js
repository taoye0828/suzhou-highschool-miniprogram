const { EXAM_TOTAL_SCORE } = require('../config/app-config')
const { schools: defaultSchools } = require('../data/schools')
const { admissionScores: defaultScores } = require('../data/admission-scores')

const LEVEL_ORDER = ['challenge', 'match', 'safe']

function isValidReferenceScore(item) {
  return item &&
    Number.isInteger(item.year) &&
    Number.isInteger(item.minScore) &&
    item.minScore >= 0 &&
    item.minScore <= EXAM_TOTAL_SCORE
}

function latestReferenceScore(scores, targetYear) {
  const eligible = (Array.isArray(scores) ? scores : [])
    .filter((item) => item.year <= targetYear && isValidReferenceScore(item))
  if (!eligible.length) return null
  const latestYear = Math.max(...eligible.map((item) => item.year))
  return eligible
    .filter((item) => item.year === latestYear)
    .sort((left, right) => right.minScore - left.minScore)[0]
}

function classifyDifference(difference) {
  if (difference >= -30 && difference < 0) return 'challenge'
  if (difference >= 0 && difference <= 15) return 'match'
  if (difference > 15) return 'safe'
  return null
}

function analyzeScore({
  userScore,
  targetYear,
  schools = defaultSchools,
  scores = defaultScores
}) {
  if (!Number.isInteger(userScore) || userScore < 0 || userScore > EXAM_TOTAL_SCORE) {
    throw new TypeError(`userScore must be an integer from 0 to ${EXAM_TOTAL_SCORE}`)
  }
  if (!Number.isInteger(targetYear)) throw new TypeError('targetYear must be an integer')

  const scoreGroups = new Map()
  for (const item of scores) {
    if (!isValidReferenceScore(item) || item.year > targetYear) continue
    scoreGroups.set(item.schoolId, [...(scoreGroups.get(item.schoolId) || []), item])
  }

  return schools.flatMap((school) => {
    const reference = latestReferenceScore(scoreGroups.get(school.id), targetYear)
    if (!reference) return []
    const difference = userScore - reference.minScore
    const level = classifyDifference(difference)
    if (!level) return []
    return [{
      schoolId: school.id,
      schoolName: school.name,
      userScore,
      year: reference.year,
      schoolScore: reference.minScore,
      difference,
      differenceText: difference < 0
        ? `${difference} 分（当前低于参考分）`
        : `+${difference} 分（当前高于或等于参考分）`,
      level
    }]
  }).sort((left, right) => {
    const levelCompare = LEVEL_ORDER.indexOf(left.level) - LEVEL_ORDER.indexOf(right.level)
    if (levelCompare !== 0) return levelCompare
    const differenceCompare = Math.abs(left.difference) - Math.abs(right.difference)
    return differenceCompare !== 0
      ? differenceCompare
      : left.schoolName.localeCompare(right.schoolName, 'zh-Hans-CN')
  })
}

function scoreSummaryForSchool(schoolId, scores = defaultScores) {
  const maxByYear = new Map()
  for (const item of scores) {
    if (item.schoolId !== schoolId || !isValidReferenceScore(item)) continue
    const current = maxByYear.get(item.year)
    if (current === undefined || item.minScore > current) maxByYear.set(item.year, item.minScore)
  }
  const years = Array.from(maxByYear.keys()).sort((left, right) => right - left).slice(0, 3)
  return years.length
    ? years.map((year) => `${year} 年 ${maxByYear.get(year)} 分`).join('；')
    : '暂未收录'
}

module.exports = {
  LEVEL_ORDER,
  latestReferenceScore,
  classifyDifference,
  analyzeScore,
  scoreSummaryForSchool
}
