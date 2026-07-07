const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const failures = []
const notes = []
const expectedAppId = 'wx17e903f81714736f'
const requiredPages = [
  'pages/home/home',
  'pages/schools/schools',
  'pages/school-detail/school-detail',
  'pages/favorites/favorites',
  'pages/targets/targets',
  'pages/data-info/data-info',
  'pages/privacy/privacy',
  'pages/profile/profile'
]
const requiredTabs = [
  'pages/home/home',
  'pages/schools/schools',
  'pages/favorites/favorites',
  'pages/targets/targets',
  'pages/profile/profile'
]
const requiredDocs = [
  'docs/mp4_manual_upload_guide.md',
  'docs/mp4_review_materials.md',
  'docs/mp4_submission_checklist.md',
  'docs/mp4_release_readiness.md',
  'docs/mp4_privacy_statement.md'
]
const scanRoots = ['app.js', 'app.json', 'pages', 'components', 'utils', 'config', 'data']

function fail(message) { failures.push(message) }
function read(relative) { return fs.readFileSync(path.join(root, relative), 'utf8') }
function exists(relative) { return fs.existsSync(path.join(root, relative)) }

function walk(directory) {
  if (!fs.existsSync(directory)) return []
  const entry = fs.statSync(directory)
  if (entry.isFile()) return [directory]
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((dirent) => {
    if (dirent.name === '.git' || dirent.name === 'node_modules' || dirent.name === 'miniprogram_npm') return []
    const full = path.join(directory, dirent.name)
    return dirent.isDirectory() ? walk(full) : [full]
  })
}

function verifyJson(relative) {
  try {
    return JSON.parse(read(relative))
  } catch (error) {
    fail(`${relative} JSON 无法解析：${error.message}`)
    return null
  }
}

function verifyWxmlClosure(relative) {
  const source = read(relative).replace(/<!--[^]*?-->/g, '')
  const stack = []
  const voidTags = new Set(['input', 'image', 'icon', 'progress', 'slider', 'switch'])
  const tagPattern = /<\/?([a-zA-Z][\w-]*)(?:\s[^<>]*?)?\s*\/?>/g
  for (const match of source.matchAll(tagPattern)) {
    const raw = match[0]
    const tag = match[1]
    if (raw.startsWith('</')) {
      const opened = stack.pop()
      if (opened !== tag) fail(`${relative} 标签不匹配：${opened || '无'} -> ${tag}`)
    } else if (!raw.endsWith('/>') && !voidTags.has(tag)) {
      stack.push(tag)
    }
  }
  if (stack.length) fail(`${relative} 存在未闭合标签：${stack.join(', ')}`)
}

function loadPageDefinition(page) {
  const modulePath = path.join(root, `${page}.js`)
  let definition = null
  const previousPage = global.Page
  global.Page = (value) => { definition = value }
  try {
    delete require.cache[require.resolve(modulePath)]
    require(modulePath)
  } catch (error) {
    fail(`${page}.js 加载失败：${error.message}`)
  } finally {
    global.Page = previousPage
  }
  return definition
}

function verifyEventHandlers(page) {
  const wxml = read(`${page}.wxml`)
  const definition = loadPageDefinition(page)
  if (!definition) {
    fail(`${page}.js 未注册有效 Page 定义`)
    return
  }
  const eventPattern = /\b(?:bind|catch)[a-z]*\s*=\s*["']([^"']+)["']/g
  for (const match of wxml.matchAll(eventPattern)) {
    const handler = match[1]
    if (typeof definition[handler] !== 'function') fail(`${page}.wxml 引用了不存在的处理器 ${handler}`)
  }
}

function pagePathExists(pagePath) {
  const normalized = pagePath.replace(/^\/+/, '').split('?')[0]
  return requiredPages.includes(normalized) && exists(`${normalized}.js`)
}

function verifyJumpPaths(files) {
  const pagePathPattern = /['"`](\/?pages\/[a-z-]+\/[a-z-]+(?:\?[^'"`]*)?)['"`]/g
  for (const file of files.filter((item) => /\.(?:js|wxml)$/.test(item))) {
    const relative = path.relative(root, file)
    const source = fs.readFileSync(file, 'utf8')
    for (const match of source.matchAll(pagePathPattern)) {
      if (!pagePathExists(match[1])) fail(`${relative} 跳转路径不存在：${match[1]}`)
    }
  }
}

function verifySchoolData() {
  const { schools } = require('../data/schools')
  if (schools.length < 50) {
    const candidateDoc = 'docs/mp4_school_data_candidates.md'
    if (!exists(candidateDoc)) fail(`学校数据少于 50 条且缺少 ${candidateDoc}`)
    else {
      const candidateCount = read(candidateDoc).split('\n').filter((line) => /^- /.test(line)).length
      if (candidateCount < 50) fail(`学校数据少于 50 条且候选线索少于 50 条：${candidateCount}`)
    }
  }

  const ids = new Set()
  for (const item of schools) {
    for (const field of ['id', 'name', 'district', 'schoolType', 'sourceTitle', 'sourceUrl', 'sourceCheckedAt', 'sourceNote']) {
      if (!item[field] || typeof item[field] !== 'string') fail(`${item.id || item.name || '未知学校'} 缺少字段：${field}`)
    }
    if (!/^[a-z0-9_]+$/.test(item.id || '')) fail(`${item.name || '未知学校'} id 格式错误：${item.id}`)
    if (ids.has(item.id)) fail(`学校 id 重复：${item.id}`)
    ids.add(item.id)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(item.sourceCheckedAt || '')) fail(`${item.id} sourceCheckedAt 格式错误`)
    if (!String(item.sourceNote || '').includes('核对字段')) fail(`${item.id} sourceNote 未说明核对字段`)
    for (const field of ['ownership', 'address', 'officialWebsite', 'intro', 'campus']) {
      if (Object.hasOwn(item, field) && (!item[field] || typeof item[field] !== 'string')) fail(`${item.id} ${field} 为空或格式错误`)
    }
    for (const field of ['aliases', 'features', 'programs', 'tags']) {
      if (Object.hasOwn(item, field)) {
        if (!Array.isArray(item[field])) fail(`${item.id} ${field} 应为数组`)
        else if (item[field].some((value) => typeof value !== 'string' || !value.trim())) fail(`${item.id} ${field} 存在空值`)
      }
    }
  }
  notes.push(`正式学校数据：${schools.length} 条`)
}

function verifyAdmissionScores() {
  if (!exists('data/admission-scores.js')) fail('缺少 data/admission-scores.js')
  const { schools } = require('../data/schools')
  const { admissionScores } = require('../data/admission-scores')
  if (!Array.isArray(admissionScores)) fail('admissionScores 必须为数组')
  const schoolIds = new Set(schools.map((school) => school.id))
  const currentYear = new Date().getFullYear()
  const ids = new Set()
  for (const item of admissionScores) {
    for (const field of ['id', 'schoolId', 'year', 'region', 'batch', 'admissionType', 'scoreType', 'minScore', 'sourceTitle', 'sourceUrl', 'sourceCheckedAt', 'sourceNote']) {
      if (item[field] === undefined || item[field] === null || item[field] === '') fail(`${item.id || '未知分数线'} 缺少字段：${field}`)
    }
    if (ids.has(item.id)) fail(`分数线 id 重复：${item.id}`)
    ids.add(item.id)
    if (!schoolIds.has(item.schoolId)) fail(`${item.id} schoolId 不匹配：${item.schoolId}`)
    if (!Number.isInteger(item.year) || item.year > currentYear) fail(`${item.id} year 不合理：${item.year}`)
    if (!Number.isInteger(item.minScore) || item.minScore < 0 || item.minScore > 900) fail(`${item.id} minScore 不合理：${item.minScore}`)
    if (!/录取最低分|投档线|控制线/.test(item.scoreType || '')) fail(`${item.id} scoreType 口径不清楚：${item.scoreType}`)
    if (!String(item.sourceNote || '').includes('核对')) fail(`${item.id} sourceNote 未说明核对内容`)
  }
  notes.push(`历史录取分数线：${admissionScores.length} 条`)
}

function verifyRuntimeText(textSources) {
  const forbiddenPhrases = [
    '待核实',
    '示例学校',
    '示例高中',
    'needs_review',
    'demo_green_high_school',
    'demo_lake_high_school',
    '录取概率',
    '预测录取',
    '稳上',
    '保底推荐',
    '推荐学校',
    '能上哪所高中',
    '必上',
    '保过',
    '升学承诺',
    '微信登录',
    '授权登录',
    '一键登录',
    '登录后同步',
    '登录后保存',
    '登录后查看',
    '获取头像',
    '获取昵称',
    '获取手机号',
    '绑定手机号',
    '账号登录',
    '个人账号',
    '云端同步',
    '多设备同步'
  ]
  for (const { relative, source } of textSources) {
    for (const phrase of forbiddenPhrases) {
      if (source.includes(phrase)) fail(`${relative} 发现禁用文案：${phrase}`)
    }
  }
}

function verifySafety(textSources) {
  const forbiddenApiPatterns = [
    'wx.' + 'login',
    'wx.' + 'getUserProfile',
    'wx.' + 'getUserInfo',
    'getPhoneNumber',
    'wx.' + 'getLocation',
    'wx.' + 'chooseLocation',
    'wx.' + 'openLocation',
    'wx.' + 'request',
    'wx.' + 'requestPayment',
    'wx.' + 'requestSubscribeMessage',
    'wx.' + 'connectSocket'
  ]
  const forbiddenRuntimeTokens = [
    'openid',
    'unionid',
    'session_key',
    'access_token',
    'refresh_token',
    'loginToken',
    'userToken',
    'authToken'
  ]
  const forbiddenPaths = [
    'pages/login',
    'pages/auth',
    'pages/profile-login',
    'components/login',
    'components/user-auth',
    'utils/auth.js',
    'utils/login.js',
    'utils/session.js'
  ]
  const forbiddenSecretPatterns = [
    /sk-[A-Za-z0-9_-]{16,}/,
    /gh[pousr]_[A-Za-z0-9_]{20,}/,
    /github_pat_[A-Za-z0-9_]{20,}/,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /(?:appSecret|APP_SECRET|apiKey|API_KEY|token|TOKEN|cookie|COOKIE|password|PASSWORD|service_role)\s*[:=]\s*["'][^"']{8,}["']/
  ]

  for (const { relative, source } of textSources) {
    for (const pattern of forbiddenApiPatterns) {
      if (source.includes(pattern)) fail(`${relative} 发现禁止 API：${pattern}`)
    }
    for (const token of forbiddenRuntimeTokens) {
      if (source.includes(token)) fail(`${relative} 发现登录相关标识：${token}`)
    }
    for (const pattern of forbiddenSecretPatterns) {
      if (pattern.test(source)) fail(`${relative} 发现疑似密钥：${pattern}`)
    }
  }
  for (const relative of forbiddenPaths) {
    if (exists(relative)) fail(`存在禁止路径：${relative}`)
  }
}

const appConfig = verifyJson('app.json')
const projectConfig = verifyJson('project.config.json')
verifyJson('sitemap.json')

if (projectConfig && projectConfig.appid !== expectedAppId) {
  fail(`project.config.json appid 应为 ${expectedAppId}`)
}

if (appConfig) {
  for (const page of requiredPages) {
    if (!appConfig.pages.includes(page)) fail(`app.json 未注册 ${page}`)
    for (const extension of ['js', 'json', 'wxml', 'wxss']) {
      if (!exists(`${page}.${extension}`)) fail(`缺少页面文件 ${page}.${extension}`)
    }
    if (exists(`${page}.json`)) verifyJson(`${page}.json`)
    if (exists(`${page}.wxml`)) verifyWxmlClosure(`${page}.wxml`)
    if (exists(`${page}.js`) && exists(`${page}.wxml`)) verifyEventHandlers(page)
  }
  const tabs = (appConfig.tabBar && appConfig.tabBar.list || []).map((item) => item.pagePath)
  for (const page of requiredTabs) if (!tabs.includes(page)) fail(`tabBar 未注册 ${page}`)
}

const scanFiles = scanRoots.flatMap((relative) => walk(path.join(root, relative)))
verifyJumpPaths(scanFiles)

const textSources = scanFiles
  .filter((file) => !fs.readFileSync(file).includes(0))
  .map((file) => ({
    relative: path.relative(root, file),
    source: fs.readFileSync(file, 'utf8')
  }))

verifySchoolData()
verifyAdmissionScores()
verifyRuntimeText(textSources)
verifySafety(textSources)

for (const relative of requiredDocs) {
  if (!exists(relative)) fail(`缺少必要文档：${relative}`)
}

notes.push(`页面注册检查：${requiredPages.length} 个页面`)
notes.push(`tabBar 检查：${requiredTabs.length} 个页面`)
notes.push(`运行代码文本扫描：${textSources.length} 个文件`)
notes.push('微信开发者工具编译：NOT RUN（本脚本不能替代）')

if (failures.length) {
  console.error('MP4 STATIC VERIFY FAILED')
  failures.forEach((message) => console.error(`- ${message}`))
  process.exit(1)
}

console.log('MP4 STATIC VERIFY PASSED')
notes.forEach((message) => console.log(`- ${message}`))
