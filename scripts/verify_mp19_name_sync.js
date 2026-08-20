const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const expectedName = '学程记录'
const previousName = ['苏程', '记录'].join('')
const veryOldName = ['苏简', '记录'].join('')
const deprecatedParts = ['苏州', '高中', '目标', '查询', '助手']
const deprecatedName = deprecatedParts.join('')
const deprecatedPrefix = deprecatedParts.slice(0, 4).join('')
const deprecatedSuffix = deprecatedParts.slice(1).join('')
const deprecatedUnicode = [...deprecatedName]
  .map((character) => `\\u${character.codePointAt(0).toString(16).padStart(4, '0')}`)
  .join('')
const expectedAppId = 'wxc2a2a94f767438dd'
const shareablePages = [
  'pages/home/home',
  'pages/schools/schools',
  'pages/school-detail/school-detail',
  'pages/score-trend/score-trend',
  'pages/targets/targets'
]
// 历史文档与历史验证脚本保留当时的正式名称，不做改写（见 docs/mp19_name_share_report.md）。
const preservedHistorical = [
  'docs/mp17_name_sync_report.md',
  'docs/mp18_name_sync_report.md',
  'docs/rc9_full_upgrade_report.md',
  'docs/rc11_final_full_report.md',
  'docs/release_notes_v1.md',
  'docs/release_notes_1_2_0.md',
  'scripts/legacy/verify_mp17_name_sync.js',
  'scripts/legacy/verify_mp18_name_sync.js',
  'scripts/legacy/verify_rc9_onboarding_help.js',
  'scripts/legacy/verify_prelaunch_final.js',
  'scripts/v1/release-freeze-suite.js'
]
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

function topLevelScripts() {
  return fs.readdirSync(path.join(root, 'scripts'), { withFileTypes: true })
    .filter((entry) => entry.isFile() && textExtensions.has(path.extname(entry.name)))
    .map((entry) => path.join(root, 'scripts', entry.name))
}

function occurrences(source, needle) {
  return source.split(needle).length - 1
}

function sourceFor(relative) {
  const target = path.join(root, relative)
  if (fs.statSync(target).isDirectory()) {
    return walk(target).map((file) => fs.readFileSync(file, 'utf8')).join('\n')
  }
  return fs.readFileSync(target, 'utf8')
}

const textSources = walk(root).map((file) => ({
  relative: path.relative(root, file),
  source: fs.readFileSync(file, 'utf8')
}))
const previousMatches = []
const veryOldMatches = []
const deprecatedMatches = []
const variantMatches = []
const unicodeMatches = []
let currentNameCount = 0

for (const { relative, source } of textSources) {
  const previousCount = occurrences(source, previousName)
  if (previousCount) previousMatches.push({ relative, count: previousCount })

  const veryOldCount = occurrences(source, veryOldName)
  if (veryOldCount) veryOldMatches.push({ relative, count: veryOldCount })

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

// 更早旧品牌及其变体、Unicode 转义全仓必须清零。
assert.deepStrictEqual(veryOldMatches, [], `更早旧品牌残留：${JSON.stringify(veryOldMatches)}`)
assert.deepStrictEqual(deprecatedMatches, [], `更早旧品牌残留：${JSON.stringify(deprecatedMatches)}`)
assert.deepStrictEqual(variantMatches, [], `更早旧品牌变体残留：${JSON.stringify(variantMatches)}`)
assert.deepStrictEqual(unicodeMatches, [], `更早旧品牌 Unicode 转义残留：${unicodeMatches.join(', ')}`)

// 上一正式名称只允许出现在历史文档与历史验证脚本中。
const allowedHistoricalPrefixes = ['docs/', 'scripts/legacy/', 'scripts/v1/', 'backups/']
for (const { relative, count } of previousMatches) {
  assert.ok(
    preservedHistorical.includes(relative) ||
      allowedHistoricalPrefixes.some((prefix) => relative.startsWith(prefix)),
    `上一正式名称残留于非历史位置：${relative}（${count} 处）`
  )
}

// 运行时代码、README、当前文档与顶层验证脚本必须全部使用新名称。
for (const relative of [
  'app.js',
  'app.json',
  'pages',
  'utils',
  'config',
  'data',
  'sitemap.json',
  'README.md',
  'docs/current_release_gates.md',
  'docs/manual_wechat_release_checks.md',
  'docs/user_final_acceptance_checklist.md',
  ...topLevelScripts().map((file) => path.relative(root, file))
]) {
  assert.ok(fs.existsSync(path.join(root, relative)), `缺少扫描目标：${relative}`)
  assert.strictEqual(sourceFor(relative).includes(previousName), false, `${relative} 含上一正式名称`)
}

// 历史文档与历史验证脚本保持原样，未被本轮改写。
for (const relative of preservedHistorical) {
  assert.ok(fs.existsSync(path.join(root, relative)), `缺少历史文件：${relative}`)
  assert.ok(read(relative).includes(previousName), `历史文件被意外改写：${relative}`)
}

const appJson = JSON.parse(read('app.json'))
const projectConfig = JSON.parse(read('project.config.json'))
const { APP_CONFIG, EXAM_TOTAL_SCORE } = require('../config/app-config')
const { PRODUCT_RULES } = require('../utils/runtime-constants')
const { schools } = require('../data/schools')
const { admissionScores } = require('../data/admission-scores')

assert.strictEqual(APP_CONFIG.name, expectedName)
assert.strictEqual(PRODUCT_RULES.productName, expectedName)
assert.strictEqual(appJson.window.navigationBarTitleText, expectedName)
assert.strictEqual(projectConfig.description, expectedName)
assert.strictEqual(projectConfig.projectname, expectedName)
assert.strictEqual(projectConfig.appid, expectedAppId)
assert.strictEqual(PRODUCT_RULES.officialAppId, expectedAppId)
assert.strictEqual(projectConfig.compileType, 'miniprogram')
assert.strictEqual(projectConfig.miniprogramRoot, './')
assert.ok(read('app.js').includes('appName: APP_CONFIG.name'))
assert.ok(read('README.md').includes(`# ${expectedName}`))
assert.ok(read('README.md').includes(previousName) === false)

// 分享配置：标题使用正式名称，路径必须是 app.json 中真实注册的页面。
const shareSource = read('utils/share.js')
assert.ok(shareSource.includes("title: APP_CONFIG.name"))
const shareablePagePaths = new Set(shareablePages)
for (const pagePath of shareablePages) {
  const source = read(`${pagePath}.js`)
  assert.ok(source.includes('onShareAppMessage'), `${pagePath} 缺少 onShareAppMessage`)
  assert.ok(source.includes('onShareTimeline'), `${pagePath} 缺少 onShareTimeline`)
  assert.ok(source.includes("require('../../utils/share')"), `${pagePath} 未引入 utils/share`)
}
for (const pagePath of shareablePages) {
  const source = read(`${pagePath}.js`)
  for (const match of source.matchAll(/shareConfig\('([^']+)'/g)) {
    const sharedPath = match[1]
    assert.ok(shareablePagePaths.has(sharedPath), `${pagePath} 分享路径未注册或不在分享范围：${sharedPath}`)
    assert.ok(fs.existsSync(path.join(root, `${sharedPath}.js`)), `${pagePath} 分享路径不存在：${sharedPath}`)
    assert.ok(appJson.pages.includes(sharedPath), `${pagePath} 分享路径不在 app.json：${sharedPath}`)
  }
}
assert.ok(read('pages/home/home.js').includes("shareConfig('pages/home/home')"), '首页分享路径必须为真实首页')
assert.ok(read('pages/school-detail/school-detail.js').includes('encodeURIComponent(this.schoolId)'), '学校详情分享必须携带学校 id')

// 功能页标题保持不变，全局标题使用正式名称。
const pageTitles = appJson.pages.map((page) => {
  const config = JSON.parse(read(`${page}.json`))
  return config.navigationBarTitleText || appJson.window.navigationBarTitleText
})
assert.ok(new Set(pageTitles).size > 1, '页面标题不得全部改成正式名称')
for (const title of ['首页', '学校库', '学校详情', '成绩', '目标', '我的']) {
  assert.ok(pageTitles.includes(title), `缺少功能页标题：${title}`)
}
assert.deepStrictEqual(
  appJson.tabBar.list.map((item) => [item.pagePath, item.text]),
  [
    ['pages/home/home', '首页'],
    ['pages/schools/schools', '学校库'],
    ['pages/score-trend/score-trend', '成绩'],
    ['pages/targets/targets', '目标'],
    ['pages/profile/profile', '我的']
  ]
)

assert.strictEqual(schools.length, 55)
assert.strictEqual(admissionScores.length, 146)
assert.strictEqual(admissionScores.filter((item) => item.year === 2025).length, 103)
assert.strictEqual(admissionScores.filter((item) => item.year === 2026).length, 43)
assert.strictEqual(EXAM_TOTAL_SCORE, 740)
assert.ok(admissionScores.every((item) => item.minScore <= EXAM_TOTAL_SCORE))

const runtimeSources = [
  'app.js',
  'app.json',
  ...['pages', 'utils', 'config'].flatMap((relative) =>
    walk(path.join(root, relative)).map((file) => path.relative(root, file))
  )
].map(read).join('\n')
assert.ok(runtimeSources.includes(expectedName), '运行文件中缺少当前正式名称')

// 分享能力边界：只加页面分享，不引入登录、云开发、AI 或上传能力。
// wx.request 是 1.2.0 起官方远程公开数据链路的合法能力（仅 api.royalcup.top，见 README）。
const forbiddenCapabilities = [
  'wx.' + 'login',
  'wx.' + 'cloud',
  'wx.' + 'uploadFile',
  'wx.' + 'downloadFile',
  'wx.' + 'connectSocket',
  'wx.' + 'getUserProfile',
  'getPhoneNumber',
  'cloudfunctionRoot',
  'cloudbaseRoot',
  'openai',
  'chatgpt',
  'generative-ai',
  'ai-sdk'
]
const runtimeLower = runtimeSources.toLowerCase()
for (const marker of forbiddenCapabilities) {
  assert.strictEqual(runtimeLower.includes(marker.toLowerCase()), false, `运行文件不得出现能力：${marker}`)
}

const secretPattern = /(?:appSecret|APP_SECRET)\s*[:=]\s*["'][^"']{8,}["']/
for (const { relative, source } of textSources) {
  assert.strictEqual(secretPattern.test(source), false, `${relative} 发现疑似 AppSecret`)
}

console.log('MP19 NAME AND SHARE VERIFY PASSED')
console.log(`- 正式名称：${expectedName}`)
console.log(`- 上一正式名称非历史残留：${previousMatches.filter((item) => !item.relative.startsWith('docs/') && !item.relative.startsWith('scripts/legacy/') && !item.relative.startsWith('scripts/v1/')).length}`)
console.log(`- 保留旧名称的历史文件：${preservedHistorical.length} 个`)
console.log(`- 更早旧品牌精确命中：${deprecatedMatches.length}`)
console.log(`- 新名称命中：${currentNameCount}`)
console.log(`- 可分享页面：${shareablePages.length} 个（好友分享 + 朋友圈 + 复制链接）`)
console.log(`- 页面标题种类：${new Set(pageTitles).size}`)
console.log(`- 数据：学校 ${schools.length}，分数线 ${admissionScores.length}（2025=${admissionScores.filter((item) => item.year === 2025).length}，2026=${admissionScores.filter((item) => item.year === 2026).length}），上限 ${EXAM_TOTAL_SCORE}`)
console.log(`- AppID：${projectConfig.appid}`)
