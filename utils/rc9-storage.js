const { APP_CONFIG } = require('../config/app-config')
const {
  STORAGE_SCHEMA_VERSION,
  DEFAULT_PROFILE_ID,
  clone,
  text,
  validDate,
  normalizeStringList,
  normalizeExamRecord,
  normalizeTargetLevel,
  normalizeTargetRecord,
  normalizeStageGoal,
  normalizeScoreReview,
  normalizeScoreLossReason,
  normalizeLearningTask,
  normalizeProfile,
  normalizeRecommendationSettings,
  normalizeScenarioSettings,
  normalizeRecentHistory,
  normalizeSchoolFilters,
  createEmptyProfileData,
  normalizeProfileData,
  normalizeSubjectConfig
} = require('./rc9-models')
const {
  MIGRATION_CHAIN,
  migrateStorageSnapshot,
  storageWritesForState
} = require('./storage-migration')
const { LEGACY_STORAGE_KEYS } = require('./legacy/migration/storage-keys')

const KEYS = {
  storageSchemaVersion: 'rc9.storage_schema_version',
  profiles: 'rc9.student_profiles.v4',
  activeProfileId: 'rc9.active_profile_id.v4',
  profileData: 'rc9.profile_data.v4',
  sharedFavorites: 'rc9.shared_favorite_school_ids.v4',
  onboardingV4: 'rc9.onboarding.v4',
  userSettings: 'rc9.user_settings.v4',
  migrationBackup: 'rc9.migration_backup.v4',
  lastMigration: 'rc9.last_migration.v4',
  dataRevision: 'rc9.data_revision.v4',
  clearMarker: 'rc9.clear_marker.v4',
  importSnapshot: 'rc9.import_snapshot.v4',
  transactionJournal: 'rc10.transaction_journal.v1',
  repairSnapshot: 'rc10.repair_snapshot.v1'
}

const STORAGE_ERROR_MESSAGE = '本地存储失败，请清理空间后重试。'
const ALL_KNOWN_KEYS = [
  ...Object.values(KEYS),
  ...Object.values(LEGACY_STORAGE_KEYS)
]

function logStorageError(operation, error) {
  const errorName = error && error.name ? error.name : 'Error'
  if (typeof console !== 'undefined' && typeof console.error === 'function') {
    console.error(`[storage] ${operation} failed`, errorName)
  }
}

function readStorage(key, fallback) {
  try {
    const value = wx.getStorageSync(key)
    return {
      ok: true,
      exists: value !== undefined && value !== null && value !== '',
      value: value === undefined || value === null || value === '' ? clone(fallback) : value
    }
  } catch (error) {
    logStorageError(`read ${key}`, error)
    return { ok: false, exists: false, value: clone(fallback), message: STORAGE_ERROR_MESSAGE }
  }
}

function writeStorage(key, value) {
  try {
    wx.setStorageSync(key, clone(value))
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

function storageSnapshot(keys = ALL_KNOWN_KEYS) {
  const values = {}
  for (const key of keys) {
    const result = readStorage(key, undefined)
    if (!result.ok) return { ok: false, values: {}, message: result.message }
    if (result.exists) values[key] = clone(result.value)
  }
  return { ok: true, values }
}

function restoreSnapshot(snapshot, keys) {
  let ok = true
  for (const key of keys) {
    const result = Object.prototype.hasOwnProperty.call(snapshot, key)
      ? writeStorage(key, snapshot[key])
      : removeStorage(key)
    ok = ok && result.ok
  }
  return ok
}

function atomicWrite(values) {
  const keys = Object.keys(values)
  const before = storageSnapshot(keys)
  if (!before.ok) return { ok: false, message: before.message }
  const transactionId = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const journal = writeStorage(KEYS.transactionJournal, {
    transactionId,
    createdAt: new Date().toISOString(),
    keys,
    before: before.values,
    status: 'writing'
  })
  if (!journal.ok) {
    return { ok: false, message: '本地安全写入未开始，原数据已保留。' }
  }
  for (const key of keys) {
    const result = writeStorage(key, values[key])
    if (!result.ok) {
      const restored = restoreSnapshot(before.values, keys)
      removeStorage(KEYS.transactionJournal)
      return {
        ok: false,
        message: restored
          ? '本地写入失败，原数据已保留，请清理空间后重试。'
          : '本地写入失败，自动恢复未完成，请通过数据检查恢复安全快照。'
      }
    }
    const verify = readStorage(key, undefined)
    if (!verify.ok || JSON.stringify(verify.value) !== JSON.stringify(clone(values[key]))) {
      const restored = restoreSnapshot(before.values, keys)
      removeStorage(KEYS.transactionJournal)
      return {
        ok: false,
        message: restored
          ? '本地写入回读校验失败，原数据已保留，请重试。'
          : '本地写入回读校验失败，请通过数据检查恢复安全快照。'
      }
    }
  }
  const cleaned = removeStorage(KEYS.transactionJournal)
  if (!cleaned.ok) {
    return { ok: false, message: '数据已保存，但临时事务标记清理失败，请运行数据检查。' }
  }
  return { ok: true }
}

function atomicRemove(keys, finalWrites = {}) {
  const removeKeys = keys.filter((key) => key !== KEYS.transactionJournal)
  const touched = [...new Set([...removeKeys, ...Object.keys(finalWrites)])]
  const before = storageSnapshot(touched)
  if (!before.ok) return { ok: false, message: before.message }
  const journal = writeStorage(KEYS.transactionJournal, {
    transactionId: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    keys: touched,
    before: before.values,
    status: 'removing'
  })
  if (!journal.ok) return { ok: false, message: '本地安全清除未开始，原数据已保留。' }
  for (const key of removeKeys) {
    const result = removeStorage(key)
    if (!result.ok) {
      restoreSnapshot(before.values, touched)
      removeStorage(KEYS.transactionJournal)
      return { ok: false, message: '本地数据清除失败，原数据已保留。' }
    }
  }
  for (const [key, value] of Object.entries(finalWrites)) {
    const result = writeStorage(key, value)
    if (!result.ok) {
      restoreSnapshot(before.values, touched)
      removeStorage(KEYS.transactionJournal)
      return { ok: false, message: '本地数据清除失败，原数据已保留。' }
    }
  }
  removeStorage(KEYS.transactionJournal)
  return { ok: true }
}

function isVersionedStorageActive() {
  return readStorage(KEYS.storageSchemaVersion, 0).value === STORAGE_SCHEMA_VERSION
}

function recoverInterruptedTransaction() {
  const journalResult = readStorage(KEYS.transactionJournal, null)
  if (!journalResult.ok) return journalResult
  if (!journalResult.exists || !journalResult.value) return { ok: true, recovered: false }
  const journal = journalResult.value
  const keys = Array.isArray(journal.keys) ? journal.keys : []
  const before = journal.before && typeof journal.before === 'object' ? journal.before : {}
  const restored = restoreSnapshot(before, keys)
  if (!restored) {
    return { ok: false, message: '检测到未完成写入，但自动恢复失败，请先运行数据检查。' }
  }
  const removed = removeStorage(KEYS.transactionJournal)
  return removed.ok
    ? { ok: true, recovered: true, transactionId: journal.transactionId || '' }
    : { ok: false, message: '原数据已恢复，但事务临时标记清理失败。' }
}

function ensureStorageMigrated() {
  const recovery = recoverInterruptedTransaction()
  if (!recovery.ok) return recovery
  if (isVersionedStorageActive()) {
    const state = getVersionedState()
    return state.ok
      ? { ok: true, fromVersion: STORAGE_SCHEMA_VERSION, toVersion: STORAGE_SCHEMA_VERSION, applied: [] }
      : state
  }
  const snapshotResult = storageSnapshot()
  if (!snapshotResult.ok) return snapshotResult
  const raw = snapshotResult.values
  const ignoreLegacy = Boolean(raw[KEYS.clearMarker])
  const migration = migrateStorageSnapshot(raw, { keys: KEYS, ignoreLegacy })
  if (!migration.ok) return { ok: false, message: migration.error || '本地数据迁移失败。', migration }

  const backupResult = writeStorage(KEYS.migrationBackup, {
    capturedAt: new Date().toISOString(),
    fromVersion: migration.fromVersion,
    raw
  })
  if (!backupResult.ok) return { ok: false, message: '迁移前安全快照创建失败，原数据未修改。' }

  const writes = storageWritesForState(migration.state, KEYS)
  writes[KEYS.lastMigration] = {
    fromVersion: migration.fromVersion,
    toVersion: migration.toVersion,
    applied: migration.applied,
    migratedAt: new Date().toISOString()
  }
  writes[KEYS.dataRevision] = 1
  const result = atomicWrite(writes)
  return result.ok
    ? {
        ok: true,
        fromVersion: migration.fromVersion,
        toVersion: migration.toVersion,
        applied: migration.applied,
        backupKey: KEYS.migrationBackup
      }
    : { ok: false, message: '本地数据迁移失败，原始数据仍可恢复。' }
}

function getVersionedState() {
  if (!isVersionedStorageActive()) return { ok: false, message: '本地数据尚未迁移。' }
  const snapshotResult = storageSnapshot([
    KEYS.storageSchemaVersion,
    KEYS.profiles,
    KEYS.activeProfileId,
    KEYS.profileData,
    KEYS.sharedFavorites,
    KEYS.onboardingV4,
    KEYS.userSettings,
    KEYS.lastMigration
  ])
  if (!snapshotResult.ok) return snapshotResult
  const migrated = migrateStorageSnapshot(snapshotResult.values, { keys: KEYS })
  return migrated.ok
    ? { ok: true, state: migrated.state }
    : { ok: false, message: migrated.error || '本地数据读取失败。' }
}

function bumpRevision() {
  const current = Number(readStorage(KEYS.dataRevision, 0).value)
  const next = Number.isSafeInteger(current) ? current + 1 : 1
  return writeStorage(KEYS.dataRevision, next)
}

function getDataRevision() {
  const value = Number(readStorage(KEYS.dataRevision, 0).value)
  return Number.isSafeInteger(value) ? value : 0
}

function activeContext() {
  const stateResult = getVersionedState()
  if (!stateResult.ok) return stateResult
  const { state } = stateResult
  const profile = state.profiles.find((item) => item.id === state.activeProfileId) || state.profiles[0]
  if (!profile) return { ok: false, message: '未找到学生档案。' }
  const data = normalizeProfileData(state.profileData[profile.id], profile.id)
  return { ok: true, state, profile, data }
}

function updateVersionedState(nextState, { bump = true } = {}) {
  const normalizedProfiles = (Array.isArray(nextState.profiles) ? nextState.profiles : [])
    .map(normalizeProfile)
    .filter(Boolean)
  if (!normalizedProfiles.length) return { ok: false, message: '至少需要保留一个学生档案。' }
  const activeProfileId = normalizedProfiles.some((item) => item.id === nextState.activeProfileId)
    ? nextState.activeProfileId
    : normalizedProfiles[0].id
  const rawData = nextState.profileData && typeof nextState.profileData === 'object'
    ? nextState.profileData
    : {}
  const profileData = Object.fromEntries(normalizedProfiles.map((profile) => [
    profile.id,
    normalizeProfileData(rawData[profile.id], profile.id)
  ]))
  const writes = {
    [KEYS.profiles]: normalizedProfiles,
    [KEYS.activeProfileId]: activeProfileId,
    [KEYS.profileData]: profileData,
    [KEYS.sharedFavorites]: normalizeStringList(nextState.sharedFavoriteSchoolIds, 1000, 120).sort(),
    [KEYS.onboardingV4]: nextState.onboarding && typeof nextState.onboarding === 'object'
      ? nextState.onboarding
      : {},
    [KEYS.userSettings]: nextState.userSettings && typeof nextState.userSettings === 'object'
      ? nextState.userSettings
      : {},
    [KEYS.storageSchemaVersion]: STORAGE_SCHEMA_VERSION,
    [KEYS.dataRevision]: bump ? getDataRevision() + 1 : getDataRevision()
  }
  const result = atomicWrite(writes)
  return result.ok
    ? { ok: true, state: { ...nextState, profiles: normalizedProfiles, activeProfileId, profileData } }
    : result
}

function updateActiveProfileData(mutator) {
  const context = activeContext()
  if (!context.ok) return context
  const current = normalizeProfileData(context.data, context.profile.id)
  let next
  try {
    next = mutator(clone(current), clone(context.profile), clone(context.state))
  } catch (error) {
    logStorageError('mutate active profile', error)
    return { ok: false, message: '本地数据更新失败，原数据未修改。' }
  }
  const normalized = normalizeProfileData(next, context.profile.id)
  const profileData = { ...context.state.profileData, [context.profile.id]: normalized }
  const result = updateVersionedState({ ...context.state, profileData })
  return result.ok ? { ok: true, data: normalized, profile: context.profile } : result
}

function compareScoreRecords(left, right) {
  const dateCompare = String(left.examDate || left.date).localeCompare(String(right.examDate || right.date))
  if (dateCompare !== 0) return dateCompare
  const createdCompare = Date.parse(left.createdAt) - Date.parse(right.createdAt)
  return createdCompare !== 0 ? createdCompare : left.id.localeCompare(right.id)
}

function getProfilesResult() {
  if (!isVersionedStorageActive()) {
    return {
      ok: false,
      profiles: [],
      activeProfileId: '',
      message: '本地数据迁移尚未完成，旧数据不会被正式页面回退读取。'
    }
  }
  const state = getVersionedState()
  return state.ok
    ? { ok: true, profiles: state.state.profiles, activeProfileId: state.state.activeProfileId }
    : { ok: false, profiles: [], activeProfileId: '', message: state.message }
}

function getProfiles() {
  return getProfilesResult().profiles
}

function getActiveProfile() {
  const result = getProfilesResult()
  return result.profiles.find((item) => item.id === result.activeProfileId) || result.profiles[0] || null
}

function createStudentProfile(profile) {
  const migration = ensureStorageMigrated()
  if (!migration.ok) return migration
  const stateResult = getVersionedState()
  if (!stateResult.ok) return stateResult
  const now = new Date().toISOString()
  const id = text(profile && profile.id, 120) ||
    `profile_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  if (stateResult.state.profiles.some((item) => item.id === id)) {
    return { ok: false, message: '档案标识已存在。' }
  }
  const normalized = normalizeProfile({
    ...(profile || {}),
    id,
    createdAt: profile && profile.createdAt || now,
    updatedAt: now,
    lastUsedAt: now
  }, id)
  if (!normalized) return { ok: false, message: '档案格式无效。' }
  const profiles = [...stateResult.state.profiles, normalized]
  const profileData = {
    ...stateResult.state.profileData,
    [id]: createEmptyProfileData(id)
  }
  const result = updateVersionedState({
    ...stateResult.state,
    profiles,
    activeProfileId: id,
    profileData
  })
  return result.ok ? { ok: true, profile: normalized, profiles } : result
}

function updateStudentProfile(id, changes) {
  const stateResult = getVersionedState()
  if (!stateResult.ok) return stateResult
  const current = stateResult.state.profiles.find((item) => item.id === id)
  if (!current) return { ok: false, message: '未找到学生档案。' }
  const updated = normalizeProfile({
    ...current,
    ...(changes || {}),
    id: current.id,
    createdAt: current.createdAt,
    updatedAt: new Date().toISOString()
  }, current.id)
  const profiles = stateResult.state.profiles.map((item) => item.id === id ? updated : item)
  const profileData = { ...stateResult.state.profileData }
  if (changes && Number.isInteger(Number(changes.examYear))) {
    profileData[id] = normalizeProfileData({
      ...profileData[id],
      examYear: Number(changes.examYear)
    }, id)
  }
  const result = updateVersionedState({ ...stateResult.state, profiles, profileData })
  return result.ok ? { ok: true, profile: updated } : result
}

function switchStudentProfile(id) {
  const stateResult = getVersionedState()
  if (!stateResult.ok) return stateResult
  const profile = stateResult.state.profiles.find((item) => item.id === id)
  if (!profile) return { ok: false, message: '未找到学生档案。' }
  const now = new Date().toISOString()
  const profiles = stateResult.state.profiles.map((item) => item.id === id
    ? { ...item, lastUsedAt: now, updatedAt: now }
    : item)
  const profileData = { ...stateResult.state.profileData }
  profileData[id] = normalizeProfileData({
    ...profileData[id],
    recentHistory: addHistoryEntry(profileData[id] && profileData[id].recentHistory, 'usedProfiles', {
      id,
      profileId: id
    }, 5)
  }, id)
  const result = updateVersionedState({
    ...stateResult.state,
    profiles,
    profileData,
    activeProfileId: id
  })
  return result.ok ? { ok: true, profile: profiles.find((item) => item.id === id) } : result
}

function deleteStudentProfile(id) {
  const stateResult = getVersionedState()
  if (!stateResult.ok) return stateResult
  if (stateResult.state.profiles.length <= 1) {
    return { ok: false, message: '至少需要保留一个学生档案。' }
  }
  if (!stateResult.state.profiles.some((item) => item.id === id)) {
    return { ok: false, message: '未找到学生档案。' }
  }
  const profiles = stateResult.state.profiles.filter((item) => item.id !== id)
  const profileData = { ...stateResult.state.profileData }
  delete profileData[id]
  const activeProfileId = stateResult.state.activeProfileId === id
    ? profiles
      .slice()
      .sort((left, right) => Date.parse(right.lastUsedAt) - Date.parse(left.lastUsedAt))[0].id
    : stateResult.state.activeProfileId
  const result = updateVersionedState({
    ...stateResult.state,
    profiles,
    profileData,
    activeProfileId
  })
  return result.ok ? { ok: true, profiles, activeProfileId } : result
}

function getFavoriteIdsResult() {
  const context = activeContext()
  if (!context.ok) return { ok: false, ids: [], message: context.message }
  const ids = context.profile.favoritesMode === 'shared'
    ? normalizeStringList(context.state.sharedFavoriteSchoolIds, 1000, 120).sort()
    : context.data.favoriteSchoolIds
  return { ok: true, ids }
}

function getFavoriteIds() {
  return getFavoriteIdsResult().ids
}

function isFavorite(schoolId) {
  return getFavoriteIds().includes(schoolId)
}

function replaceFavoriteIds(ids) {
  const cleanIds = normalizeStringList(ids, 1000, 120).sort()
  const context = activeContext()
  if (!context.ok) return context
  if (context.profile.favoritesMode === 'shared') {
    const result = updateVersionedState({
      ...context.state,
      sharedFavoriteSchoolIds: cleanIds
    })
    return result.ok ? { ok: true, ids: cleanIds } : result
  }
  const result = updateActiveProfileData((data) => ({ ...data, favoriteSchoolIds: cleanIds }))
  return result.ok ? { ok: true, ids: cleanIds } : result
}

function setFavorite(schoolId, nextValue) {
  const id = text(schoolId, 120)
  if (!id) return { ok: false, message: '学校标识无效，请返回学校库重试。' }
  const current = getFavoriteIdsResult()
  if (!current.ok) return current
  const ids = new Set(current.ids)
  if (nextValue) ids.add(id)
  else ids.delete(id)
  return replaceFavoriteIds([...ids])
}

function getTargetRecordsResult() {
  const context = activeContext()
  return context.ok
    ? { ok: true, records: context.data.targetRecords }
    : { ok: false, records: [], message: context.message }
}

function getTargetRecords() {
  return getTargetRecordsResult().records
}

function saveTargetRecord(record) {
  const profileId = getActiveProfile() && getActiveProfile().id || DEFAULT_PROFILE_ID
  const normalized = normalizeTargetRecord(record, profileId)
  if (!normalized) return { ok: false, message: '目标记录格式无效，请检查后重试。' }
  const existing = getTargetRecordsResult()
  if (!existing.ok) return existing
  const current = existing.records.find((item) => item.schoolId === normalized.schoolId)
  const recordToSave = current
    ? {
        ...normalized,
        id: current.id,
        level: record && (record.level || record.targetLevel)
          ? normalizeTargetLevel(record.level || record.targetLevel)
          : current.level,
        createdAt: current.createdAt,
        updatedAt: new Date().toISOString()
      }
    : normalized
  const records = [
    recordToSave,
    ...existing.records.filter((item) => item.schoolId !== recordToSave.schoolId)
  ].slice(0, APP_CONFIG.targetScore.maxRecords)
  const result = updateActiveProfileData((data) => ({ ...data, targetRecords: records }))
  return result.ok ? { ok: true, records } : result
}

function deleteTargetRecord(id) {
  const key = text(id, 120)
  if (!key) return { ok: false, message: '目标记录标识无效。' }
  const existing = getTargetRecordsResult()
  if (!existing.ok) return existing
  const removed = existing.records.find((item) => item.id === key)
  const records = existing.records.filter((item) => item.id !== key)
  const result = updateActiveProfileData((data) => ({
    ...data,
    targetRecords: records,
    primaryTargetSchoolId: removed && data.primaryTargetSchoolId === removed.schoolId
      ? null
      : data.primaryTargetSchoolId
  }))
  return result.ok ? { ok: true, records } : result
}

function clearTargetRecords() {
  return updateActiveProfileData((data) => ({
    ...data,
    targetRecords: [],
    primaryTargetSchoolId: null
  }))
}

function getPrimaryTargetSchoolId() {
  const context = activeContext()
  return context.ok ? context.data.primaryTargetSchoolId : null
}

function setPrimaryTargetSchool(schoolId) {
  const id = schoolId === null ? null : text(schoolId, 120)
  const targets = getTargetRecords()
  if (id && !targets.some((item) => item.schoolId === id)) {
    return { ok: false, message: '主要目标必须先加入目标学校。' }
  }
  return updateActiveProfileData((data) => ({ ...data, primaryTargetSchoolId: id }))
}

function getTargetDraftResult() {
  const context = activeContext()
  return context.ok
    ? { ok: true, draft: clone(context.data.targetDraft) }
    : { ok: false, draft: {}, message: context.message }
}

function getTargetDraft() {
  return getTargetDraftResult().draft
}

function saveTargetDraft(draft) {
  const source = draft && typeof draft === 'object' && !Array.isArray(draft) ? clone(draft) : {}
  const existing = getTargetDraft()
  return updateActiveProfileData((data) => ({
    ...data,
    targetDraft: { ...existing, ...source }
  }))
}

function clearTargetDraft() {
  return updateActiveProfileData((data) => ({ ...data, targetDraft: {} }))
}

function getLearningTargetRecordsResult() {
  const context = activeContext()
  return context.ok
    ? { ok: true, records: context.data.stageGoals }
    : { ok: false, records: [], message: context.message }
}

function getLearningTargetRecords() {
  return getLearningTargetRecordsResult().records
}

const getStageGoalRecordsResult = getLearningTargetRecordsResult
const getStageGoalRecords = getLearningTargetRecords

function saveLearningTargetRecord(record) {
  const profileId = getActiveProfile() && getActiveProfile().id || DEFAULT_PROFILE_ID
  const normalized = normalizeStageGoal(record, profileId)
  if (!normalized) return { ok: false, message: '阶段目标格式无效，请检查后重试。' }
  const existing = getLearningTargetRecordsResult()
  if (!existing.ok) return existing
  const current = existing.records.find((item) => item.id === normalized.id)
  const saved = current
    ? { ...normalized, createdAt: current.createdAt, updatedAt: new Date().toISOString() }
    : normalized
  const records = [
    saved,
    ...existing.records.filter((item) => item.id !== saved.id)
  ].slice(0, APP_CONFIG.learningTarget.maxRecords)
  const result = updateActiveProfileData((data) => ({ ...data, stageGoals: records }))
  return result.ok ? { ok: true, records } : result
}

const saveStageGoalRecord = saveLearningTargetRecord

function deleteLearningTargetRecord(id) {
  const existing = getLearningTargetRecordsResult()
  if (!existing.ok) return existing
  const records = existing.records.filter((item) => item.id !== id)
  const result = updateActiveProfileData((data) => ({ ...data, stageGoals: records }))
  return result.ok ? { ok: true, records } : result
}

const deleteStageGoalRecord = deleteLearningTargetRecord

function clearLearningTargetRecords() {
  return updateActiveProfileData((data) => ({ ...data, stageGoals: [] }))
}

const clearStageGoalRecords = clearLearningTargetRecords

function getScoreRecordsResult() {
  const context = activeContext()
  return context.ok
    ? {
        ok: true,
        records: context.data.scoreRecords.slice().sort(compareScoreRecords)
      }
    : { ok: false, records: [], message: context.message }
}

function getScoreRecords() {
  return getScoreRecordsResult().records
}

function saveScoreRecord(record) {
  const profileId = getActiveProfile() && getActiveProfile().id || DEFAULT_PROFILE_ID
  const normalized = normalizeExamRecord(record, profileId)
  if (!normalized) return { ok: false, message: '成绩记录格式无效，请检查后重试。' }
  const existing = getScoreRecordsResult()
  if (!existing.ok) return existing
  const current = existing.records.find((item) => item.id === normalized.id)
  const saved = current
    ? {
        ...current,
        ...normalized,
        createdAt: current.createdAt,
        updatedAt: new Date().toISOString()
      }
    : normalized
  const records = [
    ...existing.records.filter((item) => item.id !== saved.id),
    saved
  ].sort(compareScoreRecords).slice(-APP_CONFIG.scoreRecord.maxRecords)
  const result = updateActiveProfileData((data) => ({
    ...data,
    scoreRecords: records,
    recentHistory: addHistoryEntry(data.recentHistory, 'editedExams', {
      id: saved.id,
      examRecordId: saved.id,
      examName: saved.examName,
      examDate: saved.examDate
    }, 10)
  }))
  return result.ok ? { ok: true, records } : result
}

function deleteScoreRecord(id) {
  const existing = getScoreRecordsResult()
  if (!existing.ok) return existing
  const records = existing.records.filter((item) => item.id !== id)
  const result = updateActiveProfileData((data) => ({
    ...data,
    scoreRecords: records,
    scoreReviews: data.scoreReviews.filter((item) => item.examRecordId !== id),
    scoreLossReasons: data.scoreLossReasons.filter((item) => item.examRecordId !== id),
    recentHistory: {
      ...data.recentHistory,
      editedExams: data.recentHistory.editedExams.filter((item) => item.examRecordId !== id)
    }
  }))
  return result.ok ? { ok: true, records } : result
}

function clearScoreRecords() {
  return updateActiveProfileData((data) => ({
    ...data,
    scoreRecords: [],
    scoreReviews: [],
    scoreLossReasons: [],
    recentHistory: { ...data.recentHistory, editedExams: [] }
  }))
}

function getExamYearResult() {
  const context = activeContext()
  return context.ok
    ? { ok: true, year: context.data.examYear }
    : { ok: false, year: APP_CONFIG.countdown.defaultYear, message: context.message }
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
  const context = activeContext()
  if (!context.ok) return context
  const profiles = context.state.profiles.map((profile) => profile.id === context.profile.id
    ? { ...profile, examYear: value, updatedAt: new Date().toISOString() }
    : profile)
  const profileData = {
    ...context.state.profileData,
    [context.profile.id]: { ...context.data, examYear: value }
  }
  return updateVersionedState({ ...context.state, profiles, profileData })
}

function getOnboardingState() {
  if (!isVersionedStorageActive()) {
    return {
      version: 0,
      completed: false,
      skipped: false,
      currentStep: 0,
      active: false,
      flow: 'full'
    }
  }
  const result = readStorage(KEYS.onboardingV4, {})
  const value = result.value && typeof result.value === 'object' && !Array.isArray(result.value)
    ? result.value
    : {}
  return {
    ...clone(value),
    version: Number(value.version) || 0,
    completed: Boolean(value.completed),
    skipped: Boolean(value.skipped),
    currentStep: Number.isInteger(value.currentStep) ? value.currentStep : 0,
    active: Boolean(value.active),
    flow: text(value.flow, 40) || 'full'
  }
}

function saveOnboardingState(state) {
  if (!isVersionedStorageActive()) {
    return { ok: false, message: '本地数据迁移尚未完成，教程状态未写入。' }
  }
  const value = {
    ...(state || {}),
    version: Number(state && state.version) || 0,
    completed: Boolean(state && state.completed),
    skipped: Boolean(state && state.skipped),
    currentStep: Number.isInteger(state && state.currentStep) ? state.currentStep : 0,
    active: Boolean(state && state.active),
    flow: text(state && state.flow, 40) || 'full'
  }
  const result = writeStorage(KEYS.onboardingV4, value)
  if (result.ok) bumpRevision()
  return result
}

function getRecommendationSettings() {
  const context = activeContext()
  return context.ok
    ? normalizeRecommendationSettings(context.data.recommendationSettings)
    : normalizeRecommendationSettings({})
}

function getScenarioSettings() {
  const context = activeContext()
  return context.ok
    ? normalizeScenarioSettings(context.data.scenarioSettings)
    : normalizeScenarioSettings({})
}

function saveScenarioSettings(settings) {
  return updateActiveProfileData((data) => ({
    ...data,
    scenarioSettings: normalizeScenarioSettings(settings)
  }))
}

function saveRecommendationSettings(settings) {
  return updateActiveProfileData((data) => ({
    ...data,
    recommendationSettings: normalizeRecommendationSettings(settings)
  }))
}

function getSchoolFilters() {
  const context = activeContext()
  return context.ok ? normalizeSchoolFilters(context.data.schoolFilters) : normalizeSchoolFilters({})
}

function saveSchoolFilters(filters) {
  const normalized = normalizeSchoolFilters(filters)
  return updateActiveProfileData((data) => ({
    ...data,
    schoolFilters: normalized,
    recentHistory: addHistoryEntry(data.recentHistory, 'schoolFilters', {
      id: JSON.stringify(normalized),
      filters: normalized
    }, 10)
  }))
}

function getComparisonSchoolIds() {
  const context = activeContext()
  return context.ok ? context.data.comparisonSchoolIds : []
}

function saveComparisonSchoolIds(ids) {
  const clean = normalizeStringList(ids, 3, 120)
  return updateActiveProfileData((data) => ({
    ...data,
    comparisonSchoolIds: clean,
    recentHistory: clean.length >= 2
      ? addHistoryEntry(data.recentHistory, 'schoolComparisons', {
          id: clean.join('|'),
          schoolIds: clean
        }, 5)
      : data.recentHistory
  }))
}

function addRecentViewedSchool(schoolId) {
  const id = text(schoolId, 120)
  if (!id) return { ok: false, message: '学校标识无效。' }
  return updateActiveProfileData((data) => ({
    ...data,
    recentViewedSchoolIds: [id, ...data.recentViewedSchoolIds.filter((item) => item !== id)].slice(0, 20),
    recentHistory: addHistoryEntry(data.recentHistory, 'viewedSchools', { id, schoolId: id }, 20)
  }))
}

function getRecentViewedSchoolIds() {
  const context = activeContext()
  return context.ok ? context.data.recentViewedSchoolIds : []
}

function addHistoryEntry(history, type, entry, limit) {
  const normalized = normalizeRecentHistory(history)
  if (!Object.prototype.hasOwnProperty.call(normalized, type)) return normalized
  const id = text(entry && entry.id, 240)
  if (!id) return normalized
  const item = {
    ...(entry || {}),
    id,
    at: new Date().toISOString()
  }
  return {
    ...normalized,
    [type]: [
      item,
      ...normalized[type].filter((existing) => existing.id !== id)
    ].slice(0, limit)
  }
}

function recordRecentHistory(type, entry) {
  const limits = {
    viewedSchools: 20,
    schoolFilters: 10,
    schoolComparisons: 5,
    editedExams: 10,
    viewedTargets: 10,
    usedProfiles: 5,
    scoreSegments: 10,
    targetSegments: 10
  }
  if (!limits[type]) return { ok: false, message: '最近操作类型无效。' }
  return updateActiveProfileData((data) => ({
    ...data,
    recentHistory: addHistoryEntry(data.recentHistory, type, entry, limits[type])
  }))
}

function getRecentHistory() {
  const context = activeContext()
  return context.ok ? normalizeRecentHistory(context.data.recentHistory) : normalizeRecentHistory({})
}

function clearRecentHistory(type) {
  return updateActiveProfileData((data) => {
    const history = normalizeRecentHistory(data.recentHistory)
    if (type && Object.prototype.hasOwnProperty.call(history, type)) history[type] = []
    if (!type) {
      for (const key of Object.keys(history)) history[key] = []
    }
    return {
      ...data,
      recentViewedSchoolIds: !type || type === 'viewedSchools' ? [] : data.recentViewedSchoolIds,
      recentHistory: history
    }
  })
}

function listFromActiveData(field) {
  const context = activeContext()
  return context.ok && Array.isArray(context.data[field]) ? context.data[field] : []
}

function saveProfileRecord(field, record, normalizer, label, maxRecords = 1000) {
  const profile = getActiveProfile()
  const normalized = normalizer(record, profile && profile.id || DEFAULT_PROFILE_ID)
  if (!normalized) return { ok: false, message: `${label}格式无效，请检查后重试。` }
  const existing = listFromActiveData(field)
  const current = existing.find((item) => item.id === normalized.id)
  const saved = current
    ? { ...current, ...normalized, createdAt: current.createdAt, updatedAt: new Date().toISOString() }
    : normalized
  const records = [
    saved,
    ...existing.filter((item) => item.id !== saved.id)
  ].slice(0, maxRecords)
  const result = updateActiveProfileData((data) => ({ ...data, [field]: records }))
  return result.ok ? { ok: true, record: saved, records } : result
}

function deleteProfileRecord(field, id) {
  const key = text(id, 120)
  if (!key) return { ok: false, message: '记录标识无效。' }
  const records = listFromActiveData(field).filter((item) => item.id !== key)
  const result = updateActiveProfileData((data) => ({ ...data, [field]: records }))
  return result.ok ? { ok: true, records } : result
}

function getScoreReviews() {
  return listFromActiveData('scoreReviews')
}

function saveScoreReview(record) {
  return saveProfileRecord('scoreReviews', record, normalizeScoreReview, '考试复盘')
}

function deleteScoreReview(id) {
  const review = getScoreReviews().find((item) => item.id === id)
  return updateActiveProfileData((data) => ({
    ...data,
    scoreReviews: data.scoreReviews.filter((item) => item.id !== id),
    scoreLossReasons: review
      ? data.scoreLossReasons.filter((item) => item.examRecordId !== review.examRecordId)
      : data.scoreLossReasons
  }))
}

function getScoreLossReasons() {
  return listFromActiveData('scoreLossReasons')
}

function saveScoreLossReason(record) {
  return saveProfileRecord('scoreLossReasons', record, normalizeScoreLossReason, '失分原因', 2000)
}

function deleteScoreLossReason(id) {
  return deleteProfileRecord('scoreLossReasons', id)
}

function getLearningTasks() {
  return listFromActiveData('learningTasks')
}

function saveLearningTask(record, { allowDuplicateSource = false } = {}) {
  const profile = getActiveProfile()
  const normalized = normalizeLearningTask(record, profile && profile.id || DEFAULT_PROFILE_ID)
  if (!normalized) return { ok: false, message: '学习任务格式无效，请检查后重试。' }
  if (!allowDuplicateSource && normalized.sourceReviewId) {
    const duplicate = getLearningTasks().find((item) =>
      item.id !== normalized.id &&
      item.sourceReviewId === normalized.sourceReviewId &&
      item.sourceReasonType === normalized.sourceReasonType &&
      item.subjectId === normalized.subjectId
    )
    if (duplicate) {
      return { ok: false, code: 'DUPLICATE_SOURCE', message: '该复盘已创建过学习任务。' }
    }
  }
  return saveProfileRecord('learningTasks', normalized, normalizeLearningTask, '学习任务', 1000)
}

function deleteLearningTask(id) {
  return deleteProfileRecord('learningTasks', id)
}

function getSubjectConfigs() {
  const context = activeContext()
  return context.ok ? context.data.subjectConfigs : []
}

function saveSubjectConfigs(configs) {
  const normalized = (Array.isArray(configs) ? configs : [])
    .map(normalizeSubjectConfig)
    .filter(Boolean)
  return updateActiveProfileData((data) => ({ ...data, subjectConfigs: normalized }))
}

function clearCurrentProfileData() {
  const context = activeContext()
  if (!context.ok) return context
  const empty = createEmptyProfileData(context.profile.id)
  empty.examYear = context.profile.examYear
  const profileData = { ...context.state.profileData, [context.profile.id]: empty }
  return updateVersionedState({ ...context.state, profileData })
}

function clearLocalData() {
  const marker = {
    clearedAt: new Date().toISOString(),
    schemaVersion: STORAGE_SCHEMA_VERSION
  }
  const cleared = atomicRemove(
    ALL_KNOWN_KEYS.filter((key) => key !== KEYS.clearMarker),
    { [KEYS.clearMarker]: marker }
  )
  if (!cleared.ok) return cleared
  const initialized = ensureStorageMigrated()
  return initialized.ok
    ? { ok: true, marker, migration: initialized }
    : {
        ok: false,
        marker,
        message: '本地数据已清除，但空档案初始化失败；重新打开小程序后会再次初始化。'
      }
}

function clearLocalDemoData() {
  return clearLocalData()
}

function replaceVersionedState(state, { importSnapshot = null } = {}) {
  const current = storageSnapshot()
  if (!current.ok) return current
  const snapshotResult = importSnapshot
    ? writeStorage(KEYS.importSnapshot, importSnapshot)
    : writeStorage(KEYS.importSnapshot, {
        capturedAt: new Date().toISOString(),
        raw: current.values
      })
  if (!snapshotResult.ok) return { ok: false, message: '导入前安全快照创建失败。' }
  const result = updateVersionedState({
    ...state,
    version: STORAGE_SCHEMA_VERSION
  })
  return result.ok ? { ok: true, state: result.state } : result
}

module.exports = {
  KEYS,
  ALL_KNOWN_KEYS,
  STORAGE_SCHEMA_VERSION,
  MIGRATION_CHAIN,
  readStorage,
  writeStorage,
  removeStorage,
  storageSnapshot,
  atomicWrite,
  atomicRemove,
  recoverInterruptedTransaction,
  isVersionedStorageActive,
  ensureStorageMigrated,
  getVersionedState,
  replaceVersionedState,
  getDataRevision,
  getProfilesResult,
  getProfiles,
  getActiveProfile,
  createStudentProfile,
  updateStudentProfile,
  switchStudentProfile,
  deleteStudentProfile,
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
  getPrimaryTargetSchoolId,
  setPrimaryTargetSchool,
  getTargetDraftResult,
  getTargetDraft,
  saveTargetDraft,
  clearTargetDraft,
  getLearningTargetRecordsResult,
  getLearningTargetRecords,
  getStageGoalRecordsResult,
  getStageGoalRecords,
  saveLearningTargetRecord,
  saveStageGoalRecord,
  deleteLearningTargetRecord,
  deleteStageGoalRecord,
  clearLearningTargetRecords,
  clearStageGoalRecords,
  getScoreRecordsResult,
  getScoreRecords,
  saveScoreRecord,
  deleteScoreRecord,
  clearScoreRecords,
  getExamYearResult,
  getExamYear,
  saveExamYear,
  getOnboardingState,
  saveOnboardingState,
  getRecommendationSettings,
  saveRecommendationSettings,
  getScenarioSettings,
  saveScenarioSettings,
  getSchoolFilters,
  saveSchoolFilters,
  getComparisonSchoolIds,
  saveComparisonSchoolIds,
  addRecentViewedSchool,
  getRecentViewedSchoolIds,
  recordRecentHistory,
  getRecentHistory,
  clearRecentHistory,
  getScoreReviews,
  saveScoreReview,
  deleteScoreReview,
  getScoreLossReasons,
  saveScoreLossReason,
  deleteScoreLossReason,
  getLearningTasks,
  saveLearningTask,
  deleteLearningTask,
  getSubjectConfigs,
  saveSubjectConfigs,
  clearCurrentProfileData,
  clearLocalData,
  clearLocalDemoData
}
