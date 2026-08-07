const { PRODUCT_RULES } = require('./runtime-constants')
const { canonicalJson } = require('./canonical-json')
const { CHECKSUM_ALGORITHM, checksumFor, sha256 } = require('./checksum')

const RESTORE_POINT_FORMAT_VERSION = PRODUCT_RULES.restorePointFormatVersion
const MAX_RESTORE_POINTS = 10
const SUPPORTED_RESTORE_POINT_FORMATS = Object.freeze([1, RESTORE_POINT_FORMAT_VERSION])
const SUPPORTED_STORAGE_SCHEMAS = Object.freeze([4, PRODUCT_RULES.storageSchemaVersion])
const SUPPORTED_BACKUP_FORMATS = Object.freeze([2, PRODUCT_RULES.backupFormatVersion])
const SUPPORTED_APP_DATA_VERSIONS = Object.freeze(['rc11-2', PRODUCT_RULES.appDataVersion])
const RESTORE_POINT_REASONS = Object.freeze([
  'before_migration',
  'before_import',
  'before_data_repair',
  'before_clear_profile',
  'before_clear_all',
  'before_bulk_edit',
  'before_restore',
  'manual'
])
const PROFILE_SCOPES = Object.freeze(['single_profile', 'all_profiles', 'full_user_state'])
const TRANSACTION_STAGES = Object.freeze([
  'validate',
  'snapshot',
  'prepare',
  'writeTemporary',
  'verifyTemporary',
  'commit',
  'verifyCommitted',
  'writeCommittedJournal',
  'cleanup',
  'finalReadback'
])
const ERROR_CODES = Object.freeze({
  RESTORE_POINT_CREATE_FAILED: 'RESTORE_POINT_CREATE_FAILED',
  RESTORE_POINT_VERIFY_FAILED: 'RESTORE_POINT_VERIFY_FAILED',
  RESTORE_POINT_NOT_FOUND: 'RESTORE_POINT_NOT_FOUND',
  RESTORE_POINT_VERSION_UNSUPPORTED: 'RESTORE_POINT_VERSION_UNSUPPORTED',
  RESTORE_POINT_CHECKSUM_MISMATCH: 'RESTORE_POINT_CHECKSUM_MISMATCH',
  RESTORE_POINT_SCOPE_INVALID: 'RESTORE_POINT_SCOPE_INVALID',
  TRANSACTION_ALREADY_RUNNING: 'TRANSACTION_ALREADY_RUNNING',
  OPERATION_ALREADY_COMMITTED: 'OPERATION_ALREADY_COMMITTED',
  OPERATION_LOCKED: 'OPERATION_LOCKED',
  VERSION_CONFLICT: 'VERSION_CONFLICT',
  TEMPORARY_DATA_INVALID: 'TEMPORARY_DATA_INVALID',
  FORMAL_DATA_INVALID: 'FORMAL_DATA_INVALID',
  STARTUP_RECOVERY_REQUIRED: 'STARTUP_RECOVERY_REQUIRED',
  STORAGE_WRITE_FAILED: 'STORAGE_WRITE_FAILED',
  STORAGE_READBACK_FAILED: 'STORAGE_READBACK_FAILED',
  CLEANUP_FAILED: 'CLEANUP_FAILED',
  PROFILE_NOT_FOUND: 'PROFILE_NOT_FOUND',
  INVALID_PROFILE_REFERENCE: 'INVALID_PROFILE_REFERENCE',
  INVALID_SCHOOL_REFERENCE: 'INVALID_SCHOOL_REFERENCE',
  DUPLICATE_ENTITY_ID: 'DUPLICATE_ENTITY_ID'
})

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value))
}

function checksumInput(point) {
  const copy = clone(point)
  delete copy.checksum
  return canonicalJson(copy)
}

function checksumForRestorePoint(point) {
  return checksumFor(point)
}

function summaryForPayload(payload) {
  const profiles = Array.isArray(payload.profiles) ? payload.profiles : []
  const profileData = payload.profileData && typeof payload.profileData === 'object'
    ? payload.profileData
    : {}
  const count = (field) => profiles.reduce((total, profile) => total +
    (Array.isArray(profileData[profile.id] && profileData[profile.id][field])
      ? profileData[profile.id][field].length
      : 0), 0)
  return {
    profileCount: profiles.length,
    scoreRecordCount: count('scoreRecords'),
    favoriteCount: count('favoriteSchoolIds') +
      (Array.isArray(payload.sharedFavoriteSchoolIds) ? payload.sharedFavoriteSchoolIds.length : 0),
    targetSchoolCount: count('targetRecords'),
    stageGoalCount: count('stageGoals'),
    learningTaskCount: count('learningTasks'),
    reviewCount: count('scoreReviews')
  }
}

function payloadForScope(state, profileScope) {
  if (!profileScope || !PROFILE_SCOPES.includes(profileScope.type)) {
    throw Object.assign(new Error('恢复点档案范围无效'), { code: ERROR_CODES.RESTORE_POINT_SCOPE_INVALID })
  }
  if (profileScope.type === 'single_profile') {
    const profile = state.profiles.find((item) => item.id === profileScope.profileId)
    if (!profile) throw Object.assign(new Error('未找到学生档案'), { code: ERROR_CODES.PROFILE_NOT_FOUND })
    return {
      profiles: [clone(profile)],
      activeProfileId: profile.id,
      profileData: { [profile.id]: clone(state.profileData[profile.id]) },
      sharedFavoriteSchoolIds: profileScope.includeSharedFavorites === true
        ? clone(state.sharedFavoriteSchoolIds || [])
        : []
    }
  }
  const common = {
    profiles: clone(state.profiles),
    activeProfileId: state.activeProfileId,
    profileData: clone(state.profileData),
    sharedFavoriteSchoolIds: clone(state.sharedFavoriteSchoolIds || [])
  }
  return profileScope.type === 'full_user_state'
    ? { ...common, onboarding: clone(state.onboarding || {}), userSettings: clone(state.userSettings || {}) }
    : common
}

function buildRestorePoint({
  state,
  reason,
  profileScope,
  id,
  createdAt,
  operationId = '',
  createdBy = 'automatic',
  note = '',
  sourcePlatform = 'miniprogram',
  storageSchemaVersion = PRODUCT_RULES.storageSchemaVersion,
  backupFormatVersion = PRODUCT_RULES.backupFormatVersion,
  appDataVersion = PRODUCT_RULES.appDataVersion
}) {
  if (!RESTORE_POINT_REASONS.includes(reason)) {
    throw Object.assign(new Error('恢复点原因无效'), { code: ERROR_CODES.RESTORE_POINT_CREATE_FAILED })
  }
  const payload = payloadForScope(state, profileScope)
  const point = {
    id,
    reason,
    createdAt,
    profileScope: clone(profileScope),
    restorePointFormatVersion: RESTORE_POINT_FORMAT_VERSION,
    storageSchemaVersion,
    backupFormatVersion,
    appDataVersion,
    sourcePlatform,
    summary: summaryForPayload(payload),
    checksumAlgorithm: CHECKSUM_ALGORITHM,
    payload,
    metadata: { operationId, createdBy, note }
  }
  point.checksum = checksumForRestorePoint(point)
  return point
}

function validateRestorePoint(point) {
  if (!point || typeof point !== 'object' || Array.isArray(point)) {
    return { ok: false, code: ERROR_CODES.RESTORE_POINT_VERIFY_FAILED }
  }
  if (!SUPPORTED_RESTORE_POINT_FORMATS.includes(point.restorePointFormatVersion)) {
    return { ok: false, code: ERROR_CODES.RESTORE_POINT_VERSION_UNSUPPORTED }
  }
  if (!SUPPORTED_STORAGE_SCHEMAS.includes(point.storageSchemaVersion) ||
      !SUPPORTED_BACKUP_FORMATS.includes(point.backupFormatVersion) ||
      !SUPPORTED_APP_DATA_VERSIONS.includes(point.appDataVersion)) {
    return { ok: false, code: ERROR_CODES.RESTORE_POINT_VERSION_UNSUPPORTED }
  }
  if (!RESTORE_POINT_REASONS.includes(point.reason) ||
      !point.profileScope || !PROFILE_SCOPES.includes(point.profileScope.type)) {
    return { ok: false, code: ERROR_CODES.RESTORE_POINT_SCOPE_INVALID }
  }
  if (point.checksumAlgorithm !== CHECKSUM_ALGORITHM ||
      point.checksum !== checksumForRestorePoint(point)) {
    return { ok: false, code: ERROR_CODES.RESTORE_POINT_CHECKSUM_MISMATCH }
  }
  const expectedSummary = summaryForPayload(point.payload || {})
  if (canonicalJson(expectedSummary) !== canonicalJson(point.summary)) {
    return { ok: false, code: ERROR_CODES.RESTORE_POINT_VERIFY_FAILED }
  }
  const payloadBytes = unescape(encodeURIComponent(canonicalJson(point.payload || {}))).length
  if (payloadBytes > PRODUCT_RULES.limits.maxRestorePointPayloadBytes) {
    return { ok: false, code: ERROR_CODES.RESTORE_POINT_VERIFY_FAILED }
  }
  const adapted = clone(point)
  if (adapted.restorePointFormatVersion === 1) adapted.adaptedFromRestorePointFormatVersion = 1
  return { ok: true, restorePoint: adapted }
}

function stateAfterRestore(current, point) {
  const payload = clone(point.payload)
  if (point.profileScope.type === 'single_profile') {
    const profile = payload.profiles[0]
    const exists = current.profiles.some((item) => item.id === profile.id)
    return {
      ...clone(current),
      profiles: exists
        ? current.profiles.map((item) => item.id === profile.id ? profile : item)
        : [...clone(current.profiles), profile],
      profileData: { ...clone(current.profileData), [profile.id]: clone(payload.profileData[profile.id]) },
      sharedFavoriteSchoolIds: point.profileScope.includeSharedFavorites === true
        ? clone(payload.sharedFavoriteSchoolIds || [])
        : clone(current.sharedFavoriteSchoolIds || [])
    }
  }
  const global = point.profileScope.type === 'full_user_state'
    ? { onboarding: clone(payload.onboarding || {}), userSettings: clone(payload.userSettings || {}) }
    : { onboarding: clone(current.onboarding || {}), userSettings: clone(current.userSettings || {}) }
  return { ...clone(current), ...payload, ...global }
}

function invokeFault(faultInjector, operationType, stage) {
  if (!faultInjector) return
  if (typeof faultInjector === 'function') faultInjector({ operationType, stage })
  else if (faultInjector.operationType === operationType && faultInjector.failAtStage === stage) {
    throw Object.assign(new Error('测试故障注入'), { code: faultInjector.errorCode || 'TEST_INJECTED_FAILURE' })
  }
}

module.exports = {
  RESTORE_POINT_FORMAT_VERSION,
  MAX_RESTORE_POINTS,
  CHECKSUM_ALGORITHM,
  SUPPORTED_RESTORE_POINT_FORMATS,
  SUPPORTED_STORAGE_SCHEMAS,
  SUPPORTED_BACKUP_FORMATS,
  SUPPORTED_APP_DATA_VERSIONS,
  RESTORE_POINT_REASONS,
  PROFILE_SCOPES,
  TRANSACTION_STAGES,
  ERROR_CODES,
  clone,
  canonicalJson,
  sha256,
  checksumForRestorePoint,
  summaryForPayload,
  payloadForScope,
  buildRestorePoint,
  validateRestorePoint,
  stateAfterRestore,
  invokeFault
}
