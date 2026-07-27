const DEFAULT_LIMIT = 10

function roundAverage(value) {
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

function summarizeScoreRecords(records, limit = DEFAULT_LIMIT) {
  const safeRecords = Array.isArray(records)
    ? records.filter((record) => record && Number.isFinite(record.score))
    : []
  const recentRecords = safeRecords.slice(-limit)
  if (!recentRecords.length) {
    return {
      recentRecords: [],
      highestText: '—',
      lowestText: '—',
      averageText: '—',
      changeText: '暂无变化',
      changeValueText: '—',
      changeClass: 'flat'
    }
  }

  const scores = recentRecords.map((record) => record.score)
  const firstScore = scores[0]
  const lastScore = scores[scores.length - 1]
  const change = lastScore - firstScore
  return {
    recentRecords,
    highestText: `${Math.max(...scores)} 分`,
    lowestText: `${Math.min(...scores)} 分`,
    averageText: `${roundAverage(scores.reduce((sum, score) => sum + score, 0) / scores.length)} 分`,
    changeText: recentRecords.length === 1
      ? `${lastScore} 分（等待下一次记录）`
      : `${firstScore} → ${lastScore}`,
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

function chartPoints(records, width, height, padding = 30) {
  const safeWidth = Math.max(1, Number(width) || 1)
  const safeHeight = Math.max(1, Number(height) || 1)
  const items = Array.isArray(records) ? records : []
  if (!items.length) return []

  const scores = items.map((item) => item.score)
  const minScore = Math.min(...scores)
  const maxScore = Math.max(...scores)
  const range = Math.max(1, maxScore - minScore)
  const usableWidth = Math.max(1, safeWidth - padding * 2)
  const usableHeight = Math.max(1, safeHeight - padding * 2)

  return items.map((record, index) => ({
    id: record.id,
    score: record.score,
    x: items.length === 1
      ? safeWidth / 2
      : padding + usableWidth * index / (items.length - 1),
    y: padding + usableHeight * (maxScore - record.score) / range
  }))
}

module.exports = {
  DEFAULT_LIMIT,
  summarizeScoreRecords,
  chartPoints
}
