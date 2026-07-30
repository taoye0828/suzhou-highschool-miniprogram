const { APP_CONFIG, EXAM_TOTAL_SCORE } = require('../config/app-config')

const DEFAULT_LEVEL_RULES = Object.freeze({
  sprint: Object.freeze({ min: -30, max: -1 }),
  target: Object.freeze({ min: 0, max: 15 }),
  safe: Object.freeze({ min: 16, max: Infinity })
})

const DEFAULT_PRIMARY_LEVEL_ORDER = Object.freeze(['target', 'sprint', 'safe'])

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function scoreValue(record) {
  if (!record || typeof record !== 'object') return null
  const totalScore = finiteNumber(record.totalScore)
  return totalScore === null ? finiteNumber(record.score) : totalScore
}

function validTotalScore(value) {
  return Number.isInteger(value) && value >= 0 && value <= EXAM_TOTAL_SCORE
}

function scoreDate(record) {
  if (!record || typeof record !== 'object') return ''
  return String(record.examDate || record.date || '')
}

function compareCreatedAt(leftValue, rightValue) {
  const leftTime = Date.parse(leftValue)
  const rightTime = Date.parse(rightValue)
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) {
    return leftTime - rightTime
  }
  return String(leftValue || '').localeCompare(String(rightValue || ''))
}

function compareScoreRecords(left, right) {
  const dateCompare = scoreDate(left).localeCompare(scoreDate(right))
  if (dateCompare !== 0) return dateCompare
  const createdCompare = compareCreatedAt(left && left.createdAt, right && right.createdAt)
  if (createdCompare !== 0) return createdCompare
  return String(left && left.id || '').localeCompare(String(right && right.id || ''))
}

function sortScoreRecords(records) {
  return (Array.isArray(records) ? records : [])
    .filter((record) => record && typeof record === 'object' && validTotalScore(scoreValue(record)))
    .slice()
    .sort(compareScoreRecords)
}

function selectLatestScoreRecord(records) {
  const ordered = sortScoreRecords(records)
  return ordered.length ? ordered[ordered.length - 1] : null
}

function selectLatestScoreValue(records) {
  return scoreValue(selectLatestScoreRecord(records))
}

function selectCurrentScore(records, draft, options = {}) {
  const latestRecord = selectLatestScoreRecord(records)
  const latestScore = scoreValue(latestRecord)
  if (latestScore !== null) {
    return { score: latestScore, record: latestRecord, source: 'record' }
  }

  if (options.allowDraftFallback === false) {
    return { score: null, record: null, source: 'none' }
  }
  const rawDraftScore = draft && draft.currentScore
  const draftScore = Number(String(rawDraftScore === undefined || rawDraftScore === null ? '' : rawDraftScore).trim())
  const maxScore = Number.isFinite(options.maxScore) ? options.maxScore : EXAM_TOTAL_SCORE
  return Number.isInteger(draftScore) && draftScore >= 0 && draftScore <= maxScore
    ? { score: draftScore, record: null, source: 'draft' }
    : { score: null, record: null, source: 'none' }
}

function referenceScoreValue(record) {
  if (!record || typeof record !== 'object') return null
  const minScore = finiteNumber(record.minScore)
  return minScore === null ? finiteNumber(record.score) : minScore
}

function validReference(record) {
  const score = referenceScoreValue(record)
  return record &&
    Number.isInteger(record.year) &&
    Number.isInteger(score) &&
    score >= 0 &&
    score <= EXAM_TOTAL_SCORE
}

function selectLatestReference(records, options = {}) {
  const schoolId = typeof options.schoolId === 'string' ? options.schoolId.trim() : ''
  const targetYear = Number.isInteger(options.targetYear) ? options.targetYear : Infinity
  const exactYear = Number.isInteger(options.exactYear) ? options.exactYear : null
  const allowedYears = Array.isArray(options.allowedYears)
    ? new Set(options.allowedYears.filter(Number.isInteger))
    : null

  const eligible = (Array.isArray(records) ? records : []).filter((record) => {
    if (!validReference(record)) return false
    if (schoolId && record.schoolId !== schoolId) return false
    if (record.year > targetYear) return false
    if (exactYear !== null && record.year !== exactYear) return false
    if (allowedYears && !allowedYears.has(record.year)) return false
    return true
  })
  if (!eligible.length) return null

  const latestYear = exactYear === null
    ? Math.max(...eligible.map((record) => record.year))
    : exactYear
  return eligible
    .filter((record) => record.year === latestYear)
    .slice()
    .sort((left, right) => {
      const scoreCompare = referenceScoreValue(right) - referenceScoreValue(left)
      return scoreCompare !== 0
        ? scoreCompare
        : String(left.id || '').localeCompare(String(right.id || ''))
    })[0] || null
}

function selectReferenceForSchool(schoolId, targetYear, records, options = {}) {
  return selectLatestReference(records, { ...options, schoolId, targetYear })
}

function normalizeRule(rule, fallback) {
  if (Array.isArray(rule)) {
    const min = finiteNumber(rule[0])
    const max = rule[1] === Infinity ? Infinity : finiteNumber(rule[1])
    return {
      min: min === null ? fallback.min : min,
      max: max === null ? fallback.max : max
    }
  }
  if (!rule || typeof rule !== 'object') return { ...fallback }
  const min = finiteNumber(rule.min)
  const max = rule.max === Infinity ? Infinity : finiteNumber(rule.max)
  return {
    min: min === null ? fallback.min : min,
    max: max === null ? fallback.max : max
  }
}

function normalizeLevelRules(rules = {}) {
  const source = rules && typeof rules === 'object' ? rules : {}
  return {
    sprint: normalizeRule(source.sprint, DEFAULT_LEVEL_RULES.sprint),
    target: normalizeRule(source.target, DEFAULT_LEVEL_RULES.target),
    safe: normalizeRule(source.safe, DEFAULT_LEVEL_RULES.safe)
  }
}

function differenceInRule(difference, rule) {
  return Number.isFinite(difference) &&
    difference >= rule.min &&
    difference <= rule.max
}

function classifyDifference(difference, rules = DEFAULT_LEVEL_RULES) {
  const normalized = normalizeLevelRules(rules)
  if (differenceInRule(difference, normalized.sprint)) return 'sprint'
  if (differenceInRule(difference, normalized.target)) return 'target'
  if (differenceInRule(difference, normalized.safe)) return 'safe'
  return null
}

function calculateDifference(userScore, reference) {
  const userValue = finiteNumber(userScore)
  const referenceValue = typeof reference === 'object'
    ? referenceScoreValue(reference)
    : finiteNumber(reference)
  return userValue === null || referenceValue === null
    ? null
    : userValue - referenceValue
}

function selectGap(userScore, reference, options = {}) {
  const referenceScore = typeof reference === 'object'
    ? referenceScoreValue(reference)
    : finiteNumber(reference)
  const difference = calculateDifference(userScore, referenceScore)
  return {
    userScore: finiteNumber(userScore),
    referenceScore,
    referenceYear: reference && typeof reference === 'object' && Number.isInteger(reference.year)
      ? reference.year
      : null,
    difference,
    gap: difference === null ? null : -difference,
    level: difference === null ? null : classifyDifference(difference, options.rules)
  }
}

function formatDifference(difference) {
  if (!Number.isFinite(difference)) return '待记录成绩后计算'
  if (difference < 0) return `距历史参考分还差 ${Math.abs(difference)} 分`
  if (difference === 0) return '与历史参考分持平'
  return `高于历史参考分 ${difference} 分`
}

function targetCreatedAtCompare(left, right) {
  const createdCompare = compareCreatedAt(left && left.createdAt, right && right.createdAt)
  if (createdCompare !== 0) return createdCompare
  const schoolCompare = String(left && left.schoolId || '').localeCompare(String(right && right.schoolId || ''))
  return schoolCompare !== 0
    ? schoolCompare
    : String(left && left.id || '').localeCompare(String(right && right.id || ''))
}

function selectPrimaryTarget(records, options = {}) {
  const items = (Array.isArray(records) ? records : [])
    .filter((record) => record && typeof record === 'object' && record.schoolId)
  if (!items.length) return null

  const requestedId = String(options.primaryTargetId || options.primarySchoolId || '').trim()
  if (requestedId) {
    const requested = items.find((record) => record.id === requestedId || record.schoolId === requestedId)
    if (requested) return requested
  }
  const explicit = items.filter((record) => record.isPrimary === true || record.primary === true)
  if (explicit.length) return explicit.slice().sort(targetCreatedAtCompare)[0]

  const levelOrder = Array.isArray(options.levelOrder) && options.levelOrder.length
    ? options.levelOrder
    : DEFAULT_PRIMARY_LEVEL_ORDER
  return items.slice().sort((left, right) => {
    const leftRank = levelOrder.indexOf(left.level)
    const rightRank = levelOrder.indexOf(right.level)
    const levelCompare = (leftRank < 0 ? levelOrder.length : leftRank) -
      (rightRank < 0 ? levelOrder.length : rightRank)
    return levelCompare !== 0 ? levelCompare : targetCreatedAtCompare(left, right)
  })[0]
}

function selectPlanningContext({
  scoreRecords = [],
  draft = {},
  references = [],
  schoolId = '',
  targetYear,
  targetRecords = [],
  primaryTargetId = '',
  rules
} = {}) {
  const current = selectCurrentScore(scoreRecords, draft)
  const primaryTarget = selectPrimaryTarget(targetRecords, { primaryTargetId })
  const resolvedSchoolId = schoolId || (primaryTarget && primaryTarget.schoolId) || ''
  const reference = selectReferenceForSchool(resolvedSchoolId, targetYear, references)
  return {
    currentScore: current.score,
    currentScoreRecord: current.record,
    currentScoreSource: current.source,
    primaryTarget,
    reference,
    ...selectGap(current.score, reference, { rules })
  }
}

function selectGapTrajectory(scoreRecords, reference, options = {}) {
  return sortScoreRecords(scoreRecords).map((record) => ({
    record,
    recordId: record.id,
    examName: record.examName || '',
    examDate: scoreDate(record),
    score: scoreValue(record),
    ...selectGap(scoreValue(record), reference, options)
  }))
}

module.exports = {
  DEFAULT_LEVEL_RULES,
  DEFAULT_PRIMARY_LEVEL_ORDER,
  scoreValue,
  validTotalScore,
  scoreDate,
  compareScoreRecords,
  sortScoreRecords,
  selectLatestScoreRecord,
  selectLatestScoreValue,
  selectCurrentScore,
  referenceScoreValue,
  validReference,
  selectLatestReference,
  selectReferenceForSchool,
  normalizeLevelRules,
  classifyDifference,
  calculateDifference,
  selectGap,
  formatDifference,
  selectPrimaryTarget,
  selectPlanningContext,
  selectGapTrajectory,
  getLatestScoreRecord: selectLatestScoreRecord,
  getLatestScoreValue: selectLatestScoreValue,
  getLatestReference: selectLatestReference,
  getSchoolReference: selectReferenceForSchool,
  getDifference: calculateDifference,
  getGap: selectGap,
  getPrimaryTarget: selectPrimaryTarget,
  latestScoreRecord: selectLatestScoreRecord,
  latestReference: selectLatestReference,
  primaryTarget: selectPrimaryTarget
}
