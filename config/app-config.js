const { PRODUCT_RULES } = require('../utils/runtime-constants')

const EXAM_TOTAL_SCORE = PRODUCT_RULES.examTotalScoreMax
const DEFAULT_EXAM_YEAR = 2027
const SOURCE_CHECKED_AT = '2026-07-09'

const APP_CONFIG = Object.freeze({
  name: PRODUCT_RULES.productName,
  storageSchemaVersion: PRODUCT_RULES.storageSchemaVersion,
  backupFormatVersion: PRODUCT_RULES.backupFormatVersion,
  restorePointFormatVersion: PRODUCT_RULES.restorePointFormatVersion,
  targetScore: {
    min: 0,
    max: EXAM_TOTAL_SCORE,
    maxLength: String(EXAM_TOTAL_SCORE).length,
    maxRecords: PRODUCT_RULES.limits.maxTargetRecordsPerProfile
  },
  scoreRecord: {
    maxRecords: PRODUCT_RULES.limits.maxExamRecordsPerProfile,
    examNameMaxLength: 40
  },
  learningTarget: {
    maxRecords: PRODUCT_RULES.limits.maxStageGoalsPerProfile
  },
  countdown: {
    defaultYear: DEFAULT_EXAM_YEAR,
    examMonth: 6,
    examDay: 17,
    minYear: 2020,
    maxYear: 2100
  },
  schoolData: {
    version: SOURCE_CHECKED_AT,
    sourceCheckedAt: SOURCE_CHECKED_AT
  }
})

module.exports = { APP_CONFIG, EXAM_TOTAL_SCORE, DEFAULT_EXAM_YEAR }
