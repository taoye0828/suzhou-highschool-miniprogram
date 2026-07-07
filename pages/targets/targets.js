const { APP_CONFIG } = require('../../config/app-config')
const {
  getTargetRecordsResult,
  saveTargetRecord,
  deleteTargetRecord,
  clearTargetRecords,
  getTargetDraftResult,
  saveTargetDraft,
  clearTargetDraft
} = require('../../utils/storage')
const { notifyStorageReadResult } = require('../../utils/storage-feedback')

function scoreNumber(value) {
  if (value === '' || value === null || value === undefined) return null
  const result = Number(value)
  return Number.isInteger(result) ? result : null
}

function gapSummary(currentScore, targetScore) {
  const current = scoreNumber(currentScore)
  const target = scoreNumber(targetScore)
  if (current === null || target === null) return { gapText: '填写分数后显示学习差距', reminder: '建议先记录一次真实学习测评结果。' }
  const gap = target - current
  if (gap > 0) return { gapText: `距离本阶段学习目标还有 ${gap} 分`, reminder: gap >= 50 ? '差距较大，建议拆分为每周小目标并定期复盘。' : '建议保持练习节奏，持续记录阶段变化。' }
  if (gap === 0) return { gapText: '阶段测评分数与阶段目标一致', reminder: '建议继续巩固薄弱知识点。' }
  return { gapText: `阶段测评分数已超过本阶段学习目标 ${Math.abs(gap)} 分`, reminder: '可根据近期学习情况设置下一阶段目标。' }
}

let targetIdSequence = 0

function createTargetId() {
  targetIdSequence = (targetIdSequence + 1) % 1000000
  const suffix = Math.random().toString(36).slice(2, 10)
  return `target_${Date.now()}_${targetIdSequence}_${suffix}`
}

function formatDisplayTime(isoTime) {
  const date = new Date(isoTime)
  const twoDigits = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())} ${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`
}

function presentRecord(record) {
  return {
    ...record,
    ...gapSummary(record.currentScore, record.targetScore),
    displayTime: formatDisplayTime(record.createdAt)
  }
}

Page({
  data: {
    currentScore: '',
    targetScore: '',
    note: '',
    gapText: '填写分数后显示学习差距',
    reminder: '建议先记录一次真实学习测评结果。',
    records: [],
    targetDisclaimer: APP_CONFIG.policy.targetHint,
    targetStorageHint: APP_CONFIG.policy.targetStorageHint,
    scoreMin: APP_CONFIG.targetScore.min,
    scoreMax: APP_CONFIG.targetScore.max,
    scoreMaxLength: APP_CONFIG.targetScore.maxLength
  },

  onLoad() {
    this.draftTimer = null
    this.draftDirty = false
    this.draftErrorShown = false
    const draftResult = getTargetDraftResult()
    notifyStorageReadResult(this, draftResult)
    const draft = draftResult.draft
    this.setData({
      currentScore: draft.currentScore || '',
      targetScore: draft.targetScore || '',
      note: draft.note || ''
    }, () => this.refreshSummary())
  },

  onShow() { this.loadRecords() },

  onHide() { this.flushDraft(false) },

  onUnload() { this.flushDraft(false) },

  onCurrentInput(event) {
    this.setData({ currentScore: event.detail.value }, () => this.onDraftChanged())
  },

  onTargetInput(event) {
    this.setData({ targetScore: event.detail.value }, () => this.onDraftChanged())
  },

  onNoteInput(event) {
    this.setData({ note: event.detail.value }, () => this.onDraftChanged())
  },

  onDraftChanged() {
    this.draftDirty = true
    this.refreshSummary()
    this.scheduleDraftSave()
  },

  scheduleDraftSave() {
    clearTimeout(this.draftTimer)
    this.draftTimer = setTimeout(() => {
      this.draftTimer = null
      const result = this.persistDraft()
      if (!result.ok && !this.draftErrorShown) {
        this.draftErrorShown = true
        wx.showToast({ title: result.message, icon: 'none' })
      }
    }, APP_CONFIG.targetScore.draftDebounceMs)
  },

  persistDraft() {
    if (!this.draftDirty) return { ok: true }
    const result = saveTargetDraft({
      currentScore: this.data.currentScore,
      targetScore: this.data.targetScore,
      note: this.data.note
    })
    if (result.ok) {
      this.draftDirty = false
      this.draftErrorShown = false
    }
    return result
  },

  flushDraft(showError) {
    clearTimeout(this.draftTimer)
    this.draftTimer = null
    const result = this.persistDraft()
    if (showError && !result.ok) wx.showToast({ title: result.message, icon: 'none' })
    return result
  },

  refreshSummary() {
    this.setData(gapSummary(this.data.currentScore, this.data.targetScore))
  },

  loadRecords() {
    const result = getTargetRecordsResult()
    notifyStorageReadResult(this, result)
    this.setData({ records: result.records.map(presentRecord) })
  },

  saveRecord() {
    const current = scoreNumber(this.data.currentScore)
    const target = scoreNumber(this.data.targetScore)
    const { min, max } = APP_CONFIG.targetScore
    if (current === null || target === null || current < min || target < min || current > max || target > max) {
      wx.showToast({ title: `请输入 ${min} 至 ${max} 的整数`, icon: 'none' })
      return
    }

    const result = saveTargetRecord({
      schemaVersion: 1,
      id: createTargetId(),
      currentScore: current,
      targetScore: target,
      note: this.data.note.trim(),
      createdAt: new Date().toISOString()
    })
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }

    wx.showToast({ title: '学习目标已保存', icon: 'success' })
    this.loadRecords()
  },

  clearInputs() {
    clearTimeout(this.draftTimer)
    const result = clearTargetDraft()
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    this.draftDirty = false
    this.draftErrorShown = false
    this.setData({ currentScore: '', targetScore: '', note: '', ...gapSummary('', '') })
  },

  deleteRecord(event) {
    const result = deleteTargetRecord(event.currentTarget.dataset.id)
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    wx.showToast({ title: '记录已删除', icon: 'success' })
    this.loadRecords()
  },

  clearAllRecords() {
    if (!this.data.records.length) return
    wx.showModal({
      title: '清空全部学习目标记录',
      content: '此操作只删除本机学习目标记录，且无法撤销。',
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
