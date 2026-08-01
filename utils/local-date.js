function twoDigits(value) {
  return String(value).padStart(2, '0')
}

function localDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  return `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`
}

function fromLocalDate(label) {
  if (typeof label !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(label)) return null
  const [year, month, day] = label.split('-').map(Number)
  const value = new Date(year, month - 1, day, 12, 0, 0, 0)
  return value.getFullYear() === year && value.getMonth() === month - 1 && value.getDate() === day
    ? value
    : null
}

function addLocalDays(value, days) {
  const date = value instanceof Date ? new Date(value.getTime()) : fromLocalDate(value)
  if (!date || !Number.isInteger(days)) return ''
  date.setDate(date.getDate() + days)
  return localDate(date)
}

function localWeekRange(value = new Date()) {
  const date = value instanceof Date ? new Date(value.getTime()) : fromLocalDate(value)
  if (!date) return { weekStartDate: '', weekEndDate: '' }
  const day = date.getDay()
  const offsetToMonday = day === 0 ? -6 : 1 - day
  const weekStartDate = addLocalDays(date, offsetToMonday)
  return { weekStartDate, weekEndDate: addLocalDays(weekStartDate, 6) }
}

module.exports = { localDate, fromLocalDate, addLocalDays, localWeekRange }
