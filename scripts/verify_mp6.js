const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const failures = []
const notes = []
const expectedAppId = 'wx17e903f81714736f'
const forbiddenPublicPhrases = [
  '提交前说明',
  '真实 AppID',
  '填写 AppID',
  'touristappid',
  'MP6',
  'MP7',
  'MP8',
  'MP9',
  'MP10',
  'MP11',
  '微信认证',
  '真机预览',
  '审核前',
  '上传开发版本',
  '体验版',
  '最终收口版',
  'Codex',
  'commit',
  'push',
  '开发者工具',
  '服务端口'
]
const requiredFiles = [
  'app.js',
  'app.json',
  'project.config.json',
  'sitemap.json',
  'config/app-config.js',
  'data/schools.js',
  'data/admission-scores.js',
  'README.md',
  'docs/mp12_public_ui_cleanup.md',
  'docs/mp12_package_cleanup_report.md',
  'docs/mp6_current_project_audit.md',
  'docs/mp6_manual_steps_for_user.md',
  'docs/mp6_wechat_devtools_test_checklist.md',
  'docs/mp6_review_submission_notes.md',
  'docs/mp6_final_release_readiness.md'
]

function fail(message) { failures.push(message) }
function exists(relative) { return fs.existsSync(path.join(root, relative)) }
function read(relative) { return fs.readFileSync(path.join(root, relative), 'utf8') }

function walk(target) {
  if (!fs.existsSync(target)) return []
  const stat = fs.statSync(target)
  if (stat.isFile()) return [target]
  return fs.readdirSync(target, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'miniprogram_npm') return []
    return walk(path.join(target, entry.name))
  })
}

function parseJson(relative) {
  try {
    return JSON.parse(read(relative))
  } catch (error) {
    fail(`${relative} JSON 无法解析：${error.message}`)
    return null
  }
}

function runtimeTextSources() {
  return ['app.js', 'app.json', 'pages', 'data', 'utils', 'config']
    .flatMap((relative) => walk(path.join(root, relative)))
    .filter((file) => file !== path.join(root, 'scripts/verify_mp6.js'))
    .filter((file) => !fs.readFileSync(file).includes(0))
    .map((file) => ({
      relative: path.relative(root, file),
      source: fs.readFileSync(file, 'utf8')
    }))
}

function allTextSources() {
  return walk(root)
    .filter((file) => !file.includes(`${path.sep}.git${path.sep}`))
    .filter((file) => file !== path.join(root, 'scripts/verify_mp6.js'))
    .filter((file) => !fs.readFileSync(file).includes(0))
    .map((file) => ({
      relative: path.relative(root, file),
      source: fs.readFileSync(file, 'utf8')
    }))
}

for (const relative of requiredFiles) {
  if (!exists(relative)) fail(`缺少必要文件：${relative}`)
}
if (!fs.existsSync(path.join(root, 'pages'))) fail('缺少 pages 目录')

const appJson = parseJson('app.json')
const projectConfig = parseJson('project.config.json')
parseJson('sitemap.json')

if (appJson) {
  for (const page of appJson.pages || []) {
    for (const ext of ['js', 'json', 'wxml', 'wxss']) {
      if (!exists(`${page}.${ext}`)) fail(`app.json 注册页面缺少文件：${page}.${ext}`)
    }
  }
  for (const item of (appJson.tabBar && appJson.tabBar.list) || []) {
    const page = item.pagePath
    if (!page || !(appJson.pages || []).includes(page)) fail(`tabBar 页面未注册：${page}`)
    for (const ext of ['js', 'json', 'wxml', 'wxss']) {
      if (!exists(`${page}.${ext}`)) fail(`tabBar 页面缺少文件：${page}.${ext}`)
    }
    if (item.iconPath && !exists(item.iconPath)) fail(`tabBar iconPath 不存在：${item.iconPath}`)
    if (item.selectedIconPath && !exists(item.selectedIconPath)) fail(`tabBar selectedIconPath 不存在：${item.selectedIconPath}`)
  }
  if (appJson.window && appJson.window.navigationBarTitleText !== '苏州高中目标查询助手') {
    fail('app.json window 标题应为：苏州高中目标查询助手')
  }
}

if (projectConfig) {
  if (projectConfig.appid !== expectedAppId) fail(`project.config.json appid 应为 ${expectedAppId}`)
  for (const phrase of forbiddenPublicPhrases) {
    if (String(projectConfig.description || '').includes(phrase)) fail(`project.config.json description 不得出现：${phrase}`)
  }
  const serialized = JSON.stringify(projectConfig)
  for (const phrase of ['AppSecret', 'token', 'password', 'service_role']) {
    if (serialized.includes(phrase)) fail(`project.config.json 不得出现 ${phrase}`)
  }
  if (serialized.includes('cloudfunctionRoot') || serialized.includes('cloudbaseRoot')) fail('project.config.json 不得开启云开发依赖')
}

let schools = []
let admissionScores = []
try {
  schools = require('../data/schools').schools
  admissionScores = require('../data/admission-scores').admissionScores
} catch (error) {
  fail(`数据文件无法加载：${error.message}`)
}

if (!Array.isArray(schools)) fail('schools 必须是数组')
if (!Array.isArray(admissionScores)) fail('admissionScores 必须是数组')

const schoolIds = new Set()
for (const school of Array.isArray(schools) ? schools : []) {
  if (!school.id || typeof school.id !== 'string') fail('school.id 非空检查失败')
  if (schoolIds.has(school.id)) fail(`school.id 重复：${school.id}`)
  schoolIds.add(school.id)
  if (!school.name || typeof school.name !== 'string') fail(`${school.id} school.name 非空检查失败`)
  if (!school.district && !school.region) fail(`${school.id} school.region/district 非空检查失败`)
  if (!school.schoolType && !school.type) fail(`${school.id} school.type/schoolType 非空检查失败`)
  if (String(school.name).includes('示例')) fail(`${school.id} 不得为示例学校`)
}

for (const score of Array.isArray(admissionScores) ? admissionScores : []) {
  if (!schoolIds.has(score.schoolId)) fail(`${score.id} schoolId 不存在：${score.schoolId}`)
  if (![2025, 2026].includes(score.year)) fail(`${score.id} year 不在允许范围：${score.year}`)
  if (score.minScore === 600 || score.minScore === 603) fail(`${score.id} 不得出现控制线分数：${score.minScore}`)
}

const { APP_CONFIG } = require('../config/app-config')
if (!['1.4.0', '1.5.0'].includes(APP_CONFIG.version)) fail('config/app-config.js version 必须为 1.4.0 或 1.5.0')
for (const phrase of forbiddenPublicPhrases) {
  if (String(APP_CONFIG.releaseStatus || '').includes(phrase)) fail(`config/app-config.js releaseStatus 不得出现：${phrase}`)
}

const readme = read('README.md')
const schoolMatch = readme.match(/正式学校数据：(\d+) 条/)
const scoreMatch = readme.match(/历史录取分数线：(\d+) 条/)
if (!schoolMatch || Number(schoolMatch[1]) !== schools.length) fail('README 学校数量必须等于 schools.length')
if (!scoreMatch || Number(scoreMatch[1]) !== admissionScores.length) fail('README 历史分数线数量必须等于 admissionScores.length')
if (!readme.includes('MP12 页面收口')) fail('README 必须包含 MP12 页面收口说明')

const manualSteps = read('docs/mp6_manual_steps_for_user.md')
for (const phrase of ['AppID', '编译', '真机预览', '上传', '体验版', '提交审核']) {
  if (!manualSteps.includes(phrase)) fail(`docs/mp6_manual_steps_for_user.md 缺少步骤：${phrase}`)
}

const runtimeSources = runtimeTextSources()
for (const { relative, source } of runtimeSources) {
  for (const phrase of forbiddenPublicPhrases) {
    if (source.includes(phrase)) fail(`${relative} 正式运行代码不得出现：${phrase}`)
  }
  for (const phrase of ['TODO', 'mock', '示例学校', '待核实', 'AI 推荐']) {
    if (source.includes(phrase)) fail(`${relative} 正式运行代码不得出现：${phrase}`)
  }
  for (const api of [
    'wx.' + 'login',
    'getUserProfile',
    'getPhoneNumber',
    'wx.' + 'getLocation',
    'wx.' + 'requestPayment',
    'wx.' + 'cloud',
    'wx.' + 'request',
    'requestSubscribeMessage'
  ]) {
    if (source.includes(api)) fail(`${relative} 不得出现禁止 API：${api}`)
  }
}

const targetsSource = read('pages/targets/targets.js')
if (targetsSource.includes('admission-scores')) fail('targets 页面不得 require admission-scores')
for (const field of ['schoolId', 'targetSchool', 'admissionResult', 'admissionScore']) {
  if (targetsSource.includes(field)) fail(`目标记录页面不得保存或引用 ${field}`)
}

for (const { relative, source } of allTextSources()) {
  for (const pattern of [
    /sk-[A-Za-z0-9_-]{16,}/,
    /gh[pousr]_[A-Za-z0-9_]{20,}/,
    /github_pat_[A-Za-z0-9_]{20,}/,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /(?:appSecret|APP_SECRET|apiKey|API_KEY|token|TOKEN|cookie|COOKIE|password|PASSWORD|service_role)\s*[:=]\s*["'][^"']{8,}["']/
  ]) {
    if (pattern.test(source)) fail(`${relative} 发现疑似真实密钥：${pattern}`)
  }
}

const suspiciousFiles = walk(root).map((file) => path.relative(root, file)).filter((relative) => {
  if (relative.startsWith('.git/')) return false
  const baseName = path.basename(relative)
  return /\.bak(?:_|$)/i.test(baseName) ||
    /(^|\/)(?:tmp|old|new)(?:\/|$)/i.test(relative) ||
    /\.(?:tmp|old|new)$/i.test(baseName)
})
if (suspiciousFiles.length) fail(`存在 .bak/tmp/old/new 残留文件：${suspiciousFiles.join(', ')}`)

if (failures.length) {
  console.error('FORMAL STATIC VERIFY FAILED')
  failures.forEach((message) => console.error(`- ${message}`))
  process.exit(1)
}

notes.push(`正式学校数据：${schools.length} 条`)
notes.push(`历史录取分数线：${admissionScores.length} 条`)
notes.push('正式页面文案与运行边界：已检查')
console.log('FORMAL STATIC VERIFY PASSED')
notes.forEach((message) => console.log(`- ${message}`))
