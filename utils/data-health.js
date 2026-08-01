const { schools } = require('../data/schools')
const {
  STORAGE_SCHEMA_VERSION,
  STAGE_GOAL_METRIC_TYPES,
  clone,
  validDate
} = require('./rc9-models')
const { PRODUCT_RULES } = require('./generated/product-rules')
const {
  completeSchemeSnapshot,
  recommendationEligibility,
  scoreRateBasisPoints
} = require('./v1-domain')
const {
  KEYS,
  readStorage,
  writeStorage,
  removeStorage,
  storageSnapshot,
  atomicWrite,
  getDataRevision,
  createRestorePoint
} = require('./storage')

const ISSUE_LABELS = {
  duplicate_entity_id: '重复实体 ID',
  duplicate_score_id: '重复成绩 ID',
  duplicate_target_school: '重复目标学校',
  duplicate_learning_task: '重复学习任务',
  duplicate_favorite: '重复收藏',
  duplicate_school_tag: '重复学校标签',
  invalid_school_id: '无效 schoolId',
  invalid_profile_id: '无效 profileId',
  profile_data_mismatch: '多档案数据串档',
  missing_total_max_score: '考试总满分缺失',
  total_score_out_of_range: '总分超出正式范围',
  total_score_exceeds_max: '总分超过当次满分',
  subject_score_out_of_range: '学科成绩超出满分',
  invalid_score_scheme_reference: '分值方案引用无效',
  missing_score_scheme_snapshot: '历史分值方案快照缺失',
  score_rate_mismatch: '得分率校验错误',
  ineligible_reference_exam: '不合格考试被用于历史分差参考',
  invalid_exam_template_reference: '考试模板引用无效',
  invalid_date: '日期格式错误',
  missing_required_field: '缺少必要字段',
  deleted_profile_residue: '已删除档案残留',
  orphan_review: '孤立考试复盘',
  orphan_loss_reason: '孤立失分原因',
  orphan_mistake_reference: '错题引用无效',
  orphan_learning_task: '学习任务引用无效',
  orphan_weekly_plan_task: '周计划任务引用无效',
  orphan_stage_goal_reference: '阶段目标引用无效',
  invalid_stage_goal_metric: '阶段目标指标无效',
  corrupt_stage_review: '阶段复盘快照损坏',
  invalid_school_user_state: '学校个人状态引用无效',
  multiple_primary_target: '存在多个主要目标',
  old_schema_field: '旧 Schema 字段',
  version_incompatible: '数据版本不兼容',
  onboarding_invalid: '教程状态异常',
  invalid_recent_reference: '最近操作无效引用',
  import_temp_residue: '导入临时数据残留',
  migration_temp_residue: '迁移临时数据残留',
  transaction_temp_residue: '事务日志残留',
  cleanup_pending: '事务清理待完成',
  operation_state_oversize: '操作状态超限',
  operation_state_payload: '操作状态包含完整数据',
  clear_marker_invalid: '清除标记异常'
}

const SAFE_REPAIR_TYPES = new Set([
  'duplicate_favorite',
  'duplicate_school_tag',
  'old_schema_field',
  'invalid_recent_reference',
  'transaction_temp_residue'
])

const PROFILE_ENTITY_FIELDS = [
  'scoreRecords',
  'scoreReviews',
  'scoreLossReasons',
  'targetRecords',
  'stageGoals',
  'learningTasks',
  'examTemplates',
  'scoreSchemes',
  'mistakeRecords',
  'weeklyPlans',
  'stageReviews',
  'schoolUserStates'
]

function array(value) {
  return Array.isArray(value) ? value : []
}

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function byteLength(value) {
  try {
    return unescape(encodeURIComponent(JSON.stringify(value))).length
  } catch (error) {
    return Number.POSITIVE_INFINITY
  }
}

function duplicateIds(items, selector) {
  const seen = new Set()
  const duplicates = new Set()
  for (const item of array(items)) {
    const value = selector(item)
    if (!value) continue
    if (seen.has(value)) duplicates.add(value)
    seen.add(value)
  }
  return [...duplicates]
}

function issue(type, profileId, recordId, detail) {
  return {
    type,
    label: ISSUE_LABELS[type] || type,
    profileId: profileId || '',
    recordId: recordId || '',
    detail,
    autoFixable: SAFE_REPAIR_TYPES.has(type)
  }
}

function entitySets(source) {
  return Object.fromEntries(PROFILE_ENTITY_FIELDS.map((field) => [
    field,
    new Set(array(source[field]).map((item) => item && item.id).filter(Boolean))
  ]))
}

function scanEntityIdentity(profileId, source, issues) {
  const globalIds = new Map()
  for (const field of PROFILE_ENTITY_FIELDS) {
    const records = array(source[field])
    for (const id of duplicateIds(records, (item) => item && item.id)) {
      const legacyType = field === 'scoreRecords'
        ? 'duplicate_score_id'
        : field === 'learningTasks'
          ? 'duplicate_learning_task'
          : 'duplicate_entity_id'
      issues.push(issue(legacyType, profileId, id, `${field} 中 ID ${id} 重复`))
    }
    for (const record of records) {
      if (!record || typeof record !== 'object') continue
      if (!record.id) issues.push(issue('missing_required_field', profileId, '', `${field} 中的实体缺少 ID`))
      if (record.profileId && record.profileId !== profileId) {
        issues.push(issue('profile_data_mismatch', profileId, record.id, `${field} 实体归属 ${record.profileId}`))
      }
      if (Number(record.schemaVersion) > STORAGE_SCHEMA_VERSION) {
        issues.push(issue('version_incompatible', profileId, record.id, `${field} Schema v${record.schemaVersion} 高于当前支持版本`))
      } else if (record.schemaVersion !== STORAGE_SCHEMA_VERSION) {
        issues.push(issue('old_schema_field', profileId, record.id, `${field} Schema 版本可安全补齐`))
      }
      if (record.id) {
        const previous = globalIds.get(record.id)
        if (previous && previous !== field) {
          issues.push(issue('duplicate_entity_id', profileId, record.id, `${record.id} 同时出现在 ${previous} 与 ${field}`))
        } else globalIds.set(record.id, field)
      }
    }
  }
}

function referenceExamId(source) {
  const settings = object(source.recommendationSettings)
  const draft = object(source.targetDraft)
  return [
    settings.referenceExamRecordId,
    settings.selectedExamRecordId,
    settings.selectedReferenceExamId,
    draft.referenceExamRecordId,
    draft.selectedReferenceExamId
  ].find(Boolean) || ''
}

function scanScores(profileId, source, ids, context, issues) {
  const scores = array(source.scoreRecords)
  const customSchemeIds = new Set(array(source.scoreSchemes).map((item) => item && item.id).filter(Boolean))
  const schemeIds = new Set([...context.builtInSchemeIds, ...customSchemeIds])
  const templateIds = new Set([
    ...context.builtInTemplateIds,
    ...array(source.examTemplates).map((item) => item && item.id).filter(Boolean)
  ])
  const selectedReferenceId = referenceExamId(source)

  for (const record of scores) {
    if (!record || !record.id || !record.examName) continue
    const total = Number(record.totalScore === undefined ? record.score : record.totalScore)
    const totalMaxScore = Number(record.totalMaxScore)
    if (!Number.isInteger(totalMaxScore) || totalMaxScore <= 0) {
      issues.push(issue('missing_total_max_score', profileId, record.id, `考试 ${record.examName} 未保存有效总满分`))
    }
    if (!Number.isFinite(total) || total < 0 || total > PRODUCT_RULES.examTotalScoreMax ||
        Number.isFinite(totalMaxScore) && totalMaxScore > PRODUCT_RULES.examTotalScoreMax) {
      issues.push(issue('total_score_out_of_range', profileId, record.id, `总分 ${total} / ${record.totalMaxScore}`))
    }
    if (Number.isFinite(total) && Number.isFinite(totalMaxScore) && total > totalMaxScore) {
      issues.push(issue('total_score_exceeds_max', profileId, record.id, `总分 ${total} 超过当次满分 ${totalMaxScore}`))
    }
    if (!validDate(record.examDate || record.date)) {
      issues.push(issue('invalid_date', profileId, record.id, `考试日期 ${record.examDate || record.date || '缺失'}`))
    }
    if (record.examTemplateId && !templateIds.has(record.examTemplateId)) {
      issues.push(issue('invalid_exam_template_reference', profileId, record.id, `考试模板 ${record.examTemplateId} 不存在`))
    }
    if (!record.scoreSchemeSnapshot || typeof record.scoreSchemeSnapshot !== 'object' || Array.isArray(record.scoreSchemeSnapshot)) {
      issues.push(issue('missing_score_scheme_snapshot', profileId, record.id, `考试 ${record.examName} 缺少不可变方案快照`))
    }
    if (record.scoreSchemeId && !schemeIds.has(record.scoreSchemeId) && !completeSchemeSnapshot(record.scoreSchemeSnapshot)) {
      issues.push(issue('invalid_score_scheme_reference', profileId, record.id, `方案 ${record.scoreSchemeId} 不存在且无完整历史快照`))
    }
    const expectedRate = scoreRateBasisPoints(total, totalMaxScore)
    if (expectedRate === null || record.scoreRateBasisPoints !== expectedRate) {
      issues.push(issue('score_rate_mismatch', profileId, record.id, `得分率 ${record.scoreRateBasisPoints}，应为 ${expectedRate}`))
    }
    for (const subject of array(record.subjectScores)) {
      const score = Number(subject && subject.score)
      const max = Number(subject && subject.maxScore)
      if (!Number.isFinite(score) || !Number.isFinite(max) || max <= 0 || score < 0 || score > max) {
        issues.push(issue('subject_score_out_of_range', profileId, record.id, `${subject && subject.subjectName || '学科'} ${score}/${max}`))
      }
    }
    if (selectedReferenceId === record.id) {
      const eligibility = recommendationEligibility(record)
      if (!eligibility.eligible) {
        issues.push(issue('ineligible_reference_exam', profileId, record.id, `${record.examName}：${eligibility.message}`))
      }
    }
  }

  for (const template of array(source.examTemplates)) {
    if (template && template.scoreSchemeId && !schemeIds.has(template.scoreSchemeId)) {
      issues.push(issue('invalid_score_scheme_reference', profileId, template.id, `模板引用的方案 ${template.scoreSchemeId} 不存在`))
    }
  }
}

function scanLearningReferences(profileId, source, ids, issues) {
  for (const review of array(source.scoreReviews)) {
    if (review && !ids.scoreRecords.has(review.examRecordId)) {
      issues.push(issue('orphan_review', profileId, review.id, `关联考试 ${review.examRecordId} 不存在`))
    }
  }
  for (const reason of array(source.scoreLossReasons)) {
    if (!reason) continue
    if (!ids.scoreRecords.has(reason.examRecordId) || reason.reviewId && !ids.scoreReviews.has(reason.reviewId)) {
      issues.push(issue('orphan_loss_reason', profileId, reason.id, `考试或复盘引用无效`))
    }
  }
  for (const mistake of array(source.mistakeRecords)) {
    if (!mistake) continue
    const invalid = mistake.examRecordId && !ids.scoreRecords.has(mistake.examRecordId) ||
      mistake.reviewId && !ids.scoreReviews.has(mistake.reviewId) ||
      array(mistake.linkedTaskIds).some((id) => !ids.learningTasks.has(id))
    if (invalid) issues.push(issue('orphan_mistake_reference', profileId, mistake.id, '错题的考试、复盘或任务引用无效'))
  }
  for (const task of array(source.learningTasks)) {
    if (!task) continue
    const invalid = task.stageGoalId && !ids.stageGoals.has(task.stageGoalId) ||
      task.sourceExamId && !ids.scoreRecords.has(task.sourceExamId) ||
      task.sourceReviewId && !ids.scoreReviews.has(task.sourceReviewId) ||
      task.sourceLossReasonId && !ids.scoreLossReasons.has(task.sourceLossReasonId) ||
      task.sourceMistakeRecordId && !ids.mistakeRecords.has(task.sourceMistakeRecordId)
    if (invalid) issues.push(issue('orphan_learning_task', profileId, task.id, '任务的阶段目标或来源引用无效'))
  }
  for (const plan of array(source.weeklyPlans)) {
    const missing = array(plan && plan.taskItems).filter((id) => !ids.learningTasks.has(id))
    if (missing.length) issues.push(issue('orphan_weekly_plan_task', profileId, plan.id, `缺少任务 ${missing.join('、')}`))
  }
  for (const goal of array(source.stageGoals)) {
    if (!goal || !STAGE_GOAL_METRIC_TYPES.includes(goal.metricType)) {
      issues.push(issue('invalid_stage_goal_metric', profileId, goal && goal.id, `指标 ${goal && goal.metricType || '缺失'} 无效`))
    }
  }
  for (const review of array(source.stageReviews)) {
    const snapshots = review && [
      review.stageGoalSnapshot,
      review.startDataSnapshot,
      review.endDataSnapshot,
      review.taskSummarySnapshot,
      review.examSummarySnapshot
    ]
    if (!review || !ids.stageGoals.has(review.stageGoalId) ||
        !snapshots || snapshots.some((item) => !item || typeof item !== 'object' || Array.isArray(item))) {
      issues.push(issue('corrupt_stage_review', profileId, review && review.id, '阶段目标引用或不可变快照损坏'))
    }
  }
}

function scanSchoolState(profileId, source, context, issues) {
  for (const schoolId of duplicateIds(source.targetRecords, (item) => item && item.schoolId)) {
    issues.push(issue('duplicate_target_school', profileId, schoolId, `目标学校 ${schoolId} 重复`))
  }
  for (const schoolId of duplicateIds(source.favoriteSchoolIds, (item) => item)) {
    issues.push(issue('duplicate_favorite', profileId, schoolId, `收藏 ${schoolId} 重复`))
  }
  for (const target of array(source.targetRecords)) {
    if (target && !context.schoolIds.has(target.schoolId)) {
      issues.push(issue('invalid_school_id', profileId, target.id, `目标学校 ${target.schoolId}`))
    }
  }
  for (const schoolId of array(source.favoriteSchoolIds)) {
    if (!context.schoolIds.has(schoolId)) issues.push(issue('invalid_school_id', profileId, schoolId, `收藏学校 ${schoolId}`))
  }
  for (const state of array(source.schoolUserStates)) {
    const normalized = array(state && state.tags).map((tag) => String(tag).trim()).filter(Boolean)
    if (state && new Set(normalized).size !== normalized.length) {
      issues.push(issue('duplicate_school_tag', profileId, state.id, `学校 ${state.schoolId || '缺失'} 存在重复标签`))
    }
    if (!state || !context.schoolIds.has(state.schoolId)) {
      issues.push(issue('invalid_school_user_state', profileId, state && state.id, `学校 ${state && state.schoolId || '缺失'} 不存在`))
      continue
    }
  }
  const flaggedPrimary = array(source.targetRecords).filter((item) => item && (item.isPrimary || item.primary === true))
  const primaryId = source.primaryTargetSchoolId
  if (flaggedPrimary.length > 1 || primaryId && !array(source.targetRecords).some((item) => item && item.schoolId === primaryId)) {
    issues.push(issue('multiple_primary_target', profileId, primaryId || '', flaggedPrimary.length > 1
      ? `检测到 ${flaggedPrimary.length} 个主要目标标记`
      : `主要目标 ${primaryId} 不在目标学校中`))
  }
  for (const item of array(source.recentViewedSchoolIds)) {
    if (!context.schoolIds.has(item)) issues.push(issue('invalid_recent_reference', profileId, item, `最近浏览学校 ${item} 不存在`))
  }
}

function scanProfileData(profileId, data, context) {
  const issues = []
  const source = object(data)
  if (source.profileId && source.profileId !== profileId) {
    issues.push(issue('profile_data_mismatch', profileId, '', `数据容器归属 ${source.profileId}`))
  }
  if (Number(source.schemaVersion) > STORAGE_SCHEMA_VERSION) {
    issues.push(issue('version_incompatible', profileId, '', `档案容器 Schema v${source.schemaVersion} 高于当前支持版本`))
  }
  scanEntityIdentity(profileId, source, issues)
  const ids = entitySets(source)
  scanScores(profileId, source, ids, context, issues)
  scanLearningReferences(profileId, source, ids, issues)
  scanSchoolState(profileId, source, context, issues)
  return issues
}

function snapshotValues(input) {
  if (!input) return storageSnapshot()
  if (input.ok !== undefined && input.values) return input
  return { ok: true, values: input.values || input }
}

function scanOperationState(raw, issues) {
  const states = object(raw[KEYS.restorePointOperationState])
  const entries = Object.entries(states)
  if (entries.length > 100) {
    issues.push(issue('operation_state_oversize', '', '', `操作状态共 ${entries.length} 条，超过 100 条上限`))
  }
  const forbiddenPayloadKeys = ['payload', 'result', 'backup', 'report', 'profileData', 'restorePoint']
  for (const [operationId, state] of entries) {
    if (byteLength(state) > PRODUCT_RULES.limits.maxOperationStateBytes) {
      issues.push(issue('operation_state_oversize', '', operationId, `操作状态超过 ${PRODUCT_RULES.limits.maxOperationStateBytes} 字节`))
    }
    if (state && forbiddenPayloadKeys.some((key) => Object.prototype.hasOwnProperty.call(state, key))) {
      issues.push(issue('operation_state_payload', '', operationId, '操作状态包含完整结果或数据 payload'))
    }
  }
}

function scanLocalData(input) {
  const snapshot = snapshotValues(input)
  if (!snapshot.ok) return { ok: false, issues: [], message: snapshot.message }
  const raw = snapshot.values
  const profiles = array(raw[KEYS.profiles])
  const profileIds = new Set(profiles.map((item) => item && item.id).filter(Boolean))
  const profileData = object(raw[KEYS.profileData])
  const context = {
    schoolIds: new Set(schools.map((item) => item.id)),
    builtInSchemeIds: new Set(PRODUCT_RULES.builtInScoreSchemes.map((item) => item.id)),
    builtInTemplateIds: new Set(PRODUCT_RULES.builtInExamTemplates.map((item) => item.id))
  }
  const issues = []
  const schemaVersion = Number(raw[KEYS.storageSchemaVersion])
  if (schemaVersion > STORAGE_SCHEMA_VERSION) {
    issues.push(issue('version_incompatible', '', '', `Storage Schema v${schemaVersion} 高于当前支持版本`))
  }
  for (const id of duplicateIds(profiles, (item) => item && item.id)) {
    issues.push(issue('duplicate_entity_id', '', id, `学生档案 ID ${id} 重复`))
  }
  for (const [profileId, data] of Object.entries(profileData)) {
    if (!profileIds.has(profileId)) issues.push(issue('deleted_profile_residue', profileId, '', '档案数据没有对应档案'))
    issues.push(...scanProfileData(profileId, data, context))
  }
  for (const profile of profiles) {
    if (!profile || !profile.id) issues.push(issue('invalid_profile_id', '', '', '档案缺少 ID'))
    if (profile && profile.profileId && profile.profileId !== profile.id) {
      issues.push(issue('profile_data_mismatch', profile.id, profile.id, `档案对象归属 ${profile.profileId}`))
    }
    if (profile && Number(profile.schemaVersion) > STORAGE_SCHEMA_VERSION) {
      issues.push(issue('version_incompatible', profile.id, profile.id, `档案 Schema v${profile.schemaVersion} 高于当前支持版本`))
    }
    if (profile && profile.id && !profileData[profile.id]) {
      issues.push(issue('missing_required_field', profile.id, '', '档案缺少数据容器'))
    }
  }
  if (raw[KEYS.transactionJournal]) issues.push(issue('transaction_temp_residue', '', '', '检测到上次未清理的事务日志'))
  if (raw[KEYS.cleanupPending]) issues.push(issue('cleanup_pending', '', '', '检测到提交成功但尚未清理的临时状态'))
  scanOperationState(raw, issues)
  if (raw[KEYS.importSnapshot] && !object(raw[KEYS.importSnapshot]).capturedAt) {
    issues.push(issue('import_temp_residue', '', '', '导入快照结构异常'))
  }
  if (raw[KEYS.migrationBackup] && !object(raw[KEYS.migrationBackup]).capturedAt) {
    issues.push(issue('migration_temp_residue', '', '', '迁移快照结构异常'))
  }
  for (const point of array(raw[KEYS.restorePointIndex])) {
    if (Number(point && point.restorePointFormatVersion) > PRODUCT_RULES.restorePointFormatVersion ||
        Number(point && point.storageSchemaVersion) > STORAGE_SCHEMA_VERSION ||
        Number(point && point.backupFormatVersion) > PRODUCT_RULES.backupFormatVersion) {
      issues.push(issue('version_incompatible', '', point && point.id, '恢复点版本高于当前支持版本'))
    }
  }
  const clearMarker = raw[KEYS.clearMarker]
  if (clearMarker && !Number.isFinite(Date.parse(clearMarker.clearedAt))) {
    issues.push(issue('clear_marker_invalid', '', '', '清除标记日期异常'))
  }
  const onboarding = object(raw[KEYS.onboardingV4])
  if (onboarding.currentStep !== undefined && (!Number.isInteger(onboarding.currentStep) || onboarding.currentStep < 0)) {
    issues.push(issue('onboarding_invalid', '', '', '教程步骤异常'))
  }
  return {
    ok: true,
    issues,
    total: issues.length,
    autoFixableCount: issues.filter((item) => item.autoFixable).length,
    manualCount: issues.filter((item) => !item.autoFixable).length,
    scannedAt: new Date().toISOString()
  }
}

function repairSafeIssues(options = {}) {
  const operationId = String(options.operationId || options.operationContext && options.operationContext.operationId ||
    `repair_data_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`)
  const safety = createRestorePoint({
    reason: 'before_data_repair',
    profileScope: { type: 'full_user_state' },
    operationId: `${operationId}_safety`
  })
  if (!safety.ok) return safety
  const before = storageSnapshot()
  if (!before.ok) return before
  const report = scanLocalData(before)
  if (!report.ok) return report
  const snapshotResult = writeStorage(KEYS.repairSnapshot, {
    capturedAt: new Date().toISOString(),
    restorePointId: safety.restorePoint && safety.restorePoint.id || '',
    raw: before.values
  })
  if (!snapshotResult.ok) return { ok: false, message: '修复前安全快照创建失败，原数据未修改。' }

  const profileData = clone(object(before.values[KEYS.profileData]))
  const schoolIds = new Set(schools.map((item) => item.id))
  for (const [profileId, rawData] of Object.entries(profileData)) {
    const data = object(rawData)
    data.favoriteSchoolIds = [...new Set(array(data.favoriteSchoolIds))]
    data.recentViewedSchoolIds = array(data.recentViewedSchoolIds)
      .filter((schoolId) => schoolIds.has(schoolId))
      .slice(0, PRODUCT_RULES.recentHistoryLimits.viewedSchools)
    data.schoolUserStates = array(data.schoolUserStates).map((item) => item && typeof item === 'object'
      ? { ...item, tags: [...new Set(array(item.tags).map((tag) => String(tag).trim()).filter(Boolean))] }
      : item)
    for (const field of PROFILE_ENTITY_FIELDS) {
      data[field] = array(data[field]).map((item) => item && typeof item === 'object'
        ? { ...item, profileId: item.profileId || profileId, schemaVersion: STORAGE_SCHEMA_VERSION }
        : item)
    }
    data.schemaVersion = STORAGE_SCHEMA_VERSION
    profileData[profileId] = data
  }
  const result = atomicWrite({
    [KEYS.profileData]: profileData,
    [KEYS.dataRevision]: getDataRevision() + 1
  }, { operationType: 'repair_data', operationId })
  if (!result.ok) return result
  removeStorage(KEYS.transactionJournal)
  const after = scanLocalData()
  return {
    ok: after.ok,
    before: report,
    after,
    restorePointId: safety.restorePoint && safety.restorePoint.id || '',
    snapshotKey: KEYS.repairSnapshot,
    repairedCount: Math.max(0, report.total - after.total)
  }
}

function restoreRepairSnapshot() {
  const snapshot = readStorage(KEYS.repairSnapshot, null)
  if (!snapshot.ok || !snapshot.exists || !snapshot.value || !snapshot.value.raw) {
    return { ok: false, message: '没有可恢复的修复前快照。' }
  }
  const raw = snapshot.value.raw
  const operationId = `restore_repair_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const safety = createRestorePoint({
    reason: 'before_restore',
    profileScope: { type: 'full_user_state' },
    operationId: `${operationId}_safety`,
    note: '恢复数据修复快照前'
  })
  if (!safety.ok) return safety
  const keys = [
    KEYS.profiles,
    KEYS.activeProfileId,
    KEYS.profileData,
    KEYS.sharedFavorites,
    KEYS.onboardingV4,
    KEYS.userSettings,
    KEYS.storageSchemaVersion,
    KEYS.dataRevision
  ].filter((key) => Object.prototype.hasOwnProperty.call(raw, key))
  const result = atomicWrite(Object.fromEntries(keys.map((key) => [key, raw[key]])), {
    operationType: 'restore_repair_snapshot',
    operationId
  })
  return result.ok ? { ok: true, restoredAt: new Date().toISOString() } : result
}

module.exports = {
  ISSUE_LABELS,
  SAFE_REPAIR_TYPES,
  PROFILE_ENTITY_FIELDS,
  scanProfileData,
  scanLocalData,
  repairSafeIssues,
  restoreRepairSnapshot
}
