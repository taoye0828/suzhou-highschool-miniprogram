const { schools } = require('../data/schools')
const {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  STORAGE_SCHEMA_VERSION,
  clone,
  normalizeExamRecord,
  normalizeTargetRecord,
  normalizeStageGoal,
  normalizeScoreReview,
  normalizeScoreLossReason,
  normalizeLearningTask,
  normalizeProfile,
  normalizeProfileData,
  normalizeStringList
} = require('./rc9-models')
const {
  ensureStorageMigrated,
  getVersionedState,
  replaceVersionedState,
  createRestorePoint
} = require('./storage')

const APP_DATA_VERSION = 'rc10'
const CHECKSUM_ALGORITHM = 'fnv1a32'

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = stableValue(value[key])
        return result
      }, {})
  }
  return value
}

function stableStringify(value) {
  return JSON.stringify(stableValue(value))
}

function fnv1a32(value) {
  let hash = 0x811c9dc5
  const input = unescape(encodeURIComponent(String(value)))
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

function checksumForPayload(payload) {
  return fnv1a32(stableStringify(payload))
}

function statePayload(state) {
  const profileData = clone(state.profileData)
  const flattened = (field) => state.profiles.flatMap((profile) =>
    Array.isArray(profileData[profile.id] && profileData[profile.id][field])
      ? clone(profileData[profile.id][field])
      : []
  )
  return {
    profiles: clone(state.profiles),
    activeProfileId: state.activeProfileId,
    scoreRecords: flattened('scoreRecords'),
    scoreReviews: flattened('scoreReviews'),
    scoreLossReasons: flattened('scoreLossReasons'),
    favorites: state.profiles.flatMap((profile) =>
      (profileData[profile.id] && profileData[profile.id].favoriteSchoolIds || [])
        .map((schoolId) => ({ profileId: profile.id, schoolId }))
    ),
    targetSchools: flattened('targetRecords'),
    stageGoals: flattened('stageGoals'),
    learningTasks: flattened('learningTasks'),
    recommendationSettings: state.profiles.map((profile) => ({
      profileId: profile.id,
      ...(profileData[profile.id] && profileData[profile.id].recommendationSettings || {})
    })),
    onboardingState: clone(state.onboarding),
    recentHistory: state.profiles.map((profile) => ({
      profileId: profile.id,
      ...(profileData[profile.id] && profileData[profile.id].recentHistory || {})
    })),
    sharedFavoriteSchoolIds: clone(state.sharedFavoriteSchoolIds),
    profileData,
    onboarding: clone(state.onboarding),
    userSettings: clone(state.userSettings)
  }
}

function backupPayload(backup) {
  if (backup && backup.payload && typeof backup.payload === 'object' && !Array.isArray(backup.payload)) {
    return clone(backup.payload)
  }
  const keys = [
    'profiles',
    'activeProfileId',
    'scoreRecords',
    'scoreReviews',
    'scoreLossReasons',
    'favorites',
    'targetSchools',
    'stageGoals',
    'learningTasks',
    'recommendationSettings',
    'onboardingState',
    'recentHistory',
    'sharedFavoriteSchoolIds',
    'profileData',
    'onboarding',
    'userSettings'
  ]
  return Object.fromEntries(keys.map((key) => [key, clone(backup && backup[key])]))
}

function createBackupEnvelope({ exportedAt = new Date().toISOString() } = {}) {
  const migration = ensureStorageMigrated()
  if (!migration.ok) return { ok: false, message: migration.message || '本地数据迁移未完成。' }
  const stateResult = getVersionedState()
  if (!stateResult.ok) return stateResult
  const payload = statePayload(stateResult.state)
  return {
    ok: true,
    backup: {
      format: BACKUP_FORMAT,
      backupFormatVersion: BACKUP_FORMAT_VERSION,
      storageSchemaVersion: STORAGE_SCHEMA_VERSION,
      appDataVersion: APP_DATA_VERSION,
      exportedAt,
      sourcePlatform: 'wechat_miniprogram',
      ...payload,
      checksum: {
        algorithm: CHECKSUM_ALGORITHM,
        value: checksumForPayload(payload)
      }
    }
  }
}

function duplicateValues(items, selector) {
  const seen = new Set()
  const duplicates = new Set()
  for (const item of Array.isArray(items) ? items : []) {
    const value = selector(item)
    if (!value) continue
    if (seen.has(value)) duplicates.add(value)
    seen.add(value)
  }
  return [...duplicates]
}

function validateProfileData(raw, profileId, validSchoolIds, errors) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    errors.push(`档案 ${profileId} 的数据结构无效`)
    return
  }
  const scoreRecords = Array.isArray(raw.scoreRecords) ? raw.scoreRecords : []
  const stageGoals = Array.isArray(raw.stageGoals) ? raw.stageGoals : []
  const targetRecords = Array.isArray(raw.targetRecords) ? raw.targetRecords : []
  const scoreReviews = Array.isArray(raw.scoreReviews) ? raw.scoreReviews : []
  const scoreLossReasons = Array.isArray(raw.scoreLossReasons) ? raw.scoreLossReasons : []
  const learningTasks = Array.isArray(raw.learningTasks) ? raw.learningTasks : []
  const duplicateScoreIds = duplicateValues(scoreRecords, (item) => item && item.id)
  const duplicateStageIds = duplicateValues(stageGoals, (item) => item && item.id)
  const duplicateTargetIds = duplicateValues(targetRecords, (item) => item && item.id)
  const duplicateTargetSchools = duplicateValues(targetRecords, (item) => item && item.schoolId)
  const duplicateReviewIds = duplicateValues(scoreReviews, (item) => item && item.id)
  const duplicateReasonIds = duplicateValues(scoreLossReasons, (item) => item && item.id)
  const duplicateTaskIds = duplicateValues(learningTasks, (item) => item && item.id)
  if (duplicateScoreIds.length) errors.push(`档案 ${profileId} 存在重复考试 ID`)
  if (duplicateStageIds.length) errors.push(`档案 ${profileId} 存在重复阶段目标 ID`)
  if (duplicateTargetIds.length || duplicateTargetSchools.length) {
    errors.push(`档案 ${profileId} 存在重复目标学校`)
  }
  if (duplicateReviewIds.length) errors.push(`档案 ${profileId} 存在重复复盘 ID`)
  if (duplicateReasonIds.length) errors.push(`档案 ${profileId} 存在重复失分原因 ID`)
  if (duplicateTaskIds.length) errors.push(`档案 ${profileId} 存在重复学习任务 ID`)
  for (const item of scoreRecords) {
    if (!normalizeExamRecord(item, profileId)) {
      errors.push(`档案 ${profileId} 含结构无效的考试记录`)
      break
    }
    if (item.profileId && item.profileId !== profileId) {
      errors.push(`档案 ${profileId} 含归属其他档案的考试记录`)
      break
    }
    const total = Number(item && (item.totalScore === undefined ? item.score : item.totalScore))
    if (!Number.isInteger(total) || total < 0 || total > 740) {
      errors.push(`档案 ${profileId} 含无效总分`)
      break
    }
    for (const subject of Array.isArray(item && item.subjectScores) ? item.subjectScores : []) {
      const score = Number(subject && subject.score)
      const maxScore = Number(subject && subject.maxScore)
      if (!Number.isInteger(score) || !Number.isInteger(maxScore) || maxScore <= 0 || score < 0 || score > maxScore) {
        errors.push(`档案 ${profileId} 含无效学科成绩`)
        break
      }
    }
  }
  for (const item of targetRecords) {
    if (!normalizeTargetRecord(item, profileId)) {
      errors.push(`档案 ${profileId} 含结构无效的目标学校`)
      break
    }
    if (item.profileId && item.profileId !== profileId) {
      errors.push(`档案 ${profileId} 含归属其他档案的目标学校`)
      break
    }
  }
  for (const item of stageGoals) {
    if (!normalizeStageGoal(item, profileId)) {
      errors.push(`档案 ${profileId} 含结构无效的阶段目标`)
      break
    }
    if (item.profileId && item.profileId !== profileId) {
      errors.push(`档案 ${profileId} 含归属其他档案的阶段目标`)
      break
    }
  }
  for (const item of scoreReviews) {
    if (!normalizeScoreReview(item, profileId)) {
      errors.push(`档案 ${profileId} 含结构无效的考试复盘`)
      break
    }
    if (!scoreRecords.some((record) => record && record.id === item.examRecordId)) {
      errors.push(`档案 ${profileId} 含孤立考试复盘`)
      break
    }
  }
  for (const item of scoreLossReasons) {
    if (!normalizeScoreLossReason(item, profileId)) {
      errors.push(`档案 ${profileId} 含结构无效的失分原因`)
      break
    }
    if (!scoreRecords.some((record) => record && record.id === item.examRecordId)) {
      errors.push(`档案 ${profileId} 含孤立失分原因`)
      break
    }
  }
  for (const item of learningTasks) {
    if (!normalizeLearningTask(item, profileId)) {
      errors.push(`档案 ${profileId} 含结构无效的学习任务`)
      break
    }
  }
  const schoolIds = [
    ...(Array.isArray(raw.favoriteSchoolIds) ? raw.favoriteSchoolIds : []),
    ...(Array.isArray(raw.comparisonSchoolIds) ? raw.comparisonSchoolIds : []),
    ...(Array.isArray(raw.recentViewedSchoolIds) ? raw.recentViewedSchoolIds : []),
    ...targetRecords.map((item) => item && item.schoolId)
  ].filter(Boolean)
  const invalidSchoolIds = [...new Set(schoolIds.filter((id) => !validSchoolIds.has(id)))]
  if (invalidSchoolIds.length) errors.push(`档案 ${profileId} 含未知 schoolId：${invalidSchoolIds.join('、')}`)
  if (raw.primaryTargetSchoolId &&
      !targetRecords.some((item) => item && item.schoolId === raw.primaryTargetSchoolId)) {
    errors.push(`档案 ${profileId} 的主要目标不在目标学校中`)
  }
}

function backupPreview(payload) {
  const profiles = Array.isArray(payload.profiles) ? payload.profiles : []
  const profileData = payload.profileData && typeof payload.profileData === 'object'
    ? payload.profileData
    : {}
  return {
    profileCount: profiles.length,
    scoreCount: profiles.reduce((sum, profile) => sum +
      (Array.isArray(profileData[profile.id] && profileData[profile.id].scoreRecords)
        ? profileData[profile.id].scoreRecords.length
        : 0), 0),
    targetCount: profiles.reduce((sum, profile) => sum +
      (Array.isArray(profileData[profile.id] && profileData[profile.id].targetRecords)
        ? profileData[profile.id].targetRecords.length
        : 0), 0),
    stageGoalCount: profiles.reduce((sum, profile) => sum +
      (Array.isArray(profileData[profile.id] && profileData[profile.id].stageGoals)
        ? profileData[profile.id].stageGoals.length
        : 0), 0),
    taskCount: profiles.reduce((sum, profile) => sum +
      (Array.isArray(profileData[profile.id] && profileData[profile.id].learningTasks)
        ? profileData[profile.id].learningTasks.length
        : 0), 0),
    favoriteCount: profiles.reduce((sum, profile) => sum +
      (Array.isArray(profileData[profile.id] && profileData[profile.id].favoriteSchoolIds)
        ? profileData[profile.id].favoriteSchoolIds.length
        : 0), 0),
    activeProfileId: payload.activeProfileId
  }
}

function validateBackupEnvelope(input) {
  let backup = input
  if (typeof input === 'string') {
    try {
      backup = JSON.parse(input)
    } catch (error) {
      return { ok: false, errors: ['文件不是有效 JSON。'] }
    }
  }
  const errors = []
  if (!backup || typeof backup !== 'object' || Array.isArray(backup)) {
    return { ok: false, errors: ['备份根结构无效。'] }
  }
  if (backup.format !== BACKUP_FORMAT) errors.push('备份格式标识不匹配。')
  const formatVersion = backup.backupFormatVersion === undefined
    ? backup.backupVersion
    : backup.backupFormatVersion
  if (![1, BACKUP_FORMAT_VERSION].includes(formatVersion)) errors.push('备份格式版本不受支持。')
  if (backup.storageSchemaVersion !== STORAGE_SCHEMA_VERSION) {
    errors.push('存储版本不受支持。')
  }
  if (!['rc9', APP_DATA_VERSION].includes(backup.appDataVersion)) errors.push('应用数据版本不受支持。')
  if (typeof backup.exportedAt !== 'string' || !Number.isFinite(Date.parse(backup.exportedAt))) {
    errors.push('导出时间无效。')
  }
  const payload = backupPayload(backup)
  if (!backup.checksum || backup.checksum.algorithm !== CHECKSUM_ALGORITHM) {
    errors.push('校验摘要算法不受支持。')
  } else if (checksumForPayload(payload) !== backup.checksum.value) {
    errors.push('校验摘要不匹配，文件可能已损坏。')
  }
  const profiles = Array.isArray(payload.profiles) ? payload.profiles : []
  if (!profiles.length) errors.push('备份至少需要一个学生档案。')
  const duplicateProfileIds = duplicateValues(profiles, (item) => item && item.id)
  if (duplicateProfileIds.length) errors.push('备份存在重复档案 ID。')
  if (profiles.some((item) => !normalizeProfile(item))) errors.push('备份含结构无效的学生档案。')
  const profileIds = new Set(profiles.map((item) => item && item.id).filter(Boolean))
  if (!profileIds.has(payload.activeProfileId)) errors.push('当前档案 ID 不存在。')
  const validSchoolIds = new Set(schools.map((school) => school.id))
  const invalidSharedFavorites = normalizeStringList(payload.sharedFavoriteSchoolIds, 1000, 120)
    .filter((id) => !validSchoolIds.has(id))
  if (invalidSharedFavorites.length) errors.push('共享收藏中存在未知 schoolId。')
  const rawProfileData = payload.profileData && typeof payload.profileData === 'object'
    ? payload.profileData
    : {}
  for (const profile of profiles) {
    if (!profile || !profile.id) {
      errors.push('档案 ID 缺失。')
      continue
    }
    validateProfileData(rawProfileData[profile.id], profile.id, validSchoolIds, errors)
  }
  return errors.length
    ? { ok: false, errors }
    : { ok: true, backup: clone(backup), payload: clone(payload), preview: backupPreview(payload) }
}

function newerRecord(local, incoming) {
  if (!local) return incoming
  if (!incoming) return local
  const localTime = Date.parse(local.updatedAt || local.createdAt || 0)
  const incomingTime = Date.parse(incoming.updatedAt || incoming.createdAt || 0)
  return incomingTime >= localTime ? incoming : local
}

function mergeBy(itemsA, itemsB, keySelector) {
  const result = new Map()
  for (const item of Array.isArray(itemsA) ? itemsA : []) result.set(keySelector(item), clone(item))
  for (const item of Array.isArray(itemsB) ? itemsB : []) {
    const key = keySelector(item)
    result.set(key, clone(newerRecord(result.get(key), item)))
  }
  return [...result.values()]
}

function mergeProfileData(local, incoming, profileId) {
  const left = normalizeProfileData(local, profileId)
  const right = normalizeProfileData(incoming, profileId)
  return normalizeProfileData({
    ...left,
    ...right,
    profileId,
    favoriteSchoolIds: [...new Set([...left.favoriteSchoolIds, ...right.favoriteSchoolIds])],
    scoreRecords: mergeBy(left.scoreRecords, right.scoreRecords, (item) => item.id),
    scoreReviews: mergeBy(left.scoreReviews, right.scoreReviews, (item) => item.id),
    scoreLossReasons: mergeBy(left.scoreLossReasons, right.scoreLossReasons, (item) => item.id),
    targetRecords: mergeBy(left.targetRecords, right.targetRecords, (item) => item.schoolId),
    stageGoals: mergeBy(left.stageGoals, right.stageGoals, (item) => item.id),
    learningTasks: mergeBy(left.learningTasks, right.learningTasks, (item) => item.id),
    comparisonSchoolIds: right.comparisonSchoolIds.length
      ? right.comparisonSchoolIds
      : left.comparisonSchoolIds,
    recentViewedSchoolIds: [...new Set([
      ...right.recentViewedSchoolIds,
      ...left.recentViewedSchoolIds
    ])].slice(0, 20),
    subjectConfigs: mergeBy(left.subjectConfigs, right.subjectConfigs, (item) => item.subjectId)
  }, profileId)
}

function normalizedStateFromPayload(payload) {
  const profiles = payload.profiles.map((item) => normalizeProfile(item)).filter(Boolean)
  const profileData = Object.fromEntries(profiles.map((profile) => [
    profile.id,
    normalizeProfileData(payload.profileData[profile.id], profile.id)
  ]))
  return {
    version: STORAGE_SCHEMA_VERSION,
    profiles,
    activeProfileId: profiles.some((item) => item.id === payload.activeProfileId)
      ? payload.activeProfileId
      : profiles[0].id,
    profileData,
    sharedFavoriteSchoolIds: normalizeStringList(payload.sharedFavoriteSchoolIds, 1000, 120),
    onboarding: payload.onboarding && typeof payload.onboarding === 'object' ? clone(payload.onboarding) : {},
    userSettings: payload.userSettings && typeof payload.userSettings === 'object' ? clone(payload.userSettings) : {}
  }
}

function importBackupEnvelope(input, { mode = 'merge' } = {}) {
  if (!['merge', 'overwrite'].includes(mode)) {
    return { ok: false, message: '导入模式必须是 merge 或 overwrite。' }
  }
  const validation = validateBackupEnvelope(input)
  if (!validation.ok) return { ok: false, message: validation.errors.join('；'), errors: validation.errors }
  const safety = createRestorePoint({
    reason: 'before_import',
    profileScope: { type: 'full_user_state' },
    operationId: `import_${validation.backup.checksum.value}_${mode}_safety`
  })
  if (!safety.ok) return safety
  const incoming = normalizedStateFromPayload(validation.payload)
  let nextState = incoming
  if (mode === 'merge') {
    const migration = ensureStorageMigrated()
    if (!migration.ok) return migration
    const localResult = getVersionedState()
    if (!localResult.ok) return localResult
    const local = localResult.state
    const profilesById = new Map(local.profiles.map((profile) => [profile.id, profile]))
    for (const profile of incoming.profiles) {
      profilesById.set(profile.id, newerRecord(profilesById.get(profile.id), profile))
    }
    const profiles = [...profilesById.values()].map(normalizeProfile).filter(Boolean)
    const profileData = Object.fromEntries(profiles.map((profile) => [
      profile.id,
      incoming.profileData[profile.id] && local.profileData[profile.id]
        ? mergeProfileData(local.profileData[profile.id], incoming.profileData[profile.id], profile.id)
        : normalizeProfileData(
          incoming.profileData[profile.id] || local.profileData[profile.id],
          profile.id
        )
    ]))
    nextState = {
      ...local,
      profiles,
      profileData,
      activeProfileId: local.activeProfileId,
      sharedFavoriteSchoolIds: [...new Set([
        ...local.sharedFavoriteSchoolIds,
        ...incoming.sharedFavoriteSchoolIds
      ])],
      onboarding: newerRecord(local.onboarding, incoming.onboarding),
      userSettings: { ...local.userSettings, ...incoming.userSettings }
    }
  }
  const result = replaceVersionedState(nextState, {
    importSnapshot: {
      capturedAt: new Date().toISOString(),
      mode,
      incomingChecksum: validation.backup.checksum.value,
      previous: getVersionedState().state
    }
  })
  return result.ok
    ? { ok: true, mode, preview: validation.preview, state: result.state }
    : result
}

function exportBackupFile() {
  const envelope = createBackupEnvelope()
  if (!envelope.ok) return envelope
  if (!wx.getFileSystemManager || !wx.env || !wx.env.USER_DATA_PATH) {
    return { ok: false, message: '当前微信环境不支持本地文件导出。', backup: envelope.backup }
  }
  const stamp = envelope.backup.exportedAt.replace(/[-:.TZ]/gu, '').slice(0, 14)
  const filePath = `${wx.env.USER_DATA_PATH}/suzhou_highschool_backup_${stamp}.json`
  try {
    wx.getFileSystemManager().writeFileSync(filePath, JSON.stringify(envelope.backup, null, 2), 'utf8')
    return {
      ok: true,
      filePath,
      backup: envelope.backup,
      preview: backupPreview(envelope.backup)
    }
  } catch (error) {
    return { ok: false, message: '备份文件写入失败，现有数据未修改。', backup: envelope.backup }
  }
}

function readBackupFile(filePath) {
  if (!filePath || !wx.getFileSystemManager) return { ok: false, message: '未选择备份文件。' }
  try {
    const content = wx.getFileSystemManager().readFileSync(filePath, 'utf8')
    return validateBackupEnvelope(content)
  } catch (error) {
    return { ok: false, message: '备份文件读取失败。' }
  }
}

module.exports = {
  APP_DATA_VERSION,
  CHECKSUM_ALGORITHM,
  stableStringify,
  fnv1a32,
  checksumForPayload,
  backupPayload,
  createBackupEnvelope,
  validateBackupEnvelope,
  backupPreview,
  mergeBy,
  mergeProfileData,
  importBackupEnvelope,
  exportBackupFile,
  readBackupFile
}
