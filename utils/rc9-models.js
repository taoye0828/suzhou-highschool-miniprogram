const { APP_CONFIG } = require('../config/app-config')
const { PRODUCT_RULES } = require('./generated/product-rules')
const { assertSafeJsonValue } = require('./canonical-json')

const STORAGE_SCHEMA_VERSION = PRODUCT_RULES.storageSchemaVersion
const BACKUP_FORMAT = 'suzhou-highschool-local-backup'
const BACKUP_FORMAT_VERSION = PRODUCT_RULES.backupFormatVersion
const DEFAULT_PROFILE_ID = 'profile_default'
const FAVORITES_MODES = ['independent', 'shared']
const STAGE_GOAL_STATUSES = ['not_started', 'in_progress', 'completed', 'paused']
const LOSS_REASON_TYPES = [
  '基础知识',
  '审题错误',
  '计算错误',
  '时间不足',
  '表达不完整',
  '公式使用错误',
  '单词或语法',
  '实验或作图',
  '记忆不牢',
  '其他'
]
const LEARNING_TASK_STATUSES = ['not_started', 'in_progress', 'completed', 'paused']
const STAGE_GOAL_STATUS_LABELS = {
  not_started: '未开始',
  in_progress: '进行中',
  completed: '已完成',
  paused: '已暂停'
}

const DEFAULT_RECOMMENDATION_SETTINGS = Object.freeze({
  districts: [],
  schoolTypes: [],
  referenceYears: [],
  require2026: false,
  allow2025Fallback: true,
  favoritesOnly: false,
  excludeTargetSchools: false,
  limitPerLevel: 5,
  sprintMinDifference: -30,
  sprintMaxDifference: -1,
  targetMinDifference: 0,
  targetMaxDifference: 15,
  safeMinDifference: 16,
  safeMaxDifference: null
})

const DEFAULT_SCHOOL_FILTERS = Object.freeze({
  districts: [],
  schoolTypes: [],
  referenceYears: [],
  matchLevels: [],
  targetLevels: [],
  minReferenceScore: null,
  maxReferenceScore: null,
  favoritesOnly: false,
  targetsOnly: false,
  sortBy: 'name'
})

function clone(value) {
  if (value === undefined) return undefined
  return JSON.parse(JSON.stringify(value))
}

function text(value, maxLength = 500) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function optionalInteger(value, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (value === null || value === undefined || value === '') return null
  const number = Number(value)
  return Number.isInteger(number) && number >= min && number <= max ? number : null
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
}

function isoDate(value, fallback) {
  if (typeof value === 'string' && Number.isFinite(Date.parse(value))) {
    return new Date(value).toISOString()
  }
  return fallback
}

function normalizeStringList(value, maxItems = 100, maxLength = 200) {
  return Array.isArray(value)
    ? [...new Set(value.map((item) => text(item, maxLength)).filter(Boolean))].slice(0, maxItems)
    : []
}

function normalizeLegacyExtensions(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  try {
    assertSafeJsonValue(value)
    const cloned = clone(value)
    return unescape(encodeURIComponent(JSON.stringify(cloned))).length <= PRODUCT_RULES.limits.maxLegacyExtensionsBytes
      ? cloned
      : {}
  } catch (error) {
    return {}
  }
}

function collectLegacyExtensions(source, knownKeys) {
  const extensions = normalizeLegacyExtensions(source && source.legacyExtensions)
  const known = new Set([...knownKeys, 'legacyExtensions'])
  for (const key of Object.keys(source || {})) {
    if (!known.has(key)) extensions[key] = clone(source[key])
  }
  return normalizeLegacyExtensions(extensions)
}

function normalizeSubjectConfig(value, index = 0) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const subjectName = text(value.subjectName || value.name, 40)
  const maxScore = optionalInteger(value.maxScore, { min: 1, max: APP_CONFIG.targetScore.max })
  if (!subjectName || maxScore === null) return null
  const subjectId = text(value.subjectId || value.id, 80) ||
    `subject_${subjectName.replace(/\s+/gu, '_')}_${index + 1}`
  const createdAt = isoDate(value.createdAt, new Date(0).toISOString())
  return {
    ...clone(value),
    subjectId,
    subjectName,
    maxScore,
    includedInTotal: value.includedInTotal !== false,
    displayOrder: optionalInteger(value.displayOrder, { min: 0, max: 9999 }) ?? index,
    configVersion: optionalInteger(value.configVersion, { min: 1, max: 9999 }) ?? 1,
    version: optionalInteger(value.version, { min: 1, max: 2147483647 }) ?? 1,
    createdAt,
    updatedAt: isoDate(value.updatedAt, createdAt)
  }
}

function normalizeSubjectScore(value, index = 0) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const config = normalizeSubjectConfig(value, index)
  if (!config) return null
  const score = optionalInteger(value.score, { min: 0, max: config.maxScore })
  if (score === null) return null
  return { ...config, score }
}

function normalizeExamRecord(value, profileId = DEFAULT_PROFILE_ID) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const id = text(value.id, 120)
  const examName = text(value.examName, APP_CONFIG.scoreRecord.examNameMaxLength)
  const examDate = text(value.examDate || value.date, 10)
  const totalMaxScore = optionalInteger(value.totalMaxScore, {
    min: 1,
    max: PRODUCT_RULES.examTotalScoreMax
  }) ?? PRODUCT_RULES.examTotalScoreMax
  const totalScore = optionalInteger(
    value.totalScore === undefined ? value.score : value.totalScore,
    { min: 0, max: totalMaxScore }
  )
  if (!id || !examName || !validDate(examDate) || totalScore === null) return null
  const createdAt = isoDate(value.createdAt, `${examDate}T00:00:00.000Z`)
  const updatedAt = isoDate(value.updatedAt, createdAt)
  const subjectScores = (Array.isArray(value.subjectScores) ? value.subjectScores : [])
    .map(normalizeSubjectScore)
    .filter(Boolean)
    .sort((left, right) => left.displayOrder - right.displayOrder || left.subjectId.localeCompare(right.subjectId))
  const builtInScheme = PRODUCT_RULES.builtInScoreSchemes[0]
  const metricType = PRODUCT_RULES.statusEnums.metricType.includes(value.metricType)
    ? value.metricType
    : 'full_total'
  const admissionScaleMax = optionalInteger(value.admissionScaleMax, {
    min: 1,
    max: PRODUCT_RULES.examTotalScoreMax
  }) ?? (totalMaxScore === PRODUCT_RULES.examTotalScoreMax && metricType === 'full_total'
    ? PRODUCT_RULES.examTotalScoreMax
    : null)
  const scoreSchemeId = text(value.scoreSchemeId, 120) || 'suzhou_admission_740_v1'
  const scoreSchemeName = text(value.scoreSchemeName, 120) || builtInScheme.name
  const eligibilityRuleId = text(value.eligibilityRuleId, 120) ||
    (totalMaxScore === PRODUCT_RULES.examTotalScoreMax && metricType === 'full_total'
      ? 'legacy_740_total'
      : '')
  const scoreSchemeSnapshot = value.scoreSchemeSnapshot && typeof value.scoreSchemeSnapshot === 'object' &&
    !Array.isArray(value.scoreSchemeSnapshot)
    ? clone(value.scoreSchemeSnapshot)
    : {
        ...clone(builtInScheme),
        id: scoreSchemeId,
        name: scoreSchemeName,
        metricType,
        totalMaxScore,
        admissionScaleMax,
        eligibilityRuleId
      }
  return {
    id,
    examName,
    examDate,
    date: examDate,
    createdAt,
    updatedAt,
    totalScore,
    score: totalScore,
    examType: PRODUCT_RULES.examTypes.includes(value.examType) ? value.examType : 'custom',
    scoreSchemeId,
    scoreSchemeName,
    scoreSchemeSnapshot,
    totalMaxScore,
    metricType,
    admissionScaleMax,
    eligibilityRuleId,
    scoreRateBasisPoints: Math.round(totalScore * PRODUCT_RULES.scoreRateBasis / totalMaxScore),
    migrationSource: text(value.migrationSource, 120) || 'legacy_740_total',
    subjectScores,
    classRank: optionalInteger(value.classRank, { min: 1, max: 100000 }),
    gradeRank: optionalInteger(value.gradeRank, { min: 1, max: 100000 }),
    improvementNotes: text(value.improvementNotes, 1000),
    lossNotes: text(value.lossNotes, 1000),
    nextActions: text(value.nextActions, 1000),
    notes: text(value.notes, 1000),
    legacyExtensions: collectLegacyExtensions(value, [
      'id', 'examName', 'examDate', 'date', 'totalScore', 'score', 'createdAt', 'updatedAt',
      'subjectScores', 'classRank', 'gradeRank', 'improvementNotes', 'lossNotes', 'nextActions',
      'notes', 'profileId', 'version', 'schemaVersion', 'examType', 'scoreSchemeId', 'scoreSchemeName',
      'scoreSchemeSnapshot', 'totalMaxScore', 'metricType', 'admissionScaleMax', 'eligibilityRuleId',
      'scoreRateBasisPoints', 'migrationSource'
    ]),
    profileId: text(profileId, 120) || DEFAULT_PROFILE_ID,
    version: optionalInteger(value.version, { min: 1, max: 2147483647 }) ?? 1,
    schemaVersion: STORAGE_SCHEMA_VERSION
  }
}

function normalizeTargetLevel(value) {
  if (value === 'challenge') return 'sprint'
  return ['sprint', 'target', 'safe'].includes(value) ? value : 'target'
}

function normalizeTargetRecord(value, profileId = DEFAULT_PROFILE_ID) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const schoolId = text(value.schoolId, 120)
  const schoolName = text(value.schoolName, 100)
  if (!schoolId || !schoolName) return null
  const createdAt = isoDate(value.createdAt, new Date(0).toISOString())
  return {
    id: text(value.id, 120) || `target_${schoolId}`,
    schoolId,
    schoolName,
    level: normalizeTargetLevel(value.level || value.targetLevel),
    referenceScore: optionalInteger(value.referenceScore, { min: 0, max: APP_CONFIG.targetScore.max }),
    referenceYear: optionalInteger(value.referenceYear, { min: 2000, max: 2200 }),
    createdAt,
    updatedAt: isoDate(value.updatedAt, createdAt),
    profileId: text(profileId, 120) || DEFAULT_PROFILE_ID,
    version: optionalInteger(value.version, { min: 1, max: 2147483647 }) ?? 1,
    schemaVersion: STORAGE_SCHEMA_VERSION
  }
}

function normalizeTargetSubject(value, index = 0) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const subjectName = text(value.subjectName || value.name, 40)
  const targetScore = optionalInteger(value.targetScore, { min: 0, max: APP_CONFIG.targetScore.max })
  if (!subjectName || targetScore === null) return null
  return {
    ...clone(value),
    subjectId: text(value.subjectId || value.id, 80) || `subject_target_${index + 1}`,
    subjectName,
    targetScore
  }
}

function normalizeStageGoal(value, profileId = DEFAULT_PROFILE_ID) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const id = text(value.id, 120)
  const title = text(value.title || value.stage, 80)
  if (!id || !title) return null
  const createdAt = isoDate(value.createdAt, new Date(0).toISOString())
  const startDate = validDate(value.startDate) ? value.startDate : ''
  const endDate = validDate(value.endDate) ? value.endDate : ''
  const status = STAGE_GOAL_STATUSES.includes(value.status) ? value.status : 'not_started'
  const targetTotalScore = optionalInteger(
    value.targetTotalScore === undefined ? value.targetScore : value.targetTotalScore,
    { min: 0, max: APP_CONFIG.targetScore.max }
  )
  return {
    id,
    title,
    stage: title,
    startDate,
    endDate,
    targetTotalScore,
    targetScore: targetTotalScore,
    targetSubjects: (Array.isArray(value.targetSubjects) ? value.targetSubjects : [])
      .map(normalizeTargetSubject)
      .filter(Boolean),
    weeklyTasks: normalizeStringList(value.weeklyTasks, 30, 200),
    status,
    statusLabel: STAGE_GOAL_STATUS_LABELS[status],
    isDraft: Boolean(value.isDraft),
    notes: text(value.notes === undefined ? value.note : value.notes, 1000),
    note: text(value.notes === undefined ? value.note : value.notes, 1000),
    createdAt,
    updatedAt: isoDate(value.updatedAt, createdAt),
    profileId: text(profileId, 120) || DEFAULT_PROFILE_ID,
    version: optionalInteger(value.version, { min: 1, max: 2147483647 }) ?? 1,
    schemaVersion: STORAGE_SCHEMA_VERSION
  }
}

function normalizeScoreReview(value, profileId = DEFAULT_PROFILE_ID) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const id = text(value.id, 120)
  const examRecordId = text(value.examRecordId, 120)
  if (!id || !examRecordId) return null
  const createdAt = isoDate(value.createdAt, new Date(0).toISOString())
  return {
    id,
    examRecordId,
    reviewId: text(value.reviewId, 120),
    profileId: text(profileId, 120) || DEFAULT_PROFILE_ID,
    summary: text(value.summary, 1000),
    improvementNotes: text(value.improvementNotes, 1000),
    nextActions: text(value.nextActions, 1000),
    createdAt,
    updatedAt: isoDate(value.updatedAt, createdAt),
    version: optionalInteger(value.version, { min: 1, max: 2147483647 }) ?? 1,
    schemaVersion: STORAGE_SCHEMA_VERSION
  }
}

function normalizeScoreLossReason(value, profileId = DEFAULT_PROFILE_ID) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const id = text(value.id, 120)
  const examRecordId = text(value.examRecordId, 120)
  const subjectId = text(value.subjectId, 80)
  const reasonType = text(value.reasonType, 40)
  if (!id || !examRecordId || !subjectId || !LOSS_REASON_TYPES.includes(reasonType)) return null
  const createdAt = isoDate(value.createdAt, new Date(0).toISOString())
  return {
    id,
    examRecordId,
    reviewId: text(value.reviewId, 120),
    profileId: text(profileId, 120) || DEFAULT_PROFILE_ID,
    subjectId,
    subjectName: text(value.subjectName, 40),
    reasonType,
    detail: text(value.detail, 1000),
    improvementAction: text(value.improvementAction, 1000),
    createdAt,
    updatedAt: isoDate(value.updatedAt, createdAt),
    version: optionalInteger(value.version, { min: 1, max: 2147483647 }) ?? 1,
    schemaVersion: STORAGE_SCHEMA_VERSION
  }
}

function normalizeLearningTask(value, profileId = DEFAULT_PROFILE_ID) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const id = text(value.id, 120)
  const title = text(value.title, 120)
  if (!id || !title) return null
  const createdAt = isoDate(value.createdAt, new Date(0).toISOString())
  const status = LEARNING_TASK_STATUSES.includes(value.status) ? value.status : 'not_started'
  const weeklyTarget = optionalInteger(value.weeklyTarget, { min: 1, max: 1000 })
  return {
    id,
    profileId: text(profileId, 120) || DEFAULT_PROFILE_ID,
    title,
    subjectId: text(value.subjectId, 80),
    subjectName: text(value.subjectName, 40),
    sourceExamId: text(value.sourceExamId, 120),
    sourceReviewId: text(value.sourceReviewId, 120),
    sourceLossReasonId: text(value.sourceLossReasonId, 120),
    sourceMistakeRecordId: text(value.sourceMistakeRecordId, 120),
    sourceTitleSnapshot: text(value.sourceTitleSnapshot, 200),
    sourceReasonType: LOSS_REASON_TYPES.includes(value.sourceReasonType)
      ? value.sourceReasonType
      : '',
    stageGoalId: text(value.stageGoalId, 120),
    startDate: validDate(value.startDate) ? value.startDate : '',
    dueDate: validDate(value.dueDate) ? value.dueDate : '',
    weeklyTarget,
    status,
    notes: text(value.notes, 1000),
    createdAt,
    updatedAt: isoDate(value.updatedAt, createdAt),
    version: optionalInteger(value.version, { min: 1, max: 2147483647 }) ?? 1,
    schemaVersion: STORAGE_SCHEMA_VERSION
  }
}

function normalizeExamTemplate(value, profileId = DEFAULT_PROFILE_ID) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const id = text(value.id, 120)
  const name = text(value.name, 80)
  if (!id || !name) return null
  const createdAt = isoDate(value.createdAt, new Date(0).toISOString())
  return {
    id,
    profileId: text(profileId, 120) || DEFAULT_PROFILE_ID,
    name,
    examType: PRODUCT_RULES.examTypes.includes(value.examType) ? value.examType : 'custom',
    defaultExamName: text(value.defaultExamName, 80),
    scoreSchemeId: text(value.scoreSchemeId, 120),
    enableSubjectScores: value.enableSubjectScores !== false,
    enableRank: value.enableRank !== false,
    enableReview: value.enableReview !== false,
    displayOrder: optionalInteger(value.displayOrder, { min: 0, max: 9999 }) ?? 0,
    isBuiltIn: false,
    createdAt,
    updatedAt: isoDate(value.updatedAt, createdAt),
    version: optionalInteger(value.version, { min: 1, max: 2147483647 }) ?? 1,
    schemaVersion: STORAGE_SCHEMA_VERSION
  }
}

function normalizeScoreScheme(value, profileId = DEFAULT_PROFILE_ID) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const id = text(value.id, 120)
  const name = text(value.name, 80)
  const metricType = PRODUCT_RULES.statusEnums.metricType.includes(value.metricType)
    ? value.metricType
    : ''
  const totalMaxScore = optionalInteger(value.totalMaxScore, { min: 1, max: PRODUCT_RULES.examTotalScoreMax })
  if (!id || !name || !metricType || totalMaxScore === null) return null
  const createdAt = isoDate(value.createdAt, new Date(0).toISOString())
  return {
    id,
    profileId: text(profileId, 120) || DEFAULT_PROFILE_ID,
    name,
    metricType,
    subjectRules: (Array.isArray(value.subjectRules) ? value.subjectRules : [])
      .map((item, index) => normalizeSubjectConfig(item, index))
      .filter(Boolean),
    totalMaxScore,
    admissionScaleMax: optionalInteger(value.admissionScaleMax, { min: 1, max: PRODUCT_RULES.examTotalScoreMax }),
    eligibilityRuleId: text(value.eligibilityRuleId, 120),
    isBuiltIn: false,
    createdAt,
    updatedAt: isoDate(value.updatedAt, createdAt),
    version: optionalInteger(value.version, { min: 1, max: 2147483647 }) ?? 1,
    schemaVersion: STORAGE_SCHEMA_VERSION
  }
}

function normalizeMistakeRecord(value, profileId = DEFAULT_PROFILE_ID) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const id = text(value.id, 120)
  if (!id) return null
  const createdAt = isoDate(value.createdAt, new Date(0).toISOString())
  return {
    id,
    profileId: text(profileId, 120) || DEFAULT_PROFILE_ID,
    examRecordId: text(value.examRecordId, 120),
    reviewId: text(value.reviewId, 120),
    subjectId: text(value.subjectId, 80),
    subjectName: text(value.subjectName, 40),
    questionType: text(value.questionType, 80),
    knowledgePoint: text(value.knowledgePoint, 200),
    lostScore: optionalInteger(value.lostScore, { min: 0, max: PRODUCT_RULES.examTotalScoreMax }) ?? 0,
    reasonType: text(value.reasonType, 40),
    detail: text(value.detail, PRODUCT_RULES.limits.maxNoteLength),
    corrected: Boolean(value.corrected),
    correctedDate: validDate(value.correctedDate) ? value.correctedDate : '',
    repeatedErrorConfirmed: Boolean(value.repeatedErrorConfirmed),
    improvementAction: text(value.improvementAction, PRODUCT_RULES.limits.maxNoteLength),
    linkedTaskIds: normalizeStringList(value.linkedTaskIds, 100, 120),
    notes: text(value.notes, PRODUCT_RULES.limits.maxNoteLength),
    createdAt,
    updatedAt: isoDate(value.updatedAt, createdAt),
    version: optionalInteger(value.version, { min: 1, max: 2147483647 }) ?? 1,
    schemaVersion: STORAGE_SCHEMA_VERSION
  }
}

function normalizeWeeklyPlan(value, profileId = DEFAULT_PROFILE_ID) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const id = text(value.id, 120)
  if (!id || !validDate(value.weekStartDate) || !validDate(value.weekEndDate)) return null
  const createdAt = isoDate(value.createdAt, new Date(0).toISOString())
  return {
    id,
    profileId: text(profileId, 120) || DEFAULT_PROFILE_ID,
    weekStartDate: value.weekStartDate,
    weekEndDate: value.weekEndDate,
    title: text(value.title, 120),
    taskItems: normalizeStringList(value.taskItems, 100, 120),
    notes: text(value.notes, PRODUCT_RULES.limits.maxNoteLength),
    createdAt,
    updatedAt: isoDate(value.updatedAt, createdAt),
    version: optionalInteger(value.version, { min: 1, max: 2147483647 }) ?? 1,
    schemaVersion: STORAGE_SCHEMA_VERSION
  }
}

function normalizeStageReview(value, profileId = DEFAULT_PROFILE_ID) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const id = text(value.id, 120)
  const stageGoalId = text(value.stageGoalId, 120)
  if (!id || !stageGoalId) return null
  const createdAt = isoDate(value.createdAt, new Date(0).toISOString())
  return {
    id,
    profileId: text(profileId, 120) || DEFAULT_PROFILE_ID,
    stageGoalId,
    stageGoalSnapshot: clone(value.stageGoalSnapshot || {}),
    startDataSnapshot: clone(value.startDataSnapshot || {}),
    endDataSnapshot: clone(value.endDataSnapshot || {}),
    taskSummarySnapshot: clone(value.taskSummarySnapshot || {}),
    examSummarySnapshot: clone(value.examSummarySnapshot || {}),
    summary: text(value.summary, PRODUCT_RULES.limits.maxNoteLength),
    createdAt,
    updatedAt: isoDate(value.updatedAt, createdAt),
    version: optionalInteger(value.version, { min: 1, max: 2147483647 }) ?? 1,
    schemaVersion: STORAGE_SCHEMA_VERSION
  }
}

function normalizeSchoolUserState(value, profileId = DEFAULT_PROFILE_ID) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const schoolId = text(value.schoolId, 120)
  if (!schoolId) return null
  const createdAt = isoDate(value.createdAt, new Date(0).toISOString())
  return {
    id: text(value.id, 120) || `school_state_${schoolId}`,
    profileId: text(profileId, 120) || DEFAULT_PROFILE_ID,
    schoolId,
    candidateStatus: PRODUCT_RULES.statusEnums.candidateStatus.includes(value.candidateStatus)
      ? value.candidateStatus
      : 'none',
    tags: normalizeStringList(value.tags, 20, 40),
    note: text(value.note, PRODUCT_RULES.limits.maxNoteLength),
    customOrder: optionalInteger(value.customOrder, { min: 0, max: 9999 }) ?? 0,
    createdAt,
    updatedAt: isoDate(value.updatedAt, createdAt),
    version: optionalInteger(value.version, { min: 1, max: 2147483647 }) ?? 1,
    schemaVersion: STORAGE_SCHEMA_VERSION
  }
}

function normalizeScenarioSettings(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const score = (name) => optionalInteger(source[name], {
    min: 0,
    max: APP_CONFIG.targetScore.max
  })
  return {
    ...clone(source),
    currentScore: score('currentScore'),
    stageTargetScore: score('stageTargetScore'),
    finalTargetScore: score('finalTargetScore'),
    targetYear: optionalInteger(source.targetYear, {
      min: APP_CONFIG.countdown.minYear,
      max: APP_CONFIG.countdown.maxYear
    }) ?? APP_CONFIG.countdown.defaultYear,
    districts: normalizeStringList(source.districts, 100, 80),
    schoolTypes: normalizeStringList(source.schoolTypes, 100, 80),
    referenceYears: (Array.isArray(source.referenceYears) ? source.referenceYears : [])
      .map(Number)
      .filter((year) => Number.isInteger(year) && year >= 2000 && year <= 2200)
  }
}

function normalizeRecentHistory(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const entries = (name, limit) => (Array.isArray(source[name]) ? source[name] : [])
    .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
    .map((item) => ({
      ...clone(item),
      id: text(item.id, 240),
      at: isoDate(item.at, new Date(0).toISOString())
    }))
    .filter((item) => item.id)
    .slice(0, limit)
  return {
    viewedSchools: entries('viewedSchools', 20),
    schoolFilters: entries('schoolFilters', 10),
    schoolComparisons: entries('schoolComparisons', 5),
    editedExams: entries('editedExams', 10),
    viewedTargets: entries('viewedTargets', 10),
    usedProfiles: entries('usedProfiles', 5),
    scoreSegments: entries('scoreSegments', 10),
    targetSegments: entries('targetSegments', 10)
  }
}

function normalizeProfile(value, fallbackId = DEFAULT_PROFILE_ID) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const id = text(value.id, 120) || fallbackId
  const createdAt = isoDate(value.createdAt, new Date(0).toISOString())
  return {
    ...clone(value),
    id,
    nickname: text(value.nickname, 40) || '默认档案',
    examYear: optionalInteger(value.examYear, {
      min: APP_CONFIG.countdown.minYear,
      max: APP_CONFIG.countdown.maxYear
    }) ?? APP_CONFIG.countdown.defaultYear,
    currentGrade: text(value.currentGrade, 40),
    favoritesMode: FAVORITES_MODES.includes(value.favoritesMode) ? value.favoritesMode : 'independent',
    createdAt,
    updatedAt: isoDate(value.updatedAt, createdAt),
    lastUsedAt: isoDate(value.lastUsedAt, createdAt),
    version: optionalInteger(value.version, { min: 1, max: 2147483647 }) ?? 1,
    schemaVersion: STORAGE_SCHEMA_VERSION
  }
}

function createDefaultProfile(now = new Date().toISOString()) {
  return normalizeProfile({
    id: DEFAULT_PROFILE_ID,
    nickname: '默认档案',
    examYear: APP_CONFIG.countdown.defaultYear,
    currentGrade: '',
    favoritesMode: 'independent',
    createdAt: now,
    updatedAt: now,
    lastUsedAt: now
  })
}

function normalizeRecommendationSettings(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const limit = optionalInteger(source.limitPerLevel, { min: 1, max: 20 })
  const integerOr = (name, fallback) => {
    const result = optionalInteger(source[name], { min: -740, max: 740 })
    return result === null ? fallback : result
  }
  return {
    ...clone(DEFAULT_RECOMMENDATION_SETTINGS),
    ...clone(source),
    districts: normalizeStringList(source.districts, 100, 80),
    schoolTypes: normalizeStringList(source.schoolTypes, 100, 80),
    referenceYears: (Array.isArray(source.referenceYears) ? source.referenceYears : [])
      .map((value) => value === 'latest' ? 'latest' : Number(value))
      .filter((value) => value === 'latest' ||
        (Number.isInteger(value) && value >= 2000 && value <= 2200)),
    require2026: Boolean(source.require2026),
    allow2025Fallback: source.allow2025Fallback !== false,
    favoritesOnly: Boolean(source.favoritesOnly),
    excludeTargetSchools: Boolean(source.excludeTargetSchools),
    limitPerLevel: limit ?? DEFAULT_RECOMMENDATION_SETTINGS.limitPerLevel,
    sprintMinDifference: integerOr('sprintMinDifference', -30),
    sprintMaxDifference: integerOr('sprintMaxDifference', -1),
    targetMinDifference: integerOr('targetMinDifference', 0),
    targetMaxDifference: integerOr('targetMaxDifference', 15),
    safeMinDifference: integerOr('safeMinDifference', 16),
    safeMaxDifference: source.safeMaxDifference === null || source.safeMaxDifference === undefined
      ? null
      : optionalInteger(source.safeMaxDifference, { min: -740, max: 740 })
  }
}

function normalizeSchoolFilters(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const score = (name) => optionalInteger(source[name], { min: 0, max: APP_CONFIG.targetScore.max })
  return {
    ...clone(DEFAULT_SCHOOL_FILTERS),
    ...clone(source),
    districts: normalizeStringList(source.districts, 100, 80),
    schoolTypes: normalizeStringList(source.schoolTypes, 100, 80),
    referenceYears: (Array.isArray(source.referenceYears) ? source.referenceYears : [])
      .map((value) => value === 'latest' ? 'latest' : Number(value))
      .filter((value) => value === 'latest' ||
        (Number.isInteger(value) && value >= 2000 && value <= 2200)),
    matchLevels: normalizeStringList(source.matchLevels, 3, 20)
      .filter((item) => ['sprint', 'target', 'safe'].includes(item)),
    targetLevels: normalizeStringList(source.targetLevels, 3, 20)
      .filter((item) => ['sprint', 'target', 'safe', 'challenge'].includes(item))
      .map(normalizeTargetLevel),
    minReferenceScore: score('minReferenceScore'),
    maxReferenceScore: score('maxReferenceScore'),
    favoritesOnly: Boolean(source.favoritesOnly),
    targetsOnly: Boolean(source.targetsOnly),
    sortBy: ['name', 'reference_asc', 'reference_desc', 'difference'].includes(source.sortBy)
      ? source.sortBy
      : 'name'
  }
}

function createEmptyProfileData(profileId = DEFAULT_PROFILE_ID) {
  return {
    profileId,
    favoriteSchoolIds: [],
    scoreRecords: [],
    scoreReviews: [],
    scoreLossReasons: [],
    targetRecords: [],
    stageGoals: [],
    learningTasks: [],
    examTemplates: [],
    scoreSchemes: [],
    mistakeRecords: [],
    weeklyPlans: [],
    stageReviews: [],
    schoolUserStates: [],
    recommendationSettings: normalizeRecommendationSettings({}),
    scenarioSettings: normalizeScenarioSettings({}),
    schoolFilters: normalizeSchoolFilters({}),
    comparisonSchoolIds: [],
    recentViewedSchoolIds: [],
    recentHistory: normalizeRecentHistory({}),
    subjectConfigs: [],
    primaryTargetSchoolId: null,
    examYear: APP_CONFIG.countdown.defaultYear,
    targetDraft: {},
    legacyExtensions: {},
    schemaVersion: STORAGE_SCHEMA_VERSION
  }
}

function normalizeProfileData(value, profileId = DEFAULT_PROFILE_ID) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const targetRecords = (Array.isArray(source.targetRecords) ? source.targetRecords : [])
    .map((item) => normalizeTargetRecord(item, profileId))
    .filter(Boolean)
  const seenTargets = new Set()
  const uniqueTargets = targetRecords.filter((item) => {
    if (seenTargets.has(item.schoolId)) return false
    seenTargets.add(item.schoolId)
    return true
  })
  return {
    ...createEmptyProfileData(profileId),
    profileId,
    favoriteSchoolIds: normalizeStringList(source.favoriteSchoolIds, 1000, 120).sort(),
    scoreRecords: (Array.isArray(source.scoreRecords) ? source.scoreRecords : [])
      .map((item) => normalizeExamRecord(item, profileId))
      .filter(Boolean),
    scoreReviews: (Array.isArray(source.scoreReviews) ? source.scoreReviews : [])
      .map((item) => normalizeScoreReview(item, profileId))
      .filter(Boolean),
    scoreLossReasons: (Array.isArray(source.scoreLossReasons) ? source.scoreLossReasons : [])
      .map((item) => normalizeScoreLossReason(item, profileId))
      .filter(Boolean),
    targetRecords: uniqueTargets,
    stageGoals: (Array.isArray(source.stageGoals) ? source.stageGoals : [])
      .map((item) => normalizeStageGoal(item, profileId))
      .filter(Boolean),
    learningTasks: (Array.isArray(source.learningTasks) ? source.learningTasks : [])
      .map((item) => normalizeLearningTask(item, profileId))
      .filter(Boolean),
    examTemplates: (Array.isArray(source.examTemplates) ? source.examTemplates : [])
      .map((item) => normalizeExamTemplate(item, profileId))
      .filter(Boolean),
    scoreSchemes: (Array.isArray(source.scoreSchemes) ? source.scoreSchemes : [])
      .map((item) => normalizeScoreScheme(item, profileId))
      .filter(Boolean),
    mistakeRecords: (Array.isArray(source.mistakeRecords) ? source.mistakeRecords : [])
      .map((item) => normalizeMistakeRecord(item, profileId))
      .filter(Boolean),
    weeklyPlans: (Array.isArray(source.weeklyPlans) ? source.weeklyPlans : [])
      .map((item) => normalizeWeeklyPlan(item, profileId))
      .filter(Boolean),
    stageReviews: (Array.isArray(source.stageReviews) ? source.stageReviews : [])
      .map((item) => normalizeStageReview(item, profileId))
      .filter(Boolean),
    schoolUserStates: (Array.isArray(source.schoolUserStates) ? source.schoolUserStates : [])
      .map((item) => normalizeSchoolUserState(item, profileId))
      .filter(Boolean),
    recommendationSettings: normalizeRecommendationSettings(source.recommendationSettings),
    scenarioSettings: normalizeScenarioSettings(source.scenarioSettings),
    schoolFilters: normalizeSchoolFilters(source.schoolFilters),
    comparisonSchoolIds: normalizeStringList(source.comparisonSchoolIds, 3, 120),
    recentViewedSchoolIds: normalizeStringList(source.recentViewedSchoolIds, 20, 120),
    recentHistory: normalizeRecentHistory(source.recentHistory),
    subjectConfigs: (Array.isArray(source.subjectConfigs) ? source.subjectConfigs : [])
      .map(normalizeSubjectConfig)
      .filter(Boolean),
    primaryTargetSchoolId: text(source.primaryTargetSchoolId, 120) || null,
    examYear: optionalInteger(source.examYear, {
      min: APP_CONFIG.countdown.minYear,
      max: APP_CONFIG.countdown.maxYear
    }) ?? APP_CONFIG.countdown.defaultYear,
    targetDraft: source.targetDraft && typeof source.targetDraft === 'object' && !Array.isArray(source.targetDraft)
      ? clone(source.targetDraft)
      : {},
    legacyExtensions: normalizeLegacyExtensions(source.legacyExtensions),
    schemaVersion: STORAGE_SCHEMA_VERSION
  }
}

module.exports = {
  STORAGE_SCHEMA_VERSION,
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  DEFAULT_PROFILE_ID,
  FAVORITES_MODES,
  STAGE_GOAL_STATUSES,
  STAGE_GOAL_STATUS_LABELS,
  LOSS_REASON_TYPES,
  LEARNING_TASK_STATUSES,
  DEFAULT_RECOMMENDATION_SETTINGS,
  DEFAULT_SCHOOL_FILTERS,
  clone,
  text,
  optionalInteger,
  validDate,
  isoDate,
  normalizeStringList,
  normalizeLegacyExtensions,
  normalizeSubjectConfig,
  normalizeSubjectScore,
  normalizeExamRecord,
  normalizeTargetLevel,
  normalizeTargetRecord,
  normalizeStageGoal,
  normalizeScoreReview,
  normalizeScoreLossReason,
  normalizeLearningTask,
  normalizeExamTemplate,
  normalizeScoreScheme,
  normalizeMistakeRecord,
  normalizeWeeklyPlan,
  normalizeStageReview,
  normalizeSchoolUserState,
  normalizeScenarioSettings,
  normalizeRecentHistory,
  normalizeProfile,
  createDefaultProfile,
  normalizeRecommendationSettings,
  normalizeSchoolFilters,
  createEmptyProfileData,
  normalizeProfileData
}
