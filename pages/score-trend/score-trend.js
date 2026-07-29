const { APP_CONFIG, EXAM_TOTAL_SCORE } = require('../../config/app-config')
const {
  getScoreRecordsResult,
  saveScoreRecord,
  deleteScoreRecord,
  clearScoreRecords
} = require('../../utils/storage')
const { notifyStorageReadResult } = require('../../utils/storage-feedback')
const { summarizeScoreRecords, calculateChartPoints } = require('../../utils/score-trend')

const CHART_HEIGHT = 280
const CHART_PADDING = 38
const MAX_LAYOUT_RETRIES = 3
const LAYOUT_RETRY_DELAY_MS = 80

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
  const summary = summarizeScoreRecords(records)
  return {
    records: [...records].reverse(),
    visibleRecords: summary.recentRecords,
    visibleTrendPoints: [],
    highestText: summary.highestText,
    lowestText: summary.lowestText,
    averageText: summary.averageText,
    changeText: summary.changeText,
    changeValueText: summary.changeValueText,
    changeClass: summary.changeClass
  }
}

Page({
  data: {
    selectedDate: localDateLabel(),
    examName: '',
    scoreInput: '',
    inputError: '',
    records: [],
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
    canvasWidth: null
  },

  onLoad() {
    this._chartDisposed = false
    this._chartDrawToken = 0
    this._chartRetryTimer = null
    this.loadRecords()
  },

  onReady() {
    this.scheduleTrendChartDraw()
  },

  onShow() {
    this.loadRecords()
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

  loadRecords() {
    const result = getScoreRecordsResult()
    notifyStorageReadResult(this, result)
    this.setData(presentRecords(result.records), () => this.scheduleTrendChartDraw())
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
    }, () => this.scheduleTrendChartDraw())
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
        this.setData(presentRecords(result.records), () => this.scheduleTrendChartDraw())
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
        this.setData(presentRecords([]), () => this.scheduleTrendChartDraw())
        wx.showToast({ title: '成绩记录已清空', icon: 'success' })
      }
    })
  }
})
