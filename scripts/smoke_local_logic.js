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
const scoreAnalysis = require('../utils/score-analysis')
const countdown = require('../utils/countdown')
const externalLink = require('../utils/external-link')
const { schools } = require('../data/schools')
const { admissionScores } = require('../data/admission-scores')

assert.strictEqual(storage.ensureStorageMigrated().ok, true)

assert.ok(externalLink.externalLinkRoute('https://www.suzhou.gov.cn/example').startsWith('/pages/web-view/web-view?url='))
assert.strictEqual(externalLink.externalLinkRoute('http://example.com'), '')
assert.strictEqual(externalLink.externalLinkRoute('javascript:alert(1)'), '')

function target(schoolId, schoolName, level = 'target', createdAt = '2026-07-02T00:00:00.000Z') {
  return {
    id: `target_${schoolId}`,
    schoolId,
    schoolName,
    level,
    createdAt
  }
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

assert.strictEqual(storage.saveTargetRecord(target('school_a', '学校A', 'sprint')).ok, true)
assert.strictEqual(storage.saveTargetRecord(target('school_b', '学校B', 'target', '2026-07-02T01:00:00.000Z')).ok, true)
assert.deepStrictEqual(storage.getTargetRecords().map((item) => item.schoolId), ['school_b', 'school_a'])
assert.deepStrictEqual(storage.getTargetRecords().map((item) => item.level), ['target', 'sprint'])
for (const item of storage.getTargetRecords()) {
  assert.ok(item.schoolId)
  assert.ok(item.schoolName)
  assert.ok(item.level)
  assert.strictEqual(item.schemaVersion, storage.STORAGE_SCHEMA_VERSION)
}
assert.strictEqual(storage.saveTargetRecord(target('school_a', '学校A', 'safe', '2026-07-02T02:00:00.000Z')).ok, true)
assert.strictEqual(storage.getTargetRecords().filter((item) => item.schoolId === 'school_a').length, 1)
assert.strictEqual(storage.getTargetRecords().find((item) => item.schoolId === 'school_a').level, 'safe')
assert.strictEqual(storage.deleteTargetRecord('target_school_a').ok, true)
assert.deepStrictEqual(storage.getTargetRecords().map((item) => item.schoolId), ['school_b'])

for (const record of [
  {},
  { schoolId: '', schoolName: '无标识学校' },
  { schoolId: 'missing_name', schoolName: '' },
  { id: 'old_generic', currentScore: 500, targetScore: 550, createdAt: '2026-07-02T00:00:00.000Z' }
]) {
  assert.strictEqual(storage.saveTargetRecord(record).ok, false)
}

assert.strictEqual(storage.clearTargetRecords().ok, true)
for (const record of Array.from({ length: 120 }, (_, index) => target(
  `school_${index}`,
  `学校${index}`,
  'target',
  new Date(2026, 6, 2, 0, index).toISOString()
))) assert.strictEqual(storage.saveTargetRecord(record).ok, true)
assert.strictEqual(storage.getTargetRecords().length, APP_CONFIG.targetScore.maxRecords)

writeFailure = true
assert.strictEqual(storage.saveTargetRecord(target('quota_failure', '写入失败学校')).ok, false)
assert.strictEqual(storage.saveTargetDraft({ currentScore: '500' }).ok, false)
writeFailure = false

readFailure = true
const recordsBeforeReadFailure = memory.get(storage.KEYS.profileData)
assert.strictEqual(storage.getTargetRecordsResult().ok, false)
assert.deepStrictEqual(storage.getTargetRecords(), [])
assert.strictEqual(storage.saveTargetRecord(target('must_not_overwrite', '不得覆盖学校')).ok, false)
assert.strictEqual(memory.get(storage.KEYS.profileData), recordsBeforeReadFailure)
assert.strictEqual(storage.getFavoriteIdsResult().ok, false)
assert.deepStrictEqual(storage.getFavoriteIds(), [])
assert.strictEqual(storage.setFavorite('suzhou_high_school', true).ok, false)
readFailure = false

assert.strictEqual(storage.saveTargetDraft({
  currentScore: '500',
  targetScore: '550',
  targetLevel: 'sprint',
  note: '复盘数学'
}).ok, true)
assert.strictEqual(storage.getTargetDraft().targetScore, '550')
assert.strictEqual(storage.getTargetDraft().targetLevel, 'sprint')
assert.strictEqual(storage.clearTargetDraft().ok, true)
assert.deepStrictEqual(storage.getTargetDraft(), {})

const firstScoreRecord = {
  id: 'score_1',
  date: '2026-09-15',
  examName: '  九月月考  ',
  score: 650,
  createdAt: '2026-09-15T08:00:00.000Z'
}
const secondScoreRecord = {
  id: 'score_2',
  date: '2026-10-20',
  examName: '期中考试',
  score: 670,
  createdAt: '2026-10-20T08:00:00.000Z'
}
assert.strictEqual(storage.saveScoreRecord(secondScoreRecord).ok, true)
assert.strictEqual(storage.saveScoreRecord(firstScoreRecord).ok, true)
assert.deepStrictEqual(storage.getScoreRecords().map((item) => item.id), ['score_1', 'score_2'])
assert.strictEqual(storage.getScoreRecords()[0].examName, '九月月考')
assert.strictEqual(storage.saveScoreRecord({ ...firstScoreRecord, id: 'over', score: EXAM_TOTAL_SCORE + 1 }).ok, false)
assert.strictEqual(storage.saveScoreRecord({ ...firstScoreRecord, id: 'bad-date', date: '2026-02-30' }).ok, false)
assert.strictEqual(storage.deleteScoreRecord('score_1').ok, true)
assert.deepStrictEqual(storage.getScoreRecords().map((item) => item.id), ['score_2'])

assert.strictEqual(storage.getExamYear(), APP_CONFIG.countdown.defaultYear)
assert.strictEqual(storage.saveExamYear(2028).ok, true)
assert.strictEqual(storage.getExamYear(), 2028)
assert.strictEqual(storage.saveExamYear(2101).ok, false)

const countdownResult = countdown.calculateExamCountdown(2027, new Date(2026, 6, 25))
assert.strictEqual(countdownResult.targetDate, '2027-06-17')
assert.strictEqual(countdownResult.daysRemaining, 327)
assert.ok(countdown.examYearOptions(2027, new Date(2026, 6, 25)).includes(2029))

assert.strictEqual(scoreAnalysis.classifyDifference(-31), null)
assert.strictEqual(scoreAnalysis.classifyDifference(-30), 'sprint')
assert.strictEqual(scoreAnalysis.classifyDifference(0), 'target')
assert.strictEqual(scoreAnalysis.classifyDifference(15), 'target')
assert.strictEqual(scoreAnalysis.classifyDifference(16), 'safe')
const analysisResults = scoreAnalysis.analyzeScore({
  userScore: 650,
  targetYear: 2027,
  schools: [
    { id: 'challenge', name: '冲刺高中' },
    { id: 'match', name: '匹配高中' },
    { id: 'safe', name: '稳妥高中' }
  ],
  scores: [
    { id: 'challenge_old', schoolId: 'challenge', year: 2025, minScore: 690 },
    { id: 'challenge_latest_low', schoolId: 'challenge', year: 2026, minScore: 675 },
    { id: 'challenge_latest_high', schoolId: 'challenge', year: 2026, minScore: 680 },
    { id: 'match', schoolId: 'match', year: 2026, minScore: 650 },
    { id: 'safe', schoolId: 'safe', year: 2026, minScore: 620 }
  ]
})
assert.deepStrictEqual(analysisResults.map((item) => item.level), ['sprint', 'target', 'safe'])
assert.strictEqual(analysisResults[0].schoolScore, 680)

removeFailure = true
assert.strictEqual(storage.clearLocalData().ok, false)
removeFailure = false
assert.strictEqual(storage.clearLocalData().ok, true)
assert.strictEqual(storage.getFavoriteIds().length, 0)
assert.strictEqual(storage.getTargetRecords().length, 0)
assert.deepStrictEqual(storage.getTargetDraft(), {})
assert.strictEqual(storage.getScoreRecords().length, 0)
assert.strictEqual(storage.getExamYear(), APP_CONFIG.countdown.defaultYear)

assert.ok(school.filterSchools({ keyword: '南航苏附' }).some((item) => item.id === 'nuaa_suzhou_affiliated_high_school'))
assert.strictEqual(school.filterSchools({ keyword: '' }).length, schools.length)
assert.strictEqual(school.filterSchools({ keyword: '   ' }).length, schools.length)
assert.ok(school.filterSchools({ keyword: '  南航苏附  ' }).some((item) => item.id === 'nuaa_suzhou_affiliated_high_school'))
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
    id: 'sample_2025_c',
    schoolId: 'suzhou_high_school',
    year: 2025,
    region: '苏州市区',
    batch: '第一批次',
    admissionType: '项目招生',
    scoreType: '录取最低分',
    minScore: 648
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
assert.strictEqual(scoreUtils.countScoresBySchoolId('suzhou_high_school', sampleScores), 3)
assert.deepStrictEqual(scoreUtils.getScoresBySchoolId('suzhou_high_school', sampleScores).map((item) => item.year), [2025, 2025, 2024])
assert.deepStrictEqual(scoreUtils.groupScoresByYear('suzhou_high_school', sampleScores).map((group) => group.year), ['2025', '2024'])
assert.strictEqual(scoreUtils.groupScoresByYear('suzhou_high_school', sampleScores)[0].items.length, 2)

assert.ok(expectedErrorLogs.length >= 7)
console.error = originalConsoleError
console.log('LOCAL LOGIC SMOKE PASSED')
