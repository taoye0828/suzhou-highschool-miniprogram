const { admissionScores } = require('../data/admission-scores')

const SCORE_SAFETY_NOTICE = '历史录取分数线仅供了解，不代表未来录取结果。本小程序不做录取预测，不提供志愿填报结论。'
const EMPTY_SCORE_TEXT = '本校暂未收录已核实历史录取分数线。'
const BATCH_ORDER = {
  提前录取批次: 0,
  第一批次: 1,
  跨区招生: 2
}

function compareScores(left, right) {
  if (right.year !== left.year) return right.year - left.year
  const leftBatch = Object.prototype.hasOwnProperty.call(BATCH_ORDER, left.batch) ? BATCH_ORDER[left.batch] : 99
  const rightBatch = Object.prototype.hasOwnProperty.call(BATCH_ORDER, right.batch) ? BATCH_ORDER[right.batch] : 99
  if (leftBatch !== rightBatch) return leftBatch - rightBatch
  const typeCompare = String(left.admissionType || '').localeCompare(String(right.admissionType || ''), 'zh-Hans-CN')
  if (typeCompare !== 0) return typeCompare
  return (right.minScore || 0) - (left.minScore || 0)
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
