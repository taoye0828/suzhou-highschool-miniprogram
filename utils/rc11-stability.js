const RESTORE_POINT_FORMAT_VERSION = 1
const MAX_RESTORE_POINTS = 10
const CHECKSUM_ALGORITHM = 'sha256'
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
  'cleanup'
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

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue)
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((result, key) => {
      if (value[key] !== undefined) result[key] = canonicalValue(value[key])
      return result
    }, {})
  }
  return value
}

function canonicalJson(value) {
  return JSON.stringify(canonicalValue(value))
}

// Small synchronous SHA-256 implementation suitable for both Node tests and
// the WeChat runtime. It has no platform crypto or persisted debug dependency.
function sha256(input) {
  const text = unescape(encodeURIComponent(String(input)))
  const words = []
  const bitLength = text.length * 8
  for (let index = 0; index < text.length; index += 1) {
    words[index >> 2] = (words[index >> 2] || 0) |
      (text.charCodeAt(index) << (24 - (index % 4) * 8))
  }
  words[bitLength >> 5] = (words[bitLength >> 5] || 0) | (0x80 << (24 - bitLength % 32))
  words[(((bitLength + 64) >> 9) << 4) + 15] = bitLength
  const constants = []
  const initial = []
  let candidate = 2
  while (constants.length < 64) {
    let prime = true
    for (let factor = 2; factor * factor <= candidate; factor += 1) {
      if (candidate % factor === 0) { prime = false; break }
    }
    if (prime) {
      if (initial.length < 8) initial.push((Math.sqrt(candidate) * 0x100000000) | 0)
      constants.push((Math.pow(candidate, 1 / 3) * 0x100000000) | 0)
    }
    candidate += 1
  }
  let hash = initial.slice()
  const schedule = new Array(64)
  const rotate = (value, amount) => (value >>> amount) | (value << (32 - amount))
  for (let offset = 0; offset < words.length; offset += 16) {
    const previous = hash.slice()
    for (let round = 0; round < 64; round += 1) {
      if (round < 16) schedule[round] = words[offset + round] | 0
      else {
        const x = schedule[round - 15]
        const y = schedule[round - 2]
        const s0 = rotate(x, 7) ^ rotate(x, 18) ^ (x >>> 3)
        const s1 = rotate(y, 17) ^ rotate(y, 19) ^ (y >>> 10)
        schedule[round] = (schedule[round - 16] + s0 + schedule[round - 7] + s1) | 0
      }
      const e = hash[4]
      const a = hash[0]
      const sum1 = rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25)
      const choice = (e & hash[5]) ^ (~e & hash[6])
      const temp1 = (hash[7] + sum1 + choice + constants[round] + schedule[round]) | 0
      const sum0 = rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22)
      const majority = (a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2])
      const temp2 = (sum0 + majority) | 0
      hash = [(temp1 + temp2) | 0, hash[0], hash[1], hash[2], (hash[3] + temp1) | 0, hash[4], hash[5], hash[6]]
    }
    hash = hash.map((value, index) => (value + previous[index]) | 0)
  }
  return hash.map((value) => (value >>> 0).toString(16).padStart(8, '0')).join('')
}

function checksumInput(point) {
  const copy = clone(point)
  delete copy.checksum
  return canonicalJson(copy)
}

function checksumForRestorePoint(point) {
  return sha256(checksumInput(point))
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
      sharedFavoriteSchoolIds: profile.favoritesMode === 'shared'
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
  storageSchemaVersion = 4,
  backupFormatVersion = 2,
  appDataVersion = 'rc11-2'
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
  if (point.restorePointFormatVersion !== RESTORE_POINT_FORMAT_VERSION) {
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
  return { ok: true }
}

function stateAfterRestore(current, point) {
  const payload = clone(point.payload)
  if (point.profileScope.type === 'single_profile') {
    const profile = payload.profiles[0]
    if (!current.profiles.some((item) => item.id === profile.id)) {
      throw Object.assign(new Error('当前设备中不存在该档案'), { code: ERROR_CODES.PROFILE_NOT_FOUND })
    }
    return {
      ...clone(current),
      profiles: current.profiles.map((item) => item.id === profile.id ? profile : item),
      profileData: { ...clone(current.profileData), [profile.id]: clone(payload.profileData[profile.id]) },
      sharedFavoriteSchoolIds: profile.favoritesMode === 'shared'
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
