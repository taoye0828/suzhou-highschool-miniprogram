const DEFAULT_LIMIT = 10
const EXAM_TOTAL_SCORE = 740

function roundAverage(value) {
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

function compareCreatedAt(leftValue, rightValue) {
  const leftNumber = typeof leftValue === 'number' ? leftValue : Date.parse(leftValue)
  const rightNumber = typeof rightValue === 'number' ? rightValue : Date.parse(rightValue)
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber - rightNumber
  return String(leftValue || '').localeCompare(String(rightValue || ''))
}

function sortScoreRecords(records) {
  return (Array.isArray(records) ? records : [])
    .filter((record) => record &&
      Number.isFinite(Number.isFinite(record.totalScore) ? record.totalScore : record.score) &&
      typeof record.id === 'string')
    .map((record, sourceIndex) => ({
      ...record,
      score: Number.isFinite(record.totalScore) ? record.totalScore : record.score,
      sourceIndex
    }))
    .sort((left, right) => {
      const dateCompare = String(left.examDate || left.date || '').localeCompare(
        String(right.examDate || right.date || '')
      )
      if (dateCompare !== 0) return dateCompare
      const createdCompare = compareCreatedAt(left.createdAt, right.createdAt)
      return createdCompare !== 0 ? createdCompare : left.id.localeCompare(right.id)
    })
}

function getVisibleTrendRecords(records, limit = DEFAULT_LIMIT) {
  const ordered = sortScoreRecords(records)
  return ordered.slice(Math.max(0, ordered.length - limit)).map((record, displayIndex) => ({
    ...record,
    displayIndex: displayIndex + 1
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
  const spacing = items.length > 1 ? usableWidth / (items.length - 1) : usableWidth
  const labelWidth = Math.max(20, Math.min(76, padding * 2, spacing * 0.92))

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
      y: padding + usableHeight * (EXAM_TOTAL_SCORE - record.score) / EXAM_TOTAL_SCORE,
      leftPercent: x / safeWidth * 100,
      labelWidth
    }
  })
}

function prepareScoreTrendData(records, { limit = DEFAULT_LIMIT, width = 640, height = 280, padding = 38 } = {}) {
  const visibleRecords = getVisibleTrendRecords(records, limit)
  const visibleTrendPoints = calculateChartPoints(visibleRecords, width, height, padding)
  return {
    visibleRecords,
    statistics: calculateScoreStatistics(visibleRecords),
    visibleTrendPoints
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
