const assert = require('assert')
const { dynamicHelpState } = require('../utils/rc10-features')

const empty = dynamicHelpState({
  scoreCount: 0,
  targetCount: 0,
  stageGoalCount: 0,
  learningTaskCount: 0,
  profileCount: 1,
  hasUsedMultipleProfiles: false,
  hasBackup: false,
  healthIssueCount: 0,
  inCompareMode: false
}, {})
assert.strictEqual(empty.id, 'no_scores')
assert.strictEqual(dynamicHelpState({
  scoreCount: 0,
  targetCount: 0,
  stageGoalCount: 0,
  learningTaskCount: 0,
  profileCount: 1,
  hasUsedMultipleProfiles: false,
  hasBackup: false,
  healthIssueCount: 0,
  inCompareMode: false
}, { no_scores: { version: 1 } }).id, 'backup_first')
console.log('RC10 DYNAMIC HELP VERIFY PASSED')
