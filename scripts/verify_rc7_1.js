const assert = require('assert')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const { schools } = require('../data/schools')
const { admissionScores } = require('../data/admission-scores')
const {
  normalizeSearchText,
  splitKeyword,
  searchSchools
} = require('../utils/school-search')
const {
  analyzeScore,
  referenceForSchool
} = require('../utils/score-analysis')
const { EXAM_TOTAL_SCORE } = require('../config/app-config')

function read(relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8')
}

function sha256(relative) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(root, relative))).digest('hex')
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name)
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'miniprogram_npm') {
      return []
    }
    return entry.isDirectory() ? walk(full) : [full]
  })
}

assert.strictEqual(normalizeSearchText(' 苏 州 中 学 '), '苏州中学')
assert.deepStrictEqual(splitKeyword(' A b C '), ['a', 'b', 'c'])

const nuaaResults = searchSchools({ keyword: '南航' })
assert.strictEqual(nuaaResults[0].id, 'nuaa_suzhou_affiliated_high_school')
assert.strictEqual(nuaaResults[0].name, '南京航空航天大学苏州附属中学')

const no10Results = searchSchools({ keyword: '十中' })
assert.ok(no10Results.some((school) => school.id === 'suzhou_no10_high_school'))

const spacedResults = searchSchools({ keyword: '苏 州 中 学' })
assert.ok(spacedResults.some((school) => school.id === 'suzhou_high_school'))

const sipResults = searchSchools({ keyword: '园区' })
assert.ok(sipResults.filter((school) => school.district === '工业园区').length >= 5)
assert.deepStrictEqual(searchSchools({ keyword: '不存在学校xyz' }), [])

const ranked = searchSchools({
  keyword: 'abc',
  schools: [
    { id: 'dispersed', name: 'C校B校A校', aliases: [] },
    { id: 'ordered', name: 'A校B校C校', aliases: [] },
    { id: 'alias', name: '别名学校', aliases: ['ABC附中'] },
    { id: 'name', name: 'ABC学校', aliases: [] }
  ]
})
assert.deepStrictEqual(ranked.map((school) => school.id), ['name', 'alias', 'ordered', 'dispersed'])

const memory = new Map()
global.wx = {
  getStorageSync: (key) => memory.get(key),
  setStorageSync: (key, value) => memory.set(key, value),
  removeStorageSync: (key) => memory.delete(key)
}

const storage = require('../utils/storage')
const targetCases = [
  ['suzhou_high_school', '江苏省苏州中学校', 'sprint'],
  ['suzhou_high_school_sip', '江苏省苏州中学园区校', 'target'],
  ['suzhou_no10_high_school', '江苏省苏州第十中学校', 'safe']
]
targetCases.forEach(([schoolId, schoolName, level], index) => {
  const result = storage.saveTargetRecord({
    id: `target_${schoolId}`,
    schoolId,
    schoolName,
    level,
    createdAt: `2026-07-26T00:00:0${index}.000Z`
  })
  assert.strictEqual(result.ok, true)
})
assert.deepStrictEqual(
  new Set(storage.getTargetRecords().map((record) => record.level)),
  new Set(['sprint', 'target', 'safe'])
)

const updateResult = storage.saveTargetRecord({
  ...storage.getTargetRecords().find((record) => record.schoolId === 'suzhou_high_school_sip'),
  level: 'sprint'
})
assert.strictEqual(updateResult.ok, true)
assert.strictEqual(
  storage.getTargetRecords().find((record) => record.schoolId === 'suzhou_high_school_sip').level,
  'sprint'
)

const deleteTarget = storage.getTargetRecords().find(
  (record) => record.schoolId === 'suzhou_no10_high_school'
)
assert.strictEqual(storage.deleteTargetRecord(deleteTarget.id).ok, true)
assert.strictEqual(
  storage.getTargetRecords().some((record) => record.schoolId === 'suzhou_no10_high_school'),
  false
)
assert.strictEqual(storage.getTargetRecords().length, 2)

const nuaaReference = referenceForSchool('nuaa_suzhou_affiliated_high_school', 2027)
assert.ok(nuaaReference)
const targetResults = analyzeScore({
  userScore: nuaaReference.minScore - 10,
  targetYear: 2027,
  keyword: '南航',
  targetRecords: [{
    schoolId: 'nuaa_suzhou_affiliated_high_school',
    schoolName: '南京航空航天大学苏州附属中学',
    level: 'sprint'
  }]
})
const linkedTarget = targetResults.find(
  (result) => result.schoolId === 'nuaa_suzhou_affiliated_high_school'
)
assert.ok(linkedTarget)
assert.strictEqual(linkedTarget.isTargetSchool, true)
assert.strictEqual(linkedTarget.targetLevel, 'sprint')
assert.strictEqual(linkedTarget.improvement, 10)
assert.strictEqual(linkedTarget.improvementText, '需要提升 10 分')

assert.strictEqual(storage.clearTargetRecords().ok, true)
assert.deepStrictEqual(storage.getTargetRecords(), [])

assert.strictEqual(schools.length, 55)
assert.strictEqual(admissionScores.length, 146)
assert.strictEqual(admissionScores.filter((item) => item.year === 2025).length, 103)
assert.strictEqual(admissionScores.filter((item) => item.year === 2026).length, 43)
assert.ok(admissionScores.every((item) => item.minScore <= EXAM_TOTAL_SCORE))
assert.strictEqual(sha256('data/schools.js'), 'c185182c8dd8577b3165278c16014dbff98249585cf76bd1182b6ea1581d62f2')
assert.strictEqual(sha256('data/admission-scores.js'), '0d6257cd336dee5afe853d6c4d9ece68e1cefe2bb56a652cb8f8c651a14ccf88')
assert.strictEqual(sha256('data/admission-scores-2026.js'), '3091136605728315653049fb4802e83b87d9f86cb568746027ec9ef21417d75c')

const searchCoverage = [
  'pages/home/home.js',
  'utils/school.js',
  'pages/favorites/favorites.js',
  'pages/targets/targets.js',
  'pages/school-compare/school-compare.js',
  'utils/score-analysis.js'
]
for (const relative of searchCoverage) {
  assert.ok(read(relative).includes('school-search'), `${relative} must use the unified school search`)
}

const targetPageText = [
  read('pages/targets/targets.js'),
  read('pages/targets/targets.wxml')
].join('\n')
for (const field of [
  'schoolId',
  'schoolName',
  'level',
  'referenceScoreText',
  'referenceYearText',
  'currentScoreText',
  'gapText',
  'onLevelChange',
  'clearAllRecords'
]) {
  assert.ok(targetPageText.includes(field), `target management missing ${field}`)
}

const detailRoutes = [
  'pages/home/home.js',
  'pages/schools/schools.js',
  'pages/favorites/favorites.js',
  'pages/targets/targets.js',
  'pages/school-compare/school-compare.js',
  'pages/target-analysis/target-analysis.js'
]
for (const relative of detailRoutes) {
  assert.ok(
    read(relative).includes('/pages/school-detail/school-detail?id='),
    `${relative} must open school detail`
  )
}

const runtimeText = ['pages', 'utils', 'config']
  .flatMap((relative) => walk(path.join(root, relative)))
  .filter((file) => /\.(?:js|wxml)$/.test(file))
  .map((file) => fs.readFileSync(file, 'utf8'))
  .join('\n')
for (const phrase of ['保证录取', '预测录取', '一定考上']) {
  assert.strictEqual(runtimeText.includes(phrase), false, `forbidden promise text: ${phrase}`)
}
assert.ok(runtimeText.includes('历史数据参考') || runtimeText.includes('历史参考'))

console.log('RC7-1 VERIFY PASSED')
console.log('- 搜索：空格归一、大小写归一、名称、别名、顺序字符和分散字符排序通过')
console.log('- 范例：南航、十中、园区、空结果通过')
console.log('- 目标：添加、改级、删除、持久读取、清空通过')
console.log('- 成绩：目标学校关联、参考分、差距和提升空间通过')
console.log('- 数据：55 所、146 条、2025=103、2026=43、满分 740，受保护文件哈希未变')
