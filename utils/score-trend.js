const DEFAULT_LIMIT = 10
const EXAM_TOTAL_SCORE = 740

function roundAverage(value) {
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

function sortScoreRecords(records) {
  return (Array.isArray(records) ? records : [])
    .filter((record) => record && Number.isFinite(record.score) && typeof record.id === 'string')
    .map((record, sourceIndex) => ({ ...record, sourceIndex }))
    .sort((left, right) => {
      const dateCompare = String(left.examDate || left.date || '').localeCompare(
        String(right.examDate || right.date || '')
      )
      if (dateCompare !== 0) return dateCompare
      const createdCompare = String(left.createdAt || '').localeCompare(String(right.createdAt || ''))
      return createdCompare !== 0 ? createdCompare : left.id.localeCompare(right.id)
    })
}

function getVisibleTrendRecords(records, limit = DEFAULT_LIMIT) {
  const ordered = sortScoreRecords(records)
  return ordered.slice(Math.max(0, ordered.length - limit)).map((record, displayIndex) => ({
    ...record,
    displayIndex
  }))
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
  const lastScore = scores[scores.length - 1]
  const previousScore = scores.length > 1 ? scores[scores.length - 2] : null
  const change = previousScore === null ? null : lastScore - previousScore
  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length
  return {
    highest: Math.max(...scores),
    lowest: Math.min(...scores),
    average,
    change,
    highestText: `${Math.max(...scores)} 分`,
    lowestText: `${Math.min(...scores)} 分`,
    averageText: `${roundAverage(average)} 分`,
    changeText: recentRecords.length === 1
      ? '暂无上次成绩可比较'
      : `${previousScore} → ${lastScore}`,
    changeValueText: recentRecords.length === 1
      ? '暂无变化'
      : change > 0
        ? `提升 +${change} 分`
        : change < 0
          ? `下降 ${change} 分`
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

  return items.map((record, index) => ({
    id: record.id,
    examName: record.examName,
    examDate: record.examDate || record.date,
    createdAt: record.createdAt,
    score: record.score,
    sourceIndex: record.sourceIndex,
    displayIndex: index,
    x: items.length === 1
      ? safeWidth / 2
      : padding + usableWidth * index / (items.length - 1),
    y: padding + usableHeight * (EXAM_TOTAL_SCORE - record.score) / EXAM_TOTAL_SCORE
  }))
}

function prepareScoreTrendData(records, { limit = DEFAULT_LIMIT, width = 640, height = 280, padding = 38 } = {}) {
  const recentRecords = getVisibleTrendRecords(records, limit)
  return {
    recentRecords,
    statistics: calculateScoreStatistics(recentRecords),
    points: calculateChartPoints(recentRecords, width, height, padding)
  }
}

function summarizeScoreRecords(records, limit = DEFAULT_LIMIT) {
  const recentRecords = getVisibleTrendRecords(records, limit)
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
