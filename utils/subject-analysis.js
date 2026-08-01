const { compareScoreRecords, scoreDate } = require('./planning')
const { scoreRateBasisPoints, scoreRatePercent } = require('./v1-domain')

const DEFAULT_RECENT_LIMIT = 10
const DEFAULT_VOLATILITY_POINTS = 10
const DEFAULT_VOLATILITY_RATIO = 0.1

function roundOne(value) {
  return Math.round(value * 10) / 10
}

function average(values) {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null
}

function subjectConfigMap(subjectConfigs) {
  return new Map(
    (Array.isArray(subjectConfigs) ? subjectConfigs : [])
      .filter((config) => config && typeof config.subjectId === 'string' && config.subjectId.trim())
      .map((config) => [config.subjectId.trim(), config])
  )
}

function subjectScoreEntries(record) {
  const raw = record && record.subjectScores
  if (Array.isArray(raw)) {
    return raw.map((item) => ({
      subjectId: String(item && (item.subjectId || item.id) || '').trim(),
      subjectName: String(item && (item.subjectName || item.name) || '').trim(),
      maxScore: item && Number.isFinite(item.maxScore) ? item.maxScore : null,
      score: item && typeof item.score === 'number'
        ? item.score
        : item && typeof item.value === 'number'
          ? item.value
          : item && item.subjectScore
    }))
  }
  if (!raw || typeof raw !== 'object') return []
  return Object.keys(raw).map((subjectId) => {
    const value = raw[subjectId]
    return value && typeof value === 'object'
      ? {
        subjectId,
        subjectName: String(value.subjectName || value.name || '').trim(),
        maxScore: Number.isFinite(value.maxScore) ? value.maxScore : null,
        score: typeof value.score === 'number' ? value.score : value.value
      }
      : { subjectId, subjectName: '', maxScore: null, score: value }
  })
}

function collectSubjectSeries(records, subjectConfigs = []) {
  const configs = subjectConfigMap(subjectConfigs)
  const series = new Map()
  const orderedRecords = (Array.isArray(records) ? records : [])
    .filter((record) => record && typeof record === 'object')
    .slice()
    .sort(compareScoreRecords)
  for (const record of orderedRecords) {
    for (const entry of subjectScoreEntries(record)) {
      if (!entry.subjectId || typeof entry.score !== 'number' || !Number.isFinite(entry.score) || entry.score < 0) {
        continue
      }
      const config = configs.get(entry.subjectId)
      const maxScore = Number.isFinite(entry.maxScore)
        ? entry.maxScore
        : config && Number.isFinite(config.maxScore) ? config.maxScore : null
      if (maxScore !== null && entry.score > maxScore) continue
      if (!series.has(entry.subjectId)) {
        series.set(entry.subjectId, {
          subjectId: entry.subjectId,
          subjectName: entry.subjectName ||
            String(config && config.subjectName || '').trim() ||
            entry.subjectId,
          maxScore,
          displayOrder: config && Number.isFinite(config.displayOrder)
            ? config.displayOrder
            : Number.MAX_SAFE_INTEGER,
          points: []
        })
      }
      series.get(entry.subjectId).points.push({
        recordId: record.id,
        examName: record.examName || '',
        examDate: scoreDate(record),
        createdAt: record.createdAt || '',
        score: entry.score,
        maxScore,
        scoreRateBasisPoints: maxScore === null ? null : scoreRateBasisPoints(entry.score, maxScore)
      })
      if (maxScore !== null) series.get(entry.subjectId).maxScore = maxScore
    }
  }
  return Array.from(series.values()).sort((left, right) => {
    const orderCompare = left.displayOrder - right.displayOrder
    return orderCompare !== 0
      ? orderCompare
      : left.subjectName.localeCompare(right.subjectName, 'zh-Hans-CN')
  })
}

function consecutiveTrend(values) {
  if (values.length < 2) return { direction: 'flat', length: values.length }
  const lastDifference = values[values.length - 1] - values[values.length - 2]
  if (lastDifference === 0) return { direction: 'flat', length: 1 }
  const direction = lastDifference > 0 ? 'up' : 'down'
  let length = 2
  for (let index = values.length - 2; index > 0; index -= 1) {
    const difference = values[index] - values[index - 1]
    if ((direction === 'up' && difference > 0) || (direction === 'down' && difference < 0)) {
      length += 1
    } else {
      break
    }
  }
  return { direction, length }
}

function calculateSubjectStatistics(points, options = {}) {
  const recentLimit = Number.isInteger(options.limit) && options.limit > 0
    ? options.limit
    : DEFAULT_RECENT_LIMIT
  const allPoints = Array.isArray(points) ? points : []
  const recentPoints = allPoints.slice(Math.max(0, allPoints.length - recentLimit))
  const allScores = allPoints.map((point) => point.score)
  const recentScores = recentPoints.map((point) => point.score)
  const latest = recentScores.length ? recentScores[recentScores.length - 1] : null
  const previous = recentScores.length > 1 ? recentScores[recentScores.length - 2] : null
  const recentThree = recentScores.slice(Math.max(0, recentScores.length - 3))
  const previousThree = recentScores.length >= 6
    ? recentScores.slice(recentScores.length - 6, recentScores.length - 3)
    : []
  const historicalBeforeLatest = allScores.slice(0, -1)
  const trend = consecutiveTrend(recentScores)
  const highest = recentScores.length ? Math.max(...recentScores) : null
  const lowest = recentScores.length ? Math.min(...recentScores) : null
  const recentThreeAverage = average(recentThree)
  const previousThreeAverage = average(previousThree)
  const historicalAverage = average(allScores)

  return {
    count: allScores.length,
    recentCount: recentScores.length,
    recentPoints,
    highest,
    lowest,
    average: average(recentScores),
    historicalAverage,
    latest,
    previous,
    recentChange: latest === null || previous === null ? null : latest - previous,
    recentThreeAverage,
    previousThreeAverage,
    recentThreeChange: recentThreeAverage === null || previousThreeAverage === null
      ? null
      : recentThreeAverage - previousThreeAverage,
    historicalAverageBeforeLatest: average(historicalBeforeLatest),
    volatility: highest === null || lowest === null ? null : highest - lowest,
    trendDirection: trend.direction,
    trendLength: trend.length,
    consecutiveRise: trend.direction === 'up' && trend.length >= 3,
    consecutiveDecline: trend.direction === 'down' && trend.length >= 3,
    dataSufficient: recentScores.length >= 3
  }
}

function conclusion(code, text, severity = 'info') {
  return { code, text, severity }
}

function buildSubjectConclusions(analysis, options = {}) {
  const stats = analysis.statistics
  const conclusions = []
  if (!stats.dataSufficient) {
    conclusions.push(conclusion('insufficient_data', '数据不足，至少记录 3 次后再观察单科趋势。'))
    return conclusions
  }

  const volatilityPoints = Number.isFinite(options.volatilityPoints)
    ? options.volatilityPoints
    : DEFAULT_VOLATILITY_POINTS
  const volatilityRatio = Number.isFinite(options.volatilityRatio)
    ? options.volatilityRatio
    : DEFAULT_VOLATILITY_RATIO
  const isVolatile = analysis.maxScore
    ? stats.volatility / analysis.maxScore >= volatilityRatio
    : stats.volatility >= volatilityPoints
  if (isVolatile) {
    conclusions.push(conclusion('recent_volatility_high', '近期波动较大。', 'attention'))
  }
  if (stats.recentThreeChange !== null && stats.recentThreeChange < 0) {
    conclusions.push(conclusion('recent_three_average_down', '最近三次平均分低于此前三次。', 'attention'))
  }
  if (stats.consecutiveRise) {
    conclusions.push(conclusion('recent_three_rising', '最近三次持续上升。', 'positive'))
  }
  if (stats.consecutiveDecline) {
    conclusions.push(conclusion('recent_three_falling', '最近三次持续下降。', 'attention'))
  }
  if (
    stats.latest !== null &&
    stats.historicalAverageBeforeLatest !== null &&
    stats.latest < stats.historicalAverageBeforeLatest
  ) {
    conclusions.push(conclusion('latest_below_personal_average', '最近成绩低于个人历史平均。', 'attention'))
  }
  if (conclusions.some((item) => [
    'recent_volatility_high',
    'recent_three_average_down',
    'recent_three_falling'
  ].includes(item.code))) {
    conclusions.push(conclusion('prioritize_review', '建议优先复盘该学科错题和失分记录。', 'action'))
  }
  return conclusions
}

function analyzeSubjectSeries(series, options = {}) {
  const rateMetric = options.metric === 'rate'
  const points = rateMetric
    ? series.points
      .map((point) => ({
        ...point,
        rawScore: point.score,
        score: scoreRatePercent(point.scoreRateBasisPoints)
      }))
      .filter((point) => Number.isFinite(point.score))
    : series.points
  const statistics = calculateSubjectStatistics(points, options)
  const analysis = {
    subjectId: series.subjectId,
    subjectName: series.subjectName,
    maxScore: rateMetric ? 100 : series.maxScore,
    metric: rateMetric ? 'rate' : 'raw',
    displayOrder: series.displayOrder,
    statistics
  }
  return { ...analysis, conclusions: buildSubjectConclusions(analysis, options) }
}

function analyzeSubject(records, subjectId, subjectConfigs = [], options = {}) {
  const series = collectSubjectSeries(records, subjectConfigs)
    .find((item) => item.subjectId === subjectId)
  if (!series) {
    const config = subjectConfigMap(subjectConfigs).get(subjectId)
    return analyzeSubjectSeries({
      subjectId,
      subjectName: String(config && config.subjectName || subjectId || ''),
      maxScore: config && Number.isFinite(config.maxScore) ? config.maxScore : null,
      displayOrder: config && Number.isFinite(config.displayOrder)
        ? config.displayOrder
        : Number.MAX_SAFE_INTEGER,
      points: []
    }, options)
  }
  return analyzeSubjectSeries(series, options)
}

function findMostVolatileSubject(analyses) {
  return (Array.isArray(analyses) ? analyses : [])
    .filter((item) => item && item.statistics && Number.isFinite(item.statistics.volatility))
    .slice()
    .sort((left, right) => {
      const leftMetric = left.maxScore
        ? left.statistics.volatility / left.maxScore
        : left.statistics.volatility
      const rightMetric = right.maxScore
        ? right.statistics.volatility / right.maxScore
        : right.statistics.volatility
      const compare = rightMetric - leftMetric
      return compare !== 0
        ? compare
        : String(left.subjectId).localeCompare(String(right.subjectId))
    })[0] || null
}

function analyzeSubjects(records, subjectConfigs = [], options = {}) {
  const subjects = collectSubjectSeries(records, subjectConfigs)
    .map((series) => analyzeSubjectSeries(series, options))
  const mostVolatileSubject = findMostVolatileSubject(subjects)
  return {
    subjects,
    mostVolatileSubject,
    conclusions: mostVolatileSubject
      ? [conclusion(
        'most_volatile_subject',
        `${mostVolatileSubject.subjectName}是当前记录中波动最大的科目。`,
        'info'
      )]
      : []
  }
}

module.exports = {
  DEFAULT_RECENT_LIMIT,
  DEFAULT_VOLATILITY_POINTS,
  DEFAULT_VOLATILITY_RATIO,
  roundOne,
  subjectScoreEntries,
  collectSubjectSeries,
  consecutiveTrend,
  calculateSubjectStatistics,
  buildSubjectConclusions,
  analyzeSubjectSeries,
  analyzeSubject,
  analyzeSubjects,
  findMostVolatileSubject,
  summarizeSubjects: analyzeSubjects,
  analyzeSubjectTrends: analyzeSubjects,
  subjectTrendFor: analyzeSubject,
  mostVolatileSubject: findMostVolatileSubject
}
