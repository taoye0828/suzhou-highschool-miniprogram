const { EXAM_TOTAL_SCORE } = require('../config/app-config')
const { schools } = require('../data/schools')
const { admissionScores } = require('../data/admission-scores')
const { analyzeScore } = require('./score-analysis')
const { getVisibleTrendRecords, calculateScoreStatistics } = require('./score-trend')
const { LOSS_REASON_TYPES, validDate } = require('./rc9-models')

const ALL_ADMISSION_SCORES = admissionScores

function validScenarioScore(value, optional = false) {
  if (optional && (value === '' || value === null || value === undefined)) return null
  const number = Number(value)
  if (!Number.isInteger(number) || number < 0 || number > EXAM_TOTAL_SCORE) {
    throw new TypeError(`情景成绩必须是 0—${EXAM_TOTAL_SCORE} 的整数`)
  }
  return number
}

function scenarioResults(settings, options = {}) {
  const currentScore = validScenarioScore(settings.currentScore)
  const scenarios = [
    { key: 'current', label: '当前成绩', score: currentScore },
    { key: 'stage', label: '下一阶段目标', score: validScenarioScore(settings.stageTargetScore, true) },
    { key: 'final', label: '中考目标', score: validScenarioScore(settings.finalTargetScore, true) }
  ].filter((item) => item.score !== null)
  return scenarios.map((scenario) => {
    const results = analyzeScore({
      userScore: scenario.score,
      targetYear: Number(settings.targetYear),
      schools: options.schools || schools,
      scores: options.scores || ALL_ADMISSION_SCORES,
      targetRecords: options.targetRecords || [],
      favoriteIds: options.favoriteIds || [],
      districts: settings.districts || [],
      schoolTypes: settings.schoolTypes || [],
      referenceYears: settings.referenceYears || [],
      limitPerLevel: options.limitPerLevel === undefined ? 5 : options.limitPerLevel
    }).map((item) => ({
      ...item,
      scenarioKey: scenario.key,
      scenarioLabel: scenario.label,
      scenarioScore: scenario.score,
      improvementFromCurrent: scenario.score - currentScore
    }))
    const targetClassification = Object.fromEntries(results
      .filter((item) => item.isTargetSchool)
      .map((item) => [item.schoolId, item.level]))
    return {
      ...scenario,
      improvementFromCurrent: scenario.score - currentScore,
      results,
      counts: {
        sprint: results.filter((item) => item.level === 'sprint').length,
        target: results.filter((item) => item.level === 'target').length,
        safe: results.filter((item) => item.level === 'safe').length
      },
      schoolIds: results.map((item) => item.schoolId),
      targetClassification
    }
  })
}

function lossReasonStatistics(reasons, scoreRecords) {
  const recordsById = new Map((Array.isArray(scoreRecords) ? scoreRecords : [])
    .map((item) => [item.id, item]))
  const ordered = (Array.isArray(reasons) ? reasons : [])
    .filter((item) => item && LOSS_REASON_TYPES.includes(item.reasonType))
    .slice()
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
  const counts = new Map()
  for (const item of ordered) counts.set(item.reasonType, (counts.get(item.reasonType) || 0) + 1)
  const latestExamIds = [...new Set(
    [...recordsById.values()]
      .sort((left, right) => String(right.examDate).localeCompare(String(left.examDate)))
      .map((item) => item.id)
  )].slice(0, 3)
  const recentCounts = new Map()
  for (const item of ordered.filter((reason) => latestExamIds.includes(reason.examRecordId))) {
    recentCounts.set(item.reasonType, (recentCounts.get(item.reasonType) || 0) + 1)
  }
  const types = LOSS_REASON_TYPES.map((reasonType) => ({
    reasonType,
    count: counts.get(reasonType) || 0,
    recentThreeCount: recentCounts.get(reasonType) || 0,
    repeatedInRecentThree: (recentCounts.get(reasonType) || 0) >= 2,
    latestAt: (ordered.find((item) => item.reasonType === reasonType) || {}).updatedAt || ''
  })).filter((item) => item.count > 0)
    .sort((left, right) => right.count - left.count || right.latestAt.localeCompare(left.latestAt))
  return {
    total: ordered.length,
    recent: ordered.slice(0, 5),
    types,
    mostFrequent: types[0] || null,
    reducedTypes: types.filter((item) => item.count > item.recentThreeCount && !item.repeatedInRecentThree)
  }
}

function goalProgress(stageGoals, learningTasks, scoreRecords, now = new Date()) {
  const goals = Array.isArray(stageGoals) ? stageGoals : []
  const tasks = Array.isArray(learningTasks) ? learningTasks : []
  const latestScores = getVisibleTrendRecords(scoreRecords, 1)
  const currentScore = latestScores.length ? latestScores[0].score : null
  const today = now.toISOString().slice(0, 10)
  const weekEnd = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10)
  const goalById = new Map(goals.map((item) => [item.id, item]))
  const presentTask = (task) => ({
    ...task,
    stageGoalTitle: (goalById.get(task.stageGoalId) || {}).title || '',
    dueSoon: validDate(task.dueDate) && task.dueDate >= today && task.dueDate <= weekEnd,
    overdue: validDate(task.dueDate) && task.dueDate < today && task.status !== 'completed'
  })
  const presentedTasks = tasks.map(presentTask)
  return {
    currentScore,
    goals: goals.map((goal) => ({
      ...goal,
      currentScore,
      scoreGap: Number.isInteger(currentScore) && Number.isInteger(goal.targetTotalScore)
        ? goal.targetTotalScore - currentScore
        : null,
      daysRemaining: validDate(goal.endDate)
        ? Math.ceil((Date.parse(`${goal.endDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000)
        : null,
      tasks: presentedTasks.filter((task) => task.stageGoalId === goal.id)
    })),
    unlinkedTasks: presentedTasks.filter((task) => !task.stageGoalId),
    thisWeek: presentedTasks.filter((task) => task.dueSoon),
    completedCount: tasks.filter((item) => item.status === 'completed').length,
    incompleteCount: tasks.filter((item) => item.status !== 'completed').length,
    pausedCount: tasks.filter((item) => item.status === 'paused').length,
    dueSoonCount: presentedTasks.filter((item) => item.dueSoon).length
  }
}

function targetGapTrajectory(scoreRecords, referenceScore, limit = 10) {
  if (!Number.isInteger(referenceScore)) {
    return { points: [], summary: null, referenceScore: null }
  }
  const records = getVisibleTrendRecords(scoreRecords, limit)
  const points = records.map((item) => ({
    ...item,
    difference: item.score - referenceScore
  }))
  const statistics = calculateScoreStatistics(records)
  return {
    points,
    referenceScore,
    summary: points.length
      ? {
          recordCount: points.length,
          latestScore: points[points.length - 1].score,
          latestDifference: points[points.length - 1].difference,
          firstToLatestChange: points[points.length - 1].difference - points[0].difference,
          recentChange: points.length > 1
            ? points[points.length - 1].difference - points[points.length - 2].difference
            : null,
          highest: statistics.highest,
          lowest: statistics.lowest,
          average: statistics.average
        }
      : null
  }
}

function schoolScoreTrend(schoolId, scores = ALL_ADMISSION_SCORES) {
  return (Array.isArray(scores) ? scores : [])
    .filter((item) => item && item.schoolId === schoolId &&
      Number.isInteger(item.year) &&
      Number.isFinite(Number(item.minScore === undefined ? item.score : item.minScore)))
    .map((item) => ({
      id: item.id,
      schoolId,
      year: item.year,
      score: Number(item.minScore === undefined ? item.score : item.minScore),
      itemName: item.itemName || item.admissionType || item.batch || '录取分数线',
      sourceUrl: item.sourceUrl || ''
    }))
    .sort((left, right) => left.year - right.year ||
      left.itemName.localeCompare(right.itemName, 'zh-Hans-CN') ||
      String(left.id).localeCompare(String(right.id)))
}

function dynamicHelpState(context, dismissed = {}) {
  const candidates = [
    ['no_scores', !context.scoreCount, '先记录一次成绩，趋势与目标差距才会开始计算。'],
    ['no_targets', context.scoreCount > 0 && !context.targetCount, '从学校库加入目标学校，可持续查看分差变化。'],
    ['no_stage_goal', context.targetCount > 0 && !context.stageGoalCount, '建立一个阶段目标，把目标拆成可执行任务。'],
    ['no_tasks', context.stageGoalCount > 0 && !context.learningTaskCount, '可从考试复盘的失分原因创建学习任务。'],
    ['multiple_profiles', context.profileCount > 1 && !context.hasUsedMultipleProfiles, '切换档案时，成绩、目标和任务会保持隔离。'],
    ['backup_first', !context.hasBackup, '首次备份前可先预览档案、成绩、目标和任务数量。'],
    ['trend_short', context.scoreCount === 1, '至少两条成绩才能计算最近变化，单条记录仍会居中显示。'],
    ['data_health', context.healthIssueCount > 0, `数据检查发现 ${context.healthIssueCount} 项，请先查看再决定是否修复。`],
    ['compare_first', context.inCompareMode, '选择至少两所学校后，可调整顺序并查看正式字段对比。']
  ]
  const selected = candidates.find(([id, visible]) => visible && !dismissed[id])
  return selected ? { id: selected[0], message: selected[2], version: 1 } : null
}

module.exports = {
  ALL_ADMISSION_SCORES,
  validScenarioScore,
  scenarioResults,
  lossReasonStatistics,
  goalProgress,
  targetGapTrajectory,
  schoolScoreTrend,
  dynamicHelpState
}
