const { APP_CONFIG, EXAM_TOTAL_SCORE } = require('../../config/app-config')
const {
  getTargetRecordsResult,
  getTargetDraftResult,
  getScoreRecordsResult,
  getExamYearResult,
  getLearningTargetRecordsResult,
  getFavoriteIdsResult,
  setFavorite,
  getPrimaryTargetSchoolId,
  getRecommendationSettings,
  getScenarioSettings,
  saveScenarioSettings,
  getLearningTasks,
  getScoreReviews,
  getScoreLossReasons,
  saveLearningTask,
  deleteLearningTask: removeLearningTask,
  recordRecentHistory,
  getSubjectConfigs,
  saveTargetRecord,
  deleteTargetRecord,
  clearTargetRecords,
  setPrimaryTargetSchool,
  saveTargetDraft,
  saveLearningTargetRecord,
  deleteLearningTargetRecord,
  clearLearningTargetRecords,
  saveRecommendationSettings,
  saveExamYear
} = require('../../utils/storage')
const {
  DEFAULT_RECOMMENDATION_SETTINGS,
  STAGE_GOAL_STATUS_LABELS
} = require('../../utils/rc9-models')
const {
  selectCurrentScore,
  selectReferenceForSchool,
  selectGap,
  selectGapTrajectory,
  formatDifference
} = require('../../utils/planning')
const { analyzeScore } = require('../../utils/score-analysis')
const { scenarioResults, goalProgress } = require('../../utils/rc10-features')
const { notifyStorageReadResult } = require('../../utils/storage-feedback')
const { operationOptions } = require('../../utils/operation-context')
const { schools } = require('../../data/schools')
const { admissionScores } = require('../../data/admission-scores')
const { FORMAL_SCORE_YEARS } = require('../../utils/school')
const { onboardingForPage, handleOnboardingAction } = require('../../utils/onboarding')

const LEVEL_ORDER = ['sprint', 'target', 'safe']
const STATUS_OPTIONS = [
  { value: 'not_started', label: '未开始' },
  { value: 'in_progress', label: '进行中' },
  { value: 'completed', label: '已完成' },
  { value: 'paused', label: '已暂停' }
]
const REFERENCE_YEAR_OPTIONS = [
  { value: 'latest', label: '不晚于目标年份的最新数据' },
  ...FORMAL_SCORE_YEARS.map((year) => ({ value: String(year), label: `只看 ${year} 年` }))
]

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, 'zh-Hans-CN'))
}

function choiceOptions(values, selectedValues) {
  const selected = new Set(Array.isArray(selectedValues) ? selectedValues : [])
  return values.map((value) => ({ value, label: value, checked: selected.has(value) }))
}

function validScoreInput(value, { optional = false } = {}) {
  const raw = String(value === undefined || value === null ? '' : value).trim()
  if (optional && !raw) return { ok: true, value: null, raw: '' }
  const score = Number(raw)
  return /^\d+$/.test(raw) &&
    Number.isInteger(score) &&
    score >= 0 &&
    score <= EXAM_TOTAL_SCORE
    ? { ok: true, value: score, raw }
    : { ok: false, value: null, raw }
}

function formatChange(value) {
  if (!Number.isFinite(value)) return '数据不足'
  if (value > 0) return `提升 ${value} 分`
  if (value < 0) return `下降 ${Math.abs(value)} 分`
  return '持平'
}

function statusIndex(status) {
  return Math.max(0, STATUS_OPTIONS.findIndex((item) => item.value === status))
}

function referenceMode(settings) {
  if (settings.require2026) return String(Math.max(...FORMAL_SCORE_YEARS))
  if (settings.referenceYears.length === 1 && FORMAL_SCORE_YEARS.includes(settings.referenceYears[0])) {
    return String(settings.referenceYears[0])
  }
  return 'latest'
}

function emptyLearningDraft() {
  return {
    id: '',
    title: '',
    startDate: '',
    endDate: '',
    targetTotalScore: '',
    targetSubjects: [],
    weeklyTasksText: '',
    status: 'not_started',
    notes: '',
    createdAt: '',
    isDraft: false
  }
}

function normalizeLearningDraft(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const legacyTitle = source.title === undefined ? source.stage : source.title
  const legacyScore = source.targetTotalScore === undefined ? source.targetScore : source.targetTotalScore
  const targetSubjects = (Array.isArray(source.targetSubjects) ? source.targetSubjects : [])
    .map((item, index) => ({
      clientId: String(item.clientId || item.subjectId || `subject_${Date.now()}_${index}`),
      subjectId: String(item.subjectId || ''),
      subjectName: String(item.subjectName || item.name || ''),
      targetScore: item.targetScore === undefined || item.targetScore === null
        ? ''
        : String(item.targetScore)
    }))
  return {
    ...emptyLearningDraft(),
    id: String(source.id || ''),
    title: String(legacyTitle || ''),
    startDate: String(source.startDate || ''),
    endDate: String(source.endDate || ''),
    targetTotalScore: legacyScore === undefined || legacyScore === null ? '' : String(legacyScore),
    targetSubjects,
    weeklyTasksText: Array.isArray(source.weeklyTasks)
      ? source.weeklyTasks.join('\n')
      : String(source.weeklyTasksText || ''),
    status: STATUS_OPTIONS.some((item) => item.value === source.status)
      ? source.status
      : 'not_started',
    notes: String(source.notes === undefined ? source.note || '' : source.notes),
    createdAt: String(source.createdAt || ''),
    isDraft: Boolean(source.isDraft)
  }
}

function cloneDefaultRecommendationSettings() {
  return {
    ...DEFAULT_RECOMMENDATION_SETTINGS,
    districts: [],
    schoolTypes: [],
    referenceYears: []
  }
}

function recommendationSections(results) {
  return APP_CONFIG.scoreAnalysis.levels.map((level) => ({
    ...level,
    results: results
      .filter((item) => item.level === level.value)
      .map((item) => ({
        ...item,
        differenceClass: item.difference < 0
          ? 'negative'
          : item.difference > 0
            ? 'positive'
            : 'neutral',
        actionText: item.isTargetSchool ? '更新目标等级' : '加入目标'
      }))
  }))
}

function trajectoryPresentation(scoreRecords, reference) {
  const source = selectGapTrajectory(scoreRecords, reference).slice(-10)
  if (!source.length) {
    return {
      visibleTrendPoints: [],
      referenceLineStyle: '',
      plotWidthRpx: 560,
      firstChangeText: '数据不足',
      recentChangeText: '数据不足'
    }
  }
  const referenceScore = Number(reference && (reference.minScore ?? reference.score))
  const values = source.map((item) => item.score)
  if (Number.isFinite(referenceScore)) values.push(referenceScore)
  const minimum = Math.min(...values)
  const maximum = Math.max(...values)
  const range = Math.max(1, maximum - minimum)
  const yFor = (score) => 12 + ((maximum - score) / range) * 68
  const count = source.length
  const visibleTrendPoints = source.map((item, index) => {
    const x = count === 1 ? 50 : index * 100 / (count - 1)
    const y = yFor(item.score)
    return {
      ...item,
      displayIndex: index + 1,
      x,
      y,
      pointStyle: `left:${x.toFixed(4)}%;top:${y.toFixed(4)}%;`,
      scoreStyle: `left:${x.toFixed(4)}%;top:${Math.max(0, y - 13).toFixed(4)}%;`,
      labelStyle: `left:${x.toFixed(4)}%;`,
      shortDate: item.examDate ? item.examDate.slice(5) : '',
      differenceText: formatDifference(item.difference)
    }
  })
  const first = source[0]
  const latest = source[source.length - 1]
  const previous = source.length > 1 ? source[source.length - 2] : null
  return {
    visibleTrendPoints,
    referenceLineStyle: Number.isFinite(referenceScore)
      ? `top:${yFor(referenceScore).toFixed(4)}%;`
      : '',
    plotWidthRpx: Math.max(560, count * 116),
    firstChangeText: formatChange(latest.score - first.score),
    recentChangeText: previous ? formatChange(latest.score - previous.score) : '数据不足'
  }
}

function presentTarget(record, currentScore, targetYear, scoreRecords, primarySchoolId) {
  const level = APP_CONFIG.targetScore.levels.find((item) => item.value === record.level)
  const reference = selectReferenceForSchool(
    record.schoolId,
    targetYear,
    admissionScores
  )
  const gap = selectGap(currentScore, reference)
  const trajectory = trajectoryPresentation(scoreRecords, reference)
  return {
    ...record,
    isPrimary: record.schoolId === primarySchoolId,
    levelLabel: level ? level.label : '目标',
    levelIndex: Math.max(
      0,
      APP_CONFIG.targetScore.levels.findIndex((item) => item.value === record.level)
    ),
    referenceScoreText: Number.isInteger(gap.referenceScore) ? `${gap.referenceScore} 分` : '暂未收录',
    referenceYearText: Number.isInteger(gap.referenceYear) ? `${gap.referenceYear} 年` : '—',
    currentScoreText: Number.isInteger(currentScore) ? `${currentScore} 分` : '尚未记录',
    differenceText: formatDifference(gap.difference),
    differenceClass: gap.difference === null
      ? 'neutral'
      : gap.difference < 0
        ? 'negative'
        : gap.difference > 0
          ? 'positive'
          : 'neutral',
    ...trajectory
  }
}

function latestSubjectScoreMap(scoreRecords) {
  const latest = selectCurrentScore(scoreRecords, {}, { allowDraftFallback: false }).record
  const map = new Map()
  for (const item of latest && Array.isArray(latest.subjectScores) ? latest.subjectScores : []) {
    if (item.subjectId) map.set(`id:${item.subjectId}`, item.score)
    if (item.subjectName) map.set(`name:${item.subjectName}`, item.score)
  }
  return map
}

function presentLearningTarget(record, currentScore, scoreRecords) {
  const subjectScores = latestSubjectScoreMap(scoreRecords)
  const targetSubjects = (Array.isArray(record.targetSubjects) ? record.targetSubjects : [])
    .map((item) => {
      const current = subjectScores.get(`id:${item.subjectId}`) ??
        subjectScores.get(`name:${item.subjectName}`)
      return {
        ...item,
        currentScoreText: Number.isInteger(current) ? `${current} 分` : '尚未记录',
        subjectGapText: Number.isInteger(current)
          ? formatDifference(current - item.targetScore)
          : '待记录该学科成绩'
      }
    })
  const totalDifference = Number.isInteger(currentScore) && Number.isInteger(record.targetTotalScore)
    ? currentScore - record.targetTotalScore
    : null
  return {
    ...record,
    title: record.title || record.stage,
    statusLabel: STAGE_GOAL_STATUS_LABELS[record.status] || '未开始',
    statusIndex: statusIndex(record.status),
    totalTargetText: Number.isInteger(record.targetTotalScore)
      ? `${record.targetTotalScore} 分`
      : '草稿待补充',
    currentScoreText: Number.isInteger(currentScore) ? `${currentScore} 分` : '尚未记录',
    totalGapText: totalDifference === null
      ? '待记录成绩后计算'
      : totalDifference < 0
        ? `距阶段目标还差 ${Math.abs(totalDifference)} 分`
        : totalDifference === 0
          ? '当前成绩与阶段目标持平'
          : `当前成绩高于阶段目标 ${totalDifference} 分`,
    targetSubjects,
    weeklyTasks: Array.isArray(record.weeklyTasks) ? record.weeklyTasks : []
  }
}

function presentLearningTask(task, scoreRecords, scoreReviews, lossReasons) {
  const hasSource = Boolean(
    task.sourceExamId || task.sourceReviewId || task.sourceLossReasonId
  )
  const examExists = !task.sourceExamId || scoreRecords.some(
    (record) => record.id === task.sourceExamId
  )
  const reviewExists = !task.sourceReviewId || scoreReviews.some(
    (review) => review.id === task.sourceReviewId
  )
  const reasonExists = !task.sourceLossReasonId || lossReasons.some(
    (reason) => reason.id === task.sourceLossReasonId
  )
  const sourceAvailable = !hasSource || examExists && reviewExists && reasonExists
  return {
    ...task,
    sourceAvailable,
    sourceStatusText: !hasSource
      ? '手动创建'
      : sourceAvailable
        ? `来源：${task.sourceReasonType || '考试复盘'}`
        : '来源记录已删除，任务继续保留'
  }
}

Page({
  data: {
    activeSegment: 'recommendation',
    segments: [
      { value: 'recommendation', label: '推荐' },
      { value: 'schools', label: '目标学校' },
      { value: 'learning', label: '学习目标' }
    ],
    targetYears: APP_CONFIG.scoreAnalysis.targetYears,
    targetYearIndex: 0,
    scoreMax: EXAM_TOTAL_SCORE,
    recommendationScoreInput: '',
    stageScenarioInput: '',
    finalScenarioInput: '',
    scenarioCards: [],
    scenarioError: '',
    recommendationScoreSource: '',
    hasManualReferenceScore: false,
    recommendationError: '',
    recommendationHasRun: false,
    recommendationCount: 0,
    recommendationSections: recommendationSections([]),
    recommendationSettingsOpen: false,
    recommendationSettings: cloneDefaultRecommendationSettings(),
    districtOptions: [],
    schoolTypeOptions: [],
    referenceYearOptions: REFERENCE_YEAR_OPTIONS,
    referenceYearIndex: 0,
    records: [],
    targetLevels: APP_CONFIG.targetScore.levels,
    currentScoreText: '尚未记录',
    learningDraft: emptyLearningDraft(),
    learningRecords: [],
    learningTasks: [],
    goalProgressSummary: null,
    learningError: '',
    statusOptions: STATUS_OPTIONS,
    onboarding: { visible: false, step: null }
  },

  onLoad(options = {}) {
    const requested = String(options.segment || '')
    if (['recommendation', 'schools', 'learning'].includes(requested)) {
      this.setData({ activeSegment: requested })
    }
  },

  onShow() {
    const app = getApp()
    const requested = app && app.globalData && app.globalData.targetCenterSegment
    if (['recommendation', 'schools', 'learning'].includes(requested)) {
      this.setData({ activeSegment: requested })
      app.globalData.targetCenterSegment = ''
    }
    this.loadAll()
    this.syncOnboarding()
  },

  loadAll() {
    const targetResult = getTargetRecordsResult()
    const scoreResult = getScoreRecordsResult()
    const draftResult = getTargetDraftResult()
    const yearResult = getExamYearResult()
    const learningResult = getLearningTargetRecordsResult()
    const favoriteResult = getFavoriteIdsResult()
    const learningTasks = getLearningTasks()
    const scoreReviews = getScoreReviews()
    const lossReasons = getScoreLossReasons()
    const failedResult = [
      targetResult,
      scoreResult,
      draftResult,
      yearResult,
      learningResult,
      favoriteResult
    ].find((result) => !result.ok)
    notifyStorageReadResult(this, failedResult || targetResult)

    const current = selectCurrentScore(scoreResult.records, draftResult.draft)
    const primarySchoolId = getPrimaryTargetSchoolId()
    const settings = getRecommendationSettings()
    const scenarioSettings = getScenarioSettings()
    const learningDraft = normalizeLearningDraft(
      draftResult.draft.learningGoalDraft ||
      (draftResult.draft.stage || draftResult.draft.targetScore ? draftResult.draft : {})
    )
    const targetYearIndex = Math.max(0, this.data.targetYears.indexOf(yearResult.year))
    const districts = uniqueValues(schools.map((school) => school.district))
    const schoolTypes = uniqueValues(schools.map((school) => school.schoolType))
    const mode = referenceMode(settings)
    const referenceYearIndex = Math.max(
      0,
      REFERENCE_YEAR_OPTIONS.findIndex((item) => item.value === mode)
    )
    this._targetRecords = targetResult.records
    this._scoreRecords = scoreResult.records
    this._learningRecords = learningResult.records
    this._favoriteIds = favoriteResult.ids
    this._learningTasks = learningTasks
    this._subjectConfigs = getSubjectConfigs()
    this._targetYear = yearResult.year

    this.setData({
      targetYearIndex,
      recommendationScoreInput: scenarioSettings.currentScore === null
        ? (current.score === null ? '' : String(current.score))
        : String(scenarioSettings.currentScore),
      stageScenarioInput: scenarioSettings.stageTargetScore === null
        ? ''
        : String(scenarioSettings.stageTargetScore),
      finalScenarioInput: scenarioSettings.finalTargetScore === null
        ? ''
        : String(scenarioSettings.finalTargetScore),
      recommendationScoreSource: scenarioSettings.currentScore !== null &&
        scenarioSettings.currentScore !== current.score
        ? '本次分析使用手动覆盖值，不修改真实成绩'
        : current.source === 'record'
        ? `来自最近一次考试：${current.record.examName}`
        : current.source === 'draft'
          ? '来自上次输入草稿'
          : '尚未记录成绩',
      hasManualReferenceScore: scenarioSettings.currentScore !== null && scenarioSettings.currentScore !== current.score,
      recommendationSettings: settings,
      districtOptions: choiceOptions(districts, settings.districts),
      schoolTypeOptions: choiceOptions(schoolTypes, settings.schoolTypes),
      referenceYearIndex,
      records: targetResult.records
        .map((record) => presentTarget(
          record,
          current.score,
          yearResult.year,
          scoreResult.records,
          primarySchoolId
        ))
        .sort((left, right) => {
          if (left.isPrimary !== right.isPrimary) return left.isPrimary ? -1 : 1
          const levelCompare = LEVEL_ORDER.indexOf(left.level) - LEVEL_ORDER.indexOf(right.level)
          return levelCompare !== 0
            ? levelCompare
            : left.schoolName.localeCompare(right.schoolName, 'zh-Hans-CN')
        }),
      currentScoreText: current.score === null ? '尚未记录' : `${current.score} 分`,
      learningDraft,
      learningRecords: learningResult.records.map((record) =>
        presentLearningTarget(record, current.score, scoreResult.records)
      ),
      learningTasks: learningTasks.map((task) => presentLearningTask(
        task,
        scoreResult.records,
        scoreReviews,
        lossReasons
      )),
      goalProgressSummary: goalProgress(
        learningResult.records,
        learningTasks,
        scoreResult.records
      ),
      learningError: ''
    }, () => {
      this.analyzeRecommendations({ silent: true })
      this.analyzeScenarios({ silent: true })
    })
  },

  selectSegment(event) {
    const segment = event.currentTarget.dataset.segment
    if (!['recommendation', 'schools', 'learning'].includes(segment)) return
    this.setData({ activeSegment: segment })
    recordRecentHistory(
      'targetSegments',
      { id: segment, segment },
      operationOptions('record_recent_history', `targetSegments:${segment}`)
    )
  },

  onRecommendationScoreInput(event) {
    const recommendationScoreInput = event.detail.value
    this.setData({ recommendationScoreInput, recommendationError: '' })
    const existing = getTargetDraftResult().draft
    const result = saveTargetDraft(
      { ...existing, currentScore: recommendationScoreInput },
      operationOptions('save_target_draft', 'targetDraft')
    )
    if (!result.ok) wx.showToast({ title: result.message, icon: 'none' })
  },

  restoreFormalReferenceScore() {
    const current = selectCurrentScore(this._scoreRecords || [], {})
    const next = getScenarioSettings()
    const saved = saveScenarioSettings({ ...next, currentScore: null }, operationOptions('save_scenario_settings', 'scenarioSettings'))
    if (!saved.ok) {
      wx.showToast({ title: saved.message, icon: 'none' })
      return
    }
    this.setData({
      recommendationScoreInput: current.score === null ? '' : String(current.score),
      recommendationScoreSource: current.source === 'record'
        ? `来自最近一次考试：${current.record.examName}`
        : '尚未记录成绩',
      hasManualReferenceScore: false
    }, () => {
      this.analyzeRecommendations({ silent: true })
      this.analyzeScenarios({ silent: true })
    })
  },

  onScenarioScoreInput(event) {
    const field = event.currentTarget.dataset.field
    if (!['stageScenarioInput', 'finalScenarioInput'].includes(field)) return
    this.setData({ [field]: event.detail.value, scenarioError: '' })
  },

  analyzeScenarios(options = {}) {
    const current = validScoreInput(this.data.recommendationScoreInput)
    const stage = validScoreInput(this.data.stageScenarioInput, { optional: true })
    const finalTarget = validScoreInput(this.data.finalScenarioInput, { optional: true })
    if (!current.ok || !stage.ok || !finalTarget.ok) {
      if (!options.silent) this.setData({ scenarioError: `情景成绩必须是 0 至 ${EXAM_TOTAL_SCORE} 的整数，可留空。` })
      return
    }
    const settings = {
      currentScore: current.value,
      stageTargetScore: stage.value,
      finalTargetScore: finalTarget.value,
      targetYear: this._targetYear,
      districts: this.data.recommendationSettings.districts,
      schoolTypes: this.data.recommendationSettings.schoolTypes,
      referenceYears: this.data.recommendationSettings.referenceYears
    }
    const saved = saveScenarioSettings(
      settings,
      operationOptions('save_scenario_settings', 'scenarioSettings')
    )
    if (!saved.ok) {
      if (!options.silent) this.setData({ scenarioError: saved.message })
      return
    }
    try {
      this.setData({
        scenarioCards: scenarioResults(settings, {
          targetRecords: this._targetRecords,
          favoriteIds: this._favoriteIds,
          limitPerLevel: this.data.recommendationSettings.limitPerLevel
        }),
        scenarioError: ''
      })
    } catch (error) {
      if (!options.silent) this.setData({ scenarioError: error.message })
    }
  },

  onTargetYearChange(event) {
    const index = Number(event.detail.value)
    const year = this.data.targetYears[index]
    if (!Number.isInteger(year)) return
    const result = saveExamYear(year, operationOptions('save_exam_year', year))
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    this._targetYear = year
    this.setData({ targetYearIndex: index }, () => this.loadAll())
  },

  toggleRecommendationSettings() {
    this.setData({ recommendationSettingsOpen: !this.data.recommendationSettingsOpen })
  },

  onDistrictChange(event) {
    this.persistRecommendationSettings({
      ...this.data.recommendationSettings,
      districts: event.detail.value
    })
  },

  onSchoolTypeChange(event) {
    this.persistRecommendationSettings({
      ...this.data.recommendationSettings,
      schoolTypes: event.detail.value
    })
  },

  onReferenceYearChange(event) {
    const index = Number(event.detail.value)
    const option = REFERENCE_YEAR_OPTIONS[index] || REFERENCE_YEAR_OPTIONS[0]
    const next = {
      ...this.data.recommendationSettings,
      referenceYears: option.value === 'latest' ? [] : [Number(option.value)],
      require2026: Number(option.value) === Math.max(...FORMAL_SCORE_YEARS)
    }
    this.persistRecommendationSettings(next, { referenceYearIndex: index })
  },

  onRecommendationSwitch(event) {
    const field = event.currentTarget.dataset.field
    if (!['allow2025Fallback', 'favoritesOnly', 'excludeTargetSchools'].includes(field)) return
    this.persistRecommendationSettings({
      ...this.data.recommendationSettings,
      [field]: Boolean(event.detail.value)
    })
  },

  resetRecommendationSettings() {
    const settings = cloneDefaultRecommendationSettings()
    const result = saveRecommendationSettings(
      settings,
      operationOptions('save_recommendation_settings', 'recommendationSettings')
    )
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    wx.showToast({ title: '已恢复默认参考设置', icon: 'success' })
    this.loadAll()
  },

  persistRecommendationSettings(settings, extraData = {}) {
    const result = saveRecommendationSettings(
      settings,
      operationOptions('save_recommendation_settings', 'recommendationSettings')
    )
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    const saved = getRecommendationSettings()
    this.setData({
      ...extraData,
      recommendationSettings: saved,
      districtOptions: choiceOptions(
        uniqueValues(schools.map((school) => school.district)),
        saved.districts
      ),
      schoolTypeOptions: choiceOptions(
        uniqueValues(schools.map((school) => school.schoolType)),
        saved.schoolTypes
      )
    }, () => this.analyzeRecommendations({ silent: true }))
  },

  analyzeRecommendations({ silent = false } = {}) {
    const scoreResult = validScoreInput(this.data.recommendationScoreInput)
    if (!scoreResult.ok) {
      this.setData({
        recommendationError: `当前成绩必须是 0 至 ${EXAM_TOTAL_SCORE} 的整数。`,
        recommendationHasRun: false,
        recommendationCount: 0,
        recommendationSections: recommendationSections([])
      })
      if (!silent) wx.showToast({ title: '请先填写有效成绩。', icon: 'none' })
      return
    }
    const settings = this.data.recommendationSettings
    const exactYear = settings.referenceYears.length === 1
      ? settings.referenceYears[0]
      : undefined
    const results = analyzeScore({
      userScore: scoreResult.value,
      targetYear: this.data.targetYears[this.data.targetYearIndex],
      targetRecords: this._targetRecords || [],
      favoriteIds: this._favoriteIds || [],
      settings,
      referenceYear: exactYear
    })
    this.setData({
      recommendationError: '',
      recommendationHasRun: true,
      recommendationCount: results.length,
      recommendationSections: recommendationSections(results)
    })
  },

  addRecommendationTarget(event) {
    const schoolId = event.currentTarget.dataset.schoolId
    const item = this.data.recommendationSections
      .flatMap((section) => section.results)
      .find((candidate) => candidate.schoolId === schoolId)
    if (!item) return
    const result = saveTargetRecord({
      id: `target_${item.schoolId}`,
      schoolId: item.schoolId,
      schoolName: item.schoolName,
      level: item.level,
      referenceScore: item.schoolScore,
      referenceYear: item.year,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, operationOptions('save_target', item.schoolId))
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    wx.showToast({
      title: item.isTargetSchool ? '目标等级已更新' : '已加入目标',
      icon: 'success'
    })
    this.loadAll()
  },

  addScenarioTarget(event) {
    const schoolId = event.currentTarget.dataset.schoolId
    const scenarioKey = event.currentTarget.dataset.scenarioKey
    const item = this.data.scenarioCards
      .filter((scenario) => scenario.key === scenarioKey)
      .flatMap((scenario) => scenario.results)
      .find((candidate) => candidate.schoolId === schoolId)
    if (!item) return
    const result = saveTargetRecord({
      id: `target_${item.schoolId}`,
      schoolId: item.schoolId,
      schoolName: item.schoolName,
      level: item.level,
      referenceScore: item.schoolScore,
      referenceYear: item.year,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, operationOptions('save_target', item.schoolId))
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    this.loadAll()
  },

  toggleScenarioFavorite(event) {
    const schoolId = event.currentTarget.dataset.schoolId
    const nextValue = !this._favoriteIds.includes(schoolId)
    const result = setFavorite(
      schoolId,
      nextValue,
      operationOptions('set_favorite', schoolId)
    )
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    this.loadAll()
  },

  setPrimaryTarget(event) {
    const schoolId = event.currentTarget.dataset.schoolId
    const result = setPrimaryTargetSchool(
      schoolId,
      operationOptions('set_primary_target', schoolId)
    )
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    wx.showToast({ title: '已设为主要目标', icon: 'success' })
    this.loadAll()
  },

  onLevelChange(event) {
    const record = (this._targetRecords || []).find(
      (item) => item.id === event.currentTarget.dataset.id
    )
    const level = this.data.targetLevels[Number(event.detail.value)]
    if (!record || !level) {
      wx.showToast({ title: '目标等级无效，请重试。', icon: 'none' })
      return
    }
    const result = saveTargetRecord(
      { ...record, level: level.value },
      operationOptions('save_target', record.id)
    )
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    wx.showToast({ title: '目标等级已更新', icon: 'success' })
    this.loadAll()
  },

  deleteTarget(event) {
    const id = event.currentTarget.dataset.id
    wx.showModal({
      title: '删除目标学校',
      content: '只删除这所目标学校，不影响收藏、成绩或学习目标。',
      confirmText: '删除',
      confirmColor: '#b42318',
      success: (modalResult) => {
        if (!modalResult.confirm) return
        const result = deleteTargetRecord(id, operationOptions('delete_target', id))
        if (!result.ok) {
          wx.showToast({ title: result.message, icon: 'none' })
          return
        }
        wx.showToast({ title: '目标学校已删除', icon: 'success' })
        this.loadAll()
      }
    })
  },

  clearAllTargets() {
    if (!this.data.records.length) return
    wx.showModal({
      title: '清空目标学校',
      content: '将删除当前档案的全部目标学校及主要目标设置，不影响学习目标。',
      confirmText: '确认清空',
      confirmColor: '#b42318',
      success: (modalResult) => {
        if (!modalResult.confirm) return
        const result = clearTargetRecords(operationOptions('clear_targets', 'targetRecords'))
        if (!result.ok) {
          wx.showToast({ title: result.message, icon: 'none' })
          return
        }
        wx.showToast({ title: '目标学校已清空', icon: 'success' })
        this.loadAll()
      }
    })
  },

  openSchool(event) {
    const schoolId = event.currentTarget.dataset.schoolId
    if (!schoolId) return
    wx.navigateTo({ url: `/pages/school-detail/school-detail?id=${schoolId}` })
  },

  openSchools() {
    wx.switchTab({ url: '/pages/schools/schools' })
  },

  openScoreCenter() {
    const app = getApp()
    if (app && app.globalData) app.globalData.scoreCenterSegment = 'records'
    wx.switchTab({ url: '/pages/score-trend/score-trend' })
  },

  updateLearningInput(event) {
    const field = event.currentTarget.dataset.field
    if (!Object.prototype.hasOwnProperty.call(this.data.learningDraft, field)) return
    this.setData({
      learningDraft: {
        ...this.data.learningDraft,
        [field]: event.detail.value
      },
      learningError: ''
    }, () => this.persistLearningDraft())
  },

  updateLearningDate(event) {
    const field = event.currentTarget.dataset.field
    if (!['startDate', 'endDate'].includes(field)) return
    this.setData({
      learningDraft: {
        ...this.data.learningDraft,
        [field]: event.detail.value
      },
      learningError: ''
    }, () => this.persistLearningDraft())
  },

  updateLearningStatus(event) {
    const option = STATUS_OPTIONS[Number(event.detail.value)]
    if (!option) return
    this.setData({
      learningDraft: {
        ...this.data.learningDraft,
        status: option.value
      }
    }, () => this.persistLearningDraft())
  },

  addTargetSubject() {
    const targetSubjects = [
      ...this.data.learningDraft.targetSubjects,
      {
        clientId: `subject_${Date.now()}_${this.data.learningDraft.targetSubjects.length}`,
        subjectId: '',
        subjectName: '',
        targetScore: ''
      }
    ]
    this.setData({
      learningDraft: { ...this.data.learningDraft, targetSubjects }
    }, () => this.persistLearningDraft())
  },

  updateTargetSubject(event) {
    const index = Number(event.currentTarget.dataset.index)
    const field = event.currentTarget.dataset.field
    if (!Number.isInteger(index) || !['subjectName', 'targetScore'].includes(field)) return
    const targetSubjects = this.data.learningDraft.targetSubjects.map((item, itemIndex) =>
      itemIndex === index ? { ...item, [field]: event.detail.value } : item
    )
    this.setData({
      learningDraft: { ...this.data.learningDraft, targetSubjects },
      learningError: ''
    }, () => this.persistLearningDraft())
  },

  removeTargetSubject(event) {
    const index = Number(event.currentTarget.dataset.index)
    const targetSubjects = this.data.learningDraft.targetSubjects
      .filter((item, itemIndex) => itemIndex !== index)
    this.setData({
      learningDraft: { ...this.data.learningDraft, targetSubjects }
    }, () => this.persistLearningDraft())
  },

  persistLearningDraft() {
    const existing = getTargetDraftResult().draft
    const result = saveTargetDraft({
      ...existing,
      learningGoalDraft: this.data.learningDraft
    }, operationOptions('save_target_draft', 'learningGoalDraft'))
    if (!result.ok) wx.showToast({ title: result.message, icon: 'none' })
  },

  resetLearningForm(eventOrCallback) {
    const callback = typeof eventOrCallback === 'function' ? eventOrCallback : null
    const learningDraft = emptyLearningDraft()
    const existing = getTargetDraftResult().draft
    const result = saveTargetDraft({
      ...existing,
      learningGoalDraft: learningDraft
    }, operationOptions('save_target_draft', 'learningGoalDraft'))
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    this.setData({ learningDraft, learningError: '' }, callback || undefined)
  },

  editLearningTarget(event) {
    const record = (this._learningRecords || []).find(
      (item) => item.id === event.currentTarget.dataset.id
    )
    if (!record) return
    this.setData({
      learningDraft: normalizeLearningDraft(record),
      learningError: ''
    }, () => this.persistLearningDraft())
  },

  saveLearningTarget(event) {
    const saveAsDraft = event.currentTarget.dataset.draft === true ||
      event.currentTarget.dataset.draft === 'true'
    const draft = this.data.learningDraft
    const title = String(draft.title || '').trim()
    if (!title) {
      this.setData({ learningError: '请填写阶段目标名称。' })
      return
    }
    const totalScore = validScoreInput(draft.targetTotalScore, { optional: saveAsDraft })
    if (!totalScore.ok) {
      this.setData({
        learningError: `目标总分必须是 0 至 ${EXAM_TOTAL_SCORE} 的整数。`
      })
      return
    }
    if (!saveAsDraft && (!draft.startDate || !draft.endDate)) {
      this.setData({ learningError: '请填写开始日期和截止日期。' })
      return
    }
    if (draft.startDate && draft.endDate && draft.startDate > draft.endDate) {
      this.setData({ learningError: '截止日期不能早于开始日期。' })
      return
    }
    const subjectConfigs = new Map(
      (this._subjectConfigs || []).map((item) => [item.subjectName, item])
    )
    const targetSubjects = []
    for (let index = 0; index < draft.targetSubjects.length; index += 1) {
      const item = draft.targetSubjects[index]
      const subjectName = String(item.subjectName || '').trim()
      const rawScore = String(item.targetScore || '').trim()
      if (!subjectName && !rawScore) continue
      const config = subjectConfigs.get(subjectName)
      const maximum = config && Number.isInteger(config.maxScore)
        ? config.maxScore
        : EXAM_TOTAL_SCORE
      const parsed = validScoreInput(rawScore)
      if (!subjectName || !parsed.ok || parsed.value > maximum) {
        this.setData({
          learningError: config
            ? `${subjectName || '学科'}目标分必须是 0 至 ${maximum} 的整数。`
            : '每个学科目标都需要名称和有效分数。'
        })
        return
      }
      targetSubjects.push({
        subjectId: item.subjectId || (config && config.subjectId) || `subject_target_${index + 1}`,
        subjectName,
        targetScore: parsed.value
      })
    }
    const now = new Date().toISOString()
    const stageGoalId = draft.id || `learning_${Date.now()}`
    const result = saveLearningTargetRecord({
      id: stageGoalId,
      title,
      startDate: draft.startDate,
      endDate: draft.endDate,
      targetTotalScore: totalScore.value,
      targetSubjects,
      weeklyTasks: String(draft.weeklyTasksText || '')
        .split(/\r?\n/u)
        .map((item) => item.trim())
        .filter(Boolean),
      status: draft.status,
      notes: draft.notes,
      isDraft: saveAsDraft,
      createdAt: draft.createdAt || now,
      updatedAt: now
    }, operationOptions('save_stage_goal', stageGoalId))
    if (!result.ok) {
      this.setData({ learningError: result.message })
      return
    }
    wx.showToast({
      title: saveAsDraft ? '学习目标草稿已保存' : '学习目标已保存',
      icon: 'success'
    })
    this.resetLearningForm(() => this.loadAll())
  },

  onLearningRecordStatusChange(event) {
    const record = (this._learningRecords || []).find(
      (item) => item.id === event.currentTarget.dataset.id
    )
    const option = STATUS_OPTIONS[Number(event.detail.value)]
    if (!record || !option) return
    const result = saveLearningTargetRecord({
      ...record,
      status: option.value,
      updatedAt: new Date().toISOString()
    }, operationOptions('save_stage_goal', record.id))
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    wx.showToast({ title: `状态已更新为${option.label}`, icon: 'success' })
    this.loadAll()
  },

  deleteLearningTarget(event) {
    const id = event.currentTarget.dataset.id
    wx.showModal({
      title: '删除学习目标',
      content: '只删除这一条阶段学习目标，不影响目标学校和成绩。',
      confirmText: '删除',
      confirmColor: '#b42318',
      success: (modalResult) => {
        if (!modalResult.confirm) return
        const result = deleteLearningTargetRecord(
          id,
          operationOptions('delete_stage_goal', id)
        )
        if (!result.ok) {
          wx.showToast({ title: result.message, icon: 'none' })
          return
        }
        wx.showToast({ title: '学习目标已删除', icon: 'success' })
        this.loadAll()
      }
    })
  },

  clearLearningTargets() {
    if (!this.data.learningRecords.length) return
    wx.showModal({
      title: '清空学习目标',
      content: '将删除当前档案的全部学习目标，不影响目标学校；未保存表单草稿仍会保留。',
      confirmText: '确认清空',
      confirmColor: '#b42318',
      success: (modalResult) => {
        if (!modalResult.confirm) return
        const result = clearLearningTargetRecords(
          operationOptions('clear_stage_goals', 'stageGoals')
        )
        if (!result.ok) {
          wx.showToast({ title: result.message, icon: 'none' })
          return
        }
        wx.showToast({ title: '学习目标已清空', icon: 'success' })
        this.loadAll()
      }
    })
  },

  onLearningTaskStatusChange(event) {
    const task = (this._learningTasks || []).find((item) => item.id === event.currentTarget.dataset.id)
    const option = STATUS_OPTIONS[Number(event.detail.value)]
    if (!task || !option) return
    const result = saveLearningTask({ ...task, status: option.value, updatedAt: new Date().toISOString() }, {
      ...operationOptions('save_learning_task', task.id),
      allowDuplicateSource: true
    })
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    this.loadAll()
  },

  deleteLearningTask(event) {
    const id = event.currentTarget.dataset.id
    const result = removeLearningTask(id, operationOptions('delete_learning_task', id))
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    this.loadAll()
  },

  syncOnboarding() {
    this.setData({
      onboarding: onboardingForPage('/pages/targets/targets')
    })
  },

  onOnboardingAction(event) {
    handleOnboardingAction(event)
    this.syncOnboarding()
  }
})
