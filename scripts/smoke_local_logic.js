const assert = require('assert')
const { APP_CONFIG, EXAM_TOTAL_SCORE } = require('../config/app-config')

const originalConsoleError = console.error
const expectedErrorLogs = []
console.error = (...values) => expectedErrorLogs.push(values.join(' '))

const memory = new Map()
let readFailure = false
let writeFailure = false
let removeFailure = false
global.wx = {
  getStorageSync: (key) => {
    if (readFailure) throw new Error('simulated read failure')
    return memory.get(key)
  },
  setStorageSync: (key, value) => {
    if (writeFailure) throw new Error('simulated quota failure')
    memory.set(key, value)
  },
  removeStorageSync: (key) => {
    if (removeFailure) throw new Error('simulated remove failure')
    memory.delete(key)
  }
}

const storage = require('../utils/storage')
const school = require('../utils/school')
const scoreUtils = require('../utils/admission-scores')
const { schools } = require('../data/schools')
const { admissionScores } = require('../data/admission-scores')

function target(id, createdAt = '2026-07-02T00:00:00.000Z') {
  return { id, currentScore: 500, targetScore: 550, note: '复盘数学', createdAt }
}

assert.ok(schools.length >= 50)
assert.ok(Array.isArray(admissionScores))
for (const score of admissionScores) {
  assert.ok([2025, 2026].includes(score.year))
  assert.ok(schools.some((item) => item.id === score.schoolId))
  assert.strictEqual(score.region, '苏州市六区')
  assert.strictEqual(score.scoreType, '录取最低分')
  assert.ok(Number.isInteger(score.minScore))
  assert.ok(score.minScore >= 300 && score.minScore <= EXAM_TOTAL_SCORE)
  assert.notStrictEqual(score.minScore, 600)
  assert.notStrictEqual(score.minScore, 603)
  if (score.year === 2025) assert.strictEqual(score.sourceCheckedAt, '2026-07-06')
  if (score.year === 2026) {
    assert.strictEqual(score.sourceCheckedAt, '2026-07-09')
    assert.strictEqual(score.status, 'verified')
    assert.notStrictEqual(score.sourceType, 'thirdPartyCandidateOnly')
  }
}
assert.strictEqual(admissionScores.filter((score) => score.year === 2025).length, 103)
assert.strictEqual(admissionScores.filter((score) => score.year === 2026).length, 43)

assert.strictEqual(storage.getFavoriteIds().length, 0)
assert.strictEqual(storage.setFavorite('suzhou_high_school', true).ok, true)
assert.strictEqual(storage.isFavorite('suzhou_high_school'), true)
assert.strictEqual(storage.setFavorite('suzhou_high_school', false).ok, true)
assert.strictEqual(storage.isFavorite('suzhou_high_school'), false)
assert.strictEqual(storage.setFavorite('', true).ok, false)
assert.strictEqual(storage.replaceFavoriteIds(['old_id', 'suzhou_high_school']).ok, true)
assert.deepStrictEqual(storage.getFavoriteIds(), ['old_id', 'suzhou_high_school'])

const splitIds = school.splitFavoriteIdsByValidity(storage.getFavoriteIds())
assert.deepStrictEqual(splitIds.valid, ['suzhou_high_school'])
assert.deepStrictEqual(splitIds.invalid, ['old_id'])
assert.strictEqual(storage.replaceFavoriteIds(splitIds.valid).ok, true)
assert.deepStrictEqual(storage.getFavoriteIds(), ['suzhou_high_school'])

assert.strictEqual(storage.saveTargetRecord(target('target_1')).ok, true)
assert.strictEqual(storage.saveTargetRecord(target('target_2', '2026-07-02T01:00:00.000Z')).ok, true)
assert.deepStrictEqual(storage.getTargetRecords().map((item) => item.id), ['target_2', 'target_1'])
for (const item of storage.getTargetRecords()) {
  assert.strictEqual(Object.hasOwn(item, 'schoolId'), false)
  assert.strictEqual(Object.hasOwn(item, 'targetSchool'), false)
  assert.strictEqual(Object.hasOwn(item, 'admissionResult'), false)
  assert.strictEqual(Object.hasOwn(item, 'admissionScore'), false)
}
assert.strictEqual(storage.deleteTargetRecord('target_1').ok, true)
assert.deepStrictEqual(storage.getTargetRecords().map((item) => item.id), ['target_2'])

memory.set(storage.KEYS.targets, [
  {},
  { id: 'broken', currentScore: 500, targetScore: 550, createdAt: 123 },
  { id: 'empty-score', currentScore: '', targetScore: '', createdAt: '2026-07-02T00:00:00.000Z' },
  target('valid')
])
assert.deepStrictEqual(storage.getTargetRecords().map((item) => item.id), ['valid'])

const legacyTarget = target('legacy_above_max')
legacyTarget.targetScore = EXAM_TOTAL_SCORE + 10
memory.set(storage.KEYS.targets, [legacyTarget])
assert.deepStrictEqual(storage.getTargetRecords(), [])
assert.strictEqual(storage.saveTargetRecord(legacyTarget).ok, false)
assert.strictEqual(storage.saveTargetRecord({ ...legacyTarget, targetScore: EXAM_TOTAL_SCORE }).ok, true)

memory.set(storage.KEYS.targets, Array.from({ length: 120 }, (_, index) => target(`record_${index}`, new Date(2026, 6, 2, 0, index).toISOString())))
assert.strictEqual(storage.getTargetRecords().length, APP_CONFIG.targetScore.maxRecords)

writeFailure = true
assert.strictEqual(storage.saveTargetRecord(target('quota_failure')).ok, false)
assert.strictEqual(storage.saveTargetDraft({ currentScore: '500' }).ok, false)
writeFailure = false

readFailure = true
const recordsBeforeReadFailure = memory.get(storage.KEYS.targets)
assert.strictEqual(storage.getTargetRecordsResult().ok, false)
assert.deepStrictEqual(storage.getTargetRecords(), [])
assert.strictEqual(storage.saveTargetRecord(target('must_not_overwrite')).ok, false)
assert.strictEqual(memory.get(storage.KEYS.targets), recordsBeforeReadFailure)
assert.strictEqual(storage.getFavoriteIdsResult().ok, false)
assert.deepStrictEqual(storage.getFavoriteIds(), [])
assert.strictEqual(storage.setFavorite('suzhou_high_school', true).ok, false)
readFailure = false

assert.strictEqual(storage.saveTargetDraft({ currentScore: '500', targetScore: '550', note: '复盘数学' }).ok, true)
assert.strictEqual(storage.getTargetDraft().targetScore, '550')
memory.set(storage.KEYS.targetDraft, [])
assert.deepStrictEqual(storage.getTargetDraft(), {})

removeFailure = true
assert.strictEqual(storage.clearLocalData().ok, false)
removeFailure = false
assert.strictEqual(storage.clearLocalData().ok, true)
assert.strictEqual(storage.getFavoriteIds().length, 0)
assert.strictEqual(storage.getTargetRecords().length, 0)
assert.deepStrictEqual(storage.getTargetDraft(), {})

assert.ok(school.filterSchools({ keyword: '南航苏附' }).some((item) => item.id === 'nuaa_suzhou_affiliated_high_school'))
assert.ok(school.filterSchools({ keyword: '星湖街' }).some((item) => item.id === 'nuaa_suzhou_affiliated_high_school'))
assert.ok(school.filterSchools({ district: '吴江区' }).every((item) => item.district === '吴江区'))
assert.ok(school.filterSchools({ schoolType: '普通高中' }).every((item) => item.schoolType === '普通高中'))
assert.ok(school.filterSchools({ ownership: '民办' }).every((item) => item.ownership === '民办'))
assert.ok(school.uniqueTags().includes('工业园区'))
assert.ok(school.filterSchools({ tag: '工业园区' }).every((item) => item.tags.includes('工业园区')))
assert.ok(school.filterSchools({
  keyword: '苏州',
  district: '工业园区',
  schoolType: '普通高中',
  tag: '工业园区'
}).every((item) => item.district === '工业园区' && item.schoolType === '普通高中' && item.tags.includes('工业园区')))
const scoredSchools = new Set(admissionScores.map((item) => item.schoolId))
assert.strictEqual(school.filterSchools({ scoreStatus: school.SCORE_STATUS_WITH_SCORES }).length, scoredSchools.size)
assert.strictEqual(school.filterSchools({ scoreStatus: school.SCORE_STATUS_WITHOUT_SCORES }).length, schools.length - scoredSchools.size)

const sampleScores = [
  {
    id: 'sample_2025_b',
    schoolId: 'suzhou_high_school',
    year: 2025,
    region: '苏州市区',
    batch: '第一批次',
    admissionType: '统招生',
    scoreType: '录取最低分',
    minScore: 650
  },
  {
    id: 'sample_2024_a',
    schoolId: 'suzhou_high_school',
    year: 2024,
    region: '苏州市区',
    batch: '提前录取批次',
    admissionType: '统招生',
    scoreType: '录取最低分',
    minScore: 645
  }
]
assert.strictEqual(scoreUtils.hasScoresForSchool('suzhou_high_school', sampleScores), true)
assert.strictEqual(scoreUtils.countScoresBySchoolId('suzhou_high_school', sampleScores), 2)
assert.deepStrictEqual(scoreUtils.getScoresBySchoolId('suzhou_high_school', sampleScores).map((item) => item.year), [2025, 2024])
assert.deepStrictEqual(scoreUtils.groupScoresByYear('suzhou_high_school', sampleScores).map((group) => group.year), ['2025', '2024'])

assert.ok(expectedErrorLogs.length >= 7)
console.error = originalConsoleError
console.log('LOCAL LOGIC SMOKE PASSED')
