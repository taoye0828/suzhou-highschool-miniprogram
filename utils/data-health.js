const { schools } = require('../data/schools')
const {
  STORAGE_SCHEMA_VERSION,
  clone,
  validDate
} = require('./rc9-models')
const {
  KEYS,
  readStorage,
  writeStorage,
  removeStorage,
  storageSnapshot,
  atomicWrite,
  getDataRevision
} = require('./storage')
const { createRestorePoint } = require('./storage')

const ISSUE_LABELS = {
  duplicate_score_id: '重复成绩 ID',
  duplicate_target_school: '重复目标学校',
  duplicate_learning_task: '重复学习任务',
  invalid_school_id: '无效 schoolId',
  invalid_profile_id: '无效 profileId',
  total_score_out_of_range: '总分超出 0—740',
  subject_score_out_of_range: '单科成绩超出范围',
  invalid_date: '日期格式错误',
  missing_required_field: '缺少必要字段',
  deleted_profile_residue: '已删除档案残留',
  orphan_review: '孤立考试复盘',
  orphan_loss_reason: '孤立失分原因',
  orphan_learning_task: '孤立学习任务来源',
  orphan_stage_goal_reference: '孤立阶段目标引用',
  old_schema_field: '旧 Schema 字段',
  onboarding_invalid: '教程状态异常',
  invalid_recent_reference: '最近操作无效引用',
  import_temp_residue: '导入临时数据残留',
  migration_temp_residue: '迁移临时数据残留',
  transaction_temp_residue: '事务临时数据残留',
  duplicate_favorite: '重复收藏',
  profile_data_mismatch: '多档案数据串档',
  clear_marker_invalid: '清除标记异常'
}

const SAFE_REPAIR_TYPES = new Set([
  'duplicate_favorite',
  'old_schema_field',
  'invalid_recent_reference',
  'transaction_temp_residue'
])

function array(value) {
  return Array.isArray(value) ? value : []
}

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
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
    label: ISSUE_LABELS[type],
    profileId: profileId || '',
    recordId: recordId || '',
    detail,
    autoFixable: SAFE_REPAIR_TYPES.has(type)
  }
}

function scanProfileData(profileId, data, context) {
  const issues = []
  const source = object(data)
  const scores = array(source.scoreRecords)
  const reviews = array(source.scoreReviews)
  const reasons = array(source.scoreLossReasons)
  const targets = array(source.targetRecords)
  const goals = array(source.stageGoals)
  const tasks = array(source.learningTasks)
  const scoreIds = new Set(scores.map((item) => item && item.id).filter(Boolean))
  const reviewIds = new Set(reviews.map((item) => item && item.id).filter(Boolean))
  const goalIds = new Set(goals.map((item) => item && item.id).filter(Boolean))

  for (const id of duplicateIds(scores, (item) => item && item.id)) {
    issues.push(issue('duplicate_score_id', profileId, id, `成绩 ID ${id} 重复`))
  }
  for (const id of duplicateIds(tasks, (item) => item && item.id)) {
    issues.push(issue('duplicate_learning_task', profileId, id, `学习任务 ID ${id} 重复`))
  }
  for (const schoolId of duplicateIds(targets, (item) => item && item.schoolId)) {
    issues.push(issue('duplicate_target_school', profileId, schoolId, `目标学校 ${schoolId} 重复`))
  }
  for (const schoolId of duplicateIds(source.favoriteSchoolIds, (item) => item)) {
    issues.push(issue('duplicate_favorite', profileId, schoolId, `收藏 ${schoolId} 重复`))
  }

  for (const record of scores) {
    if (!record || !record.id || !record.examName) {
      issues.push(issue('missing_required_field', profileId, record && record.id, '成绩缺少 ID 或考试名称'))
      continue
    }
    if (record.profileId && record.profileId !== profileId) {
      issues.push(issue('profile_data_mismatch', profileId, record.id, '成绩归属其他档案'))
    }
    const total = Number(record.totalScore === undefined ? record.score : record.totalScore)
    if (!Number.isFinite(total) || total < 0 || total > 740) {
      issues.push(issue('total_score_out_of_range', profileId, record.id, `总分 ${record.totalScore}`))
    }
    if (!validDate(record.examDate || record.date)) {
      issues.push(issue('invalid_date', profileId, record.id, `考试日期 ${record.examDate || record.date || '缺失'}`))
    }
    for (const subject of array(record.subjectScores)) {
      const score = Number(subject && subject.score)
      const max = Number(subject && subject.maxScore)
      if (!Number.isFinite(score) || !Number.isFinite(max) || score < 0 || score > max) {
        issues.push(issue('subject_score_out_of_range', profileId, record.id, `${subject && subject.subjectName || '学科'}成绩异常`))
      }
    }
    if (record.schemaVersion !== STORAGE_SCHEMA_VERSION) {
      issues.push(issue('old_schema_field', profileId, record.id, '成绩 Schema 版本可安全补齐'))
    }
  }

  for (const target of targets) {
    if (target && !context.schoolIds.has(target.schoolId)) {
      issues.push(issue('invalid_school_id', profileId, target.id, `目标学校 ${target.schoolId}`))
    }
    if (target && target.profileId && target.profileId !== profileId) {
      issues.push(issue('profile_data_mismatch', profileId, target.id, '目标学校归属其他档案'))
    }
  }
  for (const schoolId of array(source.favoriteSchoolIds)) {
    if (!context.schoolIds.has(schoolId)) {
      issues.push(issue('invalid_school_id', profileId, schoolId, `收藏学校 ${schoolId}`))
    }
  }
  for (const review of reviews) {
    if (review && !scoreIds.has(review.examRecordId)) {
      issues.push(issue('orphan_review', profileId, review.id, `关联考试 ${review.examRecordId} 不存在`))
    }
  }
  for (const reason of reasons) {
    if (reason && !scoreIds.has(reason.examRecordId)) {
      issues.push(issue('orphan_loss_reason', profileId, reason.id, `关联考试 ${reason.examRecordId} 不存在`))
    }
  }
  for (const task of tasks) {
    if (task && task.stageGoalId && !goalIds.has(task.stageGoalId)) {
      issues.push(issue('orphan_stage_goal_reference', profileId, task.id, `阶段目标 ${task.stageGoalId} 不存在`))
    }
    if (task && task.sourceReviewId && !reviewIds.has(task.sourceReviewId)) {
      issues.push(issue('orphan_learning_task', profileId, task.id, '来源复盘已不存在，任务本身将保留'))
    }
  }
  for (const item of array(source.recentViewedSchoolIds)) {
    if (!context.schoolIds.has(item)) {
      issues.push(issue('invalid_recent_reference', profileId, item, `最近浏览学校 ${item} 不存在`))
    }
  }
  return issues
}

function scanLocalData() {
  const snapshot = storageSnapshot()
  if (!snapshot.ok) return { ok: false, issues: [], message: snapshot.message }
  const raw = snapshot.values
  const profiles = array(raw[KEYS.profiles])
  const profileIds = new Set(profiles.map((item) => item && item.id).filter(Boolean))
  const profileData = object(raw[KEYS.profileData])
  const context = { schoolIds: new Set(schools.map((item) => item.id)) }
  const issues = []
  for (const [profileId, data] of Object.entries(profileData)) {
    if (!profileIds.has(profileId)) {
      issues.push(issue('deleted_profile_residue', profileId, '', '档案数据没有对应档案'))
    }
    issues.push(...scanProfileData(profileId, data, context))
  }
  for (const profile of profiles) {
    if (!profile || !profile.id) issues.push(issue('invalid_profile_id', '', '', '档案缺少 ID'))
    if (profile && profile.id && !profileData[profile.id]) {
      issues.push(issue('missing_required_field', profile.id, '', '档案缺少数据容器'))
    }
  }
  if (raw[KEYS.transactionJournal]) {
    issues.push(issue('transaction_temp_residue', '', '', '检测到上次未清理的事务日志'))
  }
  if (raw[KEYS.importSnapshot] && !object(raw[KEYS.importSnapshot]).capturedAt) {
    issues.push(issue('import_temp_residue', '', '', '导入快照结构异常'))
  }
  if (raw[KEYS.migrationBackup] && !object(raw[KEYS.migrationBackup]).capturedAt) {
    issues.push(issue('migration_temp_residue', '', '', '迁移快照结构异常'))
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

function repairSafeIssues() {
  const safety = createRestorePoint({
    reason: 'before_data_repair',
    profileScope: { type: 'full_user_state' },
    operationId: `repair_${Date.now()}_safety`
  })
  if (!safety.ok) return safety
  const before = storageSnapshot()
  if (!before.ok) return before
  const report = scanLocalData()
  if (!report.ok) return report
  const snapshotResult = writeStorage(KEYS.repairSnapshot, {
    capturedAt: new Date().toISOString(),
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
      .slice(0, 20)
    for (const field of ['scoreRecords', 'scoreReviews', 'scoreLossReasons', 'targetRecords', 'stageGoals', 'learningTasks']) {
      data[field] = array(data[field]).map((item) =>
        item && typeof item === 'object'
          ? { ...item, profileId: item.profileId || profileId, schemaVersion: STORAGE_SCHEMA_VERSION }
          : item
      )
    }
    data.schemaVersion = STORAGE_SCHEMA_VERSION
    profileData[profileId] = data
  }
  const result = atomicWrite({
    [KEYS.profileData]: profileData,
    [KEYS.dataRevision]: getDataRevision() + 1
  })
  if (!result.ok) return result
  removeStorage(KEYS.transactionJournal)
  const after = scanLocalData()
  return {
    ok: after.ok,
    before: report,
    after,
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
  return result.ok
    ? { ok: true, restoredAt: new Date().toISOString() }
    : result
}

module.exports = {
  ISSUE_LABELS,
  SAFE_REPAIR_TYPES,
  scanLocalData,
  repairSafeIssues,
  restoreRepairSnapshot
}
