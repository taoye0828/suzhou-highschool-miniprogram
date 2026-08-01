const { scoreRateBasisPoints } = require('./v1-domain')

const METRIC_LABELS = Object.freeze({
  total_score: '总分',
  subject_score: '学科分',
  score_rate: '得分率',
  task_completion: '任务完成率'
})

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value))
}

function dateFromLabel(label) {
  const [year, month, day] = String(label || '').split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

function dateLabel(date) {
  return date.toISOString().slice(0, 10)
}

function shiftDate(label, days) {
  const date = dateFromLabel(label)
  date.setUTCDate(date.getUTCDate() + days)
  return dateLabel(date)
}

function weekRange(label) {
  const date = dateFromLabel(label)
  const day = date.getUTCDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  const start = shiftDate(label, mondayOffset)
  return { weekStartDate: start, weekEndDate: shiftDate(start, 6) }
}

function copyWeeklyPlanToNextWeek(plan, id, now) {
  const start = shiftDate(plan.weekStartDate, 7)
  return {
    ...clone(plan),
    id,
    weekStartDate: start,
    weekEndDate: shiftDate(start, 6),
    createdAt: now,
    updatedAt: now,
    version: 1
  }
}

function orderedExams(records) {
  return (Array.isArray(records) ? records : []).slice().sort((left, right) => {
    const date = String(left.examDate || left.date || '').localeCompare(String(right.examDate || right.date || ''))
    return date !== 0 ? date : String(left.id).localeCompare(String(right.id))
  })
}

function metricSeries(goal, scoreRecords, learningTasks) {
  if (!goal) return []
  if (goal.metricType === 'task_completion') {
    const tasks = (Array.isArray(learningTasks) ? learningTasks : []).filter((item) => item.stageGoalId === goal.id)
    if (!tasks.length) return []
    const completed = tasks.filter((item) => item.status === 'completed').length
    return [{ date: goal.endDate || goal.startDate || '', value: Math.round(completed * 100 / tasks.length) }]
  }
  return orderedExams(scoreRecords).map((record) => {
    if (goal.metricType === 'subject_score') {
      const subject = (record.subjectScores || []).find((item) =>
        goal.metricSubjectId ? item.subjectId === goal.metricSubjectId : item.subjectName === goal.metricSubjectName)
      return subject && Number.isFinite(subject.score)
        ? { date: record.examDate || record.date || '', value: subject.score, recordId: record.id }
        : null
    }
    if (goal.metricType === 'score_rate') {
      const value = Number.isInteger(record.scoreRateBasisPoints)
        ? record.scoreRateBasisPoints
        : scoreRateBasisPoints(record.totalScore, record.totalMaxScore)
      return Number.isInteger(value)
        ? { date: record.examDate || record.date || '', value, recordId: record.id }
        : null
    }
    return Number.isFinite(record.totalScore)
      ? { date: record.examDate || record.date || '', value: record.totalScore, recordId: record.id }
      : null
  }).filter(Boolean)
}

function goalProgressValue(goal, scoreRecords, learningTasks) {
  const series = metricSeries(goal, scoreRecords, learningTasks)
  if (!series.length) return { comparable: false, value: null, text: '暂无可比较记录' }
  const value = series[series.length - 1].value
  const text = goal.metricType === 'score_rate'
    ? `${(value / 100).toFixed(2)}%`
    : goal.metricType === 'task_completion'
      ? `${value}%`
      : `${value} 分`
  return { comparable: true, value, text }
}

function createStageReviewSnapshot(goal, scoreRecords, learningTasks, summary, id, now) {
  const series = metricSeries(goal, scoreRecords, learningTasks)
  const tasks = (Array.isArray(learningTasks) ? learningTasks : []).filter((item) => item.stageGoalId === goal.id)
  const exams = orderedExams(scoreRecords).filter((item) => {
    const date = item.examDate || item.date || ''
    return (!goal.startDate || date >= goal.startDate) && (!goal.endDate || date <= goal.endDate)
  })
  return {
    id,
    stageGoalId: goal.id,
    stageGoalSnapshot: clone(goal),
    startDataSnapshot: series.length ? clone(series[0]) : {},
    endDataSnapshot: series.length ? clone(series[series.length - 1]) : {},
    taskSummarySnapshot: {
      total: tasks.length,
      completed: tasks.filter((item) => item.status === 'completed').length,
      items: clone(tasks.map((item) => ({ id: item.id, title: item.title, status: item.status })))
    },
    examSummarySnapshot: {
      total: exams.length,
      items: clone(exams.map((item) => ({
        id: item.id,
        examName: item.examName,
        examDate: item.examDate || item.date,
        totalScore: item.totalScore,
        totalMaxScore: item.totalMaxScore,
        scoreRateBasisPoints: item.scoreRateBasisPoints
      })))
    },
    summary: String(summary || '').trim(),
    createdAt: now,
    updatedAt: now,
    version: 1
  }
}

module.exports = {
  METRIC_LABELS,
  shiftDate,
  weekRange,
  copyWeeklyPlanToNextWeek,
  metricSeries,
  goalProgressValue,
  createStageReviewSnapshot
}
