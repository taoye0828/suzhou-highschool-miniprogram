const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const expectedName = '苏程记录'
const expectedAppId = 'wx17e903f81714736f'
const deprecatedParts = ['苏州', '高中', '目标', '查询', '助手']
const deprecatedName = deprecatedParts.join('')
const deprecatedPrefix = deprecatedParts.slice(0, 4).join('')
const deprecatedSuffix = deprecatedParts.slice(1).join('')
const deprecatedUnicode = [...deprecatedName]
  .map((character) => `\\u${character.codePointAt(0).toString(16).padStart(4, '0')}`)
  .join('')
const textExtensions = new Set([
  '.js',
  '.json',
  '.wxml',
  '.wxss',
  '.md',
  '.html',
  '.txt',
  '.yml',
  '.yaml'
])

function read(relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8')
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === '.git' || entry.name === 'node_modules') return []
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) return walk(fullPath)
    return textExtensions.has(path.extname(entry.name)) ? [fullPath] : []
  })
}

function occurrences(source, needle) {
  return source.split(needle).length - 1
}

const textSources = walk(root).map((file) => ({
  relative: path.relative(root, file),
  source: fs.readFileSync(file, 'utf8')
}))

const deprecatedMatches = []
const variantMatches = []
const unicodeMatches = []
let currentNameCount = 0

for (const { relative, source } of textSources) {
  const exactCount = occurrences(source, deprecatedName)
  if (exactCount) deprecatedMatches.push({ relative, count: exactCount })

  const compactSource = source.replace(/\s+/g, '')
  const variantCount = occurrences(source, deprecatedPrefix) +
    occurrences(source, deprecatedSuffix) +
    (compactSource.includes(deprecatedName) && !source.includes(deprecatedName) ? 1 : 0)
  if (variantCount) variantMatches.push({ relative, count: variantCount })

  if (source.toLowerCase().includes(deprecatedUnicode)) unicodeMatches.push(relative)
  currentNameCount += occurrences(source, expectedName)
}

assert.deepStrictEqual(deprecatedMatches, [], `旧名称残留：${JSON.stringify(deprecatedMatches)}`)
assert.deepStrictEqual(variantMatches, [], `旧名称变体残留：${JSON.stringify(variantMatches)}`)
assert.deepStrictEqual(unicodeMatches, [], `旧名称 Unicode 转义残留：${unicodeMatches.join(', ')}`)

const appJson = JSON.parse(read('app.json'))
const projectConfig = JSON.parse(read('project.config.json'))
const { APP_CONFIG, EXAM_TOTAL_SCORE } = require('../config/app-config')
const { schools } = require('../data/schools')
const { admissionScores } = require('../data/admission-scores')

assert.strictEqual(APP_CONFIG.name, expectedName)
assert.strictEqual(projectConfig.appid, expectedAppId)
assert.strictEqual(appJson.window.navigationBarTitleText, expectedName)
assert.strictEqual(JSON.parse(read('pages/home/home.json')).navigationBarTitleText, expectedName)
assert.ok(read('app.js').includes('appName: APP_CONFIG.name'))
assert.ok(read('pages/data-info/data-info.wxml').includes('{{appName}}'))
assert.ok(read('pages/privacy/privacy.wxml').includes('{{appName}}'))
assert.ok(read('README.md').includes(`# ${expectedName}`))

for (const relative of [
  'app.js',
  'app.json',
  'pages',
  'components',
  'utils',
  'config',
  'README.md',
  'docs',
  'scripts'
]) {
  assert.ok(fs.existsSync(path.join(root, relative)), `缺少扫描目标：${relative}`)
}

const pageTitles = appJson.pages.map((page) => {
  const config = JSON.parse(read(`${page}.json`))
  return config.navigationBarTitleText || appJson.window.navigationBarTitleText
})
assert.ok(new Set(pageTitles).size > 1, '页面标题不得全部改成同一标题')
assert.ok(pageTitles.includes('学校库'))
assert.ok(pageTitles.includes('成绩中心'))
assert.ok(pageTitles.includes('目标规划'))
assert.ok(pageTitles.includes('我的'))

assert.strictEqual(schools.length, 55)
assert.strictEqual(admissionScores.length, 146)
assert.strictEqual(admissionScores.filter((item) => item.year === 2025).length, 103)
assert.strictEqual(admissionScores.filter((item) => item.year === 2026).length, 43)
assert.strictEqual(EXAM_TOTAL_SCORE, 740)
assert.ok(admissionScores.every((item) => item.minScore <= EXAM_TOTAL_SCORE))

const runtimeSources = [
  'app.js',
  'app.json',
  ...['pages', 'components', 'utils', 'config'].flatMap((relative) =>
    walk(path.join(root, relative)).map((file) => path.relative(root, file))
  )
].map(read).join('\n')

assert.ok(runtimeSources.includes(expectedName), '运行文件中缺少当前正式名称')
for (const marker of [
  'wx.' + 'login',
  'wx.' + 'cloud',
  'wx.' + 'request',
  'cloudfunctionRoot',
  'cloudbaseRoot'
]) {
  assert.strictEqual(runtimeSources.includes(marker), false, `运行文件不得出现：${marker}`)
}

const secretPattern = /(?:appSecret|APP_SECRET)\s*[:=]\s*["'][^"']{8,}["']/
for (const { relative, source } of textSources) {
  assert.strictEqual(secretPattern.test(source), false, `${relative} 发现疑似 AppSecret`)
}

console.log('MP17 NAME SYNC VERIFY PASSED')
console.log(`- 正式名称：${expectedName}`)
console.log(`- 旧名称精确命中：${deprecatedMatches.length}`)
console.log(`- 旧名称变体命中：${variantMatches.length}`)
console.log(`- 新名称命中：${currentNameCount}`)
console.log(`- 页面标题种类：${new Set(pageTitles).size}`)
console.log(`- 数据：学校 ${schools.length}，分数线 ${admissionScores.length}（2025=${admissionScores.filter((item) => item.year === 2025).length}，2026=${admissionScores.filter((item) => item.year === 2026).length}），上限 ${EXAM_TOTAL_SCORE}`)
console.log(`- AppID：${projectConfig.appid}`)
