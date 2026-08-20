'use strict'

// Generated from shared-spec/product_rules_v1.json. Do not edit by hand.
const PRODUCT_RULES = Object.freeze({
  "productVersion": "1.0.0",
  "productName": "学程记录",
  "officialAppId": "wxc2a2a94f767438dd",
  "releaseStatus": "V1 功能冻结版",
  "productStage": "pre_release_ux_freeze",
  "featureFreezeVersion": 1,
  "storageSchemaVersion": 5,
  "backupFormatVersion": 3,
  "restorePointFormatVersion": 2,
  "appDataVersion": "v1",
  "operationLockTtlMs": 300000,
  "examTotalScoreMax": 740,
  "recommendation": {
    "differenceFormula": "userScore-referenceScore",
    "sprint": {
      "minInclusive": -30,
      "maxExclusive": 0
    },
    "target": {
      "minInclusive": 0,
      "maxInclusive": 15
    },
    "safe": {
      "minExclusive": 15,
      "maxInclusive": null
    },
    "limitPerLevel": 5,
    "referenceYearRule": "latest_not_after_exam_year",
    "allowedEligibilityRuleIds": [
      "suzhou_admission_740_v1",
      "legacy_740_total"
    ]
  },
  "examTypes": [
    "weekly_test",
    "unit_test",
    "monthly_exam",
    "midterm_exam",
    "final_exam",
    "mock_exam",
    "custom"
  ],
  "builtInExamTemplates": [
    {
      "id": "builtin_monthly_exam_v1",
      "name": "月考",
      "examType": "monthly_exam",
      "defaultExamName": "月考",
      "scoreSchemeId": "suzhou_admission_740_v1",
      "enableSubjectScores": true,
      "enableRank": true,
      "enableReview": true,
      "displayOrder": 10,
      "isBuiltIn": true
    },
    {
      "id": "builtin_midterm_exam_v1",
      "name": "期中考试",
      "examType": "midterm_exam",
      "defaultExamName": "期中考试",
      "scoreSchemeId": "suzhou_admission_740_v1",
      "enableSubjectScores": true,
      "enableRank": true,
      "enableReview": true,
      "displayOrder": 20,
      "isBuiltIn": true
    },
    {
      "id": "builtin_final_exam_v1",
      "name": "期末考试",
      "examType": "final_exam",
      "defaultExamName": "期末考试",
      "scoreSchemeId": "suzhou_admission_740_v1",
      "enableSubjectScores": true,
      "enableRank": true,
      "enableReview": true,
      "displayOrder": 30,
      "isBuiltIn": true
    },
    {
      "id": "builtin_mock_exam_v1",
      "name": "模拟考试",
      "examType": "mock_exam",
      "defaultExamName": "模拟考试",
      "scoreSchemeId": "suzhou_admission_740_v1",
      "enableSubjectScores": true,
      "enableRank": true,
      "enableReview": true,
      "displayOrder": 40,
      "isBuiltIn": true
    }
  ],
  "builtInScoreSchemes": [
    {
      "id": "suzhou_admission_740_v1",
      "name": "苏州中考 740 分制",
      "metricType": "full_total",
      "subjectRules": [
        {
          "subjectId": "chinese",
          "subjectName": "语文",
          "maxScore": 130
        },
        {
          "subjectId": "mathematics",
          "subjectName": "数学",
          "maxScore": 130
        },
        {
          "subjectId": "english",
          "subjectName": "英语",
          "maxScore": 130
        },
        {
          "subjectId": "physics",
          "subjectName": "物理",
          "maxScore": 100
        },
        {
          "subjectId": "chemistry",
          "subjectName": "化学",
          "maxScore": 100
        },
        {
          "subjectId": "history",
          "subjectName": "历史",
          "maxScore": 50
        },
        {
          "subjectId": "morality",
          "subjectName": "道德与法治",
          "maxScore": 50
        },
        {
          "subjectId": "physical_education",
          "subjectName": "体育",
          "maxScore": 50
        }
      ],
      "totalMaxScore": 740,
      "admissionScaleMax": 740,
      "eligibilityRuleId": "suzhou_admission_740_v1",
      "isBuiltIn": true
    }
  ],
  "scoreRateBasis": 10000,
  "statusEnums": {
    "candidateStatus": [
      "none",
      "exploring",
      "focused",
      "not_considering"
    ],
    "stageGoalStatus": [
      "not_started",
      "in_progress",
      "completed",
      "paused"
    ],
    "learningTaskStatus": [
      "not_started",
      "in_progress",
      "completed",
      "paused"
    ],
    "metricType": [
      "full_total",
      "partial_total",
      "single_subject"
    ]
  },
  "recentHistoryLimits": {
    "viewedSchools": 20,
    "schoolFilters": 10,
    "schoolComparisons": 5,
    "editedExams": 10,
    "viewedTargets": 10,
    "usedProfiles": 5,
    "trendRecords": 10
  },
  "limits": {
    "maxProfiles": 10,
    "maxExamRecordsPerProfile": 100,
    "maxTargetRecordsPerProfile": 100,
    "maxMistakeRecordsPerProfile": 2000,
    "maxLearningTasksPerProfile": 2000,
    "maxWeeklyPlansPerProfile": 520,
    "maxStageGoalsPerProfile": 500,
    "maxStageReviewsPerProfile": 500,
    "maxSchoolUserStatesPerProfile": 55,
    "maxCustomExamTemplatesPerProfile": 30,
    "maxCustomScoreSchemesPerProfile": 30,
    "maxBackupFileBytes": 4194304,
    "maxImportFileBytes": 4194304,
    "maxReportFileBytes": 1048576,
    "maxRestorePointPayloadBytes": 524288,
    "maxOperationStateBytes": 2048,
    "maxLegacyExtensionsBytes": 16384,
    "maxJsonDepth": 40,
    "maxNoteLength": 1000
  },
  "performanceBudgetsMs": {
    "searchMedian": 80,
    "searchMax": 200,
    "reportMedian": 300,
    "reportMax": 1000,
    "backupMedian": 1000,
    "backupMax": 3000,
    "healthMedian": 1500,
    "healthMax": 4000
  },
  "maxSetDataPayloadBytes": 204800,
  "forbiddenObjectKeys": [
    "__proto__",
    "prototype",
    "constructor"
  ],
  "errorCodes": [
    "VERSION_UNSUPPORTED",
    "CHECKSUM_MISMATCH",
    "FILE_TOO_LARGE",
    "JSON_DEPTH_EXCEEDED",
    "ENTITY_LIMIT_EXCEEDED",
    "DANGEROUS_OBJECT_KEY",
    "REFERENCE_INVALID",
    "VERSION_CONFLICT",
    "STARTUP_RECOVERY_REQUIRED"
  ]
})

module.exports = { PRODUCT_RULES }
