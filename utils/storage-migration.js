const {
  STORAGE_SCHEMA_VERSION,
  DEFAULT_PROFILE_ID,
  clone,
  createDefaultProfile,
  createEmptyProfileData,
  normalizeExamRecord,
  normalizeTargetRecord,
  normalizeStageGoal,
  normalizeProfile,
  normalizeProfileData
} = require('./rc9-models')

const MIGRATION_CHAIN = Object.freeze([
  { from: 1, to: 2, label: 'v1 → v2' },
  { from: 2, to: 3, label: 'v2 → v3' },
  { from: 3, to: 4, label: 'v3 → v4' }
])

function array(value) {
  return Array.isArray(value) ? clone(value) : []
}

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? clone(value) : {}
}

function migrateV1ToV2(state, now) {
  const source = object(state)
  const profileId = source.profileId || DEFAULT_PROFILE_ID
  return {
    ...source,
    version: 2,
    profileId,
    scoreRecords: array(source.scoreRecords)
      .map((record) => normalizeExamRecord(record, profileId))
      .filter(Boolean),
    targetRecords: array(source.targetRecords)
      .map((record) => normalizeTargetRecord(record, profileId))
      .filter(Boolean),
    migratedAt: now
  }
}

function migrateV2ToV3(state, now) {
  const source = object(state)
  const profileId = source.profileId || DEFAULT_PROFILE_ID
  return {
    ...source,
    version: 3,
    stageGoals: array(source.stageGoals)
      .map((record) => normalizeStageGoal(record, profileId))
      .filter(Boolean),
    primaryTargetSchoolId: source.primaryTargetSchoolId || null,
    comparisonSchoolIds: array(source.comparisonSchoolIds),
    recommendationSettings: object(source.recommendationSettings),
    schoolFilters: object(source.schoolFilters),
    recentViewedSchoolIds: array(source.recentViewedSchoolIds),
    subjectConfigs: array(source.subjectConfigs),
    migratedAt: now
  }
}

function migrateV3ToV4(state, now) {
  const source = object(state)
  const profile = normalizeProfile(source.profile || {
    id: source.profileId || DEFAULT_PROFILE_ID,
    nickname: '默认档案',
    examYear: source.examYear,
    favoritesMode: 'independent',
    createdAt: now,
    updatedAt: now,
    lastUsedAt: now
  })
  const profileId = profile ? profile.id : DEFAULT_PROFILE_ID
  const profileData = normalizeProfileData({
    ...createEmptyProfileData(profileId),
    favoriteSchoolIds: array(source.favoriteSchoolIds),
    scoreRecords: array(source.scoreRecords),
    targetRecords: array(source.targetRecords),
    stageGoals: array(source.stageGoals),
    recommendationSettings: object(source.recommendationSettings),
    schoolFilters: object(source.schoolFilters),
    comparisonSchoolIds: array(source.comparisonSchoolIds),
    recentViewedSchoolIds: array(source.recentViewedSchoolIds),
    subjectConfigs: array(source.subjectConfigs),
    primaryTargetSchoolId: source.primaryTargetSchoolId || null,
    examYear: source.examYear,
    targetDraft: object(source.targetDraft)
  }, profileId)
  return {
    version: STORAGE_SCHEMA_VERSION,
    profiles: [profile || createDefaultProfile(now)],
    activeProfileId: profileId,
    profileData: { [profileId]: profileData },
    sharedFavoriteSchoolIds: array(source.sharedFavoriteSchoolIds),
    onboarding: object(source.onboarding),
    userSettings: object(source.userSettings),
    migratedAt: now
  }
}

function legacyStateFromSnapshot(snapshot, now, keys) {
  const source = object(snapshot)
  const examYear = source[keys.examYear]
  return {
    version: 1,
    profileId: DEFAULT_PROFILE_ID,
    profile: createDefaultProfile(now),
    favoriteSchoolIds: array(source[keys.favorites]),
    targetRecords: array(source[keys.targets]),
    targetDraft: object(source[keys.targetDraft]),
    stageGoals: array(source[keys.learningTargets]),
    scoreRecords: array(source[keys.scoreRecords]),
    examYear,
    onboarding: object(source[keys.onboarding]),
    recommendationSettings: {},
    schoolFilters: {},
    comparisonSchoolIds: [],
    recentViewedSchoolIds: [],
    subjectConfigs: [],
    primaryTargetSchoolId: null,
    sharedFavoriteSchoolIds: [],
    userSettings: {}
  }
}

function finalStateFromSnapshot(snapshot, keys) {
  const source = object(snapshot)
  const profiles = array(source[keys.profiles]).map(normalizeProfile).filter(Boolean)
  const safeProfiles = profiles.length ? profiles : [createDefaultProfile()]
  const activeProfileId = safeProfiles.some((profile) => profile.id === source[keys.activeProfileId])
    ? source[keys.activeProfileId]
    : safeProfiles[0].id
  const rawProfileData = object(source[keys.profileData])
  const profileData = Object.fromEntries(safeProfiles.map((profile) => [
    profile.id,
    normalizeProfileData(rawProfileData[profile.id], profile.id)
  ]))
  return {
    version: STORAGE_SCHEMA_VERSION,
    profiles: safeProfiles,
    activeProfileId,
    profileData,
    sharedFavoriteSchoolIds: array(source[keys.sharedFavorites]),
    onboarding: object(source[keys.onboardingV4]),
    userSettings: object(source[keys.userSettings]),
    migratedAt: source[keys.lastMigration] && source[keys.lastMigration].migratedAt
  }
}

function migrateStorageSnapshot(snapshot, { keys, now = new Date().toISOString(), ignoreLegacy = false } = {}) {
  if (!keys) throw new TypeError('keys are required')
  const sourceVersion = Number(snapshot && snapshot[keys.storageSchemaVersion])
  if (sourceVersion === STORAGE_SCHEMA_VERSION) {
    return {
      ok: true,
      fromVersion: STORAGE_SCHEMA_VERSION,
      toVersion: STORAGE_SCHEMA_VERSION,
      applied: [],
      state: finalStateFromSnapshot(snapshot, keys)
    }
  }

  let state = ignoreLegacy
    ? {
        version: 1,
        profileId: DEFAULT_PROFILE_ID,
        profile: createDefaultProfile(now),
        favoriteSchoolIds: [],
        targetRecords: [],
        targetDraft: {},
        stageGoals: [],
        scoreRecords: [],
        examYear: undefined,
        onboarding: {},
        userSettings: {}
      }
    : legacyStateFromSnapshot(snapshot, now, keys)
  const applied = []
  for (const step of MIGRATION_CHAIN) {
    if (state.version !== step.from) {
      return {
        ok: false,
        fromVersion: Number.isInteger(sourceVersion) ? sourceVersion : 1,
        toVersion: state.version,
        applied,
        error: `迁移链中断：期望 v${step.from}，实际 v${state.version}`
      }
    }
    if (step.to === 2) state = migrateV1ToV2(state, now)
    if (step.to === 3) state = migrateV2ToV3(state, now)
    if (step.to === 4) state = migrateV3ToV4(state, now)
    applied.push(step.label)
  }
  return {
    ok: true,
    fromVersion: Number.isInteger(sourceVersion) ? sourceVersion : 1,
    toVersion: STORAGE_SCHEMA_VERSION,
    applied,
    state
  }
}

function storageWritesForState(state, keys) {
  return {
    [keys.profiles]: clone(state.profiles),
    [keys.activeProfileId]: state.activeProfileId,
    [keys.profileData]: clone(state.profileData),
    [keys.sharedFavorites]: clone(state.sharedFavoriteSchoolIds),
    [keys.onboardingV4]: clone(state.onboarding),
    [keys.userSettings]: clone(state.userSettings),
    [keys.lastMigration]: {
      fromVersion: state.version === STORAGE_SCHEMA_VERSION ? 1 : state.version,
      toVersion: STORAGE_SCHEMA_VERSION,
      migratedAt: state.migratedAt || new Date().toISOString()
    },
    [keys.storageSchemaVersion]: STORAGE_SCHEMA_VERSION
  }
}

module.exports = {
  MIGRATION_CHAIN,
  migrateV1ToV2,
  migrateV2ToV3,
  migrateV3ToV4,
  legacyStateFromSnapshot,
  finalStateFromSnapshot,
  migrateStorageSnapshot,
  storageWritesForState
}
