const { APP_CONFIG, EXAM_TOTAL_SCORE } = require('../../config/app-config')
const {
  STORAGE_SCHEMA_VERSION,
  getScoreRecordsResult,
  saveScoreRecord,
  deleteScoreRecord,
  clearScoreRecords,
  getSubjectConfigs,
  saveSubjectConfigs,
  getActiveProfile,
  getDataRevision
} = require('../../utils/rc9-storage')
const { notifyStorageReadResult } = require('../../utils/storage-feedback')
const { onboardingForPage, handleOnboardingAction } = require('../../utils/onboarding')
const {
  summarizeScoreRecords,
  calculateChartPoints,
  sortScoreRecords
} = require('../../utils/score-trend')
const {
  analyzeSubject,
  analyzeSubjects,
  roundOne
} = require('../../utils/subject-analysis')

const CHART_HEIGHT = 280
const CHART_PADDING = 38
const MAX_LAYOUT_RETRIES = 3
const LAYOUT_RETRY_DELAY_MS = 80
const RANK_MAX = 100000
const SCORE_SEGMENTS = ['records', 'trend', 'review']

let recordSequence = 0
let subjectSequence = 0

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

function emptyRecordForm(subjectConfigs = []) {
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
    formSubjectScores: subjectFormFields(subjectConfigs),
    inputError: '',
    editingRecordId: '',
    templateSourceId: '',
    recordFormModeText: '新增考试',
    recordSaveButtonText: '保存成绩记录',
    showRecordDetails: false,
    recordFormInitialized: true
  }
}

function recordFormFromRecord(record, subjectConfigs) {
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
    inputError: '',
    editingRecordId: record.id,
    templateSourceId: '',
    recordFormModeText: '编辑考试',
    recordSaveButtonText: '保存修改',
    showRecordDetails: true,
    recordFormInitialized: true
  }
}

function templateFormFromRecord(record, subjectConfigs) {
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
        subjects.length ||
        Number.isInteger(record.classRank) ||
        Number.isInteger(record.gradeRank) ||
        record.improvementNotes ||
        record.lossNotes ||
        record.nextActions ||
        record.notes
      )
      return {
        ...record,
        examDate: examDate(record),
        date: examDate(record),
        totalScore: scoreValue(record),
        score: scoreValue(record),
        subjectScores: subjects,
        classRankText: rankText(record.classRank),
        gradeRankText: rankText(record.gradeRank),
        hasReview,
        isExpanded: expandedRecordId === record.id
      }
    })
}

function subjectTrendItems(points) {
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
      scoreText: scoreText(point.score),
      deltaText: delta === null
        ? '起点'
        : delta > 0
          ? `+${displayNumber(delta)}`
          : displayNumber(delta),
      deltaClass: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'
    }
  })
}

function selectedSubjectPresentation(records, subjectConfigs, subjectId) {
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
  const analysis = analyzeSubject(records, subjectId, subjectConfigs)
  const stats = analysis.statistics
  return {
    selectedSubjectId: subjectId,
    selectedSubjectName: analysis.subjectName,
    selectedSubjectMaxText: Number.isFinite(analysis.maxScore)
      ? `配置满分 ${analysis.maxScore} 分`
      : '沿用记录中的学科配置',
    subjectHighestText: scoreText(stats.highest),
    subjectLowestText: scoreText(stats.lowest),
    subjectAverageText: scoreText(stats.average),
    subjectChangeText: changeText(stats.recentChange),
    subjectRecentThreeText: scoreText(stats.recentThreeAverage),
    subjectHistoryAverageText: scoreText(stats.historicalAverage),
    subjectTrendItems: subjectTrendItems(stats.recentPoints),
    subjectConclusions: analysis.conclusions || []
  }
}

function presentSubjects(records, subjectConfigs, requestedSubjectId) {
  const overview = analyzeSubjects(records, subjectConfigs)
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
    ...selectedSubjectPresentation(records, subjectConfigs, selectedSubjectId)
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
  const summary = summarizeScoreRecords(records)
  const ascending = orderedRecords(records)
  const descending = ascending.slice().reverse()
  const keyword = options.keyword || ''
  const dateFilter = options.dateFilter || ''
  const expandedRecordId = descending.some((record) => record.id === options.expandedRecordId)
    ? options.expandedRecordId
    : ''
  return {
    records: descending,
    filteredRecords: presentRecordCards(descending, keyword, dateFilter, expandedRecordId),
    filteredRecordCount: presentRecordCards(descending, keyword, dateFilter, expandedRecordId).length,
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
      options.selectedSubjectId || ''
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
    reviewDraft: emptyReviewDraft(),
    reviewSubjectScores: [],
    reviewError: '',
    onboarding: { visible: false, step: null }
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
    this.setData({ activeSegment: segment }, () => {
      if (segment === 'trend') this.scheduleTrendChartDraw()
    })
  },

  syncOnboarding() {
    const onboarding = onboardingForPage('/pages/score-trend/score-trend')
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
    const activeProfile = getActiveProfile()
    const activeProfileId = activeProfile && activeProfile.id || ''
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
      selectedReviewRecordId: options.selectedReviewRecordId === undefined
        ? this.data.selectedReviewRecordId
        : options.selectedReviewRecordId
    })
    const nextData = {
      ...presentation,
      subjectConfigs,
      activeProfileId,
      activeProfileName: activeProfile && activeProfile.nickname || '默认档案',
      dataRevision: getDataRevision()
    }
    if (shouldResetRecordForm) {
      Object.assign(nextData, emptyRecordForm(subjectConfigs))
    } else if (options.refreshSubjectFields) {
      nextData.formSubjectScores = mergeSubjectFormFields(
        subjectConfigs,
        this.data.formSubjectScores,
        Boolean(this.data.editingRecordId)
      )
    }
    this.setData(nextData, () => this.scheduleTrendChartDraw())
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
      const points = calculateChartPoints(
        this.data.visibleRecords,
        width,
        CHART_HEIGHT,
        CHART_PADDING
      )
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
      context.fillText(String(point.score), point.x, Math.max(22, point.y - 14))
    })
    context.draw()
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
      ? this.data.records.reduce((highest, record) => {
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
    const result = saveSubjectConfigs(configs)
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
        )
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
      totalScore > EXAM_TOTAL_SCORE
    ) {
      return { ok: false, message: `成绩必须是 0 至 ${EXAM_TOTAL_SCORE} 的整数。` }
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
      subjectScores: this.data.formSubjectScores,
      improvementNotes: this.data.improvementNotes,
      lossNotes: this.data.lossNotes,
      nextActions: this.data.nextActions,
      notes: this.data.notes
    })
    if (!values.ok) {
      this.setData({ inputError: values.message })
      return
    }
    const original = this.data.records.find((record) => record.id === this.data.editingRecordId)
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
      subjectScores: values.subjectScores,
      classRank: values.classRank,
      gradeRank: values.gradeRank,
      improvementNotes: values.improvementNotes,
      lossNotes: values.lossNotes,
      nextActions: values.nextActions,
      notes: values.notes,
      createdAt: original && original.createdAt || now,
      updatedAt: now
    }
    const result = saveScoreRecord(payload)
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    const message = original ? '考试记录已更新' : '成绩记录已保存在本机'
    this.loadRecords({
      resetRecordForm: true,
      selectedReviewRecordId: payload.id
    })
    wx.showToast({ title: message, icon: 'success' })
  },

  editRecord(event) {
    const id = event.currentTarget.dataset.id
    const record = this.data.records.find((item) => item.id === id)
    if (!record) return
    this.rememberSegment('records')
    this.setData({
      activeSegment: 'records',
      ...recordFormFromRecord(record, this.data.subjectConfigs)
    })
  },

  copyRecordTemplate(event) {
    const id = event.currentTarget.dataset.id
    const record = this.data.records.find((item) => item.id === id)
    if (!record) return
    this.rememberSegment('records')
    this.setData({
      activeSegment: 'records',
      ...templateFormFromRecord(record, this.data.subjectConfigs)
    })
    wx.showToast({ title: '已复制结构，请确认日期和新成绩', icon: 'none' })
  },

  cancelRecordEdit() {
    this.setData(emptyRecordForm(this.data.subjectConfigs))
  },

  toggleRecordCard(event) {
    const id = event.currentTarget.dataset.id
    const expandedRecordId = this.data.expandedRecordId === id ? '' : id
    this.setData({
      expandedRecordId,
      filteredRecords: presentRecordCards(
        this.data.records,
        this.data.recordKeyword,
        this.data.recordDateFilter,
        expandedRecordId
      )
    })
  },

  onRecordKeywordInput(event) {
    const recordKeyword = event.detail.value
    const filteredRecords = presentRecordCards(
      this.data.records,
      recordKeyword,
      this.data.recordDateFilter,
      this.data.expandedRecordId
    )
    this.setData({
      recordKeyword,
      filteredRecords,
      filteredRecordCount: filteredRecords.length
    })
  },

  onFilterDateChange(event) {
    const recordDateFilter = event.detail.value
    const filteredRecords = presentRecordCards(
      this.data.records,
      this.data.recordKeyword,
      recordDateFilter,
      this.data.expandedRecordId
    )
    this.setData({
      recordDateFilter,
      filteredRecords,
      filteredRecordCount: filteredRecords.length
    })
  },

  clearRecordFilters() {
    const filteredRecords = presentRecordCards(
      this.data.records,
      '',
      '',
      this.data.expandedRecordId
    )
    this.setData({
      recordKeyword: '',
      recordDateFilter: '',
      filteredRecords,
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
        const result = deleteScoreRecord(id)
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
    if (!this.data.records.length) return
    wx.showModal({
      title: '清空全部成绩记录',
      content: '此操作会清空当前学生档案的考试记录，仅可通过此前导出的本地备份恢复。',
      confirmText: '确认清空',
      confirmColor: '#b42318',
      success: (modalResult) => {
        if (!modalResult.confirm) return
        const result = clearScoreRecords()
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
        this.data.records,
        this.data.subjectConfigs,
        selected.subjectId
      )
    })
  },

  onReviewExamChange(event) {
    const selectedReviewIndex = Number(event.detail.value)
    const selected = this.data.reviewOptions[selectedReviewIndex]
    if (!selected) return
    this.setData(reviewState(
      this.data.records,
      this.data.subjectConfigs,
      selected.id
    ))
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
    const record = this.data.records.find(
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
      subjectScores: this.data.reviewSubjectScores,
      improvementNotes: this.data.reviewDraft.improvementNotes,
      lossNotes: this.data.reviewDraft.lossNotes,
      nextActions: this.data.reviewDraft.nextActions,
      notes: this.data.reviewDraft.notes
    })
    if (!values.ok) {
      this.setData({ reviewError: values.message })
      return
    }
    const result = saveScoreRecord({
      ...record,
      schemaVersion: STORAGE_SCHEMA_VERSION,
      totalScore: values.totalScore,
      score: values.totalScore,
      subjectScores: values.subjectScores,
      classRank: values.classRank,
      gradeRank: values.gradeRank,
      improvementNotes: values.improvementNotes,
      lossNotes: values.lossNotes,
      nextActions: values.nextActions,
      notes: values.notes,
      updatedAt: new Date().toISOString()
    })
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    this.loadRecords({ selectedReviewRecordId: record.id })
    wx.showToast({ title: '考试复盘已保存', icon: 'success' })
  }
})
