const assert = require('assert')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const { APP_CONFIG, EXAM_TOTAL_SCORE } = require('../config/app-config')

function walk(relative) {
  const target = path.join(root, relative)
  if (!fs.existsSync(target)) return []
  const stat = fs.statSync(target)
  if (stat.isFile()) return [target]
  return fs.readdirSync(target, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === '.git' || entry.name === 'node_modules') return []
    return walk(path.relative(root, path.join(target, entry.name)))
  })
}

function sha256(relative) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(root, relative))).digest('hex')
}

assert.strictEqual(EXAM_TOTAL_SCORE, 740)
assert.strictEqual(APP_CONFIG.targetScore.max, EXAM_TOTAL_SCORE)

const memory = new Map()
global.wx = {
  getStorageSync: (key) => memory.get(key),
  setStorageSync: (key, value) => memory.set(key, value),
  removeStorageSync: (key) => memory.delete(key)
}
const storage = require('../utils/storage')
assert.strictEqual(storage.ensureStorageMigrated().ok, true)
const baseRecord = {
  id: 'score_max_check',
  date: '2026-07-09',
  examName: '满分边界测试',
  score: EXAM_TOTAL_SCORE,
  createdAt: '2026-07-09T00:00:00.000Z'
}
assert.strictEqual(storage.saveScoreRecord(baseRecord).ok, true)
assert.strictEqual(storage.saveScoreRecord({ ...baseRecord, id: 'above_by_one', score: EXAM_TOTAL_SCORE + 1 }).ok, false)
assert.strictEqual(storage.saveScoreRecord({ ...baseRecord, id: 'old_wrong_max', score: EXAM_TOTAL_SCORE + 10 }).ok, false)

const legacyRecord = { ...baseRecord, id: 'legacy_record', score: EXAM_TOTAL_SCORE + 10 }
assert.strictEqual(storage.saveScoreRecord(legacyRecord).ok, false)
assert.deepStrictEqual(storage.getScoreRecords().map((record) => record.id), ['score_max_check'])

const runtimeFiles = ['pages', 'components', 'config', 'utils', 'app.js', 'app.json', 'app.wxss']
  .flatMap(walk)
  .filter((file) => fs.statSync(file).isFile())
for (const file of runtimeFiles) {
  assert.strictEqual(fs.readFileSync(file, 'utf8').includes('750'), false, `${path.relative(root, file)} 仍包含错误满分`)
}

const visibleAndLogicFiles = ['pages', 'components', 'config', 'utils', 'scripts', 'app.js', 'app.json', 'app.wxss']
  .flatMap(walk)
  .filter((file) => fs.statSync(file).isFile())
const forbiddenPatterns = [
  /(满分|总分)\s*7[5]0/,
  /0\s*[-至]\s*7[5]0/,
  /\/\s*7[5]0/,
  /超过\s*7[5]0/,
  /(?:denominator|max|scoreMax|scoreLimit)\s*[:=]\s*7[5]0/
]
for (const file of visibleAndLogicFiles) {
  const source = fs.readFileSync(file, 'utf8')
  for (const pattern of forbiddenPatterns) {
    assert.strictEqual(pattern.test(source), false, `${path.relative(root, file)} 命中错误满分模式 ${pattern}`)
  }
}

const { schools } = require('../data/schools')
const { admissionScores } = require('../data/admission-scores')
const { MP13_2026_VERIFIED_COUNT } = require('../data/admission-scores-2026')
assert.strictEqual(schools.length, 55)
assert.strictEqual(admissionScores.length, 103 + MP13_2026_VERIFIED_COUNT)
assert.strictEqual(admissionScores.filter((item) => item.year === 2025).length, 103)
assert.strictEqual(admissionScores.filter((item) => item.year === 2026).length, MP13_2026_VERIFIED_COUNT)
assert.strictEqual(sha256('data/schools.js'), 'c185182c8dd8577b3165278c16014dbff98249585cf76bd1182b6ea1581d62f2')

const projectConfig = JSON.parse(fs.readFileSync(path.join(root, 'project.config.json'), 'utf8'))
assert.strictEqual(projectConfig.appid, 'wxc2a2a94f767438dd')

console.log('SCORE MAX 740 VERIFY PASSED')
