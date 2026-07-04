const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const failures = []
const notes = []
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
  'README.md',
  'docs/mp2_release_readiness.md',
  'docs/mp2_review_materials.md',
  'docs/mp2_privacy_statement.md',
  'docs/mp2_school_data_sources.md',
  'docs/mp2_submission_checklist.md'
]

function fail(message) { failures.push(message) }
function read(relative) { return fs.readFileSync(path.join(root, relative), 'utf8') }
function exists(relative) { return fs.existsSync(path.join(root, relative)) }

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'miniprogram_npm') return []
    const full = path.join(directory, entry.name)
    return entry.isDirectory() ? walk(full) : [full]
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

function verifyJumpPaths() {
  const files = walk(root)
    .filter((file) => /\.(?:js|wxml)$/.test(file))
    .filter((file) => !file.includes(`${path.sep}scripts${path.sep}`))
  const pagePathPattern = /['"`](\/?pages\/[a-z-]+\/[a-z-]+(?:\?[^'"`]*)?)['"`]/g
  for (const file of files) {
    const relative = path.relative(root, file)
    const source = fs.readFileSync(file, 'utf8')
    for (const match of source.matchAll(pagePathPattern)) {
      if (!pagePathExists(match[1])) fail(`${relative} 跳转路径不存在：${match[1]}`)
    }
  }
}

function verifySchoolData() {
  const { schools } = require('../data/schools')
  if (schools.length < 20) fail(`学校数据少于 20 条：${schools.length}`)

  const ids = new Set()
  let demoCount = 0
  let realCount = 0
  for (const item of schools) {
    if (!item.id || typeof item.id !== 'string') fail('存在缺失 id 的学校记录')
    if (ids.has(item.id)) fail(`学校 id 重复：${item.id}`)
    ids.add(item.id)
    for (const field of ['name', 'district', 'schoolType', 'ownership', 'boardingType', 'dataStatus', 'sourceCheckedAt']) {
      if (!item[field] || typeof item[field] !== 'string') fail(`${item.id} 缺少字段：${field}`)
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(item.sourceCheckedAt || '')) fail(`${item.id} sourceCheckedAt 格式错误`)
    if (Array.isArray(item.tags) && item.tags.length > 4) fail(`${item.id} tags 超过 4 个`)
    if (item.dataStatus === 'needs_review') fail(`${item.id} dataStatus 错误使用 needs_review`)
    if (item.dataKind === 'demo') {
      demoCount += 1
      if (item.dataStatus !== '示例学校') fail(`${item.id} 示例学校 dataStatus 不正确`)
    } else {
      realCount += 1
      if (item.name.includes('示例')) fail(`${item.id} 真实学校名称包含示例`)
      if (!item.sourceUrl && !item.sourceNote) fail(`${item.id} 真实学校缺少 sourceUrl 或 sourceNote`)
    }
    if (/升学承诺|保证|必上|保过/.test(item.intro || '')) fail(`${item.id} intro 存在承诺性表述`)
  }
  if (demoCount > 3) fail(`示例学校超过 3 条：${demoCount}`)
  notes.push(`学校数据：${schools.length} 条，其中真实公开来源样本 ${realCount} 条，示例 ${demoCount} 条`)
}

function verifyNoDisplayedScoreFields() {
  const { schools } = require('../data/schools')
  const forbiddenFields = ['score', 'scores', 'scoreLine', 'admissionScore', 'cutoffScore', 'rank']
  for (const school of schools) {
    for (const field of forbiddenFields) {
      if (Object.hasOwn(school, field)) fail(`${school.id} 包含当前版本不应展示的字段：${field}`)
    }
  }
}

function verifyDangerousCopy(textSources) {
  const dangerous = [
    { phrase: '预测录取', allowNegative: false },
    { phrase: '稳上', allowNegative: false },
    { phrase: '保底推荐', allowNegative: false },
    { phrase: '能上哪所高中', allowNegative: false },
    { phrase: '推荐学校', allowNegative: false },
    { phrase: '录取概率', allowNegative: true },
    { phrase: '志愿建议', allowNegative: false }
  ]
  for (const { relative, source } of textSources) {
    for (const item of dangerous) {
      let index = source.indexOf(item.phrase)
      while (index !== -1) {
        const context = source.slice(Math.max(0, index - 12), index + item.phrase.length + 12)
        const allowed = item.allowNegative && /不展示录取概率|不提供录取概率/.test(context)
        if (!allowed) fail(`${relative} 发现危险或误导文案：${item.phrase}`)
        index = source.indexOf(item.phrase, index + item.phrase.length)
      }
    }
  }
}

function verifySafety(textSources, allProjectFiles) {
  const forbiddenApiPatterns = [
    'wx.' + 'login',
    'wx.' + 'getLocation',
    'wx.' + 'chooseLocation',
    'wx.' + 'openLocation',
    'wx.' + 'requestPayment',
    'wx.' + 'requestSubscribeMessage',
    'wx.' + 'request',
    'wx.' + 'connectSocket'
  ]
  for (const { relative, source } of textSources) {
    for (const pattern of forbiddenApiPatterns) {
      if (source.includes(pattern)) fail(`${relative} 发现禁止 API：${pattern}`)
    }
  }

  const forbiddenSecretPatterns = [
    /sk-[A-Za-z0-9_-]{16,}/,
    /gh[pousr]_[A-Za-z0-9_]{20,}/,
    /sb_(?:secret|publishable)_[A-Za-z0-9_-]+/,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /(?:appSecret|APP_SECRET|apiKey|API_KEY|token|TOKEN|service_role)\s*[:=]\s*["'][^"']{8,}["']/,
    /password\s*[:=]\s*["'][^"']{6,}["']/i
  ]
  for (const { relative, source } of textSources) {
    for (const pattern of forbiddenSecretPatterns) {
      if (pattern.test(source)) fail(`${relative} 发现疑似密钥：${pattern}`)
    }
  }

  const suspiciousFiles = allProjectFiles.map((file) => path.relative(root, file)).filter((relative) => {
    const baseName = path.basename(relative)
    return /(^|\/)(?:tmp|old|new)(\/|$)/i.test(relative) ||
      /\.bak(?:_|$)/i.test(relative) ||
      /^\.env(?:\.|$)/i.test(baseName)
  })
  if (suspiciousFiles.length) fail(`存在临时、备份或环境文件：${suspiciousFiles.join(', ')}`)
}

const appConfig = verifyJson('app.json')
const projectConfig = verifyJson('project.config.json')
verifyJson('sitemap.json')

if (projectConfig && projectConfig.appid !== 'touristappid') {
  fail('project.config.json appid 应保持 touristappid')
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

verifyJumpPaths()
verifySchoolData()
verifyNoDisplayedScoreFields()

const allProjectFiles = walk(root)
const textFiles = allProjectFiles.filter((file) => !fs.readFileSync(file).includes(0))
const textSources = textFiles.map((file) => ({
  relative: path.relative(root, file),
  source: fs.readFileSync(file, 'utf8')
}))
verifyDangerousCopy(textSources.filter((item) => !item.relative.startsWith('scripts/')))
verifySafety(textSources, allProjectFiles)

for (const relative of requiredDocs) {
  if (!exists(relative)) fail(`缺少必要文档：${relative}`)
}

notes.push(`页面注册检查：${requiredPages.length} 个页面`)
notes.push(`tabBar 检查：${requiredTabs.length} 个页面`)
notes.push('跳转路径检查：已执行')
notes.push(`全项目文本安全扫描：${textSources.length} 个文件`)
notes.push('微信开发者工具编译：NOT RUN（本脚本不能替代）')

if (failures.length) {
  console.error('MP2 STATIC VERIFY FAILED')
  failures.forEach((message) => console.error(`- ${message}`))
  process.exit(1)
}

console.log('MP2 STATIC VERIFY PASSED（仅补充检查）')
notes.forEach((message) => console.log(`- ${message}`))
