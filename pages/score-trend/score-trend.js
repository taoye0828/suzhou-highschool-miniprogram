const { APP_CONFIG, EXAM_TOTAL_SCORE } = require('../../config/app-config')
const {
  getScoreRecordsResult,
  saveScoreRecord,
  deleteScoreRecord,
  clearScoreRecords
} = require('../../utils/storage')
const { notifyStorageReadResult } = require('../../utils/storage-feedback')

let recordSequence = 0

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

function presentRecords(records) {
  const chartRecords = records.slice(-12).map((record) => ({
    ...record,
    height: Math.max(6, Math.round(record.score / EXAM_TOTAL_SCORE * 100)),
    shortName: record.examName.length > 6 ? `${record.examName.slice(0, 6)}…` : record.examName,
    shortDate: record.date.slice(5)
  }))
  return {
    records: [...records].reverse(),
    chartRecords
  }
}

Page({
  data: {
    selectedDate: localDateLabel(),
    examName: '',
    scoreInput: '',
    inputError: '',
    records: [],
    chartRecords: [],
    maxRecords: APP_CONFIG.scoreRecord.maxRecords,
    scoreMax: EXAM_TOTAL_SCORE,
    planningDisclaimer: APP_CONFIG.policy.planningDisclaimer
  },

  onLoad() {
    this.loadRecords()
  },

  onShow() {
    this.loadRecords()
  },

  loadRecords() {
    const result = getScoreRecordsResult()
    notifyStorageReadResult(this, result)
    this.setData(presentRecords(result.records))
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

  saveRecord() {
    const examName = String(this.data.examName || '').trim()
    const rawScore = String(this.data.scoreInput || '').trim()
    const score = Number(rawScore)
    if (!examName || examName.length > APP_CONFIG.scoreRecord.examNameMaxLength) {
      this.setData({ inputError: `考试名称需填写 1 至 ${APP_CONFIG.scoreRecord.examNameMaxLength} 个字符。` })
      return
    }
    if (!/^\d+$/.test(rawScore) || !Number.isInteger(score) || score < 0 || score > EXAM_TOTAL_SCORE) {
      this.setData({ inputError: `成绩必须是 0 至 ${EXAM_TOTAL_SCORE} 的整数。` })
      return
    }
    const result = saveScoreRecord({
      schemaVersion: 1,
      id: createRecordId(),
      date: this.data.selectedDate,
      examName,
      score,
      createdAt: new Date().toISOString()
    })
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    this.setData({
      examName: '',
      scoreInput: '',
      inputError: '',
      ...presentRecords(result.records)
    })
    wx.showToast({ title: '成绩记录已保存在本机', icon: 'success' })
  },

  deleteRecord(event) {
    const id = event.currentTarget.dataset.id
    wx.showModal({
      title: '删除成绩记录',
      content: '该记录只保存在本机，删除后无法恢复。',
      confirmText: '确认删除',
      confirmColor: '#b42318',
      success: (modalResult) => {
        if (!modalResult.confirm) return
        const result = deleteScoreRecord(id)
        if (!result.ok) {
          wx.showToast({ title: result.message, icon: 'none' })
          return
        }
        this.setData(presentRecords(result.records))
        wx.showToast({ title: '成绩记录已删除', icon: 'success' })
      }
    })
  },

  clearAllRecords() {
    if (!this.data.records.length) return
    wx.showModal({
      title: '清空全部成绩记录',
      content: '此操作只删除本机成绩记录，且无法撤销。',
      confirmText: '确认清空',
      confirmColor: '#b42318',
      success: (modalResult) => {
        if (!modalResult.confirm) return
        const result = clearScoreRecords()
        if (!result.ok) {
          wx.showToast({ title: result.message, icon: 'none' })
          return
        }
        this.setData(presentRecords([]))
        wx.showToast({ title: '成绩记录已清空', icon: 'success' })
      }
    })
  }
})
