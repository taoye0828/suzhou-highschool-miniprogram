const { admissionScores } = require('../data/admission-scores')

const SCORE_SAFETY_NOTICE = '历史录取分数线仅供了解，不代表未来录取结果。本小程序不做录取预测，不提供志愿填报结论。'
const EMPTY_SCORE_TEXT = '本校暂未收录已核实历史录取分数线。'

function compareScores(left, right) {
  if (right.year !== left.year) return right.year - left.year
  const leftKey = `${left.batch || ''}-${left.admissionType || ''}-${left.scoreType || ''}`
  const rightKey = `${right.batch || ''}-${right.admissionType || ''}-${right.scoreType || ''}`
  return leftKey.localeCompare(rightKey, 'zh-Hans-CN')
}

function getScoresBySchoolId(schoolId, source = admissionScores) {
  if (typeof schoolId !== 'string' || !schoolId.trim()) return []
  const id = schoolId.trim()
  return (Array.isArray(source) ? source : [])
    .filter((item) => item && item.schoolId === id)
    .slice()
    .sort(compareScores)
}

function hasScoresForSchool(schoolId, source = admissionScores) {
  return getScoresBySchoolId(schoolId, source).length > 0
}

function countScoresBySchoolId(schoolId, source = admissionScores) {
  return getScoresBySchoolId(schoolId, source).length
}

function groupScoresByYear(schoolId, source = admissionScores) {
  return getScoresBySchoolId(schoolId, source).reduce((groups, score) => {
    const year = String(score.year)
    const existing = groups.find((group) => group.year === year)
    if (existing) existing.items.push(score)
    else groups.push({ year, items: [score] })
    return groups
  }, [])
}

module.exports = {
  SCORE_SAFETY_NOTICE,
  EMPTY_SCORE_TEXT,
  getScoresBySchoolId,
  hasScoresForSchool,
  countScoresBySchoolId,
  groupScoresByYear
}
