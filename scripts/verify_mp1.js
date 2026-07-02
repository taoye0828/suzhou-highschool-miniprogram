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

function fail(message) { failures.push(message) }
function read(relative) { return fs.readFileSync(path.join(root, relative), 'utf8') }

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

// 补充性闭合检查，不替代微信开发者工具编译。
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

const appConfig = verifyJson('app.json')
verifyJson('project.config.json')
verifyJson('sitemap.json')

if (appConfig) {
  for (const page of requiredPages) {
    if (!appConfig.pages.includes(page)) fail(`app.json 未注册 ${page}`)
    const filesExist = ['js', 'json', 'wxml', 'wxss'].every((extension) => {
      const relative = `${page}.${extension}`
      if (!fs.existsSync(path.join(root, relative))) {
        fail(`缺少页面文件 ${relative}`)
        return false
      }
      return true
    })
    if (!filesExist) continue
    verifyJson(`${page}.json`)
    verifyWxmlClosure(`${page}.wxml`)
    verifyEventHandlers(page)
  }

  const tabs = (appConfig.tabBar && appConfig.tabBar.list || []).map((item) => item.pagePath)
  for (const page of requiredTabs) if (!tabs.includes(page)) fail(`tabBar 未注册 ${page}`)
}

const allProjectFiles = walk(root)
const textFiles = allProjectFiles.filter((file) => !fs.readFileSync(file).includes(0))
const textSources = textFiles.map((file) => ({
  relative: path.relative(root, file),
  source: fs.readFileSync(file, 'utf8')
}))

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
  /appSecret\s*[:=]\s*["'][^"']+/i,
  /service_role\s*[:=]\s*["'][^"']+/i
]
for (const { relative, source } of textSources) {
  for (const pattern of forbiddenSecretPatterns) {
    if (pattern.test(source)) fail(`${relative} 发现疑似密钥：${pattern}`)
  }
}

const storageSource = read('utils/storage.js')
for (const key of ['mp1.favorite_school_ids', 'mp1.target_records', 'mp1.target_draft']) {
  if (!storageSource.includes(key)) fail(`缺少统一本地存储键：${key}`)
}
for (const api of ['wx.setStorageSync', 'wx.getStorageSync', 'wx.removeStorageSync']) {
  if (!storageSource.includes(api)) fail(`本地存储工具未使用 ${api}`)
}

const suspiciousFiles = allProjectFiles.map((file) => path.relative(root, file)).filter((relative) => {
  const baseName = path.basename(relative)
  return /(^|\/)(?:tmp|old|new)(\/|$)/i.test(relative) ||
    /\.bak(?:_|$)/i.test(relative) ||
    /^\.env(?:\.|$)/i.test(baseName)
})
if (suspiciousFiles.length) fail(`存在临时、备份或环境文件：${suspiciousFiles.join(', ')}`)

notes.push(`页面文件检查：${requiredPages.length} 个页面 × 4 类文件`)
notes.push(`JSON 解析检查：${3 + requiredPages.length} 个文件`)
notes.push(`WXML 补充闭合检查：${requiredPages.length} 个文件`)
notes.push(`WXML 事件处理器检查：${requiredPages.length} 个页面`)
notes.push(`tabBar 检查：${requiredTabs.length} 个页面`)
notes.push(`全项目文本安全扫描：${textSources.length} 个文件`)
notes.push('微信开发者工具编译：NOT RUN（本脚本不能替代）')

if (failures.length) {
  console.error('MP1 STATIC VERIFY FAILED')
  failures.forEach((message) => console.error(`- ${message}`))
  process.exit(1)
}

console.log('MP1 STATIC VERIFY PASSED（仅补充检查）')
notes.forEach((message) => console.log(`- ${message}`))
