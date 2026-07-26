const { APP_CONFIG } = require('../config/app-config')

const KEYS = {
  favorites: 'mp1.favorite_school_ids',
  targets: 'mp1.target_records',
  targetDraft: 'mp1.target_draft',
  scoreRecords: 'mp1.score_records',
  examYear: 'mp1.exam_year'
}

const STORAGE_ERROR_MESSAGE = '本地存储失败，请清理空间后重试。'

function logStorageError(operation, error) {
  const errorName = error && error.name ? error.name : 'Error'
  if (typeof console !== 'undefined' && typeof console.error === 'function') {
    console.error(`[storage] ${operation} failed`, errorName)
  }
}

function readStorage(key, fallback) {
  try {
    const value = wx.getStorageSync(key)
    return { ok: true, value: value === undefined || value === null || value === '' ? fallback : value }
  } catch (error) {
    logStorageError(`read ${key}`, error)
    return { ok: false, value: fallback, message: STORAGE_ERROR_MESSAGE }
  }
}

function writeStorage(key, value) {
  try {
    wx.setStorageSync(key, value)
    return { ok: true, value }
  } catch (error) {
    logStorageError(`write ${key}`, error)
    return { ok: false, message: STORAGE_ERROR_MESSAGE }
  }
}

function removeStorage(key) {
  try {
    wx.removeStorageSync(key)
    return { ok: true }
  } catch (error) {
    logStorageError(`remove ${key}`, error)
    return { ok: false, message: STORAGE_ERROR_MESSAGE }
  }
}

function getFavoriteIdsResult() {
  const readResult = readStorage(KEYS.favorites, [])
  const value = readResult.value
  const ids = Array.isArray(value)
    ? [...new Set(value.filter((id) => typeof id === 'string' && id.trim()).map((id) => id.trim()))].sort()
    : []
  return readResult.ok ? { ok: true, ids } : { ok: false, ids, message: readResult.message }
}

function getFavoriteIds() {
  return getFavoriteIdsResult().ids
}

function isFavorite(schoolId) {
  return getFavoriteIds().includes(schoolId)
}

function setFavorite(schoolId, nextValue) {
  if (typeof schoolId !== 'string' || !schoolId.trim()) {
    return { ok: false, message: '学校标识无效，请返回学校库重试。' }
  }

  const favoriteResult = getFavoriteIdsResult()
  if (!favoriteResult.ok) return { ok: false, message: favoriteResult.message }
  const ids = new Set(favoriteResult.ids)
  if (nextValue) ids.add(schoolId.trim())
  else ids.delete(schoolId.trim())
  const result = Array.from(ids).sort()
  return result.length ? writeStorage(KEYS.favorites, result) : removeStorage(KEYS.favorites)
}

function replaceFavoriteIds(ids) {
  const cleanIds = Array.isArray(ids)
    ? [...new Set(ids.filter((id) => typeof id === 'string' && id.trim()).map((id) => id.trim()))].sort()
    : []
  return cleanIds.length ? writeStorage(KEYS.favorites, cleanIds) : removeStorage(KEYS.favorites)
}

function normalizeTargetLevel(value) {
  const levels = APP_CONFIG.targetScore.levels.map((item) => item.value)
  return levels.includes(value) ? value : 'target'
}

function normalizeTargetRecord(value, options = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const schoolId = typeof value.schoolId === 'string' ? value.schoolId.trim() : ''
  const schoolName = typeof value.schoolName === 'string' ? value.schoolName.trim() : ''
  if (!schoolId || !schoolName) return null
  const id = typeof value.id === 'string' && value.id.trim()
    ? value.id.trim()
    : `target_${schoolId}`
  const createdAt = typeof value.createdAt === 'string' && Number.isFinite(Date.parse(value.createdAt))
    ? new Date(value.createdAt).toISOString()
    : new Date(0).toISOString()

  return {
    schemaVersion: 3,
    id,
    schoolId,
    schoolName: schoolName.slice(0, 100),
    level: normalizeTargetLevel(value.level || value.targetLevel),
    createdAt
  }
}

function getTargetRecordsResult() {
  const readResult = readStorage(KEYS.targets, [])
  const value = readResult.value
  const seenSchoolIds = new Set()
  const records = (Array.isArray(value) ? value : [])
    .map((record) => normalizeTargetRecord(record))
    .filter(Boolean)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .filter((record) => {
      if (seenSchoolIds.has(record.schoolId)) return false
      seenSchoolIds.add(record.schoolId)
      return true
    })
    .slice(0, APP_CONFIG.targetScore.maxRecords)
  return readResult.ok ? { ok: true, records } : { ok: false, records, message: readResult.message }
}

function getTargetRecords() {
  return getTargetRecordsResult().records
}

function saveTargetRecord(record) {
  const normalized = normalizeTargetRecord(record)
  if (!normalized) return { ok: false, message: '目标记录格式无效，请检查后重试。' }

  const existingResult = getTargetRecordsResult()
  if (!existingResult.ok) return { ok: false, message: existingResult.message }
  const records = [
    normalized,
    ...existingResult.records.filter((item) => item.schoolId !== normalized.schoolId)
  ].slice(0, APP_CONFIG.targetScore.maxRecords)

  const result = writeStorage(KEYS.targets, records)
  return result.ok ? { ok: true, records } : result
}

function deleteTargetRecord(id) {
  if (typeof id !== 'string' || !id.trim()) return { ok: false, message: '目标记录标识无效。' }
  const existingResult = getTargetRecordsResult()
  if (!existingResult.ok) return { ok: false, message: existingResult.message }
  const records = existingResult.records.filter((item) => item.id !== id)
  const result = records.length ? writeStorage(KEYS.targets, records) : removeStorage(KEYS.targets)
  return result.ok ? { ok: true, records } : result
}

function clearTargetRecords() {
  return removeStorage(KEYS.targets)
}

function getTargetDraftResult() {
  const readResult = readStorage(KEYS.targetDraft, {})
  const value = readResult.value
  const draft = !value || typeof value !== 'object' || Array.isArray(value) || !Object.keys(value).length ? {} : {
    currentScore: typeof value.currentScore === 'string' ? value.currentScore.slice(0, APP_CONFIG.targetScore.maxLength) : '',
    targetScore: typeof value.targetScore === 'string' ? value.targetScore.slice(0, APP_CONFIG.targetScore.maxLength) : '',
    targetLevel: normalizeTargetLevel(value.targetLevel),
    note: typeof value.note === 'string' ? value.note.slice(0, 200) : ''
  }
  return readResult.ok ? { ok: true, draft } : { ok: false, draft, message: readResult.message }
}

function getTargetDraft() {
  return getTargetDraftResult().draft
}

function saveTargetDraft(draft) {
  const safeDraft = draft && typeof draft === 'object' && !Array.isArray(draft) ? draft : {}
  const currentScore = safeDraft.currentScore === null || safeDraft.currentScore === undefined ? '' : safeDraft.currentScore
  const targetScore = safeDraft.targetScore === null || safeDraft.targetScore === undefined ? '' : safeDraft.targetScore
  return writeStorage(KEYS.targetDraft, {
    currentScore: String(currentScore).slice(0, APP_CONFIG.targetScore.maxLength),
    targetScore: String(targetScore).slice(0, APP_CONFIG.targetScore.maxLength),
    targetLevel: normalizeTargetLevel(safeDraft.targetLevel),
    note: String(safeDraft.note || '').slice(0, 200)
  })
}

function clearTargetDraft() {
  return removeStorage(KEYS.targetDraft)
}

function isValidDateLabel(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function normalizeScoreRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  if (typeof value.id !== 'string' || !value.id.trim()) return null
  if (!isValidDateLabel(value.date)) return null
  if (typeof value.examName !== 'string') return null
  const examName = value.examName.trim()
  if (!examName || examName.length > APP_CONFIG.scoreRecord.examNameMaxLength) return null
  const { min, max } = APP_CONFIG.targetScore
  if (!Number.isInteger(value.score) || value.score < min || value.score > max) return null
  const createdAt = typeof value.createdAt === 'string' && Number.isFinite(Date.parse(value.createdAt))
    ? new Date(value.createdAt).toISOString()
    : `${value.date}T00:00:00.000Z`
  return {
    schemaVersion: 1,
    id: value.id.trim(),
    date: value.date,
    examName,
    score: value.score,
    createdAt
  }
}

function compareScoreRecords(left, right) {
  const dateCompare = left.date.localeCompare(right.date)
  if (dateCompare !== 0) return dateCompare
  const timeCompare = Date.parse(left.createdAt) - Date.parse(right.createdAt)
  return timeCompare !== 0 ? timeCompare : left.id.localeCompare(right.id)
}

function getScoreRecordsResult() {
  const readResult = readStorage(KEYS.scoreRecords, [])
  const records = (Array.isArray(readResult.value) ? readResult.value : [])
    .map(normalizeScoreRecord)
    .filter(Boolean)
    .sort(compareScoreRecords)
    .slice(-APP_CONFIG.scoreRecord.maxRecords)
  return readResult.ok ? { ok: true, records } : { ok: false, records, message: readResult.message }
}

function getScoreRecords() {
  return getScoreRecordsResult().records
}

function saveScoreRecord(record) {
  const normalized = normalizeScoreRecord(record)
  if (!normalized) return { ok: false, message: '成绩记录格式无效，请检查后重试。' }
  const existingResult = getScoreRecordsResult()
  if (!existingResult.ok) return { ok: false, message: existingResult.message }
  const records = [
    ...existingResult.records.filter((item) => item.id !== normalized.id),
    normalized
  ].sort(compareScoreRecords).slice(-APP_CONFIG.scoreRecord.maxRecords)
  const result = writeStorage(KEYS.scoreRecords, records)
  return result.ok ? { ok: true, records } : result
}

function deleteScoreRecord(id) {
  if (typeof id !== 'string' || !id.trim()) return { ok: false, message: '成绩记录标识无效。' }
  const existingResult = getScoreRecordsResult()
  if (!existingResult.ok) return { ok: false, message: existingResult.message }
  const records = existingResult.records.filter((item) => item.id !== id)
  const result = records.length ? writeStorage(KEYS.scoreRecords, records) : removeStorage(KEYS.scoreRecords)
  return result.ok ? { ok: true, records } : result
}

function clearScoreRecords() {
  return removeStorage(KEYS.scoreRecords)
}

function getExamYearResult() {
  const readResult = readStorage(KEYS.examYear, APP_CONFIG.countdown.defaultYear)
  const value = Number(readResult.value)
  const year = Number.isInteger(value) &&
    value >= APP_CONFIG.countdown.minYear &&
    value <= APP_CONFIG.countdown.maxYear
    ? value
    : APP_CONFIG.countdown.defaultYear
  return readResult.ok ? { ok: true, year } : { ok: false, year, message: readResult.message }
}

function getExamYear() {
  return getExamYearResult().year
}

function saveExamYear(year) {
  const value = Number(year)
  if (!Number.isInteger(value) ||
      value < APP_CONFIG.countdown.minYear ||
      value > APP_CONFIG.countdown.maxYear) {
    return { ok: false, message: '目标年份无效，请重新选择。' }
  }
  return writeStorage(KEYS.examYear, value)
}

function clearLocalData() {
  const failedKeys = Object.values(KEYS).filter((key) => !removeStorage(key).ok)
  return failedKeys.length
    ? { ok: false, message: '部分本地数据清除失败，请重试。' }
    : { ok: true }
}

function clearLocalDemoData() {
  return clearLocalData()
}

module.exports = {
  KEYS,
  getFavoriteIdsResult,
  getFavoriteIds,
  isFavorite,
  setFavorite,
  replaceFavoriteIds,
  getTargetRecordsResult,
  getTargetRecords,
  saveTargetRecord,
  deleteTargetRecord,
  clearTargetRecords,
  getTargetDraftResult,
  getTargetDraft,
  saveTargetDraft,
  clearTargetDraft,
  getScoreRecordsResult,
  getScoreRecords,
  saveScoreRecord,
  deleteScoreRecord,
  clearScoreRecords,
  getExamYearResult,
  getExamYear,
  saveExamYear,
  clearLocalData,
  clearLocalDemoData
}
