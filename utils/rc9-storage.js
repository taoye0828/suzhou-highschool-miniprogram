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
const { schools } = require('../data/schools')
const {
  MAX_RESTORE_POINTS,
  TRANSACTION_STAGES,
  ERROR_CODES,
  buildRestorePoint,
  validateRestorePoint,
  stateAfterRestore,
  invokeFault,
  canonicalJson
} = require('./rc11-stability')

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
  repairSnapshot: 'rc10.repair_snapshot.v1',
  restorePointIndex: 'rc11.restore_point_index.v1',
  restorePointPayloads: 'rc11.restore_point_payloads.v1',
  restorePointTemporary: 'rc11.restore_point_temporary.v1',
  restorePointOperationState: 'rc11.restore_point_operation_state.v1',
  operationLock: 'rc11.operation_lock.v1',
  restoreTemporary: 'rc11.restore_temporary.v1',
  cleanupPending: 'rc11.cleanup_pending.v1',
  startupRecovery: 'rc11.startup_recovery.v1'
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

function atomicWrite(values, {
  operationType = 'write',
  operationId,
  faultInjector
} = {}) {
  try {
    invokeFault(faultInjector, operationType, 'validate')
  } catch (error) {
    return { ok: false, code: error.code || 'TEST_INJECTED_FAILURE', stage: 'validate' }
  }
  const keys = Object.keys(values)
  if (!keys.length) return { ok: true }
  const transactionId = operationId || `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  try {
    invokeFault(faultInjector, operationType, 'snapshot')
  } catch (error) {
    return { ok: false, code: error.code || 'TEST_INJECTED_FAILURE', stage: 'snapshot' }
  }
  const before = storageSnapshot(keys)
  if (!before.ok) return { ok: false, message: before.message }
  try {
    invokeFault(faultInjector, operationType, 'prepare')
    invokeFault(faultInjector, operationType, 'writeTemporary')
  } catch (error) {
    return { ok: false, code: error.code || 'TEST_INJECTED_FAILURE', stage: error.stage || 'prepare' }
  }
  const journal = writeStorage(KEYS.transactionJournal, {
    transactionId,
    operationType,
    createdAt: new Date().toISOString(),
    keys,
    before: before.values,
    expected: clone(values),
    status: 'prepared'
  })
  if (!journal.ok) {
    return { ok: false, message: '本地安全写入未开始，原数据已保留。' }
  }
  try {
    invokeFault(faultInjector, operationType, 'verifyTemporary')
    const journalReadback = readStorage(KEYS.transactionJournal, null)
    if (!journalReadback.ok || !journalReadback.exists ||
        canonicalJson(journalReadback.value.expected) !== canonicalJson(values)) {
      removeStorage(KEYS.transactionJournal)
      return { ok: false, code: ERROR_CODES.STORAGE_READBACK_FAILED, stage: 'verifyTemporary' }
    }
    invokeFault(faultInjector, operationType, 'commit')
  } catch (error) {
    removeStorage(KEYS.transactionJournal)
    return { ok: false, code: error.code || 'TEST_INJECTED_FAILURE', stage: 'commit' }
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
  const committedJournal = writeStorage(KEYS.transactionJournal, {
    transactionId,
    operationType,
    createdAt: new Date().toISOString(),
    keys,
    before: before.values,
    expected: clone(values),
    status: 'committed'
  })
  if (!committedJournal.ok) {
    return { ok: false, code: ERROR_CODES.STORAGE_WRITE_FAILED, stage: 'verifyCommitted' }
  }
  try {
    invokeFault(faultInjector, operationType, 'verifyCommitted')
    const after = storageSnapshot(keys)
    if (!after.ok || canonicalJson(after.values) !== canonicalJson(values)) {
      return { ok: false, code: ERROR_CODES.STORAGE_READBACK_FAILED, stage: 'verifyCommitted' }
    }
  } catch (error) {
    return { ok: false, code: error.code || 'TEST_INJECTED_FAILURE', stage: 'verifyCommitted' }
  }
  try {
    invokeFault(faultInjector, operationType, 'cleanup')
  } catch (error) {
    writeStorage(KEYS.cleanupPending, { transactionId, operationType, createdAt: new Date().toISOString() })
    return { ok: true, warning: ERROR_CODES.CLEANUP_FAILED, stage: 'cleanup' }
  }
  const cleaned = removeStorage(KEYS.transactionJournal)
  if (!cleaned.ok) {
    return { ok: false, message: '数据已保存，但临时事务标记清理失败，请运行数据检查。' }
  }
  removeStorage(KEYS.cleanupPending)
  return { ok: true, transactionId }
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
  if (journal.status === 'committed') {
    const keys = Array.isArray(journal.keys) ? journal.keys : []
    const current = storageSnapshot(keys)
    const expected = journal.expected && typeof journal.expected === 'object' ? journal.expected : {}
    if (current.ok && canonicalJson(current.values) === canonicalJson(expected)) {
      const removed = removeStorage(KEYS.transactionJournal)
      if (removed.ok) removeStorage(KEYS.cleanupPending)
      return removed.ok
        ? { ok: true, recovered: true, state: 'committed_with_temp_residue' }
        : { ok: true, recovered: true, state: 'committed_with_temp_residue', warning: ERROR_CODES.CLEANUP_FAILED }
    }
    return {
      ok: false,
      code: ERROR_CODES.STARTUP_RECOVERY_REQUIRED,
      state: 'both_valid_different',
      message: '检测到未完成写入，请在数据管理中确认保留当前数据。'
    }
  }
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

function versionConflict(current, expectedVersion) {
  if (!current || expectedVersion === undefined || expectedVersion === null) return null
  const expected = Number(expectedVersion)
  const actual = Number(current.version || 1)
  return Number.isInteger(expected) && expected !== actual
    ? {
        ok: false,
        code: ERROR_CODES.VERSION_CONFLICT,
        expectedVersion: expected,
        actualVersion: actual,
        message: '这条内容已在其他页面更新，请重新载入后再修改。'
      }
    : null
}

function updateStudentProfile(id, changes) {
  const stateResult = getVersionedState()
  if (!stateResult.ok) return stateResult
  const current = stateResult.state.profiles.find((item) => item.id === id)
  if (!current) return { ok: false, message: '未找到学生档案。' }
  const conflict = versionConflict(current, changes && (changes.expectedVersion ?? changes.version))
  if (conflict) return conflict
  const updated = normalizeProfile({
    ...current,
    ...(changes || {}),
    id: current.id,
    createdAt: current.createdAt,
    updatedAt: new Date().toISOString(),
    version: Number(current.version || 1) + 1
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
  const conflict = versionConflict(current, record && (record.expectedVersion ?? record.version))
  if (conflict) return conflict
  const recordToSave = current
    ? {
        ...normalized,
        id: current.id,
        level: record && (record.level || record.targetLevel)
          ? normalizeTargetLevel(record.level || record.targetLevel)
          : current.level,
        createdAt: current.createdAt,
        updatedAt: new Date().toISOString(),
        version: Number(current.version || 1) + 1
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
  const conflict = versionConflict(current, record && (record.expectedVersion ?? record.version))
  if (conflict) return conflict
  const saved = current
    ? {
        ...normalized,
        createdAt: current.createdAt,
        updatedAt: new Date().toISOString(),
        version: Number(current.version || 1) + 1
      }
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
  const conflict = versionConflict(current, record && (record.expectedVersion ?? record.version))
  if (conflict) return conflict
  const saved = current
    ? {
        ...current,
        ...normalized,
        createdAt: current.createdAt,
        updatedAt: new Date().toISOString(),
        version: Number(current.version || 1) + 1
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
  const conflict = versionConflict(current, record && (record.expectedVersion ?? record.version))
  if (conflict) return conflict
  const saved = current
    ? {
        ...current,
        ...normalized,
        createdAt: current.createdAt,
        updatedAt: new Date().toISOString(),
        version: Number(current.version || 1) + 1
      }
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

function operationStates() {
  const result = readStorage(KEYS.restorePointOperationState, {})
  return result.ok && result.value && typeof result.value === 'object' ? result.value : {}
}

function operationResult(operationId) {
  if (!operationId) return null
  const state = operationStates()[operationId]
  if (!state) return null
  if (state.status === 'committed') return { ...clone(state.result), idempotent: true }
  if (state.status === 'running') {
    return { ok: false, code: ERROR_CODES.TRANSACTION_ALREADY_RUNNING, message: '操作正在进行，请稍候。' }
  }
  return null
}

function acquireOperationLock({ operationId, operationType, profileId = '', entityId = '', global = false }) {
  const now = Date.now()
  const existing = readStorage(KEYS.operationLock, null)
  if (!existing.ok) return { ok: false, code: ERROR_CODES.STORAGE_READBACK_FAILED }
  if (existing.exists && existing.value) {
    const created = Date.parse(existing.value.createdAt || '')
    const stale = !Number.isFinite(created) || now - created > 5 * 60 * 1000
    const ownerState = operationStates()[existing.value.owner]
    const ownerFinished = ownerState && ownerState.status !== 'running'
    const conflicts = existing.value.global || global ||
      (profileId && existing.value.profileId === profileId) ||
      (entityId && existing.value.entityId === entityId)
    if (!stale && !ownerFinished && existing.value.owner !== operationId && conflicts) {
      return { ok: false, code: ERROR_CODES.OPERATION_LOCKED, message: '另一项本地数据操作正在进行。' }
    }
    if (stale || ownerFinished) {
      const released = removeStorage(KEYS.operationLock)
      if (!released.ok) return { ok: false, code: ERROR_CODES.CLEANUP_FAILED, message: '上一次操作已结束，但临时锁清理失败。' }
    }
  }
  const lock = {
    owner: operationId,
    operationType,
    profileId,
    entityId,
    global,
    createdAt: new Date(now).toISOString()
  }
  const written = writeStorage(KEYS.operationLock, lock)
  return written.ok ? { ok: true, lock } : { ok: false, code: ERROR_CODES.STORAGE_WRITE_FAILED }
}

function finishOperation(operationId, status, result) {
  const states = operationStates()
  states[operationId] = {
    operationId,
    status,
    finishedAt: new Date().toISOString(),
    result: clone(result)
  }
  const ids = Object.keys(states).sort((left, right) =>
    String(states[right].finishedAt || '').localeCompare(String(states[left].finishedAt || ''))
  )
  for (const id of ids.slice(100)) delete states[id]
  writeStorage(KEYS.restorePointOperationState, states)
  const lock = readStorage(KEYS.operationLock, null)
  if (lock.ok && lock.exists && lock.value && lock.value.owner === operationId) {
    removeStorage(KEYS.operationLock)
  }
}

function beginOperation(context) {
  const previous = operationResult(context.operationId)
  if (previous) return previous
  const lock = acquireOperationLock(context)
  if (!lock.ok) return lock
  const states = operationStates()
  states[context.operationId] = {
    ...context,
    status: 'running',
    startedAt: new Date().toISOString()
  }
  if (!writeStorage(KEYS.restorePointOperationState, states).ok) {
    removeStorage(KEYS.operationLock)
    return { ok: false, code: ERROR_CODES.STORAGE_WRITE_FAILED }
  }
  return { ok: true, started: true }
}

function restorePointRecord(point) {
  const copy = clone(point)
  delete copy.payload
  return copy
}

function listRestorePoints() {
  const result = readStorage(KEYS.restorePointIndex, [])
  const points = result.ok && Array.isArray(result.value) ? result.value : []
  return points.slice().sort((left, right) =>
    String(right.createdAt).localeCompare(String(left.createdAt)) || String(right.id).localeCompare(String(left.id))
  )
}

function getRestorePoint(id) {
  const result = readStorage(KEYS.restorePointPayloads, {})
  const point = result.ok && result.value && typeof result.value === 'object' ? result.value[id] : null
  if (!point) return { ok: false, code: ERROR_CODES.RESTORE_POINT_NOT_FOUND, message: '未找到该恢复点。' }
  const validation = validateRestorePoint(point)
  return validation.ok
    ? { ok: true, restorePoint: clone(point) }
    : { ok: false, code: validation.code, message: '恢复点校验失败，当前数据未修改。' }
}

function createRestorePoint({
  reason = 'manual',
  profileScope = { type: 'full_user_state' },
  operationId,
  id,
  createdAt,
  createdBy = 'automatic',
  note = '',
  faultInjector
} = {}) {
  const resolvedOperationId = operationId || `restore_point_${reason}_${Date.now()}`
  const started = beginOperation({
    operationId: resolvedOperationId,
    operationType: 'create_restore_point',
    profileId: profileScope.profileId || '',
    global: profileScope.type !== 'single_profile'
  })
  if (!started.ok || !started.started) return started
  try {
    invokeFault(faultInjector, 'create_restore_point', 'validate')
    const state = getVersionedState()
    if (!state.ok) throw Object.assign(new Error(state.message), { code: ERROR_CODES.FORMAL_DATA_INVALID })
    invokeFault(faultInjector, 'create_restore_point', 'snapshot')
    const timestamp = createdAt || new Date().toISOString()
    const point = buildRestorePoint({
      state: state.state,
      reason,
      profileScope,
      id: id || `restore_${timestamp.replace(/[^0-9]/g, '').slice(0, 17)}_${String(listRestorePoints().length + 1).padStart(2, '0')}`,
      createdAt: timestamp,
      operationId: resolvedOperationId,
      createdBy,
      note,
      sourcePlatform: 'miniprogram',
      storageSchemaVersion: STORAGE_SCHEMA_VERSION,
      backupFormatVersion: 2,
      appDataVersion: 'rc11-2'
    })
    invokeFault(faultInjector, 'create_restore_point', 'prepare')
    invokeFault(faultInjector, 'create_restore_point', 'writeTemporary')
    if (!writeStorage(KEYS.restorePointTemporary, point).ok) {
      throw Object.assign(new Error('恢复点临时写入失败'), { code: ERROR_CODES.STORAGE_WRITE_FAILED })
    }
    invokeFault(faultInjector, 'create_restore_point', 'verifyTemporary')
    const temporary = readStorage(KEYS.restorePointTemporary, null)
    const verification = temporary.ok && temporary.exists ? validateRestorePoint(temporary.value) : { ok: false }
    if (!verification.ok) throw Object.assign(new Error('恢复点回读校验失败'), {
      code: verification.code || ERROR_CODES.RESTORE_POINT_VERIFY_FAILED
    })
    invokeFault(faultInjector, 'create_restore_point', 'commit')
    const payloadsResult = readStorage(KEYS.restorePointPayloads, {})
    const payloads = payloadsResult.ok && payloadsResult.value && typeof payloadsResult.value === 'object'
      ? payloadsResult.value
      : {}
    payloads[point.id] = point
    let index = listRestorePoints().filter((item) => item.id !== point.id)
    index.push(restorePointRecord(point))
    index.sort((left, right) =>
      String(left.createdAt).localeCompare(String(right.createdAt)) || String(left.id).localeCompare(String(right.id))
    )
    const evicted = index.length > MAX_RESTORE_POINTS ? index.slice(0, index.length - MAX_RESTORE_POINTS) : []
    index = index.slice(-MAX_RESTORE_POINTS)
    for (const item of evicted) delete payloads[item.id]
    const committed = atomicWrite({
      [KEYS.restorePointIndex]: index,
      [KEYS.restorePointPayloads]: payloads
    }, { operationType: 'create_restore_point', operationId: resolvedOperationId, faultInjector })
    if (!committed.ok) throw Object.assign(new Error('恢复点保存失败'), {
      code: committed.code || ERROR_CODES.RESTORE_POINT_CREATE_FAILED,
      stage: committed.stage
    })
    invokeFault(faultInjector, 'create_restore_point', 'verifyCommitted')
    const saved = getRestorePoint(point.id)
    if (!saved.ok) throw Object.assign(new Error('恢复点保存校验失败'), { code: saved.code })
    invokeFault(faultInjector, 'create_restore_point', 'cleanup')
    removeStorage(KEYS.restorePointTemporary)
    const result = { ok: true, restorePoint: point, evictedIds: evicted.map((item) => item.id) }
    finishOperation(resolvedOperationId, 'committed', result)
    return result
  } catch (error) {
    removeStorage(KEYS.restorePointTemporary)
    const result = {
      ok: false,
      code: error.code || ERROR_CODES.RESTORE_POINT_CREATE_FAILED,
      stage: error.stage || '',
      message: '未能创建安全恢复点，本次操作未执行。'
    }
    finishOperation(resolvedOperationId, 'failed', result)
    return result
  }
}

function deleteRestorePoint(id, { operationId } = {}) {
  const resolvedOperationId = operationId || `delete_restore_point_${id}_${Date.now()}`
  const started = beginOperation({ operationId: resolvedOperationId, operationType: 'delete_restore_point', global: true })
  if (!started.ok || !started.started) return started
  const payloadsResult = readStorage(KEYS.restorePointPayloads, {})
  const payloads = payloadsResult.ok && payloadsResult.value && typeof payloadsResult.value === 'object'
    ? payloadsResult.value
    : {}
  if (!payloads[id]) {
    const result = { ok: false, code: ERROR_CODES.RESTORE_POINT_NOT_FOUND, message: '未找到该恢复点。' }
    finishOperation(resolvedOperationId, 'failed', result)
    return result
  }
  delete payloads[id]
  const index = listRestorePoints().filter((item) => item.id !== id)
  const result = atomicWrite({ [KEYS.restorePointIndex]: index, [KEYS.restorePointPayloads]: payloads }, {
    operationType: 'delete_restore_point', operationId: resolvedOperationId
  })
  const finalResult = result.ok ? { ok: true, id } : result
  finishOperation(resolvedOperationId, result.ok ? 'committed' : 'failed', finalResult)
  return finalResult
}

function clearRestorePoints({ operationId } = {}) {
  const resolvedOperationId = operationId || `clear_restore_points_${Date.now()}`
  const started = beginOperation({ operationId: resolvedOperationId, operationType: 'clear_restore_points', global: true })
  if (!started.ok || !started.started) return started
  const result = atomicWrite({ [KEYS.restorePointIndex]: [], [KEYS.restorePointPayloads]: {} }, {
    operationType: 'clear_restore_points', operationId: resolvedOperationId
  })
  const finalResult = result.ok ? { ok: true } : result
  finishOperation(resolvedOperationId, result.ok ? 'committed' : 'failed', finalResult)
  return finalResult
}

function validateRestoreState(state) {
  const profiles = Array.isArray(state && state.profiles) ? state.profiles : []
  if (!profiles.length || new Set(profiles.map((item) => item.id)).size !== profiles.length) {
    return { ok: false, code: ERROR_CODES.INVALID_PROFILE_REFERENCE }
  }
  if (!profiles.some((item) => item.id === state.activeProfileId)) {
    return { ok: false, code: ERROR_CODES.INVALID_PROFILE_REFERENCE }
  }
  const validSchoolIds = new Set(schools.map((item) => item.id))
  for (const profile of profiles) {
    const data = state.profileData && state.profileData[profile.id]
    if (!data || data.profileId !== profile.id) return { ok: false, code: ERROR_CODES.INVALID_PROFILE_REFERENCE }
    for (const field of ['scoreRecords', 'scoreReviews', 'scoreLossReasons', 'targetRecords', 'stageGoals', 'learningTasks']) {
      const records = Array.isArray(data[field]) ? data[field] : []
      if (new Set(records.map((item) => item.id)).size !== records.length) {
        return { ok: false, code: ERROR_CODES.DUPLICATE_ENTITY_ID }
      }
      if (records.some((item) => item.profileId && item.profileId !== profile.id)) {
        return { ok: false, code: ERROR_CODES.INVALID_PROFILE_REFERENCE }
      }
    }
    if ((data.scoreRecords || []).some((item) => !Number.isInteger(item.totalScore) || item.totalScore < 0 || item.totalScore > 740)) {
      return { ok: false, code: ERROR_CODES.FORMAL_DATA_INVALID }
    }
    const schoolIds = [
      ...(data.favoriteSchoolIds || []),
      ...(data.targetRecords || []).map((item) => item.schoolId)
    ]
    if (schoolIds.some((id) => !validSchoolIds.has(id))) return { ok: false, code: ERROR_CODES.INVALID_SCHOOL_REFERENCE }
  }
  return { ok: true }
}

function restoreFromRestorePoint(id, { operationId, faultInjector } = {}) {
  const resolvedOperationId = operationId || `restore_${id}_${Date.now()}`
  const previous = operationResult(resolvedOperationId)
  if (previous) return previous
  const selected = getRestorePoint(id)
  if (!selected.ok) return selected
  const before = createRestorePoint({
    reason: 'before_restore',
    profileScope: { type: 'full_user_state' },
    operationId: `${resolvedOperationId}_safety`,
    createdBy: 'automatic'
  })
  if (!before.ok) return before
  const started = beginOperation({ operationId: resolvedOperationId, operationType: 'restore', global: true })
  if (!started.ok || !started.started) return started
  try {
    invokeFault(faultInjector, 'restore', 'validate')
    const current = getVersionedState()
    if (!current.ok) throw Object.assign(new Error(current.message), { code: ERROR_CODES.FORMAL_DATA_INVALID })
    invokeFault(faultInjector, 'restore', 'snapshot')
    const next = stateAfterRestore(current.state, selected.restorePoint)
    invokeFault(faultInjector, 'restore', 'prepare')
    const validation = validateRestoreState(next)
    if (!validation.ok) throw Object.assign(new Error('恢复后数据校验失败'), { code: validation.code })
    invokeFault(faultInjector, 'restore', 'writeTemporary')
    if (!writeStorage(KEYS.restoreTemporary, next).ok) throw Object.assign(new Error(), { code: ERROR_CODES.STORAGE_WRITE_FAILED })
    invokeFault(faultInjector, 'restore', 'verifyTemporary')
    const temporary = readStorage(KEYS.restoreTemporary, null)
    if (!temporary.ok || !temporary.exists || !validateRestoreState(temporary.value).ok) {
      throw Object.assign(new Error(), { code: ERROR_CODES.TEMPORARY_DATA_INVALID })
    }
    invokeFault(faultInjector, 'restore', 'commit')
    const committed = updateVersionedState(next)
    if (!committed.ok) throw Object.assign(new Error(committed.message), { code: ERROR_CODES.STORAGE_WRITE_FAILED })
    invokeFault(faultInjector, 'restore', 'verifyCommitted')
    const readback = getVersionedState()
    if (!readback.ok || canonicalJson(readback.state) !== canonicalJson(committed.state)) {
      throw Object.assign(new Error(), { code: ERROR_CODES.STORAGE_READBACK_FAILED })
    }
    invokeFault(faultInjector, 'restore', 'cleanup')
    removeStorage(KEYS.restoreTemporary)
    const result = { ok: true, restorePointId: id, safetyRestorePointId: before.restorePoint.id }
    finishOperation(resolvedOperationId, 'committed', result)
    return result
  } catch (error) {
    removeStorage(KEYS.restoreTemporary)
    const result = { ok: false, code: error.code || ERROR_CODES.RESTORE_POINT_VERIFY_FAILED, message: '恢复未完成，当前数据已保留。' }
    finishOperation(resolvedOperationId, 'failed', result)
    return result
  }
}

function recoverStartupState() {
  const transaction = recoverInterruptedTransaction()
  if (!transaction.ok) return transaction
  const temporary = readStorage(KEYS.restorePointTemporary, null)
  let state = transaction.state || 'clean'
  if (temporary.ok && temporary.exists) {
    removeStorage(KEYS.restorePointTemporary)
    state = 'temporary_only'
  }
  const restoreTemporary = readStorage(KEYS.restoreTemporary, null)
  if (restoreTemporary.ok && restoreTemporary.exists) {
    const formal = getVersionedState()
    const tempValid = validateRestoreState(restoreTemporary.value).ok
    if (formal.ok && !tempValid) {
      removeStorage(KEYS.restoreTemporary)
      state = 'formal_valid_temp_invalid'
    } else if (formal.ok && tempValid) {
      state = canonicalJson(formal.state) === canonicalJson(restoreTemporary.value)
        ? 'committed_with_temp_residue'
        : 'both_valid_different'
      if (state === 'committed_with_temp_residue') removeStorage(KEYS.restoreTemporary)
    } else if (!formal.ok && tempValid) state = 'formal_invalid_temp_valid'
    else state = 'both_invalid'
  }
  const lock = readStorage(KEYS.operationLock, null)
  if (lock.ok && lock.exists && lock.value) {
    const age = Date.now() - Date.parse(lock.value.createdAt || '')
    if (!Number.isFinite(age) || age > 5 * 60 * 1000) {
      removeStorage(KEYS.operationLock)
      state = state === 'clean' ? 'incomplete_lock' : state
    }
  }
  const result = { ok: true, state, startupRecoveryVersion: 1, checkedAt: new Date().toISOString() }
  writeStorage(KEYS.startupRecovery, result)
  return result
}

function clearCurrentProfileData({ operationId } = {}) {
  const context = activeContext()
  if (!context.ok) return context
  const restore = createRestorePoint({
    reason: 'before_clear_profile',
    profileScope: { type: 'single_profile', profileId: context.profile.id },
    operationId: `${operationId || `clear_profile_${Date.now()}`}_safety`
  })
  if (!restore.ok) return restore
  const empty = createEmptyProfileData(context.profile.id)
  empty.examYear = context.profile.examYear
  const profileData = { ...context.state.profileData, [context.profile.id]: empty }
  return updateVersionedState({ ...context.state, profileData })
}

function clearLocalData({ operationId } = {}) {
  const restore = createRestorePoint({
    reason: 'before_clear_all',
    profileScope: { type: 'full_user_state' },
    operationId: `${operationId || `clear_all_${Date.now()}`}_safety`
  })
  if (!restore.ok) return restore
  const marker = {
    clearedAt: new Date().toISOString(),
    schemaVersion: STORAGE_SCHEMA_VERSION
  }
  const cleared = atomicRemove(
    ALL_KNOWN_KEYS.filter((key) => key !== KEYS.clearMarker && ![
      KEYS.restorePointIndex,
      KEYS.restorePointPayloads,
      KEYS.restorePointOperationState,
      KEYS.operationLock,
      KEYS.startupRecovery
    ].includes(key)),
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

function protectedCall(operationType, operationId, context, action) {
  if (!operationId) return action()
  const started = beginOperation({ operationId, operationType, ...context })
  if (!started.ok || !started.started) return started
  let result
  try {
    result = action()
  } catch (error) {
    result = { ok: false, message: '本地操作失败，原数据已保留。' }
  }
  finishOperation(operationId, result && result.ok ? 'committed' : 'failed', result)
  return result
}

function protectedSaveScoreRecord(record, options = {}) {
  return protectedCall('save_score', options.operationId, {
    profileId: (getActiveProfile() || {}).id || '', entityId: record && record.id || ''
  }, () => saveScoreRecord(record))
}

function protectedDeleteScoreRecord(id, options = {}) {
  return protectedCall('delete_score', options.operationId, {
    profileId: (getActiveProfile() || {}).id || '', entityId: id
  }, () => deleteScoreRecord(id))
}

function protectedSaveTargetRecord(record, options = {}) {
  return protectedCall('save_target', options.operationId, {
    profileId: (getActiveProfile() || {}).id || '', entityId: record && (record.id || record.schoolId) || ''
  }, () => saveTargetRecord(record))
}

function protectedSaveStageGoalRecord(record, options = {}) {
  return protectedCall('save_stage_goal', options.operationId, {
    profileId: (getActiveProfile() || {}).id || '', entityId: record && record.id || ''
  }, () => saveLearningTargetRecord(record))
}

function protectedSaveLearningTask(record, options = {}) {
  return protectedCall('save_learning_task', options.operationId, {
    profileId: (getActiveProfile() || {}).id || '', entityId: record && record.id || ''
  }, () => saveLearningTask(record, options))
}

function protectedSetFavorite(schoolId, nextValue, options = {}) {
  return protectedCall('set_favorite', options.operationId, {
    profileId: (getActiveProfile() || {}).id || '', entityId: schoolId
  }, () => setFavorite(schoolId, nextValue))
}

function protectedSwitchStudentProfile(id, options = {}) {
  return protectedCall('switch_profile', options.operationId, { global: true, entityId: id }, () => switchStudentProfile(id))
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
  recoverStartupState,
  isVersionedStorageActive,
  ensureStorageMigrated,
  getVersionedState,
  replaceVersionedState,
  getDataRevision,
  TRANSACTION_STAGES,
  ERROR_CODES,
  getProfilesResult,
  getProfiles,
  getActiveProfile,
  createStudentProfile,
  updateStudentProfile,
  switchStudentProfile: protectedSwitchStudentProfile,
  deleteStudentProfile,
  getFavoriteIdsResult,
  getFavoriteIds,
  isFavorite,
  setFavorite: protectedSetFavorite,
  replaceFavoriteIds,
  getTargetRecordsResult,
  getTargetRecords,
  saveTargetRecord: protectedSaveTargetRecord,
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
  saveLearningTargetRecord: protectedSaveStageGoalRecord,
  saveStageGoalRecord: protectedSaveStageGoalRecord,
  deleteLearningTargetRecord,
  deleteStageGoalRecord,
  clearLearningTargetRecords,
  clearStageGoalRecords,
  getScoreRecordsResult,
  getScoreRecords,
  saveScoreRecord: protectedSaveScoreRecord,
  deleteScoreRecord: protectedDeleteScoreRecord,
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
  saveLearningTask: protectedSaveLearningTask,
  deleteLearningTask,
  getSubjectConfigs,
  saveSubjectConfigs,
  createRestorePoint,
  listRestorePoints,
  getRestorePoint,
  restoreFromRestorePoint,
  deleteRestorePoint,
  clearRestorePoints,
  validateRestoreState,
  acquireOperationLock,
  clearCurrentProfileData,
  clearLocalData,
  clearLocalDemoData
}
