const { APP_CONFIG } = require('../config/app-config')

function dateAtLocalMidnight(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime())) return null
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function calculateExamCountdown(targetYear, now = new Date()) {
  const year = Number(targetYear)
  const today = dateAtLocalMidnight(now)
  if (!Number.isInteger(year) || !today) return null
  const targetDate = new Date(
    year,
    APP_CONFIG.countdown.examMonth - 1,
    APP_CONFIG.countdown.examDay
  )
  const daysRemaining = Math.round((targetDate.getTime() - today.getTime()) / 86400000)
  return {
    targetYear: year,
    targetDate: `${year}-${String(APP_CONFIG.countdown.examMonth).padStart(2, '0')}-${String(APP_CONFIG.countdown.examDay).padStart(2, '0')}`,
    targetDateText: `${year} 年 ${APP_CONFIG.countdown.examMonth} 月 ${APP_CONFIG.countdown.examDay} 日`,
    daysRemaining,
    daysText: daysRemaining < 0
      ? `目标日期已过去 ${Math.abs(daysRemaining)} 天`
      : daysRemaining === 0
        ? '今天是目标中考日期'
        : `距离中考还有 ${daysRemaining} 天`
  }
}

function examYearOptions(selectedYear, now = new Date()) {
  const currentYear = now.getFullYear()
  return Array.from(new Set([
    Number(selectedYear),
    currentYear,
    currentYear + 1,
    currentYear + 2,
    currentYear + 3
  ].filter(Number.isInteger))).sort((left, right) => left - right)
}

module.exports = { calculateExamCountdown, examYearOptions }
