const assert = require('assert')
const fs = require('fs')
const path = require('path')
const { schools } = require('../data/schools')
const { admissionScores } = require('../data/admission-scores')
const {
  MP13_2026_VERIFIED_COUNT,
  SOURCE_URL_2026_EARLY,
  SOURCE_IMAGE_URL_2026_EARLY,
  SOURCE_TITLE_2026_EARLY,
  SOURCE_CHECKED_AT_2026
} = require('../data/admission-scores-2026')
const { EXAM_TOTAL_SCORE } = require('../config/app-config')

const root = path.resolve(__dirname, '..')
const schoolIds = new Set(schools.map((school) => school.id))
const scores2025 = admissionScores.filter((item) => item.year === 2025)
const scores2026 = admissionScores.filter((item) => item.year === 2026)
const allowedSourceTypes = new Set(['officialWebsite', 'officialWeChat', 'officialImageViaMedia'])
const forbiddenKeys = ['canAdmit', 'admissionChance', 'rankSuggestion', 'safeTarget']
const forbiddenText = ['控制线', '职教高考班', '现代职教', '中职', '高职', '职业学校', '待核实']

assert.strictEqual(schools.length, 55)
assert.strictEqual(scores2025.length, 103)
assert.strictEqual(scores2026.length, MP13_2026_VERIFIED_COUNT)

const dedupe = new Set()
for (const score of scores2026) {
  assert.strictEqual(score.year, 2026)
  assert.strictEqual(score.status, 'verified')
  assert.ok(score.schoolId)
  assert.ok(schoolIds.has(score.schoolId), `${score.id} schoolId cannot be matched`)
  assert.ok(allowedSourceTypes.has(score.sourceType), `${score.id} sourceType invalid`)
  assert.notStrictEqual(score.sourceType, 'thirdPartyCandidateOnly')
  assert.strictEqual(score.sourceType, 'officialImageViaMedia')
  assert.strictEqual(score.sourceTitle, SOURCE_TITLE_2026_EARLY)
  assert.strictEqual(score.sourceUrl, SOURCE_URL_2026_EARLY)
  assert.strictEqual(score.sourceImageUrl, SOURCE_IMAGE_URL_2026_EARLY)
  assert.strictEqual(score.sourceCheckedAt, SOURCE_CHECKED_AT_2026)
  assert.ok(score.sourceTitle)
  assert.ok(score.sourceUrl)
  assert.ok(score.sourceImageUrl)
  assert.ok(Number.isInteger(score.minScore), `${score.id} minScore must be integer`)
  assert.ok(score.minScore > 0 && score.minScore <= EXAM_TOTAL_SCORE, `${score.id} minScore out of range`)
  assert.ok(score.sameScoreMin && Number.isInteger(score.sameScoreMin.chineseMathEnglish))
  const serialized = JSON.stringify(score)
  for (const key of forbiddenKeys) assert.strictEqual(Object.hasOwn(score, key), false, `${score.id} has prediction field ${key}`)
  for (const text of forbiddenText) assert.strictEqual(serialized.includes(text), false, `${score.id} includes forbidden text ${text}`)
  const key = [score.schoolId, score.year, score.batch, score.admissionType, score.minScore, score.sameScoreMin.chineseMathEnglish].join('|')
  assert.strictEqual(dedupe.has(key), false, `${score.id} duplicate record key`)
  dedupe.add(key)
}

const { APP_CONFIG, EXAM_TOTAL_SCORE: CONFIG_TOTAL } = require('../config/app-config')
assert.strictEqual(CONFIG_TOTAL, 740)
assert.strictEqual(APP_CONFIG.targetScore.max, 740)

const visibleAndLogicRoots = ['pages', 'components', 'config', 'utils', 'scripts', 'app.js', 'app.json', 'app.wxss']
const files = []
function walk(target) {
  const full = path.join(root, target)
  if (!fs.existsSync(full)) return
  const stat = fs.statSync(full)
  if (stat.isFile()) files.push(full)
  else {
    for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue
      walk(path.relative(root, path.join(full, entry.name)))
    }
  }
}
visibleAndLogicRoots.forEach(walk)
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8')
  const badMax = String(750)
  const forbiddenNeedles = ['满分 ' + badMax, '满分' + badMax, '总分 ' + badMax, '总分' + badMax, '/' + badMax, '0-' + badMax, '超过 ' + badMax, '超过' + badMax]
  for (const needle of forbiddenNeedles) {
    assert.strictEqual(source.includes(needle), false, `${path.relative(root, file)} contains wrong max-score text`)
  }
}

console.log(`MP13 2026 SCORES VERIFY PASSED: ${scores2026.length}`)
