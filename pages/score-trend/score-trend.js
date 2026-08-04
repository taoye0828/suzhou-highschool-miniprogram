const { APP_CONFIG, EXAM_TOTAL_SCORE } = require('../../config/app-config')
const {
  STORAGE_SCHEMA_VERSION,
  getScoreRecordsResult,
  saveScoreRecord,
  saveExamWithReview,
  deleteScoreRecord,
  clearScoreRecords,
  getSubjectConfigs,
  saveSubjectConfigs,
  getActiveProfile,
  getDataRevision,
  getScoreReviews,
  saveScoreReview,
  getScoreLossReasons,
  saveScoreLossReason,
  deleteScoreLossReason,
  getLearningTargetRecords,
  saveLearningTask,
  getMistakeRecords,
  saveMistakeRecord,
  deleteMistakeRecord,
  saveMistakeWithTask,
  recordRecentHistory,
  getExamTemplates,
  getScoreSchemes
} = require('../../utils/rc9-storage')
const { LOSS_REASON_TYPES } = require('../../utils/rc9-models')
const { lossReasonStatistics } = require('../../utils/rc10-features')
const { notifyStorageReadResult } = require('../../utils/storage-feedback')
const { onboardingForPage, handleOnboardingAction } = require('../../utils/onboarding')
const { operationOptions } = require('../../utils/operation-context')
const {
  summarizeScoreRecords,
  calculateTrendXPositions,
  calculateChartPoints,
  sortScoreRecords
} = require('../../utils/score-trend')
const {
  analyzeSubject,
  analyzeSubjects,
  roundOne
} = require('../../utils/subject-analysis')
const {
  EXAM_TYPE_LABELS,
  scoreSchemeSnapshot,
  resolveExamScoreSchemeSnapshot,
  formatScoreRate,
  recommendationEligibility
} = require('../../utils/v1-domain')
const { PRODUCT_RULES } = require('../../utils/generated/product-rules')

const CHART_HEIGHT = 280
const CHART_PADDING = 38
const MAX_LAYOUT_RETRIES = 3
const LAYOUT_RETRY_DELAY_MS = 80
const RANK_MAX = 100000
const SCORE_SEGMENTS = ['records', 'trend', 'review']
const EXAM_TYPE_OPTIONS = PRODUCT_RULES.examTypes.map((value) => ({
  value,
  label: EXAM_TYPE_LABELS[value] || value
}))

let recordSequence = 0
let subjectSequence = 0
let lossReasonSequence = 0
let mistakeSequence = 0

function twoDigits(value) {
  return String(value).padStart(2, '0')
}

function localDateLabel(date = new Date()) {
  return `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`
}

function createRecordId() {
  recordSequence = (recordSequence + 1) % 1000000
  return `score_${Date.now()}_${recordSequence}_${Math.random().toString(36).slice(2, 10)}`
}

function createSubjectId() {
  subjectSequence = (subjectSequence + 1) % 1000000
  return `subject_${Date.now()}_${subjectSequence}_${Math.random().toString(36).slice(2, 8)}`
}

function createLossReasonId() {
  lossReasonSequence = (lossReasonSequence + 1) % 1000000
  return `loss_${Date.now()}_${lossReasonSequence}_${Math.random().toString(36).slice(2, 8)}`
}

function createMistakeId() {
  mistakeSequence = (mistakeSequence + 1) % 1000000
  return `mistake_${Date.now()}_${mistakeSequence}_${Math.random().toString(36).slice(2, 8)}`
}

function dateAfter(days) {
  return localDateLabel(new Date(Date.now() + days * 86400000))
}

function validDateLabel(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
}

function scoreValue(record) {
  if (record && Number.isFinite(record.totalScore)) return record.totalScore
  return record && Number.isFinite(record.score) ? record.score : null
}

function examDate(record) {
  return String(record && (record.examDate || record.date) || '')
}

function orderedRecords(records) {
  const sourceById = new Map(
    (Array.isArray(records) ? records : []).map((record) => [record.id, record])
  )
  return sortScoreRecords(records)
    .map((record) => sourceById.get(record.id))
    .filter(Boolean)
}

function displayNumber(value) {
  if (!Number.isFinite(value)) return '—'
  const rounded = roundOne(value)
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

function scoreText(value) {
  return Number.isFinite(value) ? `${displayNumber(value)} 分` : '—'
}

function rankText(value) {
  return Number.isInteger(value) && value > 0 ? `第 ${value} 名` : '未填写'
}

function changeText(value) {
  if (!Number.isFinite(value)) return '暂无上次数据'
  if (value > 0) return `提升 +${displayNumber(value)} 分`
  if (value < 0) return `下降 ${displayNumber(value)} 分`
  return '持平 0 分'
}

function subjectFormFields(subjectConfigs, record, options = {}) {
  const configs = (Array.isArray(subjectConfigs) ? subjectConfigs : [])
    .filter((item) => item && item.subjectId)
    .slice()
    .sort((left, right) => {
      const order = Number(left.displayOrder || 0) - Number(right.displayOrder || 0)
      return order !== 0
        ? order
        : String(left.subjectId).localeCompare(String(right.subjectId))
    })
  const entries = record && Array.isArray(record.subjectScores)
    ? record.subjectScores.filter((item) => item && item.subjectId)
    : []
  const configById = new Map(configs.map((item) => [item.subjectId, item]))
  const entryById = new Map(entries.map((item) => [item.subjectId, item]))
  const ids = new Set()
  const appendId = (subjectId) => {
    if (subjectId) ids.add(subjectId)
  }

  if (options.template && entries.length) {
    entries.forEach((item) => appendId(item.subjectId))
  } else {
    configs.forEach((item) => appendId(item.subjectId))
    entries.forEach((item) => appendId(item.subjectId))
  }

  return Array.from(ids).map((subjectId, index) => {
    const config = configById.get(subjectId)
    const entry = entryById.get(subjectId)
    const source = { ...(config || {}), ...(entry || {}) }
    const maxScore = Number.isFinite(source.maxScore) ? source.maxScore : null
    const savedScore = entry && Number.isFinite(entry.score) ? entry.score : ''
    return {
      subjectId,
      subjectName: String(source.subjectName || source.name || subjectId),
      maxScore,
      maxScoreText: maxScore === null ? '配置上限' : `${maxScore} 分`,
      includedInTotal: source.includedInTotal !== false,
      displayOrder: Number.isInteger(source.displayOrder) ? source.displayOrder : index,
      configVersion: Number.isInteger(source.configVersion) ? source.configVersion : 1,
      scoreInput: options.blankScores ? '' : String(savedScore),
      source
    }
  })
}

function mergeSubjectFormFields(subjectConfigs, currentFields, keepUnconfigured = false) {
  const nextFields = subjectFormFields(subjectConfigs)
  const current = Array.isArray(currentFields) ? currentFields : []
  const currentById = new Map(current.map((item) => [item.subjectId, item]))
  const merged = nextFields.map((item) => {
    const previous = currentById.get(item.subjectId)
    return previous ? { ...item, scoreInput: previous.scoreInput } : item
  })
  const configuredIds = new Set(merged.map((item) => item.subjectId))
  const retained = current.filter((item) => (
    !configuredIds.has(item.subjectId) &&
    (keepUnconfigured || String(item.scoreInput || '').trim())
  ))
  return merged.concat(retained)
}

function defaultScoreScheme(scoreSchemes = []) {
  return scoreSchemes.find((item) => item.id === 'suzhou_admission_740_v1') ||
    scoreSchemes[0] || PRODUCT_RULES.builtInScoreSchemes[0]
}

function scoreSchemeFields(scheme) {
  return (Array.isArray(scheme && scheme.subjectRules) ? scheme.subjectRules : []).map((item, index) => ({
    subjectId: item.subjectId || item.id,
    subjectName: item.subjectName || item.name,
    maxScore: item.maxScore,
    maxScoreText: `${item.maxScore} 分`,
    includedInTotal: item.includedInTotal !== false,
    displayOrder: Number.isInteger(item.displayOrder) ? item.displayOrder : index,
    configVersion: Number.isInteger(item.configVersion) ? item.configVersion : 1,
    scoreInput: '',
    source: item
  })).filter((item) => item.subjectId && item.subjectName && Number.isInteger(item.maxScore))
}

function scoreSchemeFormState(scoreSchemes, schemeId, currentFields = []) {
  const schemes = Array.isArray(scoreSchemes) ? scoreSchemes : []
  const index = Math.max(0, schemes.findIndex((item) => item.id === schemeId))
  const scheme = schemes[index] || defaultScoreScheme(schemes)
  const nextFields = scoreSchemeFields(scheme)
  const currentById = new Map((Array.isArray(currentFields) ? currentFields : [])
    .map((item) => [item.subjectId, item]))
  return {
    scoreSchemeIndex: index,
    selectedScoreSchemeId: scheme.id,
    selectedScoreSchemeName: scheme.name,
    formScoreSchemeSnapshot: scoreSchemeSnapshot(scheme),
    scoreSchemeSelectionChanged: false,
    scoreMax: scheme.totalMaxScore,
    formEnableSubjectScores: true,
    formEnableRank: true,
    formEnableReview: true,
    selectedScoreSchemeSummary: `${scheme.name} · 满分 ${scheme.totalMaxScore}`,
    formSubjectScores: nextFields.map((item) => currentById.has(item.subjectId)
      ? { ...item, scoreInput: currentById.get(item.subjectId).scoreInput }
      : item)
  }
}

function emptyRecordForm(subjectConfigs = [], scoreSchemes = []) {
  const scheme = defaultScoreScheme(scoreSchemes)
  return {
    selectedDate: localDateLabel(),
    examName: '',
    scoreInput: '',
    classRankInput: '',
    gradeRankInput: '',
    improvementNotes: '',
    lossNotes: '',
    nextActions: '',
    notes: '',
    formSubjectScores: scoreSchemeFields(scheme).length
      ? scoreSchemeFields(scheme)
      : subjectFormFields(subjectConfigs),
    examTypeIndex: Math.max(0, EXAM_TYPE_OPTIONS.findIndex((item) => item.value === 'custom')),
    selectedExamTemplateId: '',
    examTemplateIndex: 0,
    scoreSchemeIndex: Math.max(0, scoreSchemes.findIndex((item) => item.id === scheme.id)),
    selectedScoreSchemeId: scheme.id,
    selectedScoreSchemeName: scheme.name,
    selectedScoreSchemeSummary: `${scheme.name} · 满分 ${scheme.totalMaxScore}`,
    scoreMax: scheme.totalMaxScore,
    inputError: '',
    editingRecordId: '',
    templateSourceId: '',
    recordFormModeText: '新增考试',
    recordSaveButtonText: '保存成绩记录',
    showRecordDetails: false,
    recordFormInitialized: true
  }
}

function recordFormFromRecord(record, subjectConfigs, scoreSchemes = []) {
  const schemeIndex = Math.max(0, scoreSchemes.findIndex((item) => item.id === record.scoreSchemeId))
  return {
    selectedDate: examDate(record),
    examName: record.examName || '',
    scoreInput: String(scoreValue(record)),
    classRankInput: Number.isInteger(record.classRank) ? String(record.classRank) : '',
    gradeRankInput: Number.isInteger(record.gradeRank) ? String(record.gradeRank) : '',
    improvementNotes: record.improvementNotes || '',
    lossNotes: record.lossNotes || '',
    nextActions: record.nextActions || '',
    notes: record.notes || '',
    formSubjectScores: subjectFormFields(subjectConfigs, record),
    examTypeIndex: Math.max(0, EXAM_TYPE_OPTIONS.findIndex((item) => item.value === record.examType)),
    selectedExamTemplateId: record.examTemplateId || '',
    examTemplateIndex: 0,
    scoreSchemeIndex: schemeIndex,
    selectedScoreSchemeId: record.scoreSchemeId,
    selectedScoreSchemeName: record.scoreSchemeName,
    formScoreSchemeSnapshot: record.scoreSchemeSnapshot,
    scoreSchemeSelectionChanged: false,
    selectedScoreSchemeSummary: `${record.scoreSchemeName} · 满分 ${record.totalMaxScore}`,
    scoreMax: record.totalMaxScore,
    formEnableSubjectScores: true,
    formEnableRank: true,
    formEnableReview: true,
    inputError: '',
    editingRecordId: record.id,
    templateSourceId: '',
    recordFormModeText: '编辑考试',
    recordSaveButtonText: '保存修改',
    showRecordDetails: true,
    recordFormInitialized: true
  }
}

function templateFormFromRecord(record, subjectConfigs, scoreSchemes = []) {
  const schemeIndex = Math.max(0, scoreSchemes.findIndex((item) => item.id === record.scoreSchemeId))
  return {
    selectedDate: localDateLabel(),
    examName: record.examName || '',
    scoreInput: '',
    classRankInput: '',
    gradeRankInput: '',
    improvementNotes: '',
    lossNotes: '',
    nextActions: '',
    notes: '',
    formSubjectScores: subjectFormFields(subjectConfigs, record, {
      blankScores: true,
      template: true
    }),
    examTypeIndex: Math.max(0, EXAM_TYPE_OPTIONS.findIndex((item) => item.value === record.examType)),
    selectedExamTemplateId: record.examTemplateId || '',
    examTemplateIndex: 0,
    scoreSchemeIndex: schemeIndex,
    selectedScoreSchemeId: record.scoreSchemeId,
    selectedScoreSchemeName: record.scoreSchemeName,
    formScoreSchemeSnapshot: record.scoreSchemeSnapshot,
    scoreSchemeSelectionChanged: false,
    selectedScoreSchemeSummary: `${record.scoreSchemeName} · 满分 ${record.totalMaxScore}`,
    scoreMax: record.totalMaxScore,
    formEnableSubjectScores: true,
    formEnableRank: true,
    formEnableReview: true,
    inputError: '',
    editingRecordId: '',
    templateSourceId: record.id,
    recordFormModeText: '复制为新考试',
    recordSaveButtonText: '另存为新考试',
    showRecordDetails: true,
    recordFormInitialized: true
  }
}

function presentSubjectScores(record) {
  return (Array.isArray(record && record.subjectScores) ? record.subjectScores : [])
    .map((item) => ({
      subjectId: item.subjectId,
      subjectName: item.subjectName || item.subjectId,
      score: item.score,
      scoreText: scoreText(item.score),
      maxScoreText: Number.isFinite(item.maxScore) ? ` / ${item.maxScore}` : ''
    }))
}

function presentRecordCards(records, keyword, dateFilter, expandedRecordId) {
  const normalizedKeyword = String(keyword || '').trim().toLowerCase()
  return (Array.isArray(records) ? records : [])
    .filter((record) => {
      const nameMatches = !normalizedKeyword ||
        String(record.examName || '').toLowerCase().includes(normalizedKeyword)
      const dateMatches = !dateFilter || examDate(record) === dateFilter
      return nameMatches && dateMatches
    })
    .map((record) => {
      const subjects = presentSubjectScores(record)
      const hasReview = Boolean(
        Number.isInteger(record.classRank) ||
        Number.isInteger(record.gradeRank) ||
        record.improvementNotes ||
        record.lossNotes ||
        record.nextActions ||
        record.notes
      )
      return {
        ...record,
        scoreSchemeName: record.metricType === 'single_subject'
          ? '旧版方案（已保留）'
          : record.scoreSchemeName,
        examDate: examDate(record),
        date: examDate(record),
        totalScore: scoreValue(record),
        score: scoreValue(record),
        examTypeLabel: EXAM_TYPE_LABELS[record.examType] || '自定义',
        scoreRateText: formatScoreRate(record.scoreRateBasisPoints),
        eligibility: recommendationEligibility(record),
        subjectScores: subjects,
        classRankText: rankText(record.classRank),
        gradeRankText: rankText(record.gradeRank),
        hasReview,
        isExpanded: expandedRecordId === record.id
      }
    })
}

function subjectTrendItems(points, metric = 'raw') {
  const recentPoints = Array.isArray(points) ? points : []
  return recentPoints.map((point, index) => {
    const previous = index > 0 ? recentPoints[index - 1].score : null
    const delta = previous === null ? null : point.score - previous
    return {
      ...point,
      sequence: index + 1,
      displayDate: point.examDate && point.examDate.length >= 10
        ? point.examDate.slice(5, 10)
        : point.examDate,
      scoreText: metric === 'rate' ? `${Number(point.score).toFixed(2)}%` : scoreText(point.score),
      deltaText: delta === null
        ? '起点'
        : delta > 0
          ? metric === 'rate' ? `+${Number(delta).toFixed(2)}%` : `+${displayNumber(delta)}`
          : metric === 'rate' ? `${Number(delta).toFixed(2)}%` : displayNumber(delta),
      deltaClass: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'
    }
  })
}

function selectedSubjectPresentation(records, subjectConfigs, subjectId, metric = 'raw') {
  if (!subjectId) {
    return {
      selectedSubjectId: '',
      selectedSubjectName: '',
      selectedSubjectMaxText: '',
      subjectHighestText: '—',
      subjectLowestText: '—',
      subjectAverageText: '—',
      subjectChangeText: '暂无上次数据',
      subjectRecentThreeText: '—',
      subjectHistoryAverageText: '—',
      subjectTrendItems: [],
      subjectConclusions: []
    }
  }
  const analysis = analyzeSubject(records, subjectId, subjectConfigs, { metric })
  const stats = analysis.statistics
  const valueText = (value) => metric === 'rate'
    ? Number.isFinite(value) ? `${Number(value).toFixed(2)}%` : '—'
    : scoreText(value)
  const changeValueText = (value) => {
    if (!Number.isFinite(value)) return '暂无上次数据'
    if (metric === 'rate') {
      if (value > 0) return `提升 +${Number(value).toFixed(2)} 个百分点`
      if (value < 0) return `下降 ${Number(value).toFixed(2)} 个百分点`
      return '持平'
    }
    return changeText(value)
  }
  return {
    selectedSubjectId: subjectId,
    selectedSubjectName: analysis.subjectName,
    selectedSubjectMaxText: metric === 'rate'
      ? '按每次考试历史学科满分计算'
      : Number.isFinite(analysis.maxScore)
      ? `配置满分 ${analysis.maxScore} 分`
      : '沿用记录中的学科配置',
    subjectHighestText: valueText(stats.highest),
    subjectLowestText: valueText(stats.lowest),
    subjectAverageText: valueText(stats.average),
    subjectChangeText: changeValueText(stats.recentChange),
    subjectRecentThreeText: valueText(stats.recentThreeAverage),
    subjectHistoryAverageText: valueText(stats.historicalAverage),
    subjectTrendItems: subjectTrendItems(stats.recentPoints, metric),
    subjectConclusions: analysis.conclusions || []
  }
}

function presentSubjects(records, subjectConfigs, requestedSubjectId, metric = 'raw') {
  const overview = analyzeSubjects(records, subjectConfigs, { metric })
  const subjectOptions = overview.subjects.map((item) => ({
    subjectId: item.subjectId,
    label: `${item.subjectName}（${item.statistics.count} 次）`
  }))
  const selectedSubjectIndex = Math.max(
    0,
    subjectOptions.findIndex((item) => item.subjectId === requestedSubjectId)
  )
  const selectedSubjectId = subjectOptions.length
    ? subjectOptions[selectedSubjectIndex].subjectId
    : ''
  const mostVolatile = overview.mostVolatileSubject
  const volatilityText = mostVolatile && mostVolatile.statistics.recentCount >= 2
    ? `${mostVolatile.subjectName}是当前记录中波动最大的科目。`
    : '至少记录同一学科 2 次后可比较波动。'
  return {
    subjectOptions,
    selectedSubjectIndex,
    subjectVolatilityText: volatilityText,
    ...selectedSubjectPresentation(records, subjectConfigs, selectedSubjectId, metric)
  }
}

function emptyReviewDraft() {
  return {
    totalScore: '',
    classRank: '',
    gradeRank: '',
    improvementNotes: '',
    lossNotes: '',
    nextActions: '',
    notes: ''
  }
}

function reviewState(records, subjectConfigs, requestedRecordId) {
  const reviewOptions = records.map((record) => ({
    id: record.id,
    label: `${record.examName} · ${examDate(record)}`
  }))
  const requestedIndex = reviewOptions.findIndex((item) => item.id === requestedRecordId)
  const selectedReviewIndex = requestedIndex >= 0 ? requestedIndex : 0
  const selectedReviewRecordId = reviewOptions.length
    ? reviewOptions[selectedReviewIndex].id
    : ''
  const record = records.find((item) => item.id === selectedReviewRecordId)
  if (!record) {
    return {
      reviewOptions,
      selectedReviewIndex: 0,
      selectedReviewRecordId: '',
      selectedReviewExamName: '',
      selectedReviewExamDate: '',
      reviewScoreMax: EXAM_TOTAL_SCORE,
      reviewDraft: emptyReviewDraft(),
      reviewSubjectScores: [],
      reviewError: ''
    }
  }
  return {
    reviewOptions,
    selectedReviewIndex,
    selectedReviewRecordId,
    selectedReviewExamName: record.examName,
    selectedReviewExamDate: examDate(record),
    reviewScoreMax: record.totalMaxScore || EXAM_TOTAL_SCORE,
    reviewDraft: {
      totalScore: String(scoreValue(record)),
      classRank: Number.isInteger(record.classRank) ? String(record.classRank) : '',
      gradeRank: Number.isInteger(record.gradeRank) ? String(record.gradeRank) : '',
      improvementNotes: record.improvementNotes || '',
      lossNotes: record.lossNotes || '',
      nextActions: record.nextActions || '',
      notes: record.notes || ''
    },
    reviewSubjectScores: subjectFormFields(subjectConfigs, record),
    reviewError: ''
  }
}

function presentRecords(records, options = {}) {
  const summary = summarizeScoreRecords(records, 10, options.trendMetric || 'raw')
  const ascending = orderedRecords(records)
  const descending = ascending.slice().reverse()
  const keyword = options.keyword || ''
  const dateFilter = options.dateFilter || ''
  const expandedRecordId = descending.some((record) => record.id === options.expandedRecordId)
    ? options.expandedRecordId
    : ''
  const recordCards = presentRecordCards(descending, keyword, dateFilter, expandedRecordId)
  return {
    records: descending.map((record) => ({
      id: record.id,
      examName: record.examName,
      examDate: examDate(record),
      version: record.version
    })),
    filteredRecords: recordCards.slice(0, 10),
    filteredRecordCount: recordCards.length,
    expandedRecordId,
    visibleRecords: summary.recentRecords,
    visibleTrendPoints: [],
    highestText: summary.highestText,
    lowestText: summary.lowestText,
    averageText: summary.averageText,
    changeText: summary.changeText,
    changeValueText: summary.changeValueText,
    changeClass: summary.changeClass,
    ...presentSubjects(
      ascending,
      options.subjectConfigs || [],
      options.selectedSubjectId || '',
      options.subjectMetric || 'raw'
    ),
    ...reviewState(
      descending,
      options.subjectConfigs || [],
      options.selectedReviewRecordId || ''
    )
  }
}

Page({
  data: {
    activeSegment: 'records',
    activeProfileId: '',
    activeProfileName: '默认档案',
    dataRevision: 0,
    selectedDate: localDateLabel(),
    examName: '',
    scoreInput: '',
    classRankInput: '',
    gradeRankInput: '',
    improvementNotes: '',
    lossNotes: '',
    nextActions: '',
    notes: '',
    formSubjectScores: [],
    inputError: '',
    editingRecordId: '',
    templateSourceId: '',
    recordFormModeText: '新增考试',
    recordSaveButtonText: '保存成绩记录',
    showRecordDetails: false,
    recordFormInitialized: false,
    examTemplates: [],
    examTemplateOptions: [{ id: '', label: '不使用模板' }],
    examTemplateIndex: 0,
    selectedExamTemplateId: '',
    examTypeOptions: EXAM_TYPE_OPTIONS,
    examTypeIndex: Math.max(0, EXAM_TYPE_OPTIONS.findIndex((item) => item.value === 'custom')),
    scoreSchemes: [],
    scoreSchemeOptions: [{ id: 'suzhou_admission_740_v1', label: '苏州中考 740 分制 · 740 分 · 内置' }],
    scoreSchemeIndex: 0,
    selectedScoreSchemeId: 'suzhou_admission_740_v1',
    selectedScoreSchemeName: '苏州中考 740 分制',
    selectedScoreSchemeSummary: '苏州中考 740 分制 · 满分 740',
    recordKeyword: '',
    recordDateFilter: '',
    expandedRecordId: '',
    records: [],
    filteredRecords: [],
    filteredRecordCount: 0,
    visibleRecords: [],
    visibleTrendPoints: [],
    highestText: '—',
    lowestText: '—',
    averageText: '—',
    changeText: '暂无变化',
    changeValueText: '—',
    changeClass: 'flat',
    maxRecords: APP_CONFIG.scoreRecord.maxRecords,
    scoreMax: EXAM_TOTAL_SCORE,
    trendMetric: 'raw',
    trendMetricOptions: [
      { value: 'raw', label: '原始分' },
      { value: 'rate', label: '得分率' }
    ],
    trendTitle: '总分原始分趋势',
    subjectMetric: 'raw',
    canvasWidth: null,
    subjectConfigs: [],
    subjectConfigNameInput: '',
    subjectConfigMaxInput: '',
    subjectConfigIncludedInTotal: true,
    editingSubjectConfigId: '',
    subjectConfigSaveText: '新增学科配置',
    subjectConfigError: '',
    subjectOptions: [],
    selectedSubjectIndex: 0,
    selectedSubjectId: '',
    selectedSubjectName: '',
    selectedSubjectMaxText: '',
    subjectHighestText: '—',
    subjectLowestText: '—',
    subjectAverageText: '—',
    subjectChangeText: '暂无上次数据',
    subjectRecentThreeText: '—',
    subjectHistoryAverageText: '—',
    subjectTrendItems: [],
    subjectConclusions: [],
    subjectVolatilityText: '至少记录同一学科 2 次后可比较波动。',
    reviewOptions: [],
    selectedReviewIndex: 0,
    selectedReviewRecordId: '',
    selectedReviewExamName: '',
    selectedReviewExamDate: '',
    reviewScoreMax: EXAM_TOTAL_SCORE,
    reviewDraft: emptyReviewDraft(),
    reviewSubjectScores: [],
    reviewError: '',
    lossReasonTypes: LOSS_REASON_TYPES,
    lossReasonTypeIndex: 0,
    lossSubjectOptions: [{ subjectId: 'overall', subjectName: '总分' }],
    lossSubjectIndex: 0,
    lossDetail: '',
    lossImprovementAction: '',
    savedLossReasons: [],
    lossStatistics: { total: 0, types: [], recent: [], mostFrequent: null, reducedTypes: [] },
    taskDueDate: dateAfter(14),
    taskWeeklyTarget: '1',
    taskStageGoals: [{ id: '', title: '暂不关联阶段目标' }],
    taskStageGoalIndex: 0,
    savedMistakes: [],
    editingMistakeId: '',
    editingMistakeVersion: null,
    mistakeQuestionType: '',
    mistakeKnowledgePoint: '',
    mistakeLostScore: '',
    mistakeDetail: '',
    mistakeImprovementAction: '',
    mistakeNotes: '',
    mistakeCorrected: false,
    mistakeRepeatedConfirmed: false,
    onboarding: { visible: false, step: null },
    loading: true,
    saving: false,
    pageError: ''
  },

  onLoad() {
    this._chartDisposed = false
    this._chartDrawToken = 0
    this._chartRetryTimer = null
    const preferredSegment = this.preferredSegment()
    if (preferredSegment !== this.data.activeSegment) {
      this.setData({ activeSegment: preferredSegment })
    }
    this.loadRecords()
    this.syncOnboarding()
  },

  onReady() {
    this.scheduleTrendChartDraw()
  },

  onShow() {
    const preferredSegment = this.preferredSegment()
    if (preferredSegment !== this.data.activeSegment) {
      this.setData({ activeSegment: preferredSegment })
    }
    this.loadRecords()
    this.syncOnboarding()
  },

  onResize() {
    this.scheduleTrendChartDraw()
  },

  onUnload() {
    this._chartDisposed = true
    this._chartDrawToken = (this._chartDrawToken || 0) + 1
    if (this._chartRetryTimer) clearTimeout(this._chartRetryTimer)
    this._chartRetryTimer = null
  },

  preferredSegment() {
    if (typeof getApp !== 'function') return this.data.activeSegment
    try {
      const app = getApp()
      const segment = app && app.globalData && app.globalData.scoreCenterSegment
      return SCORE_SEGMENTS.includes(segment) ? segment : this.data.activeSegment
    } catch (error) {
      return this.data.activeSegment
    }
  },

  rememberSegment(segment) {
    if (typeof getApp !== 'function') return
    try {
      const app = getApp()
      if (app && app.globalData) app.globalData.scoreCenterSegment = segment
    } catch (error) {
      // The page remains usable when no App instance is available in local logic tests.
    }
  },

  selectSegment(event) {
    const segment = event.currentTarget.dataset.segment
    if (!SCORE_SEGMENTS.includes(segment) || segment === this.data.activeSegment) return
    this.rememberSegment(segment)
    recordRecentHistory(
      'scoreSegments',
      { id: segment, segment },
      operationOptions('record_recent_history', `scoreSegments:${segment}`)
    )
    this.setData({ activeSegment: segment }, () => {
      if (segment === 'trend') this.scheduleTrendChartDraw()
    })
  },

  syncOnboarding() {
    let onboarding = onboardingForPage('/pages/score-trend/score-trend')
    if (onboarding.visible && onboarding.step && onboarding.step.title === '记录成绩变化') {
      const hasRecords = getScoreRecordsResult().records.length > 0
      onboarding = {
        ...onboarding,
        step: {
          ...onboarding.step,
          selector: hasRecords ? '.onboarding-score-trend' : '.onboarding-score-form',
          description: hasRecords
            ? '查看总分趋势，考试名称和日期与折线使用同一批记录。'
            : '先记录考试名称、日期和总分，保存后即可查看趋势。'
        }
      }
    }
    const selector = onboarding.step && onboarding.step.selector
    const requiredSegment = onboarding.visible && selector === '.onboarding-score-form'
      ? 'records'
      : onboarding.visible && selector === '.onboarding-score-trend'
        ? 'trend'
        : this.data.activeSegment
    if (requiredSegment !== this.data.activeSegment) this.rememberSegment(requiredSegment)
    this.setData({
      onboarding,
      activeSegment: requiredSegment
    }, () => {
      if (requiredSegment === 'trend') this.scheduleTrendChartDraw()
    })
  },

  onOnboardingAction(event) {
    handleOnboardingAction(event)
    this.syncOnboarding()
  },

  loadRecords(options = {}) {
    const result = getScoreRecordsResult()
    notifyStorageReadResult(this, result)
    const subjectConfigs = getSubjectConfigs()
    const scoreSchemes = getScoreSchemes().filter((item) => item.metricType !== 'single_subject')
    const usableSchemeIds = new Set(scoreSchemes.map((item) => item.id))
    const examTemplates = getExamTemplates().filter((item) => usableSchemeIds.has(item.scoreSchemeId))
    const activeProfile = getActiveProfile()
    const activeProfileId = activeProfile && activeProfile.id || ''
    const allLossReasons = getScoreLossReasons()
    const allMistakes = getMistakeRecords()
    this._scoreRecords = result.records
    const selectedReviewRecordId = options.selectedReviewRecordId === undefined
      ? this.data.selectedReviewRecordId
      : options.selectedReviewRecordId
    const profileChanged = Boolean(
      this.data.activeProfileId &&
      activeProfileId &&
      this.data.activeProfileId !== activeProfileId
    )
    const existingIds = new Set(result.records.map((record) => record.id))
    const shouldResetRecordForm = Boolean(
      options.resetRecordForm ||
      !this.data.recordFormInitialized ||
      profileChanged ||
      (this.data.editingRecordId && !existingIds.has(this.data.editingRecordId))
    )
    const presentation = presentRecords(result.records, {
      keyword: this.data.recordKeyword,
      dateFilter: this.data.recordDateFilter,
      expandedRecordId: this.data.expandedRecordId,
      subjectConfigs,
      selectedSubjectId: this.data.selectedSubjectId,
      selectedReviewRecordId,
      trendMetric: this.data.trendMetric,
      subjectMetric: this.data.subjectMetric
    })
    const effectiveReviewRecordId = presentation.selectedReviewRecordId
    const taskStageGoals = [
      { id: '', title: '暂不关联阶段目标' },
      ...getLearningTargetRecords().map((item) => ({ id: item.id, title: item.title }))
    ]
    const lossSubjectOptions = [
      { subjectId: 'overall', subjectName: '总分' },
      ...presentation.reviewSubjectScores.map((item) => ({
        subjectId: item.subjectId,
        subjectName: item.subjectName
      }))
    ]
    const nextData = {
      ...presentation,
      subjectConfigs,
      examTemplates,
      examTemplateOptions: [
        { id: '', label: '不使用模板' },
        ...examTemplates.map((item) => ({
          id: item.id,
          label: `${item.name}${item.isBuiltIn ? ' · 内置' : ''}`
        }))
      ],
      scoreSchemes,
      scoreSchemeOptions: scoreSchemes.map((item) => ({
        id: item.id,
        label: `${item.name} · ${item.totalMaxScore} 分${item.isBuiltIn ? ' · 内置' : ''}`
      })),
      trendTitle: this.data.trendMetric === 'rate' ? '总分得分率趋势' : '总分原始分趋势',
      activeProfileId,
      activeProfileName: activeProfile && activeProfile.nickname || '默认档案',
      dataRevision: getDataRevision(),
      loading: false,
      pageError: result.ok ? '' : result.message || '本地成绩数据读取失败。'
      ,
      savedLossReasons: allLossReasons.filter((item) => item.examRecordId === effectiveReviewRecordId),
      savedMistakes: allMistakes.filter((item) => item.examRecordId === effectiveReviewRecordId),
      lossStatistics: lossReasonStatistics(allLossReasons, result.records),
      lossSubjectOptions,
      lossSubjectIndex: 0,
      taskStageGoals,
      taskStageGoalIndex: Math.min(this.data.taskStageGoalIndex, taskStageGoals.length - 1)
    }
    if (shouldResetRecordForm) {
      Object.assign(nextData, emptyRecordForm(subjectConfigs, scoreSchemes))
    } else if (options.refreshSubjectFields) {
      nextData.formSubjectScores = mergeSubjectFormFields(
        subjectConfigs,
        this.data.formSubjectScores,
        Boolean(this.data.editingRecordId)
      )
    }
    this.setData(nextData, () => this.scheduleTrendChartDraw())
  },

  beginSaving() {
    if (this.data.saving) return false
    this.setData({ saving: true, pageError: '' })
    return true
  },

  finishSaving() {
    this.setData({ saving: false })
  },

  showMutationError(result, field = 'inputError') {
    const conflict = result && result.code === 'VERSION_CONFLICT'
    if (conflict) this.loadRecords()
    const message = conflict
      ? '成绩数据已在其他页面更新，请确认最新内容后重新保存。'
      : result && result.message || '保存失败，原数据未修改。'
    this.setData({ saving: false, pageError: message, [field]: message })
    wx.showToast({ title: message, icon: 'none' })
  },

  scheduleTrendChartDraw() {
    if (this._chartDisposed) return
    const token = (this._chartDrawToken || 0) + 1
    this._chartDrawToken = token
    if (this._chartRetryTimer) clearTimeout(this._chartRetryTimer)
    this._chartRetryTimer = null
    if (!this.data.visibleRecords.length) {
      if (this.data.visibleTrendPoints.length) this.setData({ visibleTrendPoints: [] })
      return
    }
    this.measureTrendChart(token, 0)
  },

  measureTrendChart(token, retryCount) {
    if (
      this._chartDisposed ||
      token !== this._chartDrawToken ||
      typeof wx.createSelectorQuery !== 'function'
    ) return
    const query = wx.createSelectorQuery()
    query.select('#scoreTrendChart').boundingClientRect()
    query.exec((results) => {
      if (this._chartDisposed || token !== this._chartDrawToken) return
      const measuredWidth = Number(results && results[0] && results[0].width)
      if (!Number.isFinite(measuredWidth) || measuredWidth <= 0) {
        if (retryCount >= MAX_LAYOUT_RETRIES) {
          this._chartRetryTimer = null
          const previousWidth = Number(this.data.canvasWidth)
          if (Number.isFinite(previousWidth) && previousWidth > 0) {
            this.renderTrendCanvas([], previousWidth)
          }
          return
        }
        this._chartRetryTimer = setTimeout(
          () => this.measureTrendChart(token, retryCount + 1),
          LAYOUT_RETRY_DELAY_MS
        )
        return
      }
      const width = Math.round(measuredWidth)
      if (this.data.canvasWidth !== width) {
        this.setData({ canvasWidth: width }, () => this.measureTrendChart(token, retryCount))
        return
      }
      const xPositions = calculateTrendXPositions(
        this.data.visibleRecords.length,
        width,
        CHART_PADDING
      )
      const points = calculateChartPoints(
        this.data.visibleRecords,
        width,
        CHART_HEIGHT,
        CHART_PADDING,
        xPositions
      ).map((point) => ({
        ...point,
        labelStyle: `left: ${point.leftPercent}%; width: ${point.labelWidth}px;`
      }))
      this.setData({ visibleTrendPoints: points }, () => {
        if (token === this._chartDrawToken) this.renderTrendCanvas(points, width)
      })
    })
  },

  renderTrendCanvas(points, width) {
    if (this._chartDisposed || typeof wx.createCanvasContext !== 'function') return
    const context = wx.createCanvasContext('scoreTrendChart', this)
    context.clearRect(0, 0, width, CHART_HEIGHT)
    context.setFillStyle('#f8fbfa')
    context.fillRect(0, 0, width, CHART_HEIGHT)
    if (!points.length) {
      context.draw()
      return
    }
    context.setStrokeStyle('#dbe5e2')
    context.setLineWidth(1)
    for (const y of [38, 106, 174, 242]) {
      context.beginPath()
      context.moveTo(28, y)
      context.lineTo(width - 28, y)
      context.stroke()
    }

    if (points.length > 1) {
      context.setStrokeStyle('#0f766e')
      context.setLineWidth(4)
      context.setLineJoin('round')
      context.setLineCap('round')
      context.beginPath()
      points.forEach((point, index) => {
        if (index === 0) context.moveTo(point.x, point.y)
        else context.lineTo(point.x, point.y)
      })
      context.stroke()
    }

    points.forEach((point) => {
      context.setFillStyle('#0f766e')
      context.beginPath()
      context.arc(point.x, point.y, 7, 0, Math.PI * 2)
      context.fill()
      context.setFillStyle('#0f766e')
      context.setFontSize(20)
      context.setTextAlign('center')
      context.fillText(
        point.trendMetric === 'rate' ? `${Number(point.score).toFixed(2)}%` : String(point.score),
        point.x,
        Math.max(22, point.y - 14)
      )
    })
    context.draw()
  },

  onExamTemplateChange(event) {
    const index = Number(event.detail.value)
    const template = index > 0 ? this.data.examTemplates[index - 1] : null
    if (!template) {
      this.setData({ examTemplateIndex: 0, selectedExamTemplateId: '' })
      return
    }
    const schemeState = scoreSchemeFormState(
      this.data.scoreSchemes,
      template.scoreSchemeId,
      []
    )
    this.setData({
      examTemplateIndex: index,
      selectedExamTemplateId: template.id,
      examTypeIndex: Math.max(0, EXAM_TYPE_OPTIONS.findIndex((item) => item.value === template.examType)),
      examName: template.defaultExamName || template.name,
      showRecordDetails: template.enableRank || template.enableReview,
      formEnableSubjectScores: false,
      formEnableRank: template.enableRank,
      formEnableReview: template.enableReview,
      ...schemeState,
      formScoreSchemeSnapshot: scoreSchemeSnapshot(
        this.data.scoreSchemes.find((item) => item.id === schemeState.selectedScoreSchemeId)
      ),
      scoreSchemeSelectionChanged: true,
      inputError: ''
    })
  },

  openExamSettings() {
    wx.navigateTo({ url: '/pages/exam-settings/exam-settings' })
  },

  onExamTypeChange(event) {
    const examTypeIndex = Number(event.detail.value)
    if (!EXAM_TYPE_OPTIONS[examTypeIndex]) return
    this.setData({ examTypeIndex, selectedExamTemplateId: '', examTemplateIndex: 0, inputError: '' })
  },

  onScoreSchemeChange(event) {
    const scoreSchemeIndex = Number(event.detail.value)
    const scheme = this.data.scoreSchemes[scoreSchemeIndex]
    if (!scheme) return
    this.setData({
      ...scoreSchemeFormState(this.data.scoreSchemes, scheme.id, []),
      formScoreSchemeSnapshot: scoreSchemeSnapshot(scheme),
      scoreSchemeSelectionChanged: true,
      selectedExamTemplateId: '',
      examTemplateIndex: 0,
      inputError: ''
    })
  },

  onTrendMetricChange(event) {
    const metric = event.currentTarget.dataset.metric
    if (!['raw', 'rate'].includes(metric) || metric === this.data.trendMetric) return
    this.setData({ trendMetric: metric }, () => this.loadRecords())
  },

  onSubjectMetricChange(event) {
    const metric = event.currentTarget.dataset.metric
    if (!['raw', 'rate'].includes(metric) || metric === this.data.subjectMetric) return
    this.setData({ subjectMetric: metric }, () => this.loadRecords())
  },

  onDateChange(event) {
    this.setData({ selectedDate: event.detail.value, inputError: '' })
  },

  onExamNameInput(event) {
    this.setData({ examName: event.detail.value, inputError: '' })
  },

  onScoreInput(event) {
    this.setData({ scoreInput: event.detail.value, inputError: '' })
  },

  onRankInput(event) {
    const field = event.currentTarget.dataset.field
    if (!['classRankInput', 'gradeRankInput'].includes(field)) return
    this.setData({ [field]: event.detail.value, inputError: '' })
  },

  onReviewNoteInput(event) {
    const field = event.currentTarget.dataset.field
    if (!['improvementNotes', 'lossNotes', 'nextActions', 'notes'].includes(field)) return
    this.setData({ [field]: event.detail.value, inputError: '' })
  },

  onSubjectScoreInput(event) {
    const subjectId = event.currentTarget.dataset.subjectId
    const formSubjectScores = this.data.formSubjectScores.map((item) => (
      item.subjectId === subjectId
        ? { ...item, scoreInput: event.detail.value }
        : item
    ))
    this.setData({ formSubjectScores, inputError: '' })
  },

  toggleRecordDetails() {
    this.setData({ showRecordDetails: !this.data.showRecordDetails })
  },

  onSubjectConfigInput(event) {
    const field = event.currentTarget.dataset.field
    if (field === 'subjectName') {
      this.setData({
        subjectConfigNameInput: event.detail.value,
        subjectConfigError: ''
      })
    } else if (field === 'maxScore') {
      this.setData({
        subjectConfigMaxInput: event.detail.value,
        subjectConfigError: ''
      })
    }
  },

  onSubjectIncludedChange(event) {
    this.setData({
      subjectConfigIncludedInTotal: Boolean(event.detail.value),
      subjectConfigError: ''
    })
  },

  editSubjectConfig(event) {
    const subjectId = event.currentTarget.dataset.subjectId
    const config = this.data.subjectConfigs.find((item) => item.subjectId === subjectId)
    if (!config) return
    this.setData({
      subjectConfigNameInput: config.subjectName,
      subjectConfigMaxInput: String(config.maxScore),
      subjectConfigIncludedInTotal: config.includedInTotal !== false,
      editingSubjectConfigId: config.subjectId,
      subjectConfigSaveText: '保存学科配置',
      subjectConfigError: '',
      showRecordDetails: true
    })
  },

  cancelSubjectConfigEdit() {
    this.setData({
      subjectConfigNameInput: '',
      subjectConfigMaxInput: '',
      subjectConfigIncludedInTotal: true,
      editingSubjectConfigId: '',
      subjectConfigSaveText: '新增学科配置',
      subjectConfigError: ''
    })
  },

  saveSubjectConfig() {
    const subjectName = String(this.data.subjectConfigNameInput || '').trim()
    const rawMaxScore = String(this.data.subjectConfigMaxInput || '').trim()
    const maxScore = Number(rawMaxScore)
    if (!subjectName || subjectName.length > 40) {
      this.setData({ subjectConfigError: '学科名称需填写 1 至 40 个字符。' })
      return
    }
    if (
      !/^\d+$/.test(rawMaxScore) ||
      !Number.isInteger(maxScore) ||
      maxScore < 1 ||
      maxScore > EXAM_TOTAL_SCORE
    ) {
      this.setData({
        subjectConfigError: `学科满分需填写 1 至 ${EXAM_TOTAL_SCORE} 的整数。`
      })
      return
    }
    const editingId = this.data.editingSubjectConfigId
    const duplicate = this.data.subjectConfigs.find((item) => (
      item.subjectId !== editingId &&
      String(item.subjectName || '').trim().toLowerCase() === subjectName.toLowerCase()
    ))
    if (duplicate) {
      this.setData({ subjectConfigError: '已存在同名学科，请直接编辑原配置。' })
      return
    }
    const original = this.data.subjectConfigs.find((item) => item.subjectId === editingId)
    if (editingId && !original) {
      this.setData({ subjectConfigError: '原学科配置已变化，请刷新后重试。' })
      return
    }
    const recordedHighest = editingId
      ? (this._scoreRecords || []).reduce((highest, record) => {
          const score = (Array.isArray(record.subjectScores) ? record.subjectScores : [])
            .filter((item) => item.subjectId === editingId && Number.isFinite(item.score))
            .reduce((value, item) => Math.max(value, item.score), -1)
          return Math.max(highest, score)
        }, -1)
      : -1
    if (recordedHighest > maxScore) {
      this.setData({
        subjectConfigError: `满分不能低于该学科已有最高成绩 ${recordedHighest} 分。`
      })
      return
    }
    const nowOrder = this.data.subjectConfigs.reduce(
      (highest, item) => Math.max(highest, Number(item.displayOrder) || 0),
      -1
    ) + 1
    const savedConfig = {
      ...(original || {}),
      subjectId: original ? original.subjectId : createSubjectId(),
      subjectName,
      maxScore,
      includedInTotal: this.data.subjectConfigIncludedInTotal,
      displayOrder: original && Number.isInteger(original.displayOrder)
        ? original.displayOrder
        : nowOrder,
      configVersion: original && Number.isInteger(original.configVersion)
        ? original.configVersion + 1
        : 1
    }
    const configs = original
      ? this.data.subjectConfigs.map((item) => (
          item.subjectId === original.subjectId ? savedConfig : item
        ))
      : this.data.subjectConfigs.concat(savedConfig)
    const result = saveSubjectConfigs(
      configs,
      operationOptions('save_subject_configs', 'subjectConfigs')
    )
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    this.cancelSubjectConfigEdit()
    this.loadRecords({ refreshSubjectFields: true })
    wx.showToast({
      title: original ? '学科配置已更新' : '学科配置已新增',
      icon: 'success'
    })
  },

  deleteSubjectConfig(event) {
    const subjectId = event.currentTarget.dataset.subjectId
    const config = this.data.subjectConfigs.find((item) => item.subjectId === subjectId)
    if (!config) return
    wx.showModal({
      title: '删除学科配置',
      content: `删除“${config.subjectName}”后，新考试不再显示该科目；已有考试成绩会保留。`,
      confirmText: '确认删除',
      confirmColor: '#b42318',
      success: (modalResult) => {
        if (!modalResult.confirm) return
        const result = saveSubjectConfigs(
          this.data.subjectConfigs.filter((item) => item.subjectId !== subjectId)
        , operationOptions('save_subject_configs', 'subjectConfigs'))
        if (!result.ok) {
          wx.showToast({ title: result.message, icon: 'none' })
          return
        }
        if (this.data.editingSubjectConfigId === subjectId) {
          this.cancelSubjectConfigEdit()
        }
        this.loadRecords({ refreshSubjectFields: true })
        wx.showToast({ title: '学科配置已删除', icon: 'success' })
      }
    })
  },

  validateRanks(classRankInput, gradeRankInput) {
    const parseRank = (raw, label) => {
      const text = String(raw || '').trim()
      if (!text) return { ok: true, value: null }
      const value = Number(text)
      return /^\d+$/.test(text) &&
        Number.isInteger(value) &&
        value >= 1 &&
        value <= RANK_MAX
        ? { ok: true, value }
        : { ok: false, message: `${label}需填写 1 至 ${RANK_MAX} 的整数，或留空。` }
    }
    const classRank = parseRank(classRankInput, '班级排名')
    if (!classRank.ok) return classRank
    const gradeRank = parseRank(gradeRankInput, '年级排名')
    return gradeRank.ok
      ? { ok: true, classRank: classRank.value, gradeRank: gradeRank.value }
      : gradeRank
  },

  validateSubjectScores(fields) {
    let subjectScores = []
    for (const field of Array.isArray(fields) ? fields : []) {
      const raw = String(field.scoreInput === undefined ? '' : field.scoreInput).trim()
      if (!raw) continue
      const score = Number(raw)
      if (
        !/^\d+$/.test(raw) ||
        !Number.isInteger(score) ||
        score < 0 ||
        !Number.isFinite(field.maxScore) ||
        score > field.maxScore
      ) {
        return {
          ok: false,
          message: `${field.subjectName}需填写 0 至 ${field.maxScoreText} 的整数，或留空。`
        }
      }
      subjectScores = subjectScores.concat({
        ...(field.source || {}),
        subjectId: field.subjectId,
        subjectName: field.subjectName,
        maxScore: field.maxScore,
        includedInTotal: field.includedInTotal !== false,
        displayOrder: field.displayOrder,
        configVersion: field.configVersion,
        score
      })
    }
    return { ok: true, subjectScores }
  },

  validateRecordValues(values) {
    const examName = String(values.examName || '').trim()
    const rawScore = String(values.totalScore || '').trim()
    const totalScore = Number(rawScore)
    const totalMaxScore = Number(values.totalMaxScore)
    if (!examName || examName.length > APP_CONFIG.scoreRecord.examNameMaxLength) {
      return {
        ok: false,
        message: `考试名称需填写 1 至 ${APP_CONFIG.scoreRecord.examNameMaxLength} 个字符。`
      }
    }
    if (!validDateLabel(values.examDate)) {
      return { ok: false, message: '请选择有效的考试日期。' }
    }
    if (
      !/^\d+$/.test(rawScore) ||
      !Number.isInteger(totalScore) ||
      totalScore < 0 ||
      !Number.isInteger(totalMaxScore) ||
      totalMaxScore < 1 ||
      totalMaxScore > EXAM_TOTAL_SCORE ||
      totalScore > totalMaxScore
    ) {
      return { ok: false, message: `成绩必须是 0 至 ${totalMaxScore || EXAM_TOTAL_SCORE} 的整数。` }
    }
    const ranks = this.validateRanks(values.classRank, values.gradeRank)
    if (!ranks.ok) return ranks
    const subjects = this.validateSubjectScores(values.subjectScores)
    if (!subjects.ok) return subjects
    return {
      ok: true,
      examName,
      examDate: values.examDate,
      totalScore,
      totalMaxScore,
      classRank: ranks.classRank,
      gradeRank: ranks.gradeRank,
      subjectScores: subjects.subjectScores,
      improvementNotes: String(values.improvementNotes || '').trim(),
      lossNotes: String(values.lossNotes || '').trim(),
      nextActions: String(values.nextActions || '').trim(),
      notes: String(values.notes || '').trim()
    }
  },

  saveRecord() {
    const values = this.validateRecordValues({
      examName: this.data.examName,
      examDate: this.data.selectedDate,
      totalScore: this.data.scoreInput,
      classRank: this.data.classRankInput,
      gradeRank: this.data.gradeRankInput,
      subjectScores: [],
      improvementNotes: this.data.improvementNotes,
      lossNotes: this.data.lossNotes,
      nextActions: this.data.nextActions,
      notes: this.data.notes,
      totalMaxScore: this.data.scoreMax
    })
    if (!values.ok) {
      this.setData({ inputError: values.message })
      return
    }
    const original = (this._scoreRecords || []).find((record) => record.id === this.data.editingRecordId)
    const selectedScheme = this.data.scoreSchemes.find((item) => item.id === this.data.selectedScoreSchemeId) ||
      defaultScoreScheme(this.data.scoreSchemes)
    const schemeSnapshot = resolveExamScoreSchemeSnapshot({
      originalRecord: original,
      formSnapshot: this.data.formScoreSchemeSnapshot,
      selectedScheme,
      selectionChanged: this.data.scoreSchemeSelectionChanged
    })
    if (!schemeSnapshot) {
      this.setData({ inputError: '分值方案无效，请重新选择。' })
      return
    }
    if (!this.beginSaving()) return
    const examType = EXAM_TYPE_OPTIONS[this.data.examTypeIndex] || EXAM_TYPE_OPTIONS[EXAM_TYPE_OPTIONS.length - 1]
    const now = new Date().toISOString()
    const payload = {
      ...(original || {}),
      schemaVersion: STORAGE_SCHEMA_VERSION,
      id: original ? original.id : createRecordId(),
      examName: values.examName,
      examDate: values.examDate,
      date: values.examDate,
      totalScore: values.totalScore,
      score: values.totalScore,
      totalMaxScore: values.totalMaxScore,
      examType: examType.value,
      examTemplateId: this.data.selectedExamTemplateId,
      scoreSchemeId: schemeSnapshot.id,
      scoreSchemeName: schemeSnapshot.name,
      scoreSchemeSnapshot: schemeSnapshot,
      metricType: schemeSnapshot.metricType,
      admissionScaleMax: schemeSnapshot.admissionScaleMax,
      eligibilityRuleId: schemeSnapshot.eligibilityRuleId,
      migrationSource: original && original.migrationSource || 'v1_user_entry',
      subjectScores: original && Array.isArray(original.subjectScores)
        ? original.subjectScores
        : [],
      classRank: values.classRank,
      gradeRank: values.gradeRank,
      improvementNotes: values.improvementNotes,
      lossNotes: values.lossNotes,
      nextActions: values.nextActions,
      notes: values.notes,
      createdAt: original && original.createdAt || now,
      updatedAt: now
    }
    const result = saveScoreRecord(payload, operationOptions('save_score', payload.id))
    if (!result.ok) {
      this.showMutationError(result)
      return
    }
    this.finishSaving()
    const message = original ? '考试记录已更新' : '成绩记录已保存在本机'
    this.loadRecords({
      resetRecordForm: true,
      selectedReviewRecordId: payload.id
    })
    wx.showToast({ title: message, icon: 'success' })
  },

  editRecord(event) {
    const id = event.currentTarget.dataset.id
    const record = (this._scoreRecords || []).find((item) => item.id === id)
    if (!record) return
    if (record.metricType === 'single_subject') {
      wx.showToast({ title: '旧版考试已保留，V1 暂不支持编辑', icon: 'none' })
      return
    }
    this.rememberSegment('records')
    this.setData({
      activeSegment: 'records',
      ...recordFormFromRecord(record, this.data.subjectConfigs, this.data.scoreSchemes)
    })
  },

  copyRecordTemplate(event) {
    const id = event.currentTarget.dataset.id
    const record = (this._scoreRecords || []).find((item) => item.id === id)
    if (!record) return
    if (record.metricType === 'single_subject') {
      wx.showToast({ title: '旧版考试已保留，V1 暂不支持复制', icon: 'none' })
      return
    }
    this.rememberSegment('records')
    this.setData({
      activeSegment: 'records',
      ...templateFormFromRecord(record, this.data.subjectConfigs, this.data.scoreSchemes)
    })
    wx.showToast({ title: '已复制结构，请确认日期和新成绩', icon: 'none' })
  },

  cancelRecordEdit() {
    this.setData(emptyRecordForm(this.data.subjectConfigs, this.data.scoreSchemes))
  },

  toggleRecordCard(event) {
    const id = event.currentTarget.dataset.id
    const expandedRecordId = this.data.expandedRecordId === id ? '' : id
    this.setData({
      expandedRecordId,
      filteredRecords: presentRecordCards(
        this._scoreRecords || [],
        this.data.recordKeyword,
        this.data.recordDateFilter,
        expandedRecordId
      ).slice(0, 10)
    })
  },

  onRecordKeywordInput(event) {
    const recordKeyword = event.detail.value
    const filteredRecords = presentRecordCards(
      this._scoreRecords || [],
      recordKeyword,
      this.data.recordDateFilter,
      this.data.expandedRecordId
    )
    this.setData({
      recordKeyword,
      filteredRecords: filteredRecords.slice(0, 10),
      filteredRecordCount: filteredRecords.length
    })
  },

  onFilterDateChange(event) {
    const recordDateFilter = event.detail.value
    const filteredRecords = presentRecordCards(
      this._scoreRecords || [],
      this.data.recordKeyword,
      recordDateFilter,
      this.data.expandedRecordId
    )
    this.setData({
      recordDateFilter,
      filteredRecords: filteredRecords.slice(0, 10),
      filteredRecordCount: filteredRecords.length
    })
  },

  clearRecordFilters() {
    const filteredRecords = presentRecordCards(
      this._scoreRecords || [],
      '',
      '',
      this.data.expandedRecordId
    )
    this.setData({
      recordKeyword: '',
      recordDateFilter: '',
      filteredRecords: filteredRecords.slice(0, 10),
      filteredRecordCount: filteredRecords.length
    })
  },

  deleteRecord(event) {
    const id = event.currentTarget.dataset.id
    wx.showModal({
      title: '删除成绩记录',
      content: '删除后仅可通过此前导出的本地备份恢复。',
      confirmText: '确认删除',
      confirmColor: '#b42318',
      success: (modalResult) => {
        if (!modalResult.confirm) return
        const result = deleteScoreRecord(id, operationOptions('delete_score', id))
        if (!result.ok) {
          wx.showToast({ title: result.message, icon: 'none' })
          return
        }
        this.loadRecords({
          resetRecordForm: this.data.editingRecordId === id,
          selectedReviewRecordId: this.data.selectedReviewRecordId === id
            ? ''
            : this.data.selectedReviewRecordId
        })
        wx.showToast({ title: '成绩记录已删除', icon: 'success' })
      }
    })
  },

  clearAllRecords() {
    if (!(this._scoreRecords || []).length) return
    wx.showModal({
      title: '清空全部成绩记录',
      content: '此操作会清空当前学生档案的考试记录，仅可通过此前导出的本地备份恢复。',
      confirmText: '确认清空',
      confirmColor: '#b42318',
      success: (modalResult) => {
        if (!modalResult.confirm) return
        const result = clearScoreRecords(operationOptions('clear_scores', 'scoreRecords'))
        if (!result.ok) {
          wx.showToast({ title: result.message, icon: 'none' })
          return
        }
        this.loadRecords({ resetRecordForm: true, selectedReviewRecordId: '' })
        wx.showToast({ title: '成绩记录已清空', icon: 'success' })
      }
    })
  },

  onSubjectChange(event) {
    const selectedSubjectIndex = Number(event.detail.value)
    const selected = this.data.subjectOptions[selectedSubjectIndex]
    if (!selected) return
    this.setData({
      selectedSubjectIndex,
      ...selectedSubjectPresentation(
        this._scoreRecords || [],
        this.data.subjectConfigs,
        selected.subjectId,
        this.data.subjectMetric
      )
    })
  },

  onReviewExamChange(event) {
    const selectedReviewIndex = Number(event.detail.value)
    const selected = this.data.reviewOptions[selectedReviewIndex]
    if (!selected) return
    const state = reviewState(
      this._scoreRecords || [],
      this.data.subjectConfigs,
      selected.id
    )
    const lossSubjectOptions = [
      { subjectId: 'overall', subjectName: '总分' },
      ...state.reviewSubjectScores.map((item) => ({
        subjectId: item.subjectId,
        subjectName: item.subjectName
      }))
    ]
    this.setData({
      ...state,
      lossSubjectOptions,
      lossSubjectIndex: 0,
      savedLossReasons: getScoreLossReasons().filter((item) => item.examRecordId === selected.id)
      ,
      savedMistakes: getMistakeRecords().filter((item) => item.examRecordId === selected.id),
      editingMistakeId: '',
      editingMistakeVersion: null
    })
  },

  onReviewInput(event) {
    const field = event.currentTarget.dataset.field
    if (!Object.prototype.hasOwnProperty.call(this.data.reviewDraft, field)) return
    this.setData({
      reviewDraft: { ...this.data.reviewDraft, [field]: event.detail.value },
      reviewError: ''
    })
  },

  onReviewSubjectScoreInput(event) {
    const subjectId = event.currentTarget.dataset.subjectId
    const reviewSubjectScores = this.data.reviewSubjectScores.map((item) => (
      item.subjectId === subjectId
        ? { ...item, scoreInput: event.detail.value }
        : item
    ))
    this.setData({ reviewSubjectScores, reviewError: '' })
  },

  saveReview() {
    const record = (this._scoreRecords || []).find(
      (item) => item.id === this.data.selectedReviewRecordId
    )
    if (!record) {
      this.setData({ reviewError: '请选择要复盘的考试。' })
      return
    }
    const values = this.validateRecordValues({
      examName: record.examName,
      examDate: examDate(record),
      totalScore: this.data.reviewDraft.totalScore,
      classRank: this.data.reviewDraft.classRank,
      gradeRank: this.data.reviewDraft.gradeRank,
      subjectScores: [],
      improvementNotes: this.data.reviewDraft.improvementNotes,
      lossNotes: this.data.reviewDraft.lossNotes,
      nextActions: this.data.reviewDraft.nextActions,
      notes: this.data.reviewDraft.notes,
      totalMaxScore: record.totalMaxScore || EXAM_TOTAL_SCORE
    })
    if (!values.ok) {
      this.setData({ reviewError: values.message })
      return
    }
    if (!this.beginSaving()) return
    const currentReview = getScoreReviews().find((item) => item.examRecordId === record.id)
    const examPayload = {
      ...record,
      schemaVersion: STORAGE_SCHEMA_VERSION,
      totalScore: values.totalScore,
      score: values.totalScore,
      subjectScores: Array.isArray(record.subjectScores) ? record.subjectScores : [],
      classRank: values.classRank,
      gradeRank: values.gradeRank,
      improvementNotes: values.improvementNotes,
      lossNotes: values.lossNotes,
      nextActions: values.nextActions,
      notes: values.notes,
      updatedAt: new Date().toISOString()
    }
    const reviewPayload = {
      id: `review_${record.id}`,
      examRecordId: record.id,
      summary: values.lossNotes,
      improvementNotes: values.improvementNotes,
      nextActions: values.nextActions,
      createdAt: record.createdAt,
      updatedAt: new Date().toISOString(),
      expectedVersion: currentReview && currentReview.version
    }
    const result = saveExamWithReview(
      examPayload,
      reviewPayload,
      operationOptions('save_exam_with_review', record.id)
    )
    if (!result.ok) {
      this.showMutationError(result, 'reviewError')
      return
    }
    this.finishSaving()
    this.loadRecords({ selectedReviewRecordId: record.id })
    wx.showToast({ title: '考试复盘已保存', icon: 'success' })
  },

  onLossReasonTypeChange(event) {
    this.setData({ lossReasonTypeIndex: Number(event.detail.value) })
  },

  onLossSubjectChange(event) {
    this.setData({ lossSubjectIndex: Number(event.detail.value) })
  },

  onLossInput(event) {
    const field = event.currentTarget.dataset.field
    if (!['lossDetail', 'lossImprovementAction', 'taskWeeklyTarget'].includes(field)) return
    this.setData({ [field]: event.detail.value })
  },

  onTaskDueDateChange(event) {
    this.setData({ taskDueDate: event.detail.value })
  },

  onTaskStageGoalChange(event) {
    this.setData({ taskStageGoalIndex: Number(event.detail.value) })
  },

  addLossReason() {
    const record = (this._scoreRecords || []).find((item) => item.id === this.data.selectedReviewRecordId)
    const subject = { subjectId: 'overall', subjectName: '总分' }
    const reasonType = this.data.lossReasonTypes[this.data.lossReasonTypeIndex]
    if (!record || !subject || !reasonType) return
    const lossReasonId = createLossReasonId()
    const review = getScoreReviews().find((item) => item.examRecordId === record.id)
    const result = saveScoreLossReason({
      id: lossReasonId,
      examRecordId: record.id,
      reviewId: review && review.id || '',
      subjectId: subject.subjectId,
      subjectName: subject.subjectName,
      reasonType,
      detail: this.data.lossDetail,
      improvementAction: this.data.lossImprovementAction,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, operationOptions('save_loss_reason', lossReasonId))
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    this.setData({ lossDetail: '', lossImprovementAction: '' })
    this.loadRecords({ selectedReviewRecordId: record.id })
  },

  deleteLossReason(event) {
    const id = event.currentTarget.dataset.id
    const result = deleteScoreLossReason(id, operationOptions('delete_loss_reason', id))
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    this.loadRecords({ selectedReviewRecordId: this.data.selectedReviewRecordId })
  },

  createTaskFromLoss(event) {
    const reason = this.data.savedLossReasons.find((item) => item.id === event.currentTarget.dataset.id)
    const weeklyTarget = Number(this.data.taskWeeklyTarget)
    if (!reason || !Number.isInteger(weeklyTarget) || weeklyTarget < 1 || weeklyTarget > 1000) {
      wx.showToast({ title: '请填写 1—1000 的每周次数', icon: 'none' })
      return
    }
    const stageGoal = this.data.taskStageGoals[this.data.taskStageGoalIndex] || this.data.taskStageGoals[0]
    const defaultTitle = `每周完成${reason.reasonType}专项练习并订正`
    wx.showModal({
      title: '创建学习任务',
      content: defaultTitle,
      editable: true,
      confirmText: '保存任务',
      success: (modal) => {
        if (!modal.confirm) return
        const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        const result = saveLearningTask({
          id: taskId,
          title: String(modal.content || defaultTitle).trim(),
          subjectId: reason.subjectId,
          subjectName: reason.subjectName,
          sourceExamId: reason.examRecordId,
          sourceReviewId: reason.reviewId || '',
          sourceLossReasonId: reason.id,
          sourceReasonType: reason.reasonType,
          stageGoalId: stageGoal.id,
          startDate: localDateLabel(),
          dueDate: this.data.taskDueDate,
          weeklyTarget,
          status: 'not_started',
          notes: reason.improvementAction,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }, operationOptions('save_learning_task', taskId))
        if (!result.ok) {
          wx.showToast({ title: result.message, icon: 'none' })
          return
        }
        wx.showToast({ title: '学习任务已创建', icon: 'success' })
      }
    })
  },

  onMistakeInput(event) {
    const field = event.currentTarget.dataset.field
    if (![
      'mistakeQuestionType', 'mistakeKnowledgePoint', 'mistakeLostScore', 'mistakeDetail',
      'mistakeImprovementAction', 'mistakeNotes'
    ].includes(field)) return
    this.setData({ [field]: event.detail.value })
  },

  onMistakeSwitch(event) {
    const field = event.currentTarget.dataset.field
    if (!['mistakeCorrected', 'mistakeRepeatedConfirmed'].includes(field)) return
    this.setData({ [field]: Boolean(event.detail.value) })
  },

  resetMistakeForm() {
    this.setData({
      editingMistakeId: '', editingMistakeVersion: null, mistakeQuestionType: '',
      mistakeKnowledgePoint: '', mistakeLostScore: '', mistakeDetail: '',
      mistakeImprovementAction: '', mistakeNotes: '', mistakeCorrected: false,
      mistakeRepeatedConfirmed: false
    })
  },

  saveMistake() {
    const record = (this._scoreRecords || []).find((item) => item.id === this.data.selectedReviewRecordId)
    const existing = this.data.savedMistakes.find((item) => item.id === this.data.editingMistakeId)
    const subject = existing
      ? {
          subjectId: existing.subjectId || 'overall',
          subjectName: existing.subjectName || '总分'
        }
      : { subjectId: 'overall', subjectName: '总分' }
    const reasonType = this.data.lossReasonTypes[this.data.lossReasonTypeIndex]
    const rawLostScore = String(this.data.mistakeLostScore || '').trim()
    const lostScore = rawLostScore ? Number(rawLostScore) : 0
    if (!record || !subject || !reasonType || !Number.isInteger(lostScore) || lostScore < 0 || lostScore > record.totalMaxScore) {
      wx.showToast({ title: '请检查考试和失分分值', icon: 'none' })
      return
    }
    if (!this.beginSaving()) return
    const now = new Date().toISOString()
    const id = existing && existing.id || createMistakeId()
    const review = getScoreReviews().find((item) => item.examRecordId === record.id)
    const result = saveMistakeRecord({
      ...(existing || {}),
      id,
      examRecordId: record.id,
      reviewId: review && review.id || '',
      subjectId: subject.subjectId,
      subjectName: subject.subjectName,
      questionType: this.data.mistakeQuestionType,
      knowledgePoint: this.data.mistakeKnowledgePoint,
      lostScore,
      reasonType,
      detail: this.data.mistakeDetail,
      corrected: this.data.mistakeCorrected,
      correctedDate: this.data.mistakeCorrected ? localDateLabel() : '',
      repeatedErrorConfirmed: this.data.mistakeRepeatedConfirmed,
      improvementAction: this.data.mistakeImprovementAction,
      notes: this.data.mistakeNotes,
      createdAt: existing && existing.createdAt || now,
      updatedAt: now,
      expectedVersion: this.data.editingMistakeVersion
    }, operationOptions('save_mistake_record', id))
    if (!result.ok) return this.showMutationError(result, 'reviewError')
    this.finishSaving()
    this.resetMistakeForm()
    this.loadRecords({ selectedReviewRecordId: record.id })
  },

  editMistake(event) {
    const item = this.data.savedMistakes.find((mistake) => mistake.id === event.currentTarget.dataset.id)
    if (!item) return
    const subjectIndex = Math.max(0, this.data.lossSubjectOptions.findIndex((subject) => subject.subjectId === item.subjectId))
    const reasonIndex = Math.max(0, this.data.lossReasonTypes.indexOf(item.reasonType))
    this.setData({
      editingMistakeId: item.id,
      editingMistakeVersion: item.version,
      lossSubjectIndex: subjectIndex,
      lossReasonTypeIndex: reasonIndex,
      mistakeQuestionType: item.questionType,
      mistakeKnowledgePoint: item.knowledgePoint,
      mistakeLostScore: String(item.lostScore),
      mistakeDetail: item.detail,
      mistakeImprovementAction: item.improvementAction,
      mistakeNotes: item.notes,
      mistakeCorrected: item.corrected,
      mistakeRepeatedConfirmed: item.repeatedErrorConfirmed
    })
  },

  deleteMistake(event) {
    const id = event.currentTarget.dataset.id
    const result = deleteMistakeRecord(id, operationOptions('delete_mistake_record', id))
    if (!result.ok) return wx.showToast({ title: result.message, icon: 'none' })
    this.resetMistakeForm()
    this.loadRecords({ selectedReviewRecordId: this.data.selectedReviewRecordId })
  },

  createTaskFromMistake(event) {
    const mistake = this.data.savedMistakes.find((item) => item.id === event.currentTarget.dataset.id)
    if (!mistake) return
    const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const stageGoal = this.data.taskStageGoals[this.data.taskStageGoalIndex] || this.data.taskStageGoals[0]
    const now = new Date().toISOString()
    const result = saveMistakeWithTask(mistake, {
      id: taskId,
      title: mistake.improvementAction || `订正并复习${mistake.knowledgePoint || '该错题'}`,
      subjectId: mistake.subjectId,
      subjectName: mistake.subjectName,
      sourceExamId: mistake.examRecordId,
      sourceReviewId: mistake.reviewId,
      sourceTitleSnapshot: `错题 · ${mistake.knowledgePoint || mistake.questionType || '复习任务'}`,
      stageGoalId: stageGoal.id,
      startDate: localDateLabel(),
      dueDate: this.data.taskDueDate,
      weeklyTarget: Number(this.data.taskWeeklyTarget) || 1,
      status: 'not_started',
      createdAt: now,
      updatedAt: now
    }, operationOptions('save_mistake_with_task', mistake.id))
    if (!result.ok) return wx.showToast({ title: result.message, icon: 'none' })
    this.loadRecords({ selectedReviewRecordId: this.data.selectedReviewRecordId })
    wx.showToast({ title: '错题与任务已关联', icon: 'success' })
  }
})
