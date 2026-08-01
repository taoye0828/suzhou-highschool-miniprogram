const { getSchoolById, presentSchool } = require('../../utils/school')
const {
  getFavoriteIdsResult,
  setFavorite,
  getTargetRecordsResult,
  getTargetDraftResult,
  getScoreRecordsResult,
  getExamYearResult,
  getScenarioSettings,
  saveTargetRecord,
  addRecentViewedSchool,
  getComparisonSchoolIds,
  saveComparisonSchoolIds
  ,
  getSchoolUserState,
  saveSchoolUserState
} = require('../../utils/storage')
const { notifyStorageReadResult } = require('../../utils/storage-feedback')
const { mapSearchKeyword, copyText } = require('../../utils/map')
const { openExternalLink } = require('../../utils/external-link')
const {
  EMPTY_SCORE_TEXT,
  SCORE_SAFETY_NOTICE,
  groupScoresByYear
} = require('../../utils/admission-scores')
const { APP_CONFIG } = require('../../config/app-config')
const {
  selectCurrentScore,
  selectReferenceForSchool,
  selectGap,
  formatDifference
} = require('../../utils/planning')
const {
  ALL_ADMISSION_SCORES,
  schoolScoreTrend
} = require('../../utils/rc10-features')
const { operationOptions } = require('../../utils/operation-context')
const { CANDIDATE_STATUS_LABELS } = require('../../utils/school-planning')

const CANDIDATE_STATUS_OPTIONS = Object.entries(CANDIDATE_STATUS_LABELS).map(([value, label]) => ({ value, label }))

function buildTargetAnalysis(school, targetRecord, scoreRecords, draft, targetYear, scenarios) {
  if (!school) return null
  const current = selectCurrentScore(scoreRecords, draft, {
    requireRecommendationEligible: true
  })
  const reference = selectReferenceForSchool(school.id, targetYear, ALL_ADMISSION_SCORES)
  const gap = selectGap(current.score, reference)
  const referenceScore = reference ? reference.minScore : null
  const scenarioGap = (score) => Number.isInteger(score) && Number.isInteger(referenceScore)
    ? formatDifference(score - referenceScore)
    : '尚未设置'
  const level = APP_CONFIG.targetScore.levels.find(
    (item) => targetRecord && item.value === targetRecord.level
  )
  return {
    currentScoreText: current.score === null ? '尚未记录' : `${current.score} 分`,
    referenceScoreText: reference ? `${reference.minScore} 分` : '暂未收录',
    referenceYearText: reference ? `${reference.year} 年` : '—',
    gapText: formatDifference(gap.difference),
    stageGapText: scenarioGap(scenarios.stageTargetScore),
    finalGapText: scenarioGap(scenarios.finalTargetScore),
    targetLevelText: level ? level.label : '未设置'
  }
}

Page({
  data: {
    schoolId: '',
    school: null,
    scoreGroups: [],
    isFavorite: false,
    isTargetSchool: false,
    targetLevels: APP_CONFIG.targetScore.levels,
    targetLevelIndex: APP_CONFIG.targetScore.levels.findIndex((item) => item.value === 'target'),
    targetAnalysis: null,
    scoreTrend: [],
    isCompared: false,
    mapKeyword: '',
    emptyScoreText: EMPTY_SCORE_TEXT,
    scoreSafetyNotice: SCORE_SAFETY_NOTICE,
    detailNotice: APP_CONFIG.policy.schoolDetailNotice
    ,
    candidateStatusOptions: CANDIDATE_STATUS_OPTIONS,
    candidateStatusIndex: 0,
    schoolUserStateId: '',
    schoolUserStateVersion: null,
    schoolTagsInput: '',
    schoolNoteInput: ''
  },

  onLoad(options) {
    this.setData({ schoolId: options.id || '' })
    if (getSchoolById(options.id || '')) {
      addRecentViewedSchool(
        options.id,
        operationOptions('record_recent_school', options.id)
      )
    }
    this.refresh()
  },

  onShow() {
    if (this.data.schoolId) this.refresh()
  },

  refresh() {
    const school = getSchoolById(this.data.schoolId)
    const favoriteResult = getFavoriteIdsResult()
    const targetResult = getTargetRecordsResult()
    const scoreResult = getScoreRecordsResult()
    const draftResult = getTargetDraftResult()
    const yearResult = getExamYearResult()
    const scenarioSettings = getScenarioSettings()
    const userState = school ? getSchoolUserState(school.id) : null
    const targetRecord = school
      ? targetResult.records.find((record) => record.schoolId === school.id)
      : null
    const targetLevelIndex = targetRecord
      ? APP_CONFIG.targetScore.levels.findIndex((item) => item.value === targetRecord.level)
      : APP_CONFIG.targetScore.levels.findIndex((item) => item.value === 'target')
    const failedResult = [favoriteResult, targetResult, scoreResult, draftResult, yearResult]
      .find((result) => !result.ok)
    notifyStorageReadResult(this, failedResult || favoriteResult)
    this.setData({
      school: school
        ? {
            ...presentSchool(school, favoriteResult.ids),
            aliasesText: Array.isArray(school.aliases) ? school.aliases.join('、') : ''
          }
        : null,
      isFavorite: school ? favoriteResult.ids.includes(school.id) : false,
      isTargetSchool: Boolean(targetRecord),
      isCompared: school ? getComparisonSchoolIds().includes(school.id) : false,
      targetLevelIndex: Math.max(0, targetLevelIndex),
      targetAnalysis: buildTargetAnalysis(
        school,
        targetRecord,
        scoreResult.records,
        draftResult.draft,
        yearResult.year,
        scenarioSettings
      ),
      scoreGroups: school ? groupScoresByYear(school.id) : [],
      scoreTrend: school ? schoolScoreTrend(school.id) : [],
      mapKeyword: school ? mapSearchKeyword(school.name) : ''
      ,
      candidateStatusIndex: Math.max(0, CANDIDATE_STATUS_OPTIONS.findIndex((item) => item.value === (userState && userState.candidateStatus || 'none'))),
      schoolUserStateId: userState && userState.id || '',
      schoolUserStateVersion: userState && userState.version || null,
      schoolTagsInput: userState && userState.tags.join('、') || '',
      schoolNoteInput: userState && userState.note || ''
    })
  },

  toggleFavorite() {
    if (!this.data.school) return
    const nextValue = !this.data.isFavorite
    const result = setFavorite(
      this.data.school.id,
      nextValue,
      operationOptions('set_favorite', this.data.school.id)
    )
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    this.setData({ isFavorite: nextValue })
    wx.showToast({ title: nextValue ? '已收藏' : '已取消收藏', icon: 'success' })
  },

  onTargetLevelChange(event) {
    this.setData({ targetLevelIndex: Number(event.detail.value) })
  },

  onCandidateStatusChange(event) {
    this.setData({ candidateStatusIndex: Number(event.detail.value) })
  },

  onSchoolUserInput(event) {
    const field = event.currentTarget.dataset.field
    if (!['schoolTagsInput', 'schoolNoteInput'].includes(field)) return
    this.setData({ [field]: event.detail.value })
  },

  saveSchoolUserState() {
    if (!this.data.school) return
    const status = CANDIDATE_STATUS_OPTIONS[this.data.candidateStatusIndex] || CANDIDATE_STATUS_OPTIONS[0]
    const tags = [...new Set(String(this.data.schoolTagsInput || '').split(/[、,，\n]/u).map((item) => item.trim()).filter(Boolean))].slice(0, 20)
    const now = new Date().toISOString()
    const id = this.data.schoolUserStateId || `school_state_${this.data.school.id}`
    const result = saveSchoolUserState({
      id,
      schoolId: this.data.school.id,
      candidateStatus: status.value,
      tags,
      note: this.data.schoolNoteInput,
      customOrder: 0,
      createdAt: now,
      updatedAt: now,
      expectedVersion: this.data.schoolUserStateVersion
    }, operationOptions('save_school_user_state', id))
    if (!result.ok) return wx.showToast({ title: result.message, icon: 'none' })
    wx.showToast({ title: '学校个人状态已保存', icon: 'success' })
    this.refresh()
  },

  saveSchoolTarget() {
    if (!this.data.school) return
    const level = this.data.targetLevels[this.data.targetLevelIndex]
    if (!level) {
      wx.showToast({ title: '目标等级无效，请重新选择。', icon: 'none' })
      return
    }
    const wasTargetSchool = this.data.isTargetSchool
    const result = saveTargetRecord({
      id: `target_${this.data.school.id}`,
      schoolId: this.data.school.id,
      schoolName: this.data.school.name,
      level: level.value,
      createdAt: new Date().toISOString()
    }, operationOptions('save_target', this.data.school.id))
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    this.setData({ isTargetSchool: true }, () => this.refresh())
    wx.showToast({
      title: wasTargetSchool ? '目标等级已更新' : '已加入目标',
      icon: 'success'
    })
  },

  toggleCompare() {
    if (!this.data.school) return
    const current = getComparisonSchoolIds()
    const next = current.includes(this.data.school.id)
      ? current.filter((id) => id !== this.data.school.id)
      : [...current, this.data.school.id]
    if (next.length > 3) {
      wx.showToast({ title: '最多对比 3 所学校', icon: 'none' })
      return
    }
    const result = saveComparisonSchoolIds(
      next,
      operationOptions('save_school_comparison', 'comparisonSchoolIds')
    )
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    this.setData({ isCompared: !this.data.isCompared })
  },

  copySchoolName() {
    copyText(this.data.school && this.data.school.name, '学校名称已复制')
  },

  copyAddress() {
    copyText(this.data.school && this.data.school.address, '地址已复制')
  },

  copyMapKeyword() {
    copyText(this.data.mapKeyword, '地图搜索词已复制')
  },

  copySourceLink() {
    copyText(this.data.school && this.data.school.sourceUrl, '来源链接已复制')
  },

  openSourceLink() {
    openExternalLink(this.data.school && this.data.school.sourceUrl)
  },

  copyOfficialWebsite() {
    copyText(this.data.school && this.data.school.officialWebsite, '官网链接已复制')
  },

  openOfficialWebsite() {
    openExternalLink(this.data.school && this.data.school.officialWebsite)
  },

  copyScoreSource(event) {
    copyText(event.currentTarget.dataset.url, '分数线来源链接已复制')
  },

  openScoreSource(event) {
    openExternalLink(event.currentTarget.dataset.url)
  },

  openSchools() {
    wx.switchTab({ url: '/pages/schools/schools' })
  }
})
