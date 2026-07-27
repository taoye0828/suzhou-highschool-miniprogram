const { APP_CONFIG } = require('../../config/app-config')
const {
  getTargetRecordsResult,
  getTargetDraftResult,
  getScoreRecordsResult,
  getExamYearResult,
  getLearningTargetRecordsResult,
  saveTargetRecord,
  deleteTargetRecord,
  clearTargetRecords,
  saveTargetDraft,
  saveLearningTargetRecord,
  deleteLearningTargetRecord,
  clearLearningTargetRecords
} = require('../../utils/storage')
const { notifyStorageReadResult } = require('../../utils/storage-feedback')
const { schools } = require('../../data/schools')
const { searchSchools, normalizeSearchText } = require('../../utils/school-search')
const { referenceForSchool } = require('../../utils/score-analysis')
const { onboardingForPage, handleOnboardingAction } = require('../../utils/onboarding')

const LEVEL_ORDER = ['sprint', 'target', 'safe']

function currentScoreFrom(scoreRecords, draft) {
  const latest = Array.isArray(scoreRecords) && scoreRecords.length
    ? scoreRecords[scoreRecords.length - 1].score
    : Number(String(draft && draft.currentScore || '').trim())
  return Number.isInteger(latest) && latest >= 0 && latest <= APP_CONFIG.targetScore.max
    ? latest
    : null
}

function presentRecord(record, currentScore, targetYear) {
  const level = APP_CONFIG.targetScore.levels.find((item) => item.value === record.level)
  const reference = referenceForSchool(record.schoolId, targetYear)
  const gap = reference && currentScore !== null ? reference.minScore - currentScore : null
  return {
    ...record,
    levelLabel: level ? level.label : '目标',
    levelIndex: Math.max(0, APP_CONFIG.targetScore.levels.findIndex((item) => item.value === record.level)),
    referenceScoreText: reference ? `${reference.minScore} 分` : '暂未收录',
    referenceYearText: reference ? `${reference.year} 年` : '—',
    currentScoreText: currentScore === null ? '尚未记录' : `${currentScore} 分`,
    gapText: gap === null
      ? '待记录成绩后计算'
      : gap > 0
        ? `距离历史参考目标还有 ${gap} 分`
        : gap === 0
          ? '已达到该历史参考目标'
          : `高于历史参考分 ${Math.abs(gap)} 分`
  }
}

Page({
  data: {
    activeSegment: 'schools',
    records: [],
    targetLevels: APP_CONFIG.targetScore.levels,
    targetLevelLabel: APP_CONFIG.policy.targetHint,
    keyword: '',
    searchActive: false,
    searchResults: [],
    learningDraft: { stage: '', targetScore: '', note: '' },
    learningRecords: [],
    learningError: '',
    onboarding: { visible: false, step: null }
  },

  onShow() {
    this.loadRecords()
    this.loadLearningTargets()
    this.syncOnboarding()
  },

  selectSegment(event) {
    this.setData({ activeSegment: event.currentTarget.dataset.segment })
  },

  loadLearningTargets() {
    const draftResult = getTargetDraftResult()
    const recordsResult = getLearningTargetRecordsResult()
    notifyStorageReadResult(this, !draftResult.ok ? draftResult : recordsResult)
    this.setData({
      learningDraft: {
        stage: draftResult.draft.stage || '',
        targetScore: draftResult.draft.targetScore || '',
        note: draftResult.draft.note || ''
      },
      learningRecords: recordsResult.records
    })
  },

  updateLearningDraft(event) {
    const field = event.currentTarget.dataset.field
    const learningDraft = { ...this.data.learningDraft, [field]: event.detail.value }
    this.setData({ learningDraft, learningError: '' })
    const existing = getTargetDraftResult().draft
    saveTargetDraft({ ...existing, ...learningDraft })
  },

  saveLearningTarget() {
    const stage = String(this.data.learningDraft.stage || '').trim()
    const rawScore = String(this.data.learningDraft.targetScore || '').trim()
    const targetScore = Number(rawScore)
    if (!stage) {
      this.setData({ learningError: '请填写阶段目标。' })
      return
    }
    if (!/^\d+$/.test(rawScore) || !Number.isInteger(targetScore) ||
        targetScore < 0 || targetScore > APP_CONFIG.targetScore.max) {
      this.setData({ learningError: `目标分数必须是 0 至 ${APP_CONFIG.targetScore.max} 的整数。` })
      return
    }
    const result = saveLearningTargetRecord({
      id: `learning_${Date.now()}`,
      stage,
      targetScore,
      note: this.data.learningDraft.note,
      createdAt: new Date().toISOString()
    })
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    const existing = getTargetDraftResult().draft
    saveTargetDraft({ ...existing, stage: '', targetScore: '', note: '' })
    this.setData({
      learningDraft: { stage: '', targetScore: '', note: '' },
      learningRecords: result.records,
      learningError: ''
    })
    wx.showToast({ title: '阶段目标已保存', icon: 'success' })
  },

  deleteLearningTarget(event) {
    const result = deleteLearningTargetRecord(event.currentTarget.dataset.id)
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    this.setData({ learningRecords: result.records })
  },

  clearLearningTargets() {
    if (!this.data.learningRecords.length) return
    wx.showModal({
      title: '清空阶段目标',
      content: '将删除全部阶段学习目标，草稿不受影响。',
      confirmText: '确认清空',
      confirmColor: '#b42318',
      success: (modalResult) => {
        if (!modalResult.confirm) return
        const result = clearLearningTargetRecords()
        if (!result.ok) {
          wx.showToast({ title: result.message, icon: 'none' })
          return
        }
        this.setData({ learningRecords: [] })
      }
    })
  },

  loadRecords() {
    const targetResult = getTargetRecordsResult()
    const scoreResult = getScoreRecordsResult()
    const draftResult = getTargetDraftResult()
    const yearResult = getExamYearResult()
    const failedResult = [targetResult, scoreResult, draftResult, yearResult]
      .find((result) => !result.ok)
    notifyStorageReadResult(this, failedResult || targetResult)

    const currentScore = currentScoreFrom(scoreResult.records, draftResult.draft)
    this._targetRecords = targetResult.records
    const records = targetResult.records
      .map((record) => presentRecord(record, currentScore, yearResult.year))
      .sort((left, right) => {
        const levelCompare = LEVEL_ORDER.indexOf(left.level) - LEVEL_ORDER.indexOf(right.level)
        return levelCompare !== 0
          ? levelCompare
          : left.schoolName.localeCompare(right.schoolName, 'zh-Hans-CN')
      })
    this.setData({ records }, () => this.applySchoolSearch())
  },

  openSchools() {
    wx.switchTab({ url: '/pages/schools/schools' })
  },

  openSchool(event) {
    const schoolId = event.currentTarget.dataset.schoolId
    if (!schoolId) return
    wx.navigateTo({ url: `/pages/school-detail/school-detail?id=${schoolId}` })
  },

  onKeywordInput(event) {
    this.setData({ keyword: event.detail.value }, () => this.applySchoolSearch())
  },

  applySchoolSearch() {
    const searchActive = Boolean(normalizeSearchText(this.data.keyword))
    const selectedIds = new Set((this._targetRecords || []).map((record) => record.schoolId))
    this.setData({
      searchActive,
      searchResults: searchActive
        ? searchSchools({
          schools: schools.filter((school) => !selectedIds.has(school.id)),
          keyword: this.data.keyword,
          limit: 6
        })
        : []
    })
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
    const result = saveTargetRecord({ ...record, level: level.value })
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    wx.showToast({ title: '目标等级已更新', icon: 'success' })
    this.loadRecords()
  },

  deleteRecord(event) {
    const result = deleteTargetRecord(event.currentTarget.dataset.id)
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    wx.showToast({ title: '目标学校已删除', icon: 'success' })
    this.loadRecords()
  },

  clearAllRecords() {
    if (!this.data.records.length) return
    wx.showModal({
      title: '清空全部目标学校',
      content: '此操作只删除本机保存的目标学校和等级，且无法撤销。',
      confirmText: '确认清空',
      confirmColor: '#b42318',
      success: (modalResult) => {
        if (!modalResult.confirm) return
        const result = clearTargetRecords()
        if (!result.ok) {
          wx.showToast({ title: result.message, icon: 'none' })
          return
        }
        this.loadRecords()
        wx.showToast({ title: '已清空', icon: 'success' })
      },
      fail: () => wx.showToast({ title: '确认窗口打开失败，请重试。', icon: 'none' })
    })
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
