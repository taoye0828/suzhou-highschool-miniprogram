const { EXAM_TOTAL_SCORE } = require('../config/app-config')
const { schools: defaultSchools } = require('../data/schools')
const { admissionScores: defaultScores } = require('../data/admission-scores')
const { searchSchools } = require('./school-search')

const LEVEL_ORDER = ['sprint', 'target', 'safe']

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
  if (difference >= -30 && difference < 0) return 'sprint'
  if (difference >= 0 && difference <= 15) return 'target'
  if (difference > 15) return 'safe'
  return null
}

function analyzeScore({
  userScore,
  targetYear,
  schools = defaultSchools,
  scores = defaultScores,
  keyword = '',
  targetRecords = []
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

  const targetBySchoolId = new Map(
    (Array.isArray(targetRecords) ? targetRecords : [])
      .filter((record) => record && record.schoolId)
      .map((record) => [record.schoolId, record])
  )

  return searchSchools({ schools, keyword }).flatMap((school) => {
    const reference = latestReferenceScore(scoreGroups.get(school.id), targetYear)
    if (!reference) return []
    const difference = userScore - reference.minScore
    const level = classifyDifference(difference)
    if (!level) return []
    const targetRecord = targetBySchoolId.get(school.id)
    const improvement = Math.max(0, -difference)
    return [{
      schoolId: school.id,
      schoolName: school.name,
      district: school.district || '—',
      schoolType: school.schoolType || '—',
      userScore,
      year: reference.year,
      schoolScore: reference.minScore,
      difference,
      differenceText: difference < 0
        ? `距参考分还差 ${Math.abs(difference)} 分`
        : difference === 0
          ? '与参考分一致'
          : `高于参考分 ${difference} 分`,
      gap: reference.minScore - userScore,
      improvement,
      improvementText: improvement > 0
        ? `需要提升 ${improvement} 分`
        : '当前已达到或高于该历史参考分',
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
}

function referenceForSchool(schoolId, targetYear, scores = defaultScores) {
  return latestReferenceScore(
    (Array.isArray(scores) ? scores : []).filter((item) => item.schoolId === schoolId),
    targetYear
  )
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
  referenceForSchool,
  classifyDifference,
  analyzeScore,
  scoreSummaryForSchool
}
