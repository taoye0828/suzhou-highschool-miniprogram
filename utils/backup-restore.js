const { schools } = require('../data/schools')
const { PRODUCT_RULES } = require('./runtime-constants')
const { canonicalJson, assertSafeJsonValue } = require('./canonical-json')
const {
  CHECKSUM_ALGORITHM,
  LEGACY_FNV_ALGORITHM,
  legacyFnv1a32,
  checksumFor
} = require('./checksum')
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
  normalizeExamTemplate,
  normalizeScoreScheme,
  normalizeMistakeRecord,
  normalizeWeeklyPlan,
  normalizeStageReview,
  normalizeSchoolUserState,
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

const APP_DATA_VERSION = PRODUCT_RULES.appDataVersion

function stableStringify(value) {
  return canonicalJson(value)
}

const fnv1a32 = legacyFnv1a32

function checksumForPayload(payload, algorithm = CHECKSUM_ALGORITHM) {
  return algorithm === LEGACY_FNV_ALGORITHM
    ? legacyFnv1a32(canonicalJson(payload))
    : checksumFor(payload)
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
        value: checksumForPayload(payload, CHECKSUM_ALGORITHM)
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
  const examTemplates = Array.isArray(raw.examTemplates) ? raw.examTemplates : []
  const scoreSchemes = Array.isArray(raw.scoreSchemes) ? raw.scoreSchemes : []
  const mistakeRecords = Array.isArray(raw.mistakeRecords) ? raw.mistakeRecords : []
  const weeklyPlans = Array.isArray(raw.weeklyPlans) ? raw.weeklyPlans : []
  const stageReviews = Array.isArray(raw.stageReviews) ? raw.stageReviews : []
  const schoolUserStates = Array.isArray(raw.schoolUserStates) ? raw.schoolUserStates : []
  for (const [items, limit, label] of [
    [scoreRecords, PRODUCT_RULES.limits.maxExamRecordsPerProfile, '考试记录'],
    [targetRecords, PRODUCT_RULES.limits.maxTargetRecordsPerProfile, '目标学校'],
    [learningTasks, PRODUCT_RULES.limits.maxLearningTasksPerProfile, '学习任务'],
    [examTemplates, PRODUCT_RULES.limits.maxCustomExamTemplatesPerProfile, '自定义考试模板'],
    [scoreSchemes, PRODUCT_RULES.limits.maxCustomScoreSchemesPerProfile, '自定义分值方案'],
    [mistakeRecords, PRODUCT_RULES.limits.maxMistakeRecordsPerProfile, '错题记录'],
    [weeklyPlans, PRODUCT_RULES.limits.maxWeeklyPlansPerProfile, '周计划'],
    [stageGoals, PRODUCT_RULES.limits.maxStageGoalsPerProfile, '阶段目标'],
    [stageReviews, PRODUCT_RULES.limits.maxStageReviewsPerProfile, '阶段复盘'],
    [schoolUserStates, PRODUCT_RULES.limits.maxSchoolUserStatesPerProfile, '学校个人状态']
  ]) {
    if (items.length > limit) errors.push(`档案 ${profileId} 的${label}超过数量限制`)
  }
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
  for (const [items, label] of [
    [examTemplates, '考试模板'], [scoreSchemes, '分值方案'], [mistakeRecords, '错题'],
    [weeklyPlans, '周计划'], [stageReviews, '阶段复盘'], [schoolUserStates, '学校个人状态']
  ]) {
    if (duplicateValues(items, (item) => item && item.id).length) errors.push(`档案 ${profileId} 存在重复${label} ID`)
  }
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
  for (const [items, normalizer, label] of [
    [examTemplates, normalizeExamTemplate, '考试模板'],
    [scoreSchemes, normalizeScoreScheme, '分值方案'],
    [mistakeRecords, normalizeMistakeRecord, '错题记录'],
    [weeklyPlans, normalizeWeeklyPlan, '周计划'],
    [stageReviews, normalizeStageReview, '阶段复盘'],
    [schoolUserStates, normalizeSchoolUserState, '学校个人状态']
  ]) {
    if (items.some((item) => !normalizer(item, profileId))) errors.push(`档案 ${profileId} 含结构无效的${label}`)
    if (items.some((item) => item.profileId && item.profileId !== profileId)) errors.push(`档案 ${profileId} 含串档的${label}`)
  }
  const schoolIds = [
    ...(Array.isArray(raw.favoriteSchoolIds) ? raw.favoriteSchoolIds : []),
    ...(Array.isArray(raw.comparisonSchoolIds) ? raw.comparisonSchoolIds : []),
    ...(Array.isArray(raw.recentViewedSchoolIds) ? raw.recentViewedSchoolIds : []),
    ...targetRecords.map((item) => item && item.schoolId),
    ...schoolUserStates.map((item) => item && item.schoolId)
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

const BACKUP_SCOPE_ROOT_GROUPS = Object.freeze({
  profiles: ['profiles'],
  scores: ['scoreRecords'],
  targets: ['targetSchools'],
  learning: ['scoreReviews', 'scoreLossReasons', 'stageGoals', 'learningTasks'],
  schoolPersonal: ['favorites', 'sharedFavoriteSchoolIds'],
  settings: [
    'activeProfileId',
    'recommendationSettings',
    'onboardingState',
    'recentHistory',
    'onboarding',
    'userSettings'
  ],
  container: ['profileData']
})

const BACKUP_SCOPE_PROFILE_GROUPS = Object.freeze({
  association: ['profileId'],
  scores: ['scoreRecords'],
  targets: ['targetRecords'],
  learning: [
    'scoreReviews',
    'scoreLossReasons',
    'stageGoals',
    'learningTasks',
    'mistakeRecords',
    'weeklyPlans',
    'stageReviews'
  ],
  schoolPersonal: [
    'favoriteSchoolIds',
    'comparisonSchoolIds',
    'recentViewedSchoolIds',
    'schoolUserStates'
  ],
  customConfigs: ['examTemplates', 'scoreSchemes', 'subjectConfigs'],
  settings: [
    'recommendationSettings',
    'scenarioSettings',
    'schoolFilters',
    'recentHistory',
    'primaryTargetSchoolId',
    'examYear',
    'targetDraft',
    'legacyExtensions',
    'schemaVersion'
  ]
})

const BACKUP_METADATA_FIELDS = Object.freeze([
  'format',
  'backupFormatVersion',
  'storageSchemaVersion',
  'appDataVersion',
  'exportedAt',
  'sourcePlatform',
  'checksum'
])

function uniqueSorted(values) {
  return [...new Set(values)].sort()
}

function profileSchemaFields(payload) {
  const profiles = Array.isArray(payload.profiles) ? payload.profiles : []
  const profileData = payload.profileData && typeof payload.profileData === 'object'
    ? payload.profileData
    : {}
  return uniqueSorted(profiles.flatMap((profile) =>
    Object.keys(profileData[profile.id] && typeof profileData[profile.id] === 'object'
      ? profileData[profile.id]
      : {})
  ))
}

function sumProfileArrays(payload, fields) {
  const profiles = Array.isArray(payload.profiles) ? payload.profiles : []
  const profileData = payload.profileData && typeof payload.profileData === 'object'
    ? payload.profileData
    : {}
  return profiles.reduce((total, profile) => {
    const data = profileData[profile.id] || {}
    return total + fields.reduce((subtotal, field) =>
      subtotal + (Array.isArray(data[field]) ? data[field].length : 0), 0)
  }, 0)
}

function createBackupScope(backup) {
  const payload = backupPayload(backup)
  const preview = backupPreview(payload)
  const rootFields = Object.keys(backup && typeof backup === 'object' ? backup : {}).sort()
  const payloadFields = Object.keys(payload).sort()
  const nestedFields = profileSchemaFields(payload)
  const payloadFieldSet = new Set(payloadFields)
  const profileFieldSet = new Set(nestedFields)
  const hasRootGroup = (name) => BACKUP_SCOPE_ROOT_GROUPS[name]
    .some((field) => payloadFieldSet.has(field))
  const hasProfileGroup = (name) => BACKUP_SCOPE_PROFILE_GROUPS[name]
    .some((field) => profileFieldSet.has(field))
  const countText = (count, unit) => `${count} ${unit}`
  const items = []

  if (hasRootGroup('profiles')) {
    items.push({ key: 'profiles', label: '学生档案', count: preview.profileCount, countText: countText(preview.profileCount, '个') })
  }
  if (hasRootGroup('scores') || hasProfileGroup('scores')) {
    items.push({ key: 'scores', label: '成绩记录', count: preview.scoreCount, countText: countText(preview.scoreCount, '条') })
  }
  if (hasRootGroup('targets') || hasProfileGroup('targets')) {
    items.push({ key: 'targets', label: '目标学校', count: preview.targetCount, countText: countText(preview.targetCount, '所') })
  }
  if (hasRootGroup('learning') || hasProfileGroup('learning')) {
    const count = sumProfileArrays(payload, BACKUP_SCOPE_PROFILE_GROUPS.learning)
    items.push({ key: 'learning', label: '学习目标、任务、复盘与错题等历史数据', count, countText: countText(count, '项') })
  }
  if (hasRootGroup('schoolPersonal') || hasProfileGroup('schoolPersonal')) {
    const sharedCount = Array.isArray(payload.sharedFavoriteSchoolIds)
      ? payload.sharedFavoriteSchoolIds.length
      : 0
    const count = sumProfileArrays(payload, BACKUP_SCOPE_PROFILE_GROUPS.schoolPersonal) + sharedCount
    items.push({ key: 'schoolPersonal', label: '收藏、对比、最近浏览等学校个人数据', count, countText: countText(count, '项') })
  }
  if (hasProfileGroup('customConfigs')) {
    const count = sumProfileArrays(payload, BACKUP_SCOPE_PROFILE_GROUPS.customConfigs)
    items.push({ key: 'customConfigs', label: '自定义考试、科目与分值配置', count, countText: countText(count, '项') })
  }
  if (hasRootGroup('settings') || hasProfileGroup('settings')) {
    items.push({ key: 'settings', label: '当前档案、筛选、教程及其他本地设置', count: null, countText: '已包含' })
  }

  const describedRootFields = new Set([
    ...BACKUP_METADATA_FIELDS,
    ...Object.values(BACKUP_SCOPE_ROOT_GROUPS).flat()
  ])
  const describedProfileFields = new Set(Object.values(BACKUP_SCOPE_PROFILE_GROUPS).flat())
  return {
    items,
    preview,
    includedText: `备份只包含本机“${PRODUCT_RULES.productName}”支持导出的用户数据。`,
    metadataText: '文件还会包含导出时间、格式版本和完整性校验信息。',
    excludedText: '不包含学校公开数据库、后台或远程数据、微信聊天记录和系统文件。',
    schema: {
      rootFields,
      payloadFields,
      profileDataFields: nestedFields,
      undisclosedRootFields: rootFields.filter((field) => !describedRootFields.has(field)),
      undisclosedProfileDataFields: nestedFields.filter((field) => !describedProfileFields.has(field))
    }
  }
}

function validateBackupEnvelope(input) {
  let backup = input
  if (typeof input === 'string') {
    if (unescape(encodeURIComponent(input)).length > PRODUCT_RULES.limits.maxImportFileBytes) {
      return { ok: false, errors: ['备份文件超过 4 MB 限制。'] }
    }
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
  try {
    assertSafeJsonValue(backup)
  } catch (error) {
    return { ok: false, errors: [error.code === 'JSON_DEPTH_EXCEEDED' ? '备份 JSON 层级过深。' : '备份包含不安全对象键。'] }
  }
  if (backup.format !== BACKUP_FORMAT) errors.push('备份格式标识不匹配。')
  const formatVersion = backup.backupFormatVersion === undefined
    ? backup.backupVersion
    : backup.backupFormatVersion
  if (![1, 2, BACKUP_FORMAT_VERSION].includes(formatVersion)) errors.push('备份格式版本不受支持。')
  const expectedStorageVersions = formatVersion === BACKUP_FORMAT_VERSION ? [STORAGE_SCHEMA_VERSION] : [4]
  if (!expectedStorageVersions.includes(backup.storageSchemaVersion)) {
    errors.push('存储版本不受支持。')
  }
  const supportedAppDataVersions = formatVersion === BACKUP_FORMAT_VERSION
    ? [APP_DATA_VERSION]
    : ['rc9', 'rc10', 'rc11-2']
  if (!supportedAppDataVersions.includes(backup.appDataVersion)) errors.push('应用数据版本不受支持。')
  if (typeof backup.exportedAt !== 'string' || !Number.isFinite(Date.parse(backup.exportedAt))) {
    errors.push('导出时间无效。')
  }
  const payload = backupPayload(backup)
  const supportedAlgorithms = formatVersion === BACKUP_FORMAT_VERSION
    ? [CHECKSUM_ALGORITHM]
    : [LEGACY_FNV_ALGORITHM, CHECKSUM_ALGORITHM]
  const declaredAlgorithm = backup.checksum && backup.checksum.algorithm
  if (!supportedAlgorithms.includes(declaredAlgorithm)) {
    errors.push('校验摘要算法不受支持。')
  } else if (checksumForPayload(payload, declaredAlgorithm) !== backup.checksum.value) {
    errors.push('校验摘要不匹配，文件可能已损坏。')
  }
  const profiles = Array.isArray(payload.profiles) ? payload.profiles : []
  if (!profiles.length) errors.push('备份至少需要一个学生档案。')
  if (profiles.length > PRODUCT_RULES.limits.maxProfiles) errors.push('备份中的学生档案超过数量限制。')
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
  const localVersion = Number(local.version) || 0
  const incomingVersion = Number(incoming.version) || 0
  if (localVersion !== incomingVersion) return incomingVersion > localVersion ? incoming : local
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

function mergeProfileData(local, incoming, profileId, { settingsChoice = 'local' } = {}) {
  const left = normalizeProfileData(local, profileId)
  const right = normalizeProfileData(incoming, profileId)
  const settings = settingsChoice === 'backup' ? right : left
  return normalizeProfileData({
    ...left,
    profileId,
    favoriteSchoolIds: [...new Set([...left.favoriteSchoolIds, ...right.favoriteSchoolIds])],
    scoreRecords: mergeBy(left.scoreRecords, right.scoreRecords, (item) => item.id),
    scoreReviews: mergeBy(left.scoreReviews, right.scoreReviews, (item) => item.id),
    scoreLossReasons: mergeBy(left.scoreLossReasons, right.scoreLossReasons, (item) => item.id),
    targetRecords: mergeBy(left.targetRecords, right.targetRecords, (item) => item.schoolId),
    stageGoals: mergeBy(left.stageGoals, right.stageGoals, (item) => item.id),
    learningTasks: mergeBy(left.learningTasks, right.learningTasks, (item) => item.id),
    examTemplates: mergeBy(left.examTemplates, right.examTemplates, (item) => item.id),
    scoreSchemes: mergeBy(left.scoreSchemes, right.scoreSchemes, (item) => item.id),
    mistakeRecords: mergeBy(left.mistakeRecords, right.mistakeRecords, (item) => item.id),
    weeklyPlans: mergeBy(left.weeklyPlans, right.weeklyPlans, (item) => item.id),
    stageReviews: mergeBy(left.stageReviews, right.stageReviews, (item) => item.id),
    schoolUserStates: mergeBy(left.schoolUserStates, right.schoolUserStates, (item) => item.schoolId),
    recommendationSettings: settings.recommendationSettings,
    scenarioSettings: settings.scenarioSettings,
    schoolFilters: settings.schoolFilters,
    comparisonSchoolIds: settings.comparisonSchoolIds,
    primaryTargetSchoolId: settings.primaryTargetSchoolId,
    examYear: settings.examYear,
    targetDraft: settings.targetDraft,
    subjectConfigs: settings.subjectConfigs,
    recentViewedSchoolIds: [...new Set([
      ...right.recentViewedSchoolIds,
      ...left.recentViewedSchoolIds
    ])].slice(0, 20),
    legacyExtensions: settings.legacyExtensions
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

function validateStateLimits(state) {
  const profiles = Array.isArray(state && state.profiles) ? state.profiles : []
  if (profiles.length > PRODUCT_RULES.limits.maxProfiles) {
    return {
      ok: false,
      code: 'LIMIT_EXCEEDED',
      message: '合并后学生档案将超过 10 个，原数据未修改。'
    }
  }
  const profileData = state && state.profileData && typeof state.profileData === 'object'
    ? state.profileData
    : {}
  const limits = [
    ['scoreRecords', PRODUCT_RULES.limits.maxExamRecordsPerProfile, '考试记录'],
    ['targetRecords', PRODUCT_RULES.limits.maxTargetRecordsPerProfile, '目标学校'],
    ['learningTasks', PRODUCT_RULES.limits.maxLearningTasksPerProfile, '学习任务'],
    ['examTemplates', PRODUCT_RULES.limits.maxCustomExamTemplatesPerProfile, '自定义考试模板'],
    ['scoreSchemes', PRODUCT_RULES.limits.maxCustomScoreSchemesPerProfile, '自定义分值方案'],
    ['mistakeRecords', PRODUCT_RULES.limits.maxMistakeRecordsPerProfile, '错题记录'],
    ['weeklyPlans', PRODUCT_RULES.limits.maxWeeklyPlansPerProfile, '周计划'],
    ['stageGoals', PRODUCT_RULES.limits.maxStageGoalsPerProfile, '阶段目标'],
    ['stageReviews', PRODUCT_RULES.limits.maxStageReviewsPerProfile, '阶段复盘'],
    ['schoolUserStates', PRODUCT_RULES.limits.maxSchoolUserStatesPerProfile, '学校个人状态']
  ]
  for (const profile of profiles) {
    const data = profileData[profile.id] || {}
    for (const [field, limit, label] of limits) {
      const count = Array.isArray(data[field]) ? data[field].length : 0
      if (count > limit) {
        return {
          ok: false,
          code: 'LIMIT_EXCEEDED',
          message: `合并后档案“${profile.nickname || profile.id}”的${label}将超过数量限制，原数据未修改。`
        }
      }
    }
  }
  return { ok: true }
}

function importBackupEnvelope(input, { mode = 'merge', settingsChoice = 'local', operationId } = {}) {
  if (!['merge', 'overwrite'].includes(mode)) {
    return { ok: false, message: '导入模式必须是 merge 或 overwrite。' }
  }
  const validation = validateBackupEnvelope(input)
  if (!validation.ok) return { ok: false, message: validation.errors.join('；'), errors: validation.errors }
  const migration = ensureStorageMigrated()
  if (!migration.ok) return migration
  const localResult = getVersionedState()
  if (!localResult.ok) return localResult
  const local = localResult.state
  const incoming = normalizedStateFromPayload(validation.payload)
  let nextState = incoming
  if (mode === 'merge') {
    const profilesById = new Map(local.profiles.map((profile) => [profile.id, profile]))
    for (const profile of incoming.profiles) {
      profilesById.set(profile.id, newerRecord(profilesById.get(profile.id), profile))
    }
    const profiles = [...profilesById.values()].map(normalizeProfile).filter(Boolean)
    const profileData = Object.fromEntries(profiles.map((profile) => [
      profile.id,
      incoming.profileData[profile.id] && local.profileData[profile.id]
        ? mergeProfileData(local.profileData[profile.id], incoming.profileData[profile.id], profile.id, { settingsChoice })
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
      onboarding: settingsChoice === 'backup' ? clone(incoming.onboarding) : clone(local.onboarding),
      userSettings: settingsChoice === 'backup' ? clone(incoming.userSettings) : clone(local.userSettings)
    }
  }
  const limits = validateStateLimits(nextState)
  if (!limits.ok) return limits
  const safety = createRestorePoint({
    reason: 'before_import',
    profileScope: { type: 'full_user_state' },
    operationId: `${operationId || `import_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`}_safety`
  })
  if (!safety.ok) return safety
  const result = replaceVersionedState(nextState, {
    importSnapshot: {
      capturedAt: new Date().toISOString(),
      mode,
      incomingChecksum: validation.backup.checksum.value,
      previous: clone(local)
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
    const content = JSON.stringify(envelope.backup, null, 2)
    if (unescape(encodeURIComponent(content)).length > PRODUCT_RULES.limits.maxBackupFileBytes) {
      return { ok: false, code: 'FILE_TOO_LARGE', message: '备份文件超过 4 MB 限制，未写入文件。' }
    }
    wx.getFileSystemManager().writeFileSync(filePath, content, 'utf8')
    const verification = readBackupFile(filePath)
    if (!verification.ok) {
      return {
        ok: false,
        code: 'FILE_VERIFY_FAILED',
        message: '备份文件生成后校验失败，请稍后重试。',
        backup: envelope.backup
      }
    }
    return {
      ok: true,
      filePath,
      fileName: filePath.slice(filePath.lastIndexOf('/') + 1),
      backup: verification.backup,
      preview: verification.preview,
      scope: createBackupScope(verification.backup)
    }
  } catch (error) {
    return { ok: false, message: '备份文件写入失败，现有数据未修改。', backup: envelope.backup }
  }
}

function readBackupFile(filePath) {
  if (!filePath || !wx.getFileSystemManager) return { ok: false, message: '未选择备份文件。' }
  try {
    const fileSystem = wx.getFileSystemManager()
    if (typeof fileSystem.statSync !== 'function') {
      return { ok: false, code: 'FILE_STAT_FAILED', message: '无法确认备份文件大小，文件未读取。' }
    }
    const stat = fileSystem.statSync(filePath)
    const size = Number(stat && stat.size)
    if (!Number.isFinite(size) || size < 0) {
      return { ok: false, code: 'FILE_STAT_FAILED', message: '无法确认备份文件大小，文件未读取。' }
    }
    if (size > PRODUCT_RULES.limits.maxImportFileBytes) {
      return {
        ok: false,
        code: 'FILE_TOO_LARGE',
        message: '备份文件超过 4 MB 限制，文件未读取。',
        errors: ['备份文件超过 4 MB 限制，文件未读取。']
      }
    }
    const content = fileSystem.readFileSync(filePath, 'utf8')
    return validateBackupEnvelope(content)
  } catch (error) {
    return { ok: false, message: '备份文件读取失败。' }
  }
}

function hasExportedBackup() {
  if (typeof wx === 'undefined' || !wx.getFileSystemManager || !wx.env || !wx.env.USER_DATA_PATH) return false
  try {
    return wx.getFileSystemManager().readdirSync(wx.env.USER_DATA_PATH)
      .some((name) => /^suzhou_highschool_backup_\d{14}\.json$/u.test(name))
  } catch (error) {
    return false
  }
}

const BackupExportService = Object.freeze({
  createEnvelope: createBackupEnvelope,
  exportFile: exportBackupFile,
  readFile: readBackupFile,
  validate: validateBackupEnvelope,
  importEnvelope: importBackupEnvelope
})

module.exports = {
  APP_DATA_VERSION,
  CHECKSUM_ALGORITHM,
  LEGACY_FNV_ALGORITHM,
  stableStringify,
  fnv1a32,
  checksumForPayload,
  backupPayload,
  createBackupEnvelope,
  validateBackupEnvelope,
  backupPreview,
  createBackupScope,
  mergeBy,
  mergeProfileData,
  validateStateLimits,
  importBackupEnvelope,
  exportBackupFile,
  readBackupFile,
  hasExportedBackup,
  BackupExportService
}
