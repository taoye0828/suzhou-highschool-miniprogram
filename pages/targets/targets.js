const { APP_CONFIG } = require('../../config/app-config')
const {
  getTargetRecordsResult,
  getTargetDraftResult,
  getScoreRecordsResult,
  getExamYearResult,
  saveTargetRecord,
  deleteTargetRecord,
  clearTargetRecords
} = require('../../utils/storage')
const { notifyStorageReadResult } = require('../../utils/storage-feedback')
const { schools } = require('../../data/schools')
const { searchSchools, normalizeSearchText } = require('../../utils/school-search')
const { referenceForSchool } = require('../../utils/score-analysis')

const LEVEL_ORDER = ['challenge', 'target', 'safe']

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
        ? `需提升 ${gap} 分`
        : gap === 0
          ? '与历史参考分持平'
          : `高于历史参考分 ${Math.abs(gap)} 分`
  }
}

Page({
  data: {
    records: [],
    targetLevels: APP_CONFIG.targetScore.levels,
    targetLevelLabel: APP_CONFIG.policy.targetHint,
    keyword: '',
    searchActive: false,
    searchResults: []
  },

  onShow() {
    this.loadRecords()
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
  }
})
