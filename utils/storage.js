const { APP_CONFIG } = require('../config/app-config')

const KEYS = {
  favorites: 'mp1.favorite_school_ids',
  targets: 'mp1.target_records',
  targetDraft: 'mp1.target_draft'
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

function normalizeTargetRecord(value, options = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  if (typeof value.id !== 'string' || !value.id.trim()) return null
  if (typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt))) return null

  const currentScore = value.currentScore
  const targetScore = value.targetScore
  const { min, max } = APP_CONFIG.targetScore
  if (!Number.isInteger(currentScore) || !Number.isInteger(targetScore)) return null
  if (currentScore < min || targetScore < min) return null
  if (options.enforceScoreMax && (currentScore > max || targetScore > max)) return null

  return {
    schemaVersion: 1,
    id: value.id.trim(),
    currentScore,
    targetScore,
    note: typeof value.note === 'string' ? value.note.slice(0, 200) : '',
    createdAt: new Date(value.createdAt).toISOString()
  }
}

function getTargetRecordsResult() {
  const readResult = readStorage(KEYS.targets, [])
  const value = readResult.value
  const records = (Array.isArray(value) ? value : [])
    .map(normalizeTargetRecord)
    .filter(Boolean)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, APP_CONFIG.targetScore.maxRecords)
  return readResult.ok ? { ok: true, records } : { ok: false, records, message: readResult.message }
}

function getTargetRecords() {
  return getTargetRecordsResult().records
}

function saveTargetRecord(record) {
  const normalized = normalizeTargetRecord(record, { enforceScoreMax: true })
  if (!normalized) return { ok: false, message: '目标记录格式无效，请检查后重试。' }

  const existingResult = getTargetRecordsResult()
  if (!existingResult.ok) return { ok: false, message: existingResult.message }
  const records = [
    normalized,
    ...existingResult.records.filter((item) => item.id !== normalized.id)
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
    note: String(safeDraft.note || '').slice(0, 200)
  })
}

function clearTargetDraft() {
  return removeStorage(KEYS.targetDraft)
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
  clearLocalData,
  clearLocalDemoData
}
