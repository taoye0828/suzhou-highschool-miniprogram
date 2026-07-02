const {
  getTargetRecords,
  saveTargetRecord,
  deleteTargetRecord,
  clearTargetRecords,
  getTargetDraft,
  saveTargetDraft,
  clearTargetDraft
} = require('../../utils/storage')

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
  if (gap > 0) return { gapText: `距离学习目标还有 ${gap} 分`, reminder: gap >= 50 ? '差距较大，建议拆分为每周小目标并定期复盘。' : '建议保持练习节奏，持续记录阶段变化。' }
  if (gap === 0) return { gapText: '当前分数与学习目标一致', reminder: '建议继续巩固薄弱知识点。' }
  return { gapText: `当前分数已超过学习目标 ${Math.abs(gap)} 分`, reminder: '可根据近期学习情况设置下一阶段目标。' }
}

Page({
  data: {
    currentScore: '',
    targetScore: '',
    note: '',
    gapText: '填写分数后显示学习差距',
    reminder: '建议先记录一次真实学习测评结果。',
    records: []
  },

  onLoad() {
    const draft = getTargetDraft()
    this.setData({
      currentScore: draft.currentScore || '',
      targetScore: draft.targetScore || '',
      note: draft.note || ''
    }, () => this.refreshSummary())
  },

  onShow() { this.loadRecords() },

  onCurrentInput(event) {
    this.setData({ currentScore: event.detail.value }, () => this.onDraftChanged())
  },

  onTargetInput(event) {
    this.setData({ targetScore: event.detail.value }, () => this.onDraftChanged())
  },

  onNoteInput(event) {
    this.setData({ note: event.detail.value }, () => this.persistDraft())
  },

  onDraftChanged() {
    this.refreshSummary()
    this.persistDraft()
  },

  persistDraft() {
    saveTargetDraft({
      currentScore: this.data.currentScore,
      targetScore: this.data.targetScore,
      note: this.data.note
    })
  },

  refreshSummary() {
    this.setData(gapSummary(this.data.currentScore, this.data.targetScore))
  },

  loadRecords() {
    this.setData({ records: getTargetRecords() })
  },

  saveRecord() {
    const current = scoreNumber(this.data.currentScore)
    const target = scoreNumber(this.data.targetScore)
    if (current === null || target === null || current < 0 || target < 0 || current > 750 || target > 750) {
      wx.showToast({ title: '请输入 0 至 750 的整数', icon: 'none' })
      return
    }
    const now = new Date()
    const summary = gapSummary(current, target)
    saveTargetRecord({
      id: `target_${now.getTime()}`,
      currentScore: current,
      targetScore: target,
      note: this.data.note.trim(),
      gapText: summary.gapText,
      reminder: summary.reminder,
      createdAt: now.toISOString(),
      displayTime: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    })
    wx.showToast({ title: '目标记录已保存', icon: 'success' })
    this.loadRecords()
  },

  clearInputs() {
    clearTargetDraft()
    this.setData({ currentScore: '', targetScore: '', note: '', ...gapSummary('', '') })
  },

  deleteRecord(event) {
    deleteTargetRecord(event.currentTarget.dataset.id)
    wx.showToast({ title: '记录已删除', icon: 'success' })
    this.loadRecords()
  },

  clearAllRecords() {
    if (!this.data.records.length) return
    wx.showModal({
      title: '清空全部目标记录',
      content: '此操作只删除本机目标记录，且无法撤销。',
      confirmText: '确认清空',
      confirmColor: '#b42318',
      success: (result) => {
        if (!result.confirm) return
        clearTargetRecords()
        this.loadRecords()
        wx.showToast({ title: '已清空', icon: 'success' })
      }
    })
  }
})
