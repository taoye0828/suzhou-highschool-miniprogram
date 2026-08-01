const { APP_CONFIG } = require('../config/app-config')
const { PRODUCT_RULES } = require('./generated/product-rules')
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
  normalizeSubjectConfig,
  normalizeExamTemplate,
  normalizeScoreScheme,
  normalizeMistakeRecord,
  normalizeWeeklyPlan,
  normalizeStageReview,
  normalizeSchoolUserState
} = require('./rc9-models')
const {
  builtInExamTemplates,
  builtInScoreSchemes
} = require('./v1-domain')
const {
  MIGRATION_CHAIN,
  migrateStorageSnapshot,
  storageWritesForState
} = require('./storage-migration')
const { LEGACY_STORAGE_KEYS } = require('./legacy/migration/storage-keys')
const { schools } = require('../data/schools')
const { createOperationContext } = require('./operation-context')
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
const OPERATION_LOCK_TTL_MS = PRODUCT_RULES.operationLockTtlMs
const MAX_OPERATION_STATES = 100
const MAX_OPERATION_STATE_BYTES = PRODUCT_RULES.limits.maxOperationStateBytes
const OWNER_SESSION_ID = `session_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
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

function committedTransactionResult(transactionId, {
  warning = null,
  stage = '',
  operationType = 'write'
} = {}) {
  return {
    ok: true,
    status: warning ? 'committed_with_warning' : 'committed',
    committed: true,
    recoveryRequired: false,
    warning,
    code: null,
    transactionId,
    operationType,
    stage,
    dataRevision: getDataRevision()
  }
}

function abortedTransactionResult(transactionId, {
  code = ERROR_CODES.STORAGE_WRITE_FAILED,
  message = '本地操作未提交，原数据已保留。',
  stage = '',
  operationType = 'write'
} = {}) {
  return {
    ok: false,
    status: 'aborted',
    committed: false,
    recoveryRequired: false,
    code,
    message,
    transactionId,
    operationType,
    stage,
    dataRevision: getDataRevision()
  }
}

function uncertainTransactionResult(transactionId, {
  code = ERROR_CODES.STARTUP_RECOVERY_REQUIRED,
  message = '本地操作状态暂时无法确认，请在“我的 → 数据管理 → 未完成数据操作”中处理。',
  stage = '',
  operationType = 'write'
} = {}) {
  return {
    ok: false,
    status: 'uncertain',
    committed: null,
    recoveryRequired: true,
    code,
    message,
    transactionId,
    operationType,
    stage,
    dataRevision: getDataRevision()
  }
}

function sameSnapshot(left, right) {
  return canonicalJson(left || {}) === canonicalJson(right || {})
}

function classifyTransactionOutcome({
  transactionId,
  operationType = 'write',
  keys,
  expected,
  before,
  warning = ERROR_CODES.CLEANUP_FAILED,
  stage = 'finalReadback'
}) {
  const readback = storageSnapshot(keys)
  if (readback.ok && sameSnapshot(readback.values, expected)) {
    return committedTransactionResult(transactionId, { warning, stage, operationType })
  }
  if (readback.ok && sameSnapshot(readback.values, before)) {
    return abortedTransactionResult(transactionId, {
      code: ERROR_CODES.STORAGE_WRITE_FAILED,
      message: '本地操作未提交，原数据已保留。',
      stage,
      operationType
    })
  }
  return uncertainTransactionResult(transactionId, { stage, operationType })
}

function atomicWrite(values, {
  operationType = 'write',
  operationId,
  faultInjector
} = {}) {
  const transactionId = operationId || `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  try {
    invokeFault(faultInjector, operationType, 'validate')
  } catch (error) {
    return abortedTransactionResult(transactionId, {
      code: error.code || 'TEST_INJECTED_FAILURE', stage: 'validate', operationType
    })
  }
  const keys = Object.keys(values)
  if (!keys.length) return committedTransactionResult(transactionId, { operationType })
  try {
    invokeFault(faultInjector, operationType, 'snapshot')
  } catch (error) {
    return abortedTransactionResult(transactionId, {
      code: error.code || 'TEST_INJECTED_FAILURE', stage: 'snapshot', operationType
    })
  }
  const before = storageSnapshot(keys)
  if (!before.ok) return abortedTransactionResult(transactionId, {
    code: ERROR_CODES.STORAGE_READBACK_FAILED,
    message: before.message,
    stage: 'snapshot',
    operationType
  })
  try {
    invokeFault(faultInjector, operationType, 'prepare')
    invokeFault(faultInjector, operationType, 'writeTemporary')
  } catch (error) {
    return abortedTransactionResult(transactionId, {
      code: error.code || 'TEST_INJECTED_FAILURE', stage: error.stage || 'prepare', operationType
    })
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
    return abortedTransactionResult(transactionId, {
      message: '本地安全写入未开始，原数据已保留。', stage: 'writeTemporary', operationType
    })
  }
  try {
    invokeFault(faultInjector, operationType, 'verifyTemporary')
    const journalReadback = readStorage(KEYS.transactionJournal, null)
    if (!journalReadback.ok || !journalReadback.exists ||
        canonicalJson(journalReadback.value.expected) !== canonicalJson(values)) {
      removeStorage(KEYS.transactionJournal)
      return abortedTransactionResult(transactionId, {
        code: ERROR_CODES.STORAGE_READBACK_FAILED, stage: 'verifyTemporary', operationType
      })
    }
    invokeFault(faultInjector, operationType, 'commit')
  } catch (error) {
    removeStorage(KEYS.transactionJournal)
    return abortedTransactionResult(transactionId, {
      code: error.code || 'TEST_INJECTED_FAILURE', stage: 'commit', operationType
    })
  }
  for (const key of keys) {
    const result = writeStorage(key, values[key])
    if (!result.ok) {
      const restored = restoreSnapshot(before.values, keys)
      if (restored) removeStorage(KEYS.transactionJournal)
      return restored
        ? abortedTransactionResult(transactionId, {
            message: '本地写入失败，原数据已保留，请清理空间后重试。', stage: 'commit', operationType
          })
        : uncertainTransactionResult(transactionId, { stage: 'commit', operationType })
    }
    const verify = readStorage(key, undefined)
    if (!verify.ok || JSON.stringify(verify.value) !== JSON.stringify(clone(values[key]))) {
      const restored = restoreSnapshot(before.values, keys)
      if (restored) removeStorage(KEYS.transactionJournal)
      return restored
        ? abortedTransactionResult(transactionId, {
            code: ERROR_CODES.STORAGE_READBACK_FAILED,
            message: '本地写入回读校验失败，原数据已保留，请重试。',
            stage: 'verifyCommitted',
            operationType
          })
        : uncertainTransactionResult(transactionId, { stage: 'verifyCommitted', operationType })
    }
  }
  try {
    invokeFault(faultInjector, operationType, 'verifyCommitted')
  } catch (error) {
    return uncertainTransactionResult(transactionId, {
      code: error.code || ERROR_CODES.STARTUP_RECOVERY_REQUIRED,
      stage: 'verifyCommitted',
      operationType
    })
  }
  try {
    invokeFault(faultInjector, operationType, 'writeCommittedJournal')
  } catch (error) {
    writeStorage(KEYS.cleanupPending, { transactionId, operationType, createdAt: new Date().toISOString() })
    return classifyTransactionOutcome({
      transactionId, operationType, keys, expected: values, before: before.values, stage: 'writeCommittedJournal'
    })
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
    writeStorage(KEYS.cleanupPending, { transactionId, operationType, createdAt: new Date().toISOString() })
    return classifyTransactionOutcome({
      transactionId, operationType, keys, expected: values, before: before.values, stage: 'writeCommittedJournal'
    })
  }
  try {
    invokeFault(faultInjector, operationType, 'cleanup')
  } catch (error) {
    writeStorage(KEYS.cleanupPending, { transactionId, operationType, createdAt: new Date().toISOString() })
    return committedTransactionResult(transactionId, {
      warning: ERROR_CODES.CLEANUP_FAILED, stage: 'cleanup', operationType
    })
  }
  try {
    invokeFault(faultInjector, operationType, 'finalReadback')
  } catch (error) {
    return uncertainTransactionResult(transactionId, {
      code: error.code || ERROR_CODES.STARTUP_RECOVERY_REQUIRED,
      stage: 'finalReadback',
      operationType
    })
  }
  const finalReadback = storageSnapshot(keys)
  if (!finalReadback.ok || !sameSnapshot(finalReadback.values, values)) {
    return uncertainTransactionResult(transactionId, { stage: 'finalReadback', operationType })
  }
  const cleaned = removeStorage(KEYS.transactionJournal)
  if (!cleaned.ok) {
    writeStorage(KEYS.cleanupPending, { transactionId, operationType, createdAt: new Date().toISOString() })
    return committedTransactionResult(transactionId, {
      warning: ERROR_CODES.CLEANUP_FAILED, stage: 'cleanup', operationType
    })
  }
  removeStorage(KEYS.cleanupPending)
  return committedTransactionResult(transactionId, { operationType })
}

function atomicRemove(keys, finalWrites = {}, {
  operationType = 'remove',
  operationId,
  faultInjector
} = {}) {
  const removeKeys = keys.filter((key) => key !== KEYS.transactionJournal)
  const touched = [...new Set([...removeKeys, ...Object.keys(finalWrites)])]
  const transactionId = operationId || `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  try {
    invokeFault(faultInjector, operationType, 'validate')
    invokeFault(faultInjector, operationType, 'snapshot')
  } catch (error) {
    return abortedTransactionResult(transactionId, {
      code: error.code || 'TEST_INJECTED_FAILURE', stage: 'snapshot', operationType
    })
  }
  const before = storageSnapshot(touched)
  if (!before.ok) return abortedTransactionResult(transactionId, {
    code: ERROR_CODES.STORAGE_READBACK_FAILED, message: before.message, stage: 'snapshot', operationType
  })
  const expectedAfter = clone(finalWrites)
  try {
    invokeFault(faultInjector, operationType, 'prepare')
    invokeFault(faultInjector, operationType, 'writeTemporary')
  } catch (error) {
    return abortedTransactionResult(transactionId, {
      code: error.code || 'TEST_INJECTED_FAILURE', stage: 'prepare', operationType
    })
  }
  const journal = writeStorage(KEYS.transactionJournal, {
    transactionId,
    operationType,
    createdAt: new Date().toISOString(),
    keys: touched,
    before: before.values,
    expectedAfter,
    status: 'removing'
  })
  if (!journal.ok) return abortedTransactionResult(transactionId, {
    message: '本地安全清除未开始，原数据已保留。', stage: 'writeTemporary', operationType
  })
  try {
    invokeFault(faultInjector, operationType, 'verifyTemporary')
    const prepared = readStorage(KEYS.transactionJournal, null)
    if (!prepared.ok || !prepared.exists || prepared.value.transactionId !== transactionId) {
      removeStorage(KEYS.transactionJournal)
      return abortedTransactionResult(transactionId, {
        code: ERROR_CODES.STORAGE_READBACK_FAILED, stage: 'verifyTemporary', operationType
      })
    }
    invokeFault(faultInjector, operationType, 'commit')
  } catch (error) {
    removeStorage(KEYS.transactionJournal)
    return abortedTransactionResult(transactionId, {
      code: error.code || 'TEST_INJECTED_FAILURE', stage: 'commit', operationType
    })
  }
  for (const key of removeKeys) {
    const result = removeStorage(key)
    if (!result.ok) {
      const restored = restoreSnapshot(before.values, touched)
      if (restored) removeStorage(KEYS.transactionJournal)
      return restored
        ? abortedTransactionResult(transactionId, {
            message: '本地数据清除失败，原数据已保留。', stage: 'commit', operationType
          })
        : uncertainTransactionResult(transactionId, { stage: 'commit', operationType })
    }
  }
  for (const [key, value] of Object.entries(finalWrites)) {
    const result = writeStorage(key, value)
    if (!result.ok) {
      const restored = restoreSnapshot(before.values, touched)
      if (restored) removeStorage(KEYS.transactionJournal)
      return restored
        ? abortedTransactionResult(transactionId, {
            message: '本地数据清除失败，原数据已保留。', stage: 'commit', operationType
          })
        : uncertainTransactionResult(transactionId, { stage: 'commit', operationType })
    }
  }
  try {
    invokeFault(faultInjector, operationType, 'verifyCommitted')
  } catch (error) {
    return uncertainTransactionResult(transactionId, {
      code: error.code || ERROR_CODES.STARTUP_RECOVERY_REQUIRED, stage: 'verifyCommitted', operationType
    })
  }
  const after = storageSnapshot(touched)
  if (!after.ok || !sameSnapshot(after.values, expectedAfter)) {
    return uncertainTransactionResult(transactionId, { stage: 'verifyCommitted', operationType })
  }
  try {
    invokeFault(faultInjector, operationType, 'writeCommittedJournal')
  } catch (error) {
    writeStorage(KEYS.cleanupPending, { transactionId, operationType, createdAt: new Date().toISOString() })
    return committedTransactionResult(transactionId, {
      warning: ERROR_CODES.CLEANUP_FAILED, stage: 'writeCommittedJournal', operationType
    })
  }
  const committedJournal = writeStorage(KEYS.transactionJournal, {
    transactionId,
    operationType,
    createdAt: new Date().toISOString(),
    keys: touched,
    before: before.values,
    expectedAfter,
    status: 'committed_remove'
  })
  if (!committedJournal.ok) {
    writeStorage(KEYS.cleanupPending, { transactionId, operationType, createdAt: new Date().toISOString() })
    return committedTransactionResult(transactionId, {
      warning: ERROR_CODES.CLEANUP_FAILED, stage: 'writeCommittedJournal', operationType
    })
  }
  try {
    invokeFault(faultInjector, operationType, 'cleanup')
  } catch (error) {
    writeStorage(KEYS.cleanupPending, { transactionId, operationType, createdAt: new Date().toISOString() })
    return committedTransactionResult(transactionId, {
      warning: ERROR_CODES.CLEANUP_FAILED, stage: 'cleanup', operationType
    })
  }
  try {
    invokeFault(faultInjector, operationType, 'finalReadback')
  } catch (error) {
    return uncertainTransactionResult(transactionId, {
      code: error.code || ERROR_CODES.STARTUP_RECOVERY_REQUIRED, stage: 'finalReadback', operationType
    })
  }
  const finalReadback = storageSnapshot(touched)
  if (!finalReadback.ok || !sameSnapshot(finalReadback.values, expectedAfter)) {
    return uncertainTransactionResult(transactionId, { stage: 'finalReadback', operationType })
  }
  const cleaned = removeStorage(KEYS.transactionJournal)
  if (!cleaned.ok) {
    writeStorage(KEYS.cleanupPending, { transactionId, operationType, createdAt: new Date().toISOString() })
    return committedTransactionResult(transactionId, {
      warning: ERROR_CODES.CLEANUP_FAILED, stage: 'cleanup', operationType
    })
  }
  removeStorage(KEYS.cleanupPending)
  return committedTransactionResult(transactionId, { operationType })
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
  const current = storageSnapshot(keys)
  const expected = journal.status === 'committed_remove'
    ? (journal.expectedAfter && typeof journal.expectedAfter === 'object' ? journal.expectedAfter : {})
    : (journal.expected && typeof journal.expected === 'object' ? journal.expected : {})
  const removingCommitted = journal.status === 'removing' && journal.expectedAfter &&
    current.ok && sameSnapshot(current.values, journal.expectedAfter)
  if (journal.status === 'committed' || journal.status === 'committed_remove' || removingCommitted) {
    const committedExpected = removingCommitted ? journal.expectedAfter : expected
    if (current.ok && sameSnapshot(current.values, committedExpected)) {
      const removed = removeStorage(KEYS.transactionJournal)
      if (removed.ok) removeStorage(KEYS.cleanupPending)
      return removed.ok
        ? { ok: true, recovered: true, state: 'committed_with_journal', transactionId: journal.transactionId || '' }
        : { ok: true, recovered: true, state: 'committed_with_journal', warning: ERROR_CODES.CLEANUP_FAILED }
    }
    return {
      ok: false,
      code: ERROR_CODES.STARTUP_RECOVERY_REQUIRED,
      state: 'both_valid_different',
      message: '检测到未完成写入，请在数据管理中确认保留当前数据。'
    }
  }
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
  if (migration.fromVersion === 4) {
    const timestamp = new Date().toISOString()
    const migrationPoint = buildRestorePoint({
      state: migration.beforeState,
      reason: 'before_migration',
      profileScope: { type: 'full_user_state' },
      id: `restore_before_migration_${timestamp.replace(/[^0-9]/g, '').slice(0, 17)}`,
      createdAt: timestamp,
      operationId: `migration_v4_v5_${timestamp.replace(/[^0-9]/g, '')}`,
      createdBy: 'automatic',
      note: 'Storage Schema v4 → v5 迁移前',
      sourcePlatform: 'miniprogram',
      storageSchemaVersion: 4,
      backupFormatVersion: 2,
      appDataVersion: 'rc11-2'
    })
    const verified = validateRestorePoint(migrationPoint)
    if (!verified.ok) return { ok: false, message: '迁移前恢复点校验失败，原数据未修改。' }
    const payloads = raw[KEYS.restorePointPayloads] && typeof raw[KEYS.restorePointPayloads] === 'object'
      ? clone(raw[KEYS.restorePointPayloads])
      : {}
    payloads[migrationPoint.id] = migrationPoint
    let index = Array.isArray(raw[KEYS.restorePointIndex]) ? clone(raw[KEYS.restorePointIndex]) : []
    index = index.filter((item) => item && item.id !== migrationPoint.id)
    index.push(restorePointRecord(migrationPoint))
    index.sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)))
    for (const evicted of index.slice(0, Math.max(0, index.length - MAX_RESTORE_POINTS))) delete payloads[evicted.id]
    writes[KEYS.restorePointIndex] = index.slice(-MAX_RESTORE_POINTS)
    writes[KEYS.restorePointPayloads] = payloads
  }
  const legacyStates = raw[KEYS.restorePointOperationState]
  if (legacyStates && typeof legacyStates === 'object') {
    const compacted = {}
    const ids = Object.keys(legacyStates).sort((left, right) =>
      String(legacyStates[right] && (legacyStates[right].finishedAt || legacyStates[right].startedAt) || '')
        .localeCompare(String(legacyStates[left] && (legacyStates[left].finishedAt || legacyStates[left].startedAt) || ''))
    )
    for (const id of ids.slice(0, MAX_OPERATION_STATES)) {
      const state = legacyStates[id] || {}
      compacted[id] = state.status === 'running'
        ? {
            operationId: String(id).slice(0, 160),
            operationType: String(state.operationType || '').slice(0, 80),
            status: 'running',
            profileId: String(state.profileId || '').slice(0, 120),
            entityId: String(state.entityId || '').slice(0, 120),
            startedAt: String(state.startedAt || '').slice(0, 40)
          }
        : compactOperationState(id, state.status || 'failed', state.result || state, state)
    }
    writes[KEYS.restorePointOperationState] = compacted
  }
  const currentRevision = Number(raw[KEYS.dataRevision])
  writes[KEYS.dataRevision] = Number.isSafeInteger(currentRevision) ? currentRevision + 1 : 1
  const finalSchemaVersion = writes[KEYS.storageSchemaVersion]
  delete writes[KEYS.storageSchemaVersion]
  writes[KEYS.storageSchemaVersion] = finalSchemaVersion
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
    ? { ...result, state: { ...nextState, profiles: normalizedProfiles, activeProfileId, profileData } }
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
  return result.ok ? { ...result, data: normalized, profile: context.profile } : result
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
  const merged = current ? normalizeTargetRecord({ ...current, ...record, id: current.id }, profileId) : normalized
  const recordToSave = current
    ? {
        ...merged,
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
  const result = updateActiveProfileData((data) => ({
    ...data,
    stageGoals: records,
    learningTasks: data.learningTasks.map((task) => task.stageGoalId === id
      ? { ...task, stageGoalId: '', updatedAt: new Date().toISOString(), version: Number(task.version || 1) + 1 }
      : task)
  }))
  return result.ok ? { ok: true, records } : result
}

const deleteStageGoalRecord = deleteLearningTargetRecord

function clearLearningTargetRecords() {
  return updateActiveProfileData((data) => ({
    ...data,
    stageGoals: [],
    learningTasks: data.learningTasks.map((task) => task.stageGoalId
      ? { ...task, stageGoalId: '', updatedAt: new Date().toISOString(), version: Number(task.version || 1) + 1 }
      : task)
  }))
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

function saveExamWithReview(examRecord, reviewRecord) {
  const context = activeContext()
  if (!context.ok) return context
  const profileId = context.profile.id
  const normalizedExam = normalizeExamRecord(examRecord, profileId)
  const normalizedReview = normalizeScoreReview(reviewRecord, profileId)
  if (!normalizedExam || !normalizedReview || normalizedReview.examRecordId !== normalizedExam.id) {
    return { ok: false, message: '考试与复盘数据不完整，原数据未修改。' }
  }
  const currentExam = context.data.scoreRecords.find((item) => item.id === normalizedExam.id)
  const examConflict = versionConflict(currentExam, examRecord && (examRecord.expectedVersion ?? examRecord.version))
  if (examConflict) return examConflict
  const currentReview = context.data.scoreReviews.find((item) => item.id === normalizedReview.id)
  const reviewConflict = versionConflict(currentReview, reviewRecord && (reviewRecord.expectedVersion ?? reviewRecord.version))
  if (reviewConflict) return reviewConflict
  const now = new Date().toISOString()
  const savedExam = currentExam
    ? { ...currentExam, ...normalizedExam, createdAt: currentExam.createdAt, updatedAt: now, version: Number(currentExam.version || 1) + 1 }
    : normalizedExam
  const savedReview = currentReview
    ? { ...currentReview, ...normalizedReview, createdAt: currentReview.createdAt, updatedAt: now, version: Number(currentReview.version || 1) + 1 }
    : normalizedReview
  const scoreRecords = [
    ...context.data.scoreRecords.filter((item) => item.id !== savedExam.id),
    savedExam
  ].sort(compareScoreRecords).slice(-APP_CONFIG.scoreRecord.maxRecords)
  const scoreReviews = [
    savedReview,
    ...context.data.scoreReviews.filter((item) => item.id !== savedReview.id)
  ]
  const result = updateActiveProfileData((data) => ({
    ...data,
    scoreRecords,
    scoreReviews,
    recentHistory: addHistoryEntry(data.recentHistory, 'editedExams', {
      id: savedExam.id,
      examRecordId: savedExam.id,
      examName: savedExam.examName,
      examDate: savedExam.examDate
    }, 10)
  }))
  return result.ok ? { ...result, examRecord: savedExam, review: savedReview } : result
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
  return updateActiveProfileData((data) => ({
    ...data,
    scoreReviews: data.scoreReviews.filter((item) => item.id !== id),
    scoreLossReasons: data.scoreLossReasons.filter((item) => item.reviewId !== id),
    learningTasks: data.learningTasks.map((task) => task.sourceReviewId === id
      ? { ...task, sourceReviewId: '', updatedAt: new Date().toISOString(), version: Number(task.version || 1) + 1 }
      : task)
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
  if (!allowDuplicateSource && (normalized.sourceLossReasonId || normalized.sourceMistakeRecordId || normalized.sourceReviewId)) {
    const duplicate = getLearningTasks().find((item) =>
      item.id !== normalized.id &&
      (normalized.sourceLossReasonId
        ? item.sourceLossReasonId === normalized.sourceLossReasonId
        : normalized.sourceMistakeRecordId
          ? item.sourceMistakeRecordId === normalized.sourceMistakeRecordId
          : item.sourceReviewId === normalized.sourceReviewId &&
            item.sourceReasonType === normalized.sourceReasonType &&
            item.subjectId === normalized.subjectId)
    )
    if (duplicate) {
      return { ok: false, code: 'DUPLICATE_SOURCE', message: '该复盘已创建过学习任务。' }
    }
  }
  return saveProfileRecord('learningTasks', normalized, normalizeLearningTask, '学习任务', 1000)
}

function deleteLearningTask(id) {
  return updateActiveProfileData((data) => ({
    ...data,
    learningTasks: data.learningTasks.filter((item) => item.id !== id),
    mistakeRecords: data.mistakeRecords.map((item) => item.linkedTaskIds.includes(id)
      ? {
          ...item,
          linkedTaskIds: item.linkedTaskIds.filter((taskId) => taskId !== id),
          updatedAt: new Date().toISOString(),
          version: Number(item.version || 1) + 1
        }
      : item)
  }))
}

function getMistakeRecords() {
  return listFromActiveData('mistakeRecords')
}

function saveMistakeRecord(record) {
  return saveProfileRecord(
    'mistakeRecords',
    record,
    normalizeMistakeRecord,
    '错题记录',
    PRODUCT_RULES.limits.maxMistakeRecordsPerProfile
  )
}

function deleteMistakeRecord(id) {
  return deleteProfileRecord('mistakeRecords', id)
}

function saveMistakeWithTask(mistakeInput, taskInput) {
  const profile = getActiveProfile()
  const profileId = profile && profile.id || DEFAULT_PROFILE_ID
  const mistake = normalizeMistakeRecord(mistakeInput, profileId)
  const task = normalizeLearningTask({
    ...taskInput,
    sourceMistakeRecordId: mistake && mistake.id || ''
  }, profileId)
  if (!mistake || !task) return { ok: false, message: '错题或学习任务格式无效。' }
  const context = activeContext()
  if (!context.ok) return context
  const currentMistake = context.data.mistakeRecords.find((item) => item.id === mistake.id)
  const currentTask = context.data.learningTasks.find((item) => item.id === task.id)
  const mistakeConflict = versionConflict(currentMistake, mistakeInput && (mistakeInput.expectedVersion ?? mistakeInput.version))
  if (mistakeConflict) return mistakeConflict
  const taskConflict = versionConflict(currentTask, taskInput && (taskInput.expectedVersion ?? taskInput.version))
  if (taskConflict) return taskConflict
  const duplicate = context.data.learningTasks.find((item) =>
    item.id !== task.id && item.sourceMistakeRecordId === mistake.id)
  if (duplicate) return { ok: false, code: 'DUPLICATE_SOURCE', message: '该错题已创建过学习任务。' }
  const now = new Date().toISOString()
  const savedTask = currentTask
    ? { ...currentTask, ...task, createdAt: currentTask.createdAt, updatedAt: now, version: Number(currentTask.version || 1) + 1 }
    : task
  const linkedTaskIds = [...new Set([...(mistake.linkedTaskIds || []), savedTask.id])]
  const savedMistake = currentMistake
    ? { ...currentMistake, ...mistake, linkedTaskIds, createdAt: currentMistake.createdAt, updatedAt: now, version: Number(currentMistake.version || 1) + 1 }
    : { ...mistake, linkedTaskIds }
  const result = updateActiveProfileData((data) => ({
    ...data,
    mistakeRecords: [savedMistake, ...data.mistakeRecords.filter((item) => item.id !== savedMistake.id)]
      .slice(0, PRODUCT_RULES.limits.maxMistakeRecordsPerProfile),
    learningTasks: [savedTask, ...data.learningTasks.filter((item) => item.id !== savedTask.id)]
      .slice(0, PRODUCT_RULES.limits.maxLearningTasksPerProfile)
  }))
  return result.ok ? { ok: true, mistakeRecord: savedMistake, learningTask: savedTask } : result
}

function getWeeklyPlans() {
  return listFromActiveData('weeklyPlans')
}

function saveWeeklyPlan(record) {
  return saveProfileRecord(
    'weeklyPlans', record, normalizeWeeklyPlan, '周计划', PRODUCT_RULES.limits.maxWeeklyPlansPerProfile
  )
}

function deleteWeeklyPlan(id) {
  return deleteProfileRecord('weeklyPlans', id)
}

function getStageReviews() {
  return listFromActiveData('stageReviews')
}

function saveStageReview(record) {
  return saveProfileRecord(
    'stageReviews', record, normalizeStageReview, '阶段复盘', PRODUCT_RULES.limits.maxStageReviewsPerProfile
  )
}

function deleteStageReview(id) {
  return deleteProfileRecord('stageReviews', id)
}

function getSchoolUserStates() {
  return listFromActiveData('schoolUserStates')
}

function getSchoolUserState(schoolId) {
  return getSchoolUserStates().find((item) => item.schoolId === schoolId) || null
}

function saveSchoolUserState(record) {
  return saveProfileRecord(
    'schoolUserStates', record, normalizeSchoolUserState, '学校个人状态', PRODUCT_RULES.limits.maxSchoolUserStatesPerProfile
  )
}

function deleteSchoolUserState(id) {
  return deleteProfileRecord('schoolUserStates', id)
}

function getSubjectConfigs() {
  const context = activeContext()
  return context.ok ? context.data.subjectConfigs : []
}

function saveSubjectConfigs(configs) {
  const currentById = new Map(getSubjectConfigs().map((item) => [item.subjectId, item]))
  const normalized = (Array.isArray(configs) ? configs : []).map((item, index) => {
    const current = currentById.get(item && (item.subjectId || item.id))
    const now = new Date().toISOString()
    return normalizeSubjectConfig({
      ...current,
      ...item,
      createdAt: current && current.createdAt || item && item.createdAt || now,
      updatedAt: now,
      version: current ? Number(current.version || 1) + 1 : Number(item && item.version || 1)
    }, index)
  }).filter(Boolean)
  return updateActiveProfileData((data) => ({ ...data, subjectConfigs: normalized }))
}

function getCustomExamTemplates() {
  return listFromActiveData('examTemplates')
}

function getExamTemplates() {
  const profile = getActiveProfile()
  return [
    ...builtInExamTemplates(profile && profile.id || DEFAULT_PROFILE_ID),
    ...getCustomExamTemplates()
  ].sort((left, right) => {
    const order = Number(left.displayOrder || 0) - Number(right.displayOrder || 0)
    return order !== 0 ? order : String(left.name).localeCompare(String(right.name), 'zh-Hans-CN')
  })
}

function saveExamTemplate(record) {
  const builtInIds = new Set(PRODUCT_RULES.builtInExamTemplates.map((item) => item.id))
  if (record && builtInIds.has(record.id)) {
    return { ok: false, code: 'BUILT_IN_IMMUTABLE', message: '内置考试模板不能直接修改，可复制为自定义模板。' }
  }
  const current = getCustomExamTemplates()
  if (record && !current.some((item) => item.id === record.id) &&
      current.length >= PRODUCT_RULES.limits.maxCustomExamTemplatesPerProfile) {
    return { ok: false, code: 'ENTITY_LIMIT_EXCEEDED', message: '自定义考试模板已达 30 个上限，原数据未修改。' }
  }
  return saveProfileRecord(
    'examTemplates',
    record,
    normalizeExamTemplate,
    '考试模板',
    PRODUCT_RULES.limits.maxCustomExamTemplatesPerProfile
  )
}

function examTemplateReferenceCount(id) {
  return getScoreRecords().filter((item) => item.examTemplateId === id).length
}

function deleteExamTemplate(id) {
  if (PRODUCT_RULES.builtInExamTemplates.some((item) => item.id === id)) {
    return { ok: false, code: 'BUILT_IN_IMMUTABLE', message: '内置考试模板不能删除。' }
  }
  return deleteProfileRecord('examTemplates', id)
}

function getCustomScoreSchemes() {
  return listFromActiveData('scoreSchemes')
}

function getScoreSchemes() {
  const profile = getActiveProfile()
  return [
    ...builtInScoreSchemes(profile && profile.id || DEFAULT_PROFILE_ID),
    ...getCustomScoreSchemes()
  ]
}

function saveScoreScheme(record) {
  const builtInIds = new Set(PRODUCT_RULES.builtInScoreSchemes.map((item) => item.id))
  if (record && builtInIds.has(record.id)) {
    return { ok: false, code: 'BUILT_IN_IMMUTABLE', message: '内置分值方案不能直接修改，可复制为自定义方案。' }
  }
  const current = getCustomScoreSchemes()
  if (record && !current.some((item) => item.id === record.id) &&
      current.length >= PRODUCT_RULES.limits.maxCustomScoreSchemesPerProfile) {
    return { ok: false, code: 'ENTITY_LIMIT_EXCEEDED', message: '自定义分值方案已达 30 个上限，原数据未修改。' }
  }
  return saveProfileRecord(
    'scoreSchemes',
    record,
    normalizeScoreScheme,
    '分值方案',
    PRODUCT_RULES.limits.maxCustomScoreSchemesPerProfile
  )
}

function scoreSchemeReferenceStats(id) {
  const context = activeContext()
  if (!context.ok) return { examCount: 0, templateCount: 0 }
  return {
    examCount: context.data.scoreRecords.filter((item) => item.scoreSchemeId === id).length,
    templateCount: context.data.examTemplates.filter((item) => item.scoreSchemeId === id).length
  }
}

function deleteScoreScheme(id) {
  if (PRODUCT_RULES.builtInScoreSchemes.some((item) => item.id === id)) {
    return { ok: false, code: 'BUILT_IN_IMMUTABLE', message: '内置分值方案不能删除。' }
  }
  const references = scoreSchemeReferenceStats(id)
  if (references.templateCount > 0) {
    return {
      ok: false,
      code: 'SCHEME_IN_USE_BY_TEMPLATE',
      message: `还有 ${references.templateCount} 个自定义模板使用该方案，请先修改模板。`
    }
  }
  return deleteProfileRecord('scoreSchemes', id)
}

function operationStates() {
  const result = readStorage(KEYS.restorePointOperationState, {})
  return result.ok && result.value && typeof result.value === 'object' ? result.value : {}
}

function operationResult(operationId) {
  if (!operationId) return null
  const state = operationStates()[operationId]
  if (!state) return null
  if (state.status === 'committed' || state.status === 'committed_with_warning') {
    if (state.operationType === 'create_restore_point' && state.restorePointId) {
      const payloads = readStorage(KEYS.restorePointPayloads, {})
      if (!payloads.ok || !payloads.value || !payloads.value[state.restorePointId]) return null
    }
    return {
      ok: true,
      status: state.status,
      committed: true,
      recoveryRequired: false,
      warning: state.status === 'committed_with_warning' ? state.resultCode || ERROR_CODES.CLEANUP_FAILED : null,
      code: null,
      operationId,
      operationType: state.operationType,
      profileId: state.profileId || '',
      entityId: state.entityId || '',
      restorePointId: state.restorePointId || '',
      resultVersion: state.resultVersion || 0,
      resultChecksum: state.resultChecksum || '',
      idempotent: true
    }
  }
  if (state.status === 'running') {
    return { ok: false, code: ERROR_CODES.TRANSACTION_ALREADY_RUNNING, message: '操作正在进行，请稍候。' }
  }
  return null
}

function acquireOperationLock({
  operationId,
  operationType,
  profileId = '',
  entityId = '',
  global = false,
  ownerSessionId = OWNER_SESSION_ID,
  nowMs = Date.now()
}) {
  const now = Number(nowMs)
  const existing = readStorage(KEYS.operationLock, null)
  if (!existing.ok) return {
    ok: false,
    code: ERROR_CODES.STORAGE_READBACK_FAILED,
    message: '本地操作锁读取失败，原数据已保留。'
  }
  if (existing.exists && existing.value) {
    const expiresAt = Date.parse(existing.value.expiresAt || '')
    const created = Date.parse(existing.value.acquiredAt || existing.value.createdAt || '')
    const stale = Number.isFinite(expiresAt)
      ? now >= expiresAt
      : (!Number.isFinite(created) || now - created > OPERATION_LOCK_TTL_MS)
    const existingOperationId = existing.value.operationId || existing.value.owner
    const ownerState = operationStates()[existingOperationId]
    const ownerFinished = ownerState && ownerState.status !== 'running'
    const conflicts = existing.value.global || global ||
      (profileId && existing.value.profileId === profileId) ||
      (entityId && existing.value.entityId === entityId)
    if (stale && ownerState && ownerState.status === 'running' &&
        existingOperationId !== operationId && conflicts) {
      return {
        ok: false,
        code: ERROR_CODES.STARTUP_RECOVERY_REQUIRED,
        message: '检测到过期但仍标记运行中的操作，请先处理启动恢复。'
      }
    }
    if (!stale && !ownerFinished && existingOperationId !== operationId && conflicts) {
      return { ok: false, code: ERROR_CODES.OPERATION_LOCKED, message: '另一项本地数据操作正在进行。' }
    }
    if (ownerFinished || (stale && (!ownerState || ownerState.status !== 'running'))) {
      const released = removeStorage(KEYS.operationLock)
      if (!released.ok) return { ok: false, code: ERROR_CODES.CLEANUP_FAILED, message: '上一次操作已结束，但临时锁清理失败。' }
    }
  }
  const lock = {
    lockId: `lock_${operationId}`,
    operationId,
    operationType,
    profileId,
    entityId,
    global,
    acquiredAt: new Date(now).toISOString(),
    expiresAt: new Date(now + OPERATION_LOCK_TTL_MS).toISOString(),
    ownerSessionId
  }
  const written = writeStorage(KEYS.operationLock, lock)
  return written.ok
    ? { ok: true, lock }
    : { ok: false, code: ERROR_CODES.STORAGE_WRITE_FAILED, message: '本地安全操作未开始，原数据已保留。' }
}

function compactOperationState(operationId, status, result, context = {}) {
  const restorePointId = String(
    result && (result.restorePointId || (result.restorePoint && result.restorePoint.id)) || ''
  ).slice(0, 120)
  const state = {
    operationId: String(operationId).slice(0, 160),
    operationType: String(context.operationType || result && result.operationType || '').slice(0, 80),
    status: status === 'committed' && result && result.warning ? 'committed_with_warning' : status,
    profileId: String(context.profileId || '').slice(0, 120),
    entityId: String(context.entityId || '').slice(0, 120),
    resultCode: String(result && (result.code || result.warning) || '').slice(0, 120),
    resultVersion: Number.isInteger(Number(result && result.resultVersion)) ? Number(result.resultVersion) : 0,
    resultChecksum: String(result && result.resultChecksum || '').slice(0, 128),
    restorePointId,
    startedAt: String(context.startedAt || '').slice(0, 40),
    finishedAt: new Date().toISOString()
  }
  if (unescape(encodeURIComponent(JSON.stringify(state))).length > MAX_OPERATION_STATE_BYTES) {
    state.entityId = ''
    state.resultChecksum = ''
  }
  return state
}

function finishOperation(operationId, status, result, context = {}) {
  const states = operationStates()
  const previous = states[operationId] || {}
  states[operationId] = compactOperationState(operationId, status, result, { ...previous, ...context })
  const ids = Object.keys(states).sort((left, right) =>
    String(states[right].finishedAt || '').localeCompare(String(states[left].finishedAt || ''))
  )
  for (const id of ids.slice(MAX_OPERATION_STATES)) delete states[id]
  writeStorage(KEYS.restorePointOperationState, states)
  const lock = readStorage(KEYS.operationLock, null)
  if (lock.ok && lock.exists && lock.value &&
      (lock.value.operationId === operationId || lock.value.owner === operationId)) {
    removeStorage(KEYS.operationLock)
  }
}

function beginOperation(context) {
  const resolved = createOperationContext(context)
  const previous = operationResult(resolved.operationId)
  if (previous) return previous
  const lock = acquireOperationLock({ ...context, ...resolved })
  if (!lock.ok) return lock
  const states = operationStates()
  states[resolved.operationId] = {
    ...resolved,
    global: Boolean(context.global),
    status: 'running',
    startedAt: resolved.startedAt
  }
  const ids = Object.keys(states).sort((left, right) =>
    String(states[right].startedAt || states[right].finishedAt || '')
      .localeCompare(String(states[left].startedAt || states[left].finishedAt || ''))
  )
  for (const id of ids.slice(MAX_OPERATION_STATES)) delete states[id]
  if (!writeStorage(KEYS.restorePointOperationState, states).ok) {
    removeStorage(KEYS.operationLock)
    return {
      ok: false,
      code: ERROR_CODES.STORAGE_WRITE_FAILED,
      message: '本地安全操作未开始，原数据已保留。'
    }
  }
  return { ok: true, started: true, operationContext: resolved }
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
    ? { ok: true, restorePoint: clone(validation.restorePoint || point) }
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
      backupFormatVersion: PRODUCT_RULES.backupFormatVersion,
      appDataVersion: PRODUCT_RULES.appDataVersion
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
    for (const field of [
      'scoreRecords', 'scoreReviews', 'scoreLossReasons', 'targetRecords', 'stageGoals', 'learningTasks',
      'examTemplates', 'scoreSchemes', 'mistakeRecords', 'weeklyPlans', 'stageReviews', 'schoolUserStates'
    ]) {
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
    const ids = (field) => new Set((data[field] || []).map((item) => item.id))
    const examIds = ids('scoreRecords')
    const reviewIds = ids('scoreReviews')
    const reasonIds = ids('scoreLossReasons')
    const taskIds = ids('learningTasks')
    const stageGoalIds = ids('stageGoals')
    const schemeIds = new Set([
      ...PRODUCT_RULES.builtInScoreSchemes.map((item) => item.id),
      ...(data.scoreSchemes || []).map((item) => item.id)
    ])
    if ((data.scoreReviews || []).some((item) => !examIds.has(item.examRecordId)) ||
        (data.scoreLossReasons || []).some((item) => !examIds.has(item.examRecordId) ||
          (item.reviewId && !reviewIds.has(item.reviewId))) ||
        (data.mistakeRecords || []).some((item) =>
          (item.examRecordId && !examIds.has(item.examRecordId)) ||
          (item.reviewId && !reviewIds.has(item.reviewId)) ||
          (item.linkedTaskIds || []).some((id) => !taskIds.has(id))) ||
        (data.learningTasks || []).some((item) =>
          (item.sourceExamId && !examIds.has(item.sourceExamId)) ||
          (item.sourceReviewId && !reviewIds.has(item.sourceReviewId)) ||
          (item.sourceLossReasonId && !reasonIds.has(item.sourceLossReasonId))) ||
        (data.weeklyPlans || []).some((item) => (item.taskItems || []).some((id) => !taskIds.has(id))) ||
        (data.stageReviews || []).some((item) => !stageGoalIds.has(item.stageGoalId)) ||
        (data.examTemplates || []).some((item) => item.scoreSchemeId && !schemeIds.has(item.scoreSchemeId))) {
      return { ok: false, code: ERROR_CODES.INVALID_PROFILE_REFERENCE }
    }
    const schoolIds = [
      ...(data.favoriteSchoolIds || []),
      ...(data.targetRecords || []).map((item) => item.schoolId),
      ...(data.schoolUserStates || []).map((item) => item.schoolId)
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
  let expectedCommittedState = null
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
    expectedCommittedState = committed.state
    invokeFault(faultInjector, 'restore', 'verifyCommitted')
    const readback = getVersionedState()
    if (!readback.ok || canonicalJson(readback.state) !== canonicalJson(committed.state)) {
      throw Object.assign(new Error(), { code: ERROR_CODES.STORAGE_READBACK_FAILED })
    }
    invokeFault(faultInjector, 'restore', 'cleanup')
    const cleaned = removeStorage(KEYS.restoreTemporary)
    const result = {
      ok: true,
      status: cleaned.ok ? 'committed' : 'committed_with_warning',
      committed: true,
      recoveryRequired: false,
      warning: cleaned.ok ? null : ERROR_CODES.CLEANUP_FAILED,
      restorePointId: id,
      safetyRestorePointId: before.restorePoint.id
    }
    finishOperation(resolvedOperationId, 'committed', result)
    return result
  } catch (error) {
    if (expectedCommittedState) {
      const readback = getVersionedState()
      if (readback.ok && sameSnapshot(readback.state, expectedCommittedState)) {
        const result = {
          ok: true,
          status: 'committed_with_warning',
          committed: true,
          recoveryRequired: false,
          warning: error.code || ERROR_CODES.CLEANUP_FAILED,
          code: null,
          restorePointId: id,
          safetyRestorePointId: before.restorePoint.id,
          message: '数据已恢复；临时状态仍需在数据管理中清理。'
        }
        finishOperation(resolvedOperationId, 'committed', result)
        return result
      }
      const result = uncertainTransactionResult(resolvedOperationId, {
        code: error.code || ERROR_CODES.STARTUP_RECOVERY_REQUIRED,
        stage: error.stage || 'verifyCommitted',
        operationType: 'restore'
      })
      finishOperation(resolvedOperationId, 'uncertain', result)
      return result
    }
    removeStorage(KEYS.restoreTemporary)
    const result = {
      ok: false,
      status: 'aborted',
      committed: false,
      recoveryRequired: false,
      code: error.code || ERROR_CODES.RESTORE_POINT_VERIFY_FAILED,
      message: '恢复未提交，当前数据已保留。'
    }
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
    const lockOperationId = lock.value.operationId || lock.value.owner
    const ownerState = operationStates()[lockOperationId]
    const expiresAt = Date.parse(lock.value.expiresAt || '')
    const age = Date.now() - Date.parse(lock.value.acquiredAt || lock.value.createdAt || '')
    const expired = Number.isFinite(expiresAt)
      ? Date.now() >= expiresAt
      : (!Number.isFinite(age) || age > OPERATION_LOCK_TTL_MS)
    if (expired && (!ownerState || ownerState.status !== 'running')) {
      removeStorage(KEYS.operationLock)
      state = state === 'clean' ? 'incomplete_lock' : state
    }
  }
  const result = { ok: true, state, startupRecoveryVersion: 1, checkedAt: new Date().toISOString() }
  writeStorage(KEYS.startupRecovery, result)
  return result
}

function getStartupRecoveryState() {
  const result = readStorage(KEYS.startupRecovery, null)
  return result.ok && result.exists && result.value
    ? clone(result.value)
    : { ok: true, state: 'clean', startupRecoveryVersion: 1, checkedAt: '' }
}

function resolveStartupRecovery(action, options = {}) {
  if (!['retry_auto', 'keep_formal', 'use_temporary'].includes(action)) {
    return { ok: false, code: 'RECOVERY_ACTION_INVALID', message: '未识别的恢复操作。' }
  }
  if (action === 'retry_auto') return recoverStartupState()
  return protectedCall(
    `startup_recovery_${action}`,
    options.operationContext || options.operationId,
    { global: true, entityId: action },
    (operationContext) => {
      if (action === 'keep_formal') {
        const formal = getVersionedState()
        if (!formal.ok || !validateRestoreState(formal.state).ok) {
          return { ok: false, code: ERROR_CODES.FORMAL_DATA_INVALID, message: '当前正式数据不可用，不能直接保留。' }
        }
        const journal = readStorage(KEYS.transactionJournal, null)
        if (journal.ok && journal.exists && journal.value) {
          const keys = Array.isArray(journal.value.keys) ? journal.value.keys : []
          const current = storageSnapshot(keys)
          const expected = journal.value.expectedAfter || journal.value.expected || {}
          if (current.ok && !sameSnapshot(current.values, expected) && journal.value.status !== 'committed') {
            return {
              ok: false,
              code: ERROR_CODES.STARTUP_RECOVERY_REQUIRED,
              message: '事务证据与当前数据不一致，不能自动丢弃。'
            }
          }
        }
        for (const key of [KEYS.transactionJournal, KEYS.restoreTemporary, KEYS.cleanupPending]) {
          const removed = removeStorage(key)
          if (!removed.ok) return committedTransactionResult(operationContext.operationId, {
            warning: ERROR_CODES.CLEANUP_FAILED,
            stage: 'cleanup',
            operationType: 'startup_recovery_keep_formal'
          })
        }
      } else {
        const temporary = readStorage(KEYS.restoreTemporary, null)
        if (!temporary.ok || !temporary.exists || !validateRestoreState(temporary.value).ok) {
          return { ok: false, code: ERROR_CODES.TEMPORARY_DATA_INVALID, message: '临时数据不可用，当前数据未修改。' }
        }
        const formal = getVersionedState()
        if (formal.ok) {
          const safety = createRestorePoint({
            reason: 'before_restore',
            profileScope: { type: 'full_user_state' },
            operationId: `${operationContext.operationId}_safety`
          })
          if (!safety.ok) return safety
        }
        const restored = updateVersionedState(temporary.value)
        if (!restored.ok) return restored
        const removed = removeStorage(KEYS.restoreTemporary)
        if (!removed.ok) return committedTransactionResult(operationContext.operationId, {
          warning: ERROR_CODES.CLEANUP_FAILED,
          stage: 'cleanup',
          operationType: 'startup_recovery_use_temporary'
        })
      }
      const result = { ok: true, state: 'clean', startupRecoveryVersion: 1, checkedAt: new Date().toISOString() }
      writeStorage(KEYS.startupRecovery, result)
      return result
    }
  )
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
    { [KEYS.clearMarker]: marker },
    { operationType: 'clear_all_data', operationId }
  )
  if (!cleared.ok) return cleared
  const initialized = ensureStorageMigrated()
  return initialized.ok
    ? {
        ok: true,
        status: cleared.status || 'committed',
        committed: true,
        recoveryRequired: false,
        warning: cleared.warning || null,
        marker,
        migration: initialized
      }
    : {
        ok: true,
        status: 'committed_with_warning',
        committed: true,
        recoveryRequired: false,
        warning: 'EMPTY_PROFILE_INITIALIZATION_PENDING',
        marker,
        message: '本地数据已清除；空档案将在重新打开小程序后初始化。'
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

function protectedCall(operationType, operationInput, context, action) {
  const requested = operationInput && typeof operationInput === 'object'
    ? operationInput
    : { operationId: operationInput }
  const operationContext = createOperationContext({ ...context, ...requested, operationType })
  const started = beginOperation({ ...operationContext, global: Boolean(context.global) })
  if (!started.ok || !started.started) return started
  let result
  try {
    result = action(operationContext)
  } catch (error) {
    result = { ok: false, message: '本地操作失败，原数据已保留。' }
  }
  finishOperation(
    operationContext.operationId,
    result && result.committed === true ? 'committed' : result && result.ok ? 'committed' : 'failed',
    result,
    operationContext
  )
  return result && typeof result === 'object'
    ? { ...result, operationId: operationContext.operationId }
    : result
}

function protectedCreateStudentProfile(profile, options = {}) {
  return protectedCall('create_profile', options.operationContext || options.operationId, {
    global: true,
    entityId: profile && profile.id || ''
  }, () => createStudentProfile(profile))
}

function protectedUpdateStudentProfile(id, changes, options = {}) {
  return protectedCall('update_profile', options.operationContext || options.operationId, {
    global: true,
    entityId: id,
    expectedVersion: changes && (changes.expectedVersion ?? changes.version) || 0
  }, () => updateStudentProfile(id, changes))
}

function protectedReplaceFavoriteIds(ids, options = {}) {
  return protectedCall('replace_favorites', options.operationContext || options.operationId, {
    profileId: (getActiveProfile() || {}).id || '',
    entityId: 'favoriteSchoolIds'
  }, () => replaceFavoriteIds(ids))
}

function protectedDeleteTargetRecord(id, options = {}) {
  return protectedCall('delete_target', options.operationContext || options.operationId, {
    profileId: (getActiveProfile() || {}).id || '', entityId: id
  }, () => deleteTargetRecord(id))
}

function protectedSetPrimaryTargetSchool(schoolId, options = {}) {
  return protectedCall('set_primary_target', options.operationContext || options.operationId, {
    profileId: (getActiveProfile() || {}).id || '', entityId: schoolId || 'none'
  }, () => setPrimaryTargetSchool(schoolId))
}

function protectedSaveTargetDraft(draft, options = {}) {
  return protectedCall('save_target_draft', options.operationContext || options.operationId, {
    profileId: (getActiveProfile() || {}).id || '', entityId: 'targetDraft'
  }, () => saveTargetDraft(draft))
}

function protectedClearTargetDraft(options = {}) {
  return protectedCall('clear_target_draft', options.operationContext || options.operationId, {
    profileId: (getActiveProfile() || {}).id || '', entityId: 'targetDraft'
  }, () => clearTargetDraft())
}

function protectedDeleteStageGoalRecord(id, options = {}) {
  return protectedCall('delete_stage_goal', options.operationContext || options.operationId, {
    profileId: (getActiveProfile() || {}).id || '', entityId: id
  }, () => deleteLearningTargetRecord(id))
}

function protectedSaveExamYear(year, options = {}) {
  return protectedCall('save_exam_year', options.operationContext || options.operationId, {
    profileId: (getActiveProfile() || {}).id || '', entityId: String(year)
  }, () => saveExamYear(year))
}

function protectedSaveOnboardingState(state, options = {}) {
  return protectedCall('save_onboarding', options.operationContext || options.operationId, {
    global: true, entityId: 'onboarding'
  }, () => saveOnboardingState(state))
}

function protectedSaveRecommendationSettings(settings, options = {}) {
  return protectedCall('save_recommendation_settings', options.operationContext || options.operationId, {
    profileId: (getActiveProfile() || {}).id || '', entityId: 'recommendationSettings'
  }, () => saveRecommendationSettings(settings))
}

function protectedSaveScenarioSettings(settings, options = {}) {
  return protectedCall('save_scenario_settings', options.operationContext || options.operationId, {
    profileId: (getActiveProfile() || {}).id || '', entityId: 'scenarioSettings'
  }, () => saveScenarioSettings(settings))
}

function protectedSaveSchoolFilters(filters, options = {}) {
  return protectedCall('save_school_filters', options.operationContext || options.operationId, {
    profileId: (getActiveProfile() || {}).id || '', entityId: 'schoolFilters'
  }, () => saveSchoolFilters(filters))
}

function protectedSaveComparisonSchoolIds(ids, options = {}) {
  return protectedCall('save_school_comparison', options.operationContext || options.operationId, {
    profileId: (getActiveProfile() || {}).id || '', entityId: 'comparisonSchoolIds'
  }, () => saveComparisonSchoolIds(ids))
}

function protectedAddRecentViewedSchool(schoolId, options = {}) {
  return protectedCall('record_recent_school', options.operationContext || options.operationId, {
    profileId: (getActiveProfile() || {}).id || '', entityId: schoolId
  }, () => addRecentViewedSchool(schoolId))
}

function protectedRecordRecentHistory(type, entry, options = {}) {
  return protectedCall('record_recent_history', options.operationContext || options.operationId, {
    profileId: (getActiveProfile() || {}).id || '', entityId: `${type}:${entry && entry.id || ''}`
  }, () => recordRecentHistory(type, entry))
}

function protectedClearRecentHistory(type, options = {}) {
  return protectedCall('clear_recent_history', options.operationContext || options.operationId, {
    profileId: (getActiveProfile() || {}).id || '', entityId: type || 'all'
  }, () => clearRecentHistory(type))
}

function protectedSaveScoreReview(record, options = {}) {
  return protectedCall('save_score_review', options.operationContext || options.operationId, {
    profileId: (getActiveProfile() || {}).id || '', entityId: record && record.id || ''
  }, () => saveScoreReview(record))
}

function protectedDeleteScoreReview(id, options = {}) {
  return protectedCall('delete_score_review', options.operationContext || options.operationId, {
    profileId: (getActiveProfile() || {}).id || '', entityId: id
  }, () => deleteScoreReview(id))
}

function protectedSaveScoreLossReason(record, options = {}) {
  return protectedCall('save_loss_reason', options.operationContext || options.operationId, {
    profileId: (getActiveProfile() || {}).id || '', entityId: record && record.id || ''
  }, () => saveScoreLossReason(record))
}

function protectedDeleteScoreLossReason(id, options = {}) {
  return protectedCall('delete_loss_reason', options.operationContext || options.operationId, {
    profileId: (getActiveProfile() || {}).id || '', entityId: id
  }, () => deleteScoreLossReason(id))
}

function protectedDeleteLearningTask(id, options = {}) {
  return protectedCall('delete_learning_task', options.operationContext || options.operationId, {
    profileId: (getActiveProfile() || {}).id || '', entityId: id
  }, () => deleteLearningTask(id))
}

function protectedSaveMistakeRecord(record, options = {}) {
  return protectedCall('save_mistake_record', options.operationContext || options.operationId, {
    profileId: (getActiveProfile() || {}).id || '', entityId: record && record.id || ''
  }, () => saveMistakeRecord(record))
}

function protectedDeleteMistakeRecord(id, options = {}) {
  return protectedCall('delete_mistake_record', options.operationContext || options.operationId, {
    profileId: (getActiveProfile() || {}).id || '', entityId: id
  }, () => deleteMistakeRecord(id))
}

function protectedSaveMistakeWithTask(mistakeRecord, taskRecord, options = {}) {
  return protectedCall('save_mistake_with_task', options.operationContext || options.operationId, {
    profileId: (getActiveProfile() || {}).id || '', entityId: mistakeRecord && mistakeRecord.id || ''
  }, () => saveMistakeWithTask(mistakeRecord, taskRecord))
}

function protectedSaveWeeklyPlan(record, options = {}) {
  return protectedCall('save_weekly_plan', options.operationContext || options.operationId, {
    profileId: (getActiveProfile() || {}).id || '', entityId: record && record.id || ''
  }, () => saveWeeklyPlan(record))
}

function protectedDeleteWeeklyPlan(id, options = {}) {
  return protectedCall('delete_weekly_plan', options.operationContext || options.operationId, {
    profileId: (getActiveProfile() || {}).id || '', entityId: id
  }, () => deleteWeeklyPlan(id))
}

function protectedSaveStageReview(record, options = {}) {
  return protectedCall('save_stage_review', options.operationContext || options.operationId, {
    profileId: (getActiveProfile() || {}).id || '', entityId: record && record.id || ''
  }, () => saveStageReview(record))
}

function protectedDeleteStageReview(id, options = {}) {
  return protectedCall('delete_stage_review', options.operationContext || options.operationId, {
    profileId: (getActiveProfile() || {}).id || '', entityId: id
  }, () => deleteStageReview(id))
}

function protectedSaveSchoolUserState(record, options = {}) {
  return protectedCall('save_school_user_state', options.operationContext || options.operationId, {
    profileId: (getActiveProfile() || {}).id || '', entityId: record && (record.id || record.schoolId) || ''
  }, () => saveSchoolUserState(record))
}

function protectedDeleteSchoolUserState(id, options = {}) {
  return protectedCall('delete_school_user_state', options.operationContext || options.operationId, {
    profileId: (getActiveProfile() || {}).id || '', entityId: id
  }, () => deleteSchoolUserState(id))
}

function protectedSaveSubjectConfigs(configs, options = {}) {
  return protectedCall('save_subject_configs', options.operationContext || options.operationId, {
    profileId: (getActiveProfile() || {}).id || '', entityId: 'subjectConfigs'
  }, () => saveSubjectConfigs(configs))
}

function protectedDeleteStudentProfile(id, options = {}) {
  const context = { global: true, entityId: id }
  const operationContext = createOperationContext({
    ...context,
    ...(options.operationContext || { operationId: options.operationId }),
    operationType: 'delete_profile'
  })
  const previous = operationResult(operationContext.operationId)
  if (previous) return previous
  const safety = createRestorePoint({
    reason: 'before_clear_profile',
    profileScope: { type: 'full_user_state' },
    operationId: `${operationContext.operationId}_safety`,
    note: `删除档案 ${id} 前`
  })
  if (!safety.ok) return safety
  return protectedCall('delete_profile', operationContext, {
    global: true,
    entityId: id
  }, () => deleteStudentProfile(id))
}

function protectedClearScoreRecords(options = {}) {
  const profile = getActiveProfile()
  if (!profile) return { ok: false, code: ERROR_CODES.PROFILE_NOT_FOUND, message: '未找到学生档案。' }
  const context = { profileId: profile.id, entityId: 'scoreRecords' }
  const operationContext = createOperationContext({
    ...context,
    ...(options.operationContext || { operationId: options.operationId }),
    operationType: 'clear_scores'
  })
  const previous = operationResult(operationContext.operationId)
  if (previous) return previous
  const safety = createRestorePoint({
    reason: 'before_bulk_edit',
    profileScope: { type: 'single_profile', profileId: profile.id },
    operationId: `${operationContext.operationId}_safety`,
    note: '清空成绩前'
  })
  return safety.ok
    ? protectedCall('clear_scores', operationContext, context, () => clearScoreRecords())
    : safety
}

function protectedClearTargetRecords(options = {}) {
  const profile = getActiveProfile()
  if (!profile) return { ok: false, code: ERROR_CODES.PROFILE_NOT_FOUND, message: '未找到学生档案。' }
  const context = { profileId: profile.id, entityId: 'targetRecords' }
  const operationContext = createOperationContext({
    ...context,
    ...(options.operationContext || { operationId: options.operationId }),
    operationType: 'clear_targets'
  })
  const previous = operationResult(operationContext.operationId)
  if (previous) return previous
  const safety = createRestorePoint({
    reason: 'before_bulk_edit',
    profileScope: { type: 'single_profile', profileId: profile.id },
    operationId: `${operationContext.operationId}_safety`,
    note: '清空目标学校前'
  })
  return safety.ok
    ? protectedCall('clear_targets', operationContext, context, () => clearTargetRecords())
    : safety
}

function protectedClearStageGoalRecords(options = {}) {
  const profile = getActiveProfile()
  if (!profile) return { ok: false, code: ERROR_CODES.PROFILE_NOT_FOUND, message: '未找到学生档案。' }
  const context = { profileId: profile.id, entityId: 'stageGoals' }
  const operationContext = createOperationContext({
    ...context,
    ...(options.operationContext || { operationId: options.operationId }),
    operationType: 'clear_stage_goals'
  })
  const previous = operationResult(operationContext.operationId)
  if (previous) return previous
  const safety = createRestorePoint({
    reason: 'before_bulk_edit',
    profileScope: { type: 'single_profile', profileId: profile.id },
    operationId: `${operationContext.operationId}_safety`,
    note: '清空阶段目标前'
  })
  return safety.ok
    ? protectedCall('clear_stage_goals', operationContext, context, () => clearLearningTargetRecords())
    : safety
}

function protectedClearLearningTasks(options = {}) {
  const profile = getActiveProfile()
  if (!profile) return { ok: false, code: ERROR_CODES.PROFILE_NOT_FOUND, message: '未找到学生档案。' }
  const context = { profileId: profile.id, entityId: 'learningTasks' }
  const operationContext = createOperationContext({
    ...context,
    ...(options.operationContext || { operationId: options.operationId }),
    operationType: 'clear_learning_tasks'
  })
  const previous = operationResult(operationContext.operationId)
  if (previous) return previous
  const safety = createRestorePoint({
    reason: 'before_bulk_edit',
    profileScope: { type: 'single_profile', profileId: profile.id },
    operationId: `${operationContext.operationId}_safety`,
    note: '清空学习任务前'
  })
  return safety.ok
    ? protectedCall('clear_learning_tasks', operationContext, context, () =>
        updateActiveProfileData((data) => ({ ...data, learningTasks: [] })))
    : safety
}

function protectedClearCurrentProfileData(options = {}) {
  const profile = getActiveProfile()
  if (!profile) return { ok: false, code: ERROR_CODES.PROFILE_NOT_FOUND, message: '未找到学生档案。' }
  const context = { profileId: profile.id, entityId: 'profileData' }
  const operationContext = createOperationContext({
    ...context,
    ...(options.operationContext || { operationId: options.operationId }),
    operationType: 'clear_profile_data'
  })
  const previous = operationResult(operationContext.operationId)
  if (previous) return previous
  const safety = createRestorePoint({
    reason: 'before_clear_profile',
    profileScope: { type: 'single_profile', profileId: profile.id },
    operationId: `${operationContext.operationId}_safety`
  })
  if (!safety.ok) return safety
  return protectedCall('clear_profile_data', operationContext, context, () => {
    const active = activeContext()
    if (!active.ok) return active
    const empty = createEmptyProfileData(active.profile.id)
    empty.examYear = active.profile.examYear
    const profileData = { ...active.state.profileData, [active.profile.id]: empty }
    return updateVersionedState({ ...active.state, profileData })
  })
}

function protectedClearLocalData(options = {}) {
  const context = { global: true, entityId: 'allUserData' }
  const operationContext = createOperationContext({
    ...context,
    ...(options.operationContext || { operationId: options.operationId }),
    operationType: 'clear_all_data'
  })
  const previous = operationResult(operationContext.operationId)
  if (previous) return previous
  const safety = createRestorePoint({
    reason: 'before_clear_all',
    profileScope: { type: 'full_user_state' },
    operationId: `${operationContext.operationId}_safety`
  })
  if (!safety.ok) return safety
  return protectedCall('clear_all_data', operationContext, context, () => {
    const marker = { clearedAt: new Date().toISOString(), schemaVersion: STORAGE_SCHEMA_VERSION }
    const cleared = atomicRemove(
      ALL_KNOWN_KEYS.filter((key) => key !== KEYS.clearMarker && ![
        KEYS.restorePointIndex,
        KEYS.restorePointPayloads,
        KEYS.restorePointOperationState,
        KEYS.operationLock,
        KEYS.startupRecovery
      ].includes(key)),
      { [KEYS.clearMarker]: marker },
      { operationType: 'clear_all_data', operationId: operationContext.operationId }
    )
    if (!cleared.ok) return cleared
    const initialized = ensureStorageMigrated()
    return initialized.ok
      ? { ...cleared, marker, migration: initialized }
      : {
          ok: true,
          status: 'committed_with_warning',
          committed: true,
          recoveryRequired: false,
          warning: 'EMPTY_PROFILE_INITIALIZATION_PENDING',
          marker,
          message: '本地数据已清除；空档案将在重新打开小程序后初始化。'
        }
  })
}

function protectedSaveScoreRecord(record, options = {}) {
  return protectedCall('save_score', options.operationContext || options.operationId, {
    profileId: (getActiveProfile() || {}).id || '', entityId: record && record.id || ''
  }, () => saveScoreRecord(record))
}

function protectedSaveExamWithReview(examRecord, reviewRecord, options = {}) {
  return protectedCall('save_exam_with_review', options.operationContext || options.operationId, {
    profileId: (getActiveProfile() || {}).id || '', entityId: examRecord && examRecord.id || ''
  }, () => saveExamWithReview(examRecord, reviewRecord))
}

function protectedSaveExamTemplate(record, options = {}) {
  return protectedCall('save_exam_template', options.operationContext || options.operationId, {
    profileId: (getActiveProfile() || {}).id || '', entityId: record && record.id || ''
  }, () => saveExamTemplate(record))
}

function protectedDeleteExamTemplate(id, options = {}) {
  return protectedCall('delete_exam_template', options.operationContext || options.operationId, {
    profileId: (getActiveProfile() || {}).id || '', entityId: id
  }, () => deleteExamTemplate(id))
}

function protectedSaveScoreScheme(record, options = {}) {
  return protectedCall('save_score_scheme', options.operationContext || options.operationId, {
    profileId: (getActiveProfile() || {}).id || '', entityId: record && record.id || ''
  }, () => saveScoreScheme(record))
}

function protectedDeleteScoreScheme(id, options = {}) {
  return protectedCall('delete_score_scheme', options.operationContext || options.operationId, {
    profileId: (getActiveProfile() || {}).id || '', entityId: id
  }, () => deleteScoreScheme(id))
}

function protectedDeleteScoreRecord(id, options = {}) {
  return protectedCall('delete_score', options.operationContext || options.operationId, {
    profileId: (getActiveProfile() || {}).id || '', entityId: id
  }, () => deleteScoreRecord(id))
}

function protectedSaveTargetRecord(record, options = {}) {
  return protectedCall('save_target', options.operationContext || options.operationId, {
    profileId: (getActiveProfile() || {}).id || '', entityId: record && (record.id || record.schoolId) || ''
  }, () => saveTargetRecord(record))
}

function protectedSaveStageGoalRecord(record, options = {}) {
  return protectedCall('save_stage_goal', options.operationContext || options.operationId, {
    profileId: (getActiveProfile() || {}).id || '', entityId: record && record.id || ''
  }, () => saveLearningTargetRecord(record))
}

function protectedSaveLearningTask(record, options = {}) {
  return protectedCall('save_learning_task', options.operationContext || options.operationId, {
    profileId: (getActiveProfile() || {}).id || '', entityId: record && record.id || ''
  }, () => saveLearningTask(record, options))
}

function protectedSetFavorite(schoolId, nextValue, options = {}) {
  return protectedCall('set_favorite', options.operationContext || options.operationId, {
    profileId: (getActiveProfile() || {}).id || '', entityId: schoolId
  }, () => setFavorite(schoolId, nextValue))
}

function protectedSwitchStudentProfile(id, options = {}) {
  return protectedCall('switch_profile', options.operationContext || options.operationId, {
    global: true, entityId: id
  }, () => switchStudentProfile(id))
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
  classifyTransactionOutcome,
  recoverInterruptedTransaction,
  recoverStartupState,
  getStartupRecoveryState,
  resolveStartupRecovery,
  isVersionedStorageActive,
  ensureStorageMigrated,
  getVersionedState,
  replaceVersionedState,
  validateRestoreState,
  getDataRevision,
  TRANSACTION_STAGES,
  ERROR_CODES,
  getProfilesResult,
  getProfiles,
  getActiveProfile,
  createStudentProfile: protectedCreateStudentProfile,
  updateStudentProfile: protectedUpdateStudentProfile,
  switchStudentProfile: protectedSwitchStudentProfile,
  deleteStudentProfile: protectedDeleteStudentProfile,
  getFavoriteIdsResult,
  getFavoriteIds,
  isFavorite,
  setFavorite: protectedSetFavorite,
  replaceFavoriteIds: protectedReplaceFavoriteIds,
  getTargetRecordsResult,
  getTargetRecords,
  saveTargetRecord: protectedSaveTargetRecord,
  deleteTargetRecord: protectedDeleteTargetRecord,
  clearTargetRecords: protectedClearTargetRecords,
  getPrimaryTargetSchoolId,
  setPrimaryTargetSchool: protectedSetPrimaryTargetSchool,
  getTargetDraftResult,
  getTargetDraft,
  saveTargetDraft: protectedSaveTargetDraft,
  clearTargetDraft: protectedClearTargetDraft,
  getLearningTargetRecordsResult,
  getLearningTargetRecords,
  getStageGoalRecordsResult,
  getStageGoalRecords,
  saveLearningTargetRecord: protectedSaveStageGoalRecord,
  saveStageGoalRecord: protectedSaveStageGoalRecord,
  deleteLearningTargetRecord: protectedDeleteStageGoalRecord,
  deleteStageGoalRecord: protectedDeleteStageGoalRecord,
  clearLearningTargetRecords: protectedClearStageGoalRecords,
  clearStageGoalRecords: protectedClearStageGoalRecords,
  getScoreRecordsResult,
  getScoreRecords,
  saveScoreRecord: protectedSaveScoreRecord,
  saveExamWithReview: protectedSaveExamWithReview,
  deleteScoreRecord: protectedDeleteScoreRecord,
  clearScoreRecords: protectedClearScoreRecords,
  getExamYearResult,
  getExamYear,
  saveExamYear: protectedSaveExamYear,
  getOnboardingState,
  saveOnboardingState: protectedSaveOnboardingState,
  getRecommendationSettings,
  saveRecommendationSettings: protectedSaveRecommendationSettings,
  getScenarioSettings,
  saveScenarioSettings: protectedSaveScenarioSettings,
  getSchoolFilters,
  saveSchoolFilters: protectedSaveSchoolFilters,
  getComparisonSchoolIds,
  saveComparisonSchoolIds: protectedSaveComparisonSchoolIds,
  addRecentViewedSchool: protectedAddRecentViewedSchool,
  getRecentViewedSchoolIds,
  recordRecentHistory: protectedRecordRecentHistory,
  getRecentHistory,
  clearRecentHistory: protectedClearRecentHistory,
  getScoreReviews,
  saveScoreReview: protectedSaveScoreReview,
  deleteScoreReview: protectedDeleteScoreReview,
  getScoreLossReasons,
  saveScoreLossReason: protectedSaveScoreLossReason,
  deleteScoreLossReason: protectedDeleteScoreLossReason,
  getLearningTasks,
  saveLearningTask: protectedSaveLearningTask,
  deleteLearningTask: protectedDeleteLearningTask,
  clearLearningTasks: protectedClearLearningTasks,
  getMistakeRecords,
  saveMistakeRecord: protectedSaveMistakeRecord,
  deleteMistakeRecord: protectedDeleteMistakeRecord,
  saveMistakeWithTask: protectedSaveMistakeWithTask,
  getWeeklyPlans,
  saveWeeklyPlan: protectedSaveWeeklyPlan,
  deleteWeeklyPlan: protectedDeleteWeeklyPlan,
  getStageReviews,
  saveStageReview: protectedSaveStageReview,
  deleteStageReview: protectedDeleteStageReview,
  getSchoolUserStates,
  getSchoolUserState,
  saveSchoolUserState: protectedSaveSchoolUserState,
  deleteSchoolUserState: protectedDeleteSchoolUserState,
  getSubjectConfigs,
  saveSubjectConfigs: protectedSaveSubjectConfigs,
  getExamTemplates,
  getCustomExamTemplates,
  saveExamTemplate: protectedSaveExamTemplate,
  deleteExamTemplate: protectedDeleteExamTemplate,
  examTemplateReferenceCount,
  getScoreSchemes,
  getCustomScoreSchemes,
  saveScoreScheme: protectedSaveScoreScheme,
  deleteScoreScheme: protectedDeleteScoreScheme,
  scoreSchemeReferenceStats,
  createRestorePoint,
  listRestorePoints,
  getRestorePoint,
  restoreFromRestorePoint,
  deleteRestorePoint,
  clearRestorePoints,
  validateRestoreState,
  acquireOperationLock,
  getOperationStates: operationStates,
  clearCurrentProfileData: protectedClearCurrentProfileData,
  clearLocalData: protectedClearLocalData,
  clearLocalDemoData: protectedClearLocalData
}
