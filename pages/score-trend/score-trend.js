const {
  getScoreRecords,
  saveScoreRecord,
  deleteScoreRecord
} = require('../../utils/storage')
const { operationOptions } = require('../../utils/operation-context')
const { shareConfig } = require('../../utils/share')

function twoDigits(value) {
  return String(value).padStart(2, '0')
}

function today() {
  const date = new Date()
  return `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`
}

function scoreValue(record) {
  return Number(record && (record.totalScore === undefined ? record.score : record.totalScore))
}

function ordered(records) {
  return (Array.isArray(records) ? records : []).slice().sort((left, right) => {
    const dateCompare = String(left.examDate || left.date || '').localeCompare(String(right.examDate || right.date || ''))
    return dateCompare || String(left.createdAt || '').localeCompare(String(right.createdAt || ''))
  })
}

function emptyForm() {
  return { id: '', examName: '', examDate: today(), totalScore: '' }
}

function trendPresentation(records) {
  const visible = ordered(records).slice(-10)
  const width = Math.max(320, visible.length * 82)
  return {
    width,
    items: visible.map((record, index) => {
      const x = visible.length === 1
        ? width / 2
        : 28 + (width - 56) * index / (visible.length - 1)
      return {
        id: record.id,
        examName: record.examName,
        examDate: record.examDate || record.date,
        shortDate: String(record.examDate || record.date || '').slice(5),
        score: scoreValue(record),
        leftPercent: x / width * 100
      }
    })
  }
}

function statistics(items) {
  if (!items.length) return { latest: '—', highest: '—', average: '—' }
  const values = items.map((item) => item.score)
  const average = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 10) / 10
  return {
    latest: `${values[values.length - 1]} 分`,
    highest: `${Math.max(...values)} 分`,
    average: `${average} 分`
  }
}

Page({
  data: {
    segment: 'records',
    form: emptyForm(),
    saving: false,
    recordCards: [],
    trendItems: [],
    chartWidth: 320,
    statistics: statistics([])
  },

  onShareAppMessage() {
    return shareConfig('pages/score-trend/score-trend')
  },

  onShareTimeline() {
    return shareConfig('pages/score-trend/score-trend')
  },

  onShow() {
    this.refresh()
  },

  refresh() {
    const records = ordered(getScoreRecords())
    const trend = trendPresentation(records)
    this._records = records
    this.setData({
      recordCards: records.slice().reverse().map((record) => ({
        id: record.id,
        examName: record.examName,
        examDate: record.examDate || record.date,
        totalScore: scoreValue(record)
      })),
      trendItems: trend.items,
      chartWidth: trend.width,
      statistics: statistics(trend.items)
    })
    if (this.data.segment === 'trend') wx.nextTick(() => this.drawTrend())
  },

  selectSegment(event) {
    const segment = event.currentTarget.dataset.segment
    this.setData({ segment })
    if (segment === 'trend') wx.nextTick(() => this.drawTrend())
  },

  onFormInput(event) {
    const field = event.currentTarget.dataset.field
    this.setData({ [`form.${field}`]: event.detail.value })
  },

  onDateChange(event) {
    this.setData({ 'form.examDate': event.detail.value })
  },

  resetForm() {
    this._editingRecord = null
    this.setData({ form: emptyForm() })
  },

  editRecord(event) {
    const record = this._records.find((item) => item.id === event.currentTarget.dataset.id)
    if (!record) return
    this._editingRecord = record
    this.setData({
      segment: 'records',
      form: {
        id: record.id,
        examName: record.examName,
        examDate: record.examDate || record.date,
        totalScore: String(scoreValue(record))
      }
    })
  },

  saveRecord() {
    if (this.data.saving) return
    const examName = String(this.data.form.examName || '').trim()
    const examDate = String(this.data.form.examDate || '')
    const totalScore = Number(this.data.form.totalScore)
    if (!examName || examName.length > 40) {
      wx.showToast({ title: '考试名称需填写 1 至 40 个字符', icon: 'none' })
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(examDate)) {
      wx.showToast({ title: '请选择考试日期', icon: 'none' })
      return
    }
    if (!Number.isInteger(totalScore) || totalScore < 0 || totalScore > 740) {
      wx.showToast({ title: '总分请输入 0 至 740 的整数', icon: 'none' })
      return
    }
    const now = new Date().toISOString()
    const current = this._editingRecord
    const id = current ? current.id : `score_${Date.now()}`
    const payload = current
      ? { ...current, examName, examDate, date: examDate, totalScore, score: totalScore, updatedAt: now }
      : { id, examName, examDate, date: examDate, totalScore, score: totalScore, createdAt: now, updatedAt: now }
    this.setData({ saving: true })
    const result = saveScoreRecord(payload, operationOptions('save_score', id))
    this.setData({ saving: false })
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    this.resetForm()
    this.refresh()
  },

  deleteRecord(event) {
    const record = this._records.find((item) => item.id === event.currentTarget.dataset.id)
    if (!record) return
    wx.showModal({
      title: '删除考试成绩',
      content: `确认删除“${record.examName}”的成绩记录吗？`,
      confirmText: '确认删除',
      confirmColor: '#b42318',
      success: (modal) => {
        if (!modal.confirm) return
        const result = deleteScoreRecord(record.id, operationOptions('delete_score', record.id))
        if (!result.ok) wx.showToast({ title: result.message, icon: 'none' })
        else {
          if (this.data.form.id === record.id) this.resetForm()
          this.refresh()
        }
      }
    })
  },

  drawTrend() {
    if (!this.data.trendItems.length) return
    const query = wx.createSelectorQuery().in(this)
    query.select('#trendCanvas').fields({ node: true, size: true }).exec((result) => {
      const canvasInfo = result && result[0]
      if (!canvasInfo || !canvasInfo.node) return
      const canvas = canvasInfo.node
      const width = canvasInfo.width
      const height = canvasInfo.height
      const ratio = wx.getWindowInfo ? wx.getWindowInfo().pixelRatio : 2
      canvas.width = width * ratio
      canvas.height = height * ratio
      const context = canvas.getContext('2d')
      context.scale(ratio, ratio)
      context.clearRect(0, 0, width, height)
      context.strokeStyle = '#dbe5e2'
      context.lineWidth = 1
      context.beginPath()
      context.moveTo(28, height - 28)
      context.lineTo(width - 28, height - 28)
      context.stroke()

      const points = this.data.trendItems.map((item) => ({
        x: item.leftPercent / 100 * width,
        y: 24 + (740 - item.score) / 740 * (height - 56)
      }))
      context.strokeStyle = '#0f766e'
      context.lineWidth = 2.5
      context.beginPath()
      points.forEach((point, index) => {
        if (index === 0) context.moveTo(point.x, point.y)
        else context.lineTo(point.x, point.y)
      })
      context.stroke()
      points.forEach((point, index) => {
        context.fillStyle = '#0f766e'
        context.beginPath()
        context.arc(point.x, point.y, 4, 0, Math.PI * 2)
        context.fill()
        context.fillStyle = '#17242b'
        context.font = '12px sans-serif'
        context.textAlign = 'center'
        context.fillText(String(this.data.trendItems[index].score), point.x, Math.max(14, point.y - 9))
      })
    })
  }
})
