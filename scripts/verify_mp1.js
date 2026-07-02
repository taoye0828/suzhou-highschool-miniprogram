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
    if (entry.name === '.git') return []
    const full = path.join(directory, entry.name)
    return entry.isDirectory() ? walk(full) : [full]
  })
}

function verifyJson(relative) {
  try { JSON.parse(read(relative)) } catch (error) { fail(`${relative} JSON 无法解析：${error.message}`) }
}

function verifyWxml(relative) {
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

for (const relative of ['app.json', 'project.config.json', 'sitemap.json']) verifyJson(relative)

const appConfig = JSON.parse(read('app.json'))
for (const page of requiredPages) {
  if (!appConfig.pages.includes(page)) fail(`app.json 未注册 ${page}`)
  for (const extension of ['js', 'json', 'wxml', 'wxss']) {
    const relative = `${page}.${extension}`
    if (!fs.existsSync(path.join(root, relative))) fail(`缺少页面文件 ${relative}`)
  }
  verifyJson(`${page}.json`)
  verifyWxml(`${page}.wxml`)
}

const tabs = (appConfig.tabBar && appConfig.tabBar.list || []).map((item) => item.pagePath)
for (const page of requiredTabs) if (!tabs.includes(page)) fail(`tabBar 未注册 ${page}`)

const sourceFiles = walk(root).filter((file) => {
  const relative = path.relative(root, file)
  return !relative.startsWith('docs' + path.sep) &&
    !relative.startsWith('scripts' + path.sep) &&
    ['.js', '.json', '.wxml', '.wxss'].includes(path.extname(file))
})
const source = sourceFiles.map((file) => `${path.relative(root, file)}\n${fs.readFileSync(file, 'utf8')}`).join('\n')

const forbiddenApiPatterns = [
  'wx.login', 'wx.getLocation', 'wx.chooseLocation', 'wx.openLocation',
  'wx.requestPayment', 'wx.requestSubscribeMessage', 'wx.request', 'wx.connectSocket'
]
for (const pattern of forbiddenApiPatterns) if (source.includes(pattern)) fail(`发现禁止 API：${pattern}`)

const forbiddenSecretPatterns = [
  /AppSecret\s*[:=]\s*["'][^"']+/i,
  /API[_-]?KEY\s*[:=]\s*["'][^"']+/i,
  /service_role/i,
  /SUPABASE/i,
  /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/
]
for (const pattern of forbiddenSecretPatterns) if (pattern.test(source)) fail(`发现敏感配置模式：${pattern}`)

const storageSource = read('utils/storage.js')
for (const key of ['mp1.favorite_school_ids', 'mp1.target_records', 'mp1.target_draft']) {
  if (!storageSource.includes(key)) fail(`缺少统一本地存储键：${key}`)
}
for (const api of ['wx.setStorageSync', 'wx.getStorageSync', 'wx.removeStorageSync']) {
  if (!storageSource.includes(api)) fail(`本地存储工具未使用 ${api}`)
}

const suspiciousFiles = walk(root).map((file) => path.relative(root, file)).filter((relative) => {
  return /(^|\/)(?:tmp|old|new)(\/|$)/i.test(relative) || /\.bak(?:_|$)/i.test(relative)
})
if (suspiciousFiles.length) fail(`存在临时或备份文件：${suspiciousFiles.join(', ')}`)

notes.push(`页面文件检查：${requiredPages.length} 个页面 × 4 类文件`)
notes.push(`JSON 解析检查：${3 + requiredPages.length} 个文件`)
notes.push(`WXML 闭合检查：${requiredPages.length} 个文件`)
notes.push(`tabBar 检查：${requiredTabs.length} 个页面`)
notes.push(`业务源文件安全扫描：${sourceFiles.length} 个文件`)

if (failures.length) {
  console.error('MP1 VERIFY FAILED')
  failures.forEach((message) => console.error(`- ${message}`))
  process.exit(1)
}

console.log('MP1 VERIFY PASSED')
notes.forEach((message) => console.log(`- ${message}`))
