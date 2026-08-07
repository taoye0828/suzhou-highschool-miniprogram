const { PRODUCT_RULES } = require('./runtime-constants')

const EXAM_TYPE_LABELS = Object.freeze({
  weekly_test: '周测',
  unit_test: '单元测试',
  monthly_exam: '月考',
  midterm_exam: '期中考试',
  final_exam: '期末考试',
  mock_exam: '模拟考试',
  custom: '自定义'
})

const METRIC_TYPE_LABELS = Object.freeze({
  full_total: '完整总分',
  partial_total: '部分科目总分',
  single_subject: '单科'
})

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value))
}

function builtInExamTemplates(profileId = '') {
  return PRODUCT_RULES.builtInExamTemplates.map((item) => ({
    ...clone(item),
    profileId,
    version: 1,
    schemaVersion: PRODUCT_RULES.storageSchemaVersion
  }))
}

function builtInScoreSchemes(profileId = '') {
  return PRODUCT_RULES.builtInScoreSchemes.map((item) => ({
    ...clone(item),
    profileId,
    version: 1,
    schemaVersion: PRODUCT_RULES.storageSchemaVersion
  }))
}

function scoreSchemeSnapshot(scheme) {
  if (!scheme || typeof scheme !== 'object') return null
  const subjectRules = (Array.isArray(scheme.subjectRules) ? scheme.subjectRules : []).map((item) => ({
    subjectId: String(item && (item.subjectId || item.id) || '').trim(),
    subjectName: String(item && (item.subjectName || item.name) || '').trim(),
    maxScore: Number(item && item.maxScore),
    includedInTotal: item && item.includedInTotal !== false,
    displayOrder: Number.isInteger(item && item.displayOrder) ? item.displayOrder : 0
  })).filter((item) => item.subjectId && item.subjectName && Number.isInteger(item.maxScore) && item.maxScore > 0)
  return {
    id: String(scheme.id || ''),
    name: String(scheme.name || ''),
    metricType: String(scheme.metricType || ''),
    subjectRules,
    totalMaxScore: Number(scheme.totalMaxScore),
    admissionScaleMax: Number.isInteger(scheme.admissionScaleMax) ? scheme.admissionScaleMax : null,
    eligibilityRuleId: String(scheme.eligibilityRuleId || ''),
    isBuiltIn: scheme.isBuiltIn === true,
    version: Number.isInteger(scheme.version) ? scheme.version : 1,
    schemaVersion: PRODUCT_RULES.storageSchemaVersion
  }
}

function resolveExamScoreSchemeSnapshot({
  originalRecord = null,
  formSnapshot = null,
  selectedScheme = null,
  selectionChanged = false
} = {}) {
  const historicalSnapshot = originalRecord && originalRecord.scoreSchemeSnapshot || formSnapshot
  if (!selectionChanged && historicalSnapshot && typeof historicalSnapshot === 'object') {
    return clone(historicalSnapshot)
  }
  return scoreSchemeSnapshot(selectedScheme)
}

function scoreRateBasisPoints(totalScore, totalMaxScore) {
  return Number.isInteger(totalScore) && Number.isInteger(totalMaxScore) && totalMaxScore > 0
    ? Math.round(totalScore * PRODUCT_RULES.scoreRateBasis / totalMaxScore)
    : null
}

function scoreRatePercent(value) {
  return Number.isInteger(value) ? value / 100 : null
}

function formatScoreRate(value) {
  const percent = scoreRatePercent(value)
  return percent === null ? '—' : `${percent.toFixed(2)}%`
}

function completeSchemeSnapshot(snapshot) {
  return Boolean(
    snapshot &&
    typeof snapshot === 'object' &&
    !Array.isArray(snapshot) &&
    typeof snapshot.id === 'string' && snapshot.id &&
    typeof snapshot.name === 'string' && snapshot.name &&
    snapshot.metricType === 'full_total' &&
    snapshot.totalMaxScore === PRODUCT_RULES.examTotalScoreMax &&
    snapshot.admissionScaleMax === PRODUCT_RULES.examTotalScoreMax &&
    Array.isArray(snapshot.subjectRules) && snapshot.subjectRules.length > 0 &&
    typeof snapshot.eligibilityRuleId === 'string' && snapshot.eligibilityRuleId
  )
}

function recommendationEligibility(record) {
  if (!record || typeof record !== 'object') {
    return { eligible: false, code: 'RECORD_INVALID', message: '考试记录无效' }
  }
  if (record.examType === 'weekly_test') {
    return { eligible: false, code: 'WEEKLY_TEST', message: '周测不用于历史分差参考' }
  }
  if (record.metricType !== 'full_total') {
    return { eligible: false, code: 'METRIC_NOT_FULL_TOTAL', message: '仅完整总分可用于历史分差参考' }
  }
  if (record.totalMaxScore !== PRODUCT_RULES.examTotalScoreMax ||
      record.admissionScaleMax !== PRODUCT_RULES.examTotalScoreMax) {
    return { eligible: false, code: 'SCALE_NOT_740', message: '仅 740 分完整体系可用于历史分差参考' }
  }
  if (!PRODUCT_RULES.recommendation.allowedEligibilityRuleIds.includes(record.eligibilityRuleId)) {
    return { eligible: false, code: 'ELIGIBILITY_RULE_NOT_ALLOWED', message: '分值方案不具备历史分差参考资格' }
  }
  if (!completeSchemeSnapshot(record.scoreSchemeSnapshot)) {
    return { eligible: false, code: 'SCHEME_SNAPSHOT_INCOMPLETE', message: '历史分值方案快照不完整' }
  }
  if (!Number.isInteger(record.totalScore) || record.totalScore < 0 || record.totalScore > record.totalMaxScore) {
    return { eligible: false, code: 'TOTAL_SCORE_INVALID', message: '总分超出当次考试满分' }
  }
  if (record.scoreRateBasisPoints !== scoreRateBasisPoints(record.totalScore, record.totalMaxScore)) {
    return { eligible: false, code: 'SCORE_RATE_INVALID', message: '得分率校验失败' }
  }
  return { eligible: true, code: 'ELIGIBLE', message: '可用于历史分差参考' }
}

function isRecommendationEligibleExam(record) {
  return recommendationEligibility(record).eligible
}

function trendValue(record, metric = 'raw') {
  if (!record || typeof record !== 'object') return null
  if (metric === 'rate') {
    const basisPoints = Number.isInteger(record.scoreRateBasisPoints)
      ? record.scoreRateBasisPoints
      : scoreRateBasisPoints(record.totalScore, record.totalMaxScore)
    return scoreRatePercent(basisPoints)
  }
  return Number.isFinite(record.totalScore) ? record.totalScore : Number.isFinite(record.score) ? record.score : null
}

module.exports = {
  EXAM_TYPE_LABELS,
  METRIC_TYPE_LABELS,
  builtInExamTemplates,
  builtInScoreSchemes,
  scoreSchemeSnapshot,
  resolveExamScoreSchemeSnapshot,
  scoreRateBasisPoints,
  scoreRatePercent,
  formatScoreRate,
  completeSchemeSnapshot,
  recommendationEligibility,
  isRecommendationEligibleExam,
  trendValue
}
