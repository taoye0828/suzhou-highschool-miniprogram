const { EXAM_TOTAL_SCORE } = require('../config/app-config')
const { sortScoreRecords } = require('./planning')
const { trendValue } = require('./v1-domain')

const DEFAULT_LIMIT = 10

function roundAverage(value) {
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

function getVisibleTrendRecords(records, limit = DEFAULT_LIMIT, metric = 'raw') {
  const ordered = sortScoreRecords(records)
  return ordered
    .slice(Math.max(0, ordered.length - limit))
    .map((source, displayIndex) => ({
      ...source,
      score: trendValue(source, metric),
      trendMetric: metric,
      displayIndex: displayIndex + 1
    }))
    .filter((item) => Number.isFinite(item.score))
}

function calculateScoreStatistics(records) {
  const recentRecords = Array.isArray(records) ? records : []
  if (!recentRecords.length) {
    return {
      highest: null,
      lowest: null,
      average: null,
      change: null,
      highestText: '—',
      lowestText: '—',
      averageText: '—',
      changeText: '暂无变化',
      changeValueText: '—',
      changeClass: 'flat'
    }
  }

  const scores = recentRecords.map((record) => record.score)
  const rateMetric = recentRecords[0] && recentRecords[0].trendMetric === 'rate'
  const valueText = (value) => rateMetric ? `${Number(value).toFixed(2)}%` : `${roundAverage(value)} 分`
  const lastScore = scores[scores.length - 1]
  const previousScore = scores.length > 1 ? scores[scores.length - 2] : null
  const change = previousScore === null ? null : lastScore - previousScore
  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length
  return {
    highest: Math.max(...scores),
    lowest: Math.min(...scores),
    average,
    change,
    highestText: valueText(Math.max(...scores)),
    lowestText: valueText(Math.min(...scores)),
    averageText: valueText(average),
    changeText: recentRecords.length === 1
      ? '暂无上次成绩可比较'
      : rateMetric
        ? `${valueText(previousScore)} → ${valueText(lastScore)}`
        : `${previousScore} → ${lastScore}`,
    changeValueText: recentRecords.length === 1
      ? '暂无变化'
      : change > 0
        ? rateMetric ? `提升 +${change.toFixed(2)} 个百分点` : `提升 +${change} 分`
        : change < 0
          ? rateMetric ? `下降 ${change.toFixed(2)} 个百分点` : `下降 ${change} 分`
          : '持平 0 分',
    changeClass: change > 0 ? 'up' : change < 0 ? 'down' : 'flat'
  }
}

function calculateChartPoints(records, width, height, padding = 30) {
  const safeWidth = Math.max(1, Number(width) || 1)
  const safeHeight = Math.max(1, Number(height) || 1)
  const items = Array.isArray(records) ? records : []
  if (!items.length) return []

  const usableWidth = Math.max(1, safeWidth - padding * 2)
  const usableHeight = Math.max(1, safeHeight - padding * 2)
  const spacing = items.length > 1 ? usableWidth / (items.length - 1) : usableWidth
  const labelWidth = Math.max(20, Math.min(76, padding * 2, spacing * 0.92))
  const scaleMax = items[0] && items[0].trendMetric === 'rate' ? 100 : EXAM_TOTAL_SCORE

  return items.map((record, index) => {
    const displayIndex = Number.isInteger(record.displayIndex) ? record.displayIndex : index + 1
    const examDate = String(record.examDate || record.date || '')
    const examName = typeof record.examName === 'string' && record.examName.trim()
      ? record.examName.trim()
      : `第 ${displayIndex} 次考试`
    const x = items.length === 1
      ? safeWidth / 2
      : padding + usableWidth * index / (items.length - 1)
    return {
      id: record.id,
      examName,
      examDate,
      displayDate: examDate.length >= 10 ? examDate.slice(5, 10) : examDate,
      createdAt: record.createdAt,
      score: record.score,
      sourceIndex: record.sourceIndex,
      displayIndex,
      x,
      y: padding + usableHeight * (scaleMax - record.score) / scaleMax,
      leftPercent: x / safeWidth * 100,
      labelWidth
    }
  })
}

function prepareScoreTrendData(records, { limit = DEFAULT_LIMIT, width = 640, height = 280, padding = 38, metric = 'raw' } = {}) {
  const visibleRecords = getVisibleTrendRecords(records, limit, metric)
  const visibleTrendPoints = calculateChartPoints(visibleRecords, width, height, padding)
  return {
    visibleRecords,
    statistics: calculateScoreStatistics(visibleRecords),
    visibleTrendPoints
  }
}

function summarizeScoreRecords(records, limit = DEFAULT_LIMIT, metric = 'raw') {
  const recentRecords = getVisibleTrendRecords(records, limit, metric)
  return { recentRecords, ...calculateScoreStatistics(recentRecords) }
}

const chartPoints = calculateChartPoints

module.exports = {
  DEFAULT_LIMIT,
  EXAM_TOTAL_SCORE,
  sortScoreRecords,
  getVisibleTrendRecords,
  calculateScoreStatistics,
  calculateChartPoints,
  prepareScoreTrendData,
  summarizeScoreRecords,
  chartPoints
}
