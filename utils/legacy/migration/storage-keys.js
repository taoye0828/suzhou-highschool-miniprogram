// RC11-1: legacy keys are migration/clear inputs only.
// Formal pages and services must never write these keys again.
const LEGACY_STORAGE_KEYS = Object.freeze({
  favorites: 'mp1.favorite_school_ids',
  targets: 'mp1.target_records',
  targetDraft: 'mp1.target_draft',
  learningTargets: 'rc8.learning_target_records.v1',
  scoreRecords: 'mp1.score_records',
  examYear: 'mp1.exam_year',
  onboarding: 'rc8.onboarding.v1'
})

module.exports = { LEGACY_STORAGE_KEYS }
