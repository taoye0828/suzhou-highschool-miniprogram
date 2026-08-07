'use strict'

// Only constants required by the offline runtime and legacy-data compatibility.
const PRODUCT_RULES = Object.freeze({
  productName: '苏程记录',
  officialAppId: 'wxc2a2a94f767438dd',
  storageSchemaVersion: 5,
  backupFormatVersion: 3,
  restorePointFormatVersion: 2,
  appDataVersion: 'v1',
  operationLockTtlMs: 300000,
  examTotalScoreMax: 740,
  scoreRateBasis: 10000,
  recommendation: {
    sprint: { minInclusive: -30, maxExclusive: 0 },
    target: { minInclusive: 0, maxInclusive: 15 },
    safe: { minExclusive: 15, maxInclusive: null },
    limitPerLevel: 5,
    allowedEligibilityRuleIds: ['suzhou_admission_740_v1', 'legacy_740_total']
  },
  examTypes: [
    'weekly_test',
    'unit_test',
    'monthly_exam',
    'midterm_exam',
    'final_exam',
    'mock_exam',
    'custom'
  ],
  builtInExamTemplates: [],
  builtInScoreSchemes: [
    {
      id: 'suzhou_admission_740_v1',
      name: '苏州中考 740 分制',
      metricType: 'full_total',
      subjectRules: [],
      totalMaxScore: 740,
      admissionScaleMax: 740,
      eligibilityRuleId: 'suzhou_admission_740_v1',
      isBuiltIn: true
    }
  ],
  statusEnums: {
    candidateStatus: ['none', 'exploring', 'focused', 'not_considering'],
    stageGoalStatus: ['not_started', 'in_progress', 'completed', 'paused'],
    learningTaskStatus: ['not_started', 'in_progress', 'completed', 'paused'],
    metricType: ['full_total', 'partial_total', 'single_subject']
  },
  limits: {
    maxProfiles: 10,
    maxExamRecordsPerProfile: 100,
    maxTargetRecordsPerProfile: 100,
    maxMistakeRecordsPerProfile: 2000,
    maxLearningTasksPerProfile: 2000,
    maxWeeklyPlansPerProfile: 520,
    maxStageGoalsPerProfile: 500,
    maxStageReviewsPerProfile: 500,
    maxSchoolUserStatesPerProfile: 55,
    maxCustomExamTemplatesPerProfile: 30,
    maxCustomScoreSchemesPerProfile: 30,
    maxBackupFileBytes: 4194304,
    maxImportFileBytes: 4194304,
    maxReportFileBytes: 1048576,
    maxRestorePointPayloadBytes: 524288,
    maxOperationStateBytes: 2048,
    maxLegacyExtensionsBytes: 16384,
    maxJsonDepth: 40,
    maxNoteLength: 1000
  },
  forbiddenObjectKeys: ['__proto__', 'prototype', 'constructor']
})

module.exports = { PRODUCT_RULES }
