const { APP_CONFIG } = require('../../config/app-config')
const {
  getTargetRecordsResult,
  deleteTargetRecord,
  clearTargetRecords
} = require('../../utils/storage')
const { notifyStorageReadResult } = require('../../utils/storage-feedback')

function presentRecord(record) {
  const level = APP_CONFIG.targetScore.levels.find((item) => item.value === record.level)
  return {
    ...record,
    levelLabel: level ? level.label : '目标'
  }
}

Page({
  data: {
    records: [],
    targetLevelLabel: APP_CONFIG.policy.targetHint
  },

  onShow() {
    this.loadRecords()
  },

  loadRecords() {
    const result = getTargetRecordsResult()
    notifyStorageReadResult(this, result)
    this.setData({ records: result.records.map(presentRecord) })
  },

  openSchools() {
    wx.switchTab({ url: '/pages/schools/schools' })
  },

  openSchool(event) {
    const schoolId = event.currentTarget.dataset.schoolId
    if (!schoolId) return
    wx.navigateTo({ url: `/pages/school-detail/school-detail?id=${schoolId}` })
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
