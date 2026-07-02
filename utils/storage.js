const KEYS = {
  favorites: 'mp1.favorite_school_ids',
  targets: 'mp1.target_records',
  targetDraft: 'mp1.target_draft'
}

function readArray(key) {
  const value = wx.getStorageSync(key)
  return Array.isArray(value) ? value : []
}

function getFavoriteIds() {
  return readArray(KEYS.favorites)
}

function isFavorite(schoolId) {
  return getFavoriteIds().includes(schoolId)
}

function setFavorite(schoolId, nextValue) {
  const ids = new Set(getFavoriteIds())
  if (nextValue) ids.add(schoolId)
  else ids.delete(schoolId)
  const result = Array.from(ids).sort()
  wx.setStorageSync(KEYS.favorites, result)
  return result
}

function getTargetRecords() {
  return readArray(KEYS.targets).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

function saveTargetRecord(record) {
  const records = getTargetRecords().filter((item) => item.id !== record.id)
  records.unshift(record)
  wx.setStorageSync(KEYS.targets, records)
  return records
}

function deleteTargetRecord(id) {
  const records = getTargetRecords().filter((item) => item.id !== id)
  if (records.length) wx.setStorageSync(KEYS.targets, records)
  else wx.removeStorageSync(KEYS.targets)
  return records
}

function clearTargetRecords() {
  wx.removeStorageSync(KEYS.targets)
}

function getTargetDraft() {
  const value = wx.getStorageSync(KEYS.targetDraft)
  return value && typeof value === 'object' ? value : {}
}

function saveTargetDraft(draft) {
  wx.setStorageSync(KEYS.targetDraft, draft)
}

function clearTargetDraft() {
  wx.removeStorageSync(KEYS.targetDraft)
}

function clearLocalDemoData() {
  Object.values(KEYS).forEach((key) => wx.removeStorageSync(key))
}

module.exports = {
  KEYS,
  getFavoriteIds,
  isFavorite,
  setFavorite,
  getTargetRecords,
  saveTargetRecord,
  deleteTargetRecord,
  clearTargetRecords,
  getTargetDraft,
  saveTargetDraft,
  clearTargetDraft,
  clearLocalDemoData
}
