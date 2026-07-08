const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const failures = []
const notes = []
const allowedUrls = new Set([
  'https://www.szjyksy.com/Item/4202.aspx',
  'https://www.szjyksy.com/Item/4201.aspx',
  'https://www.szjyksy.com/Item/4199.aspx'
])
const allowedTitles = new Set([
  '2025年苏州市六区第一批次普通高中学校及现代职教体系项目录取分数线',
  '2025年苏州市六区普通高中提前录取批次各校分数线公布',
  '2025年苏州市六区跨区招生各校分数线及最低控制线、自主招生最低控制线公布'
])
const allowedBatches = new Set(['提前录取批次', '第一批次', '跨区招生'])
const requiredFiles = [
  'docs/mp5_scores_to_confirm.md',
  'docs/mp5_official_scores_sources.md',
  'docs/mp5_official_pages/4202.html',
  'docs/mp5_official_pages/4201.html',
  'docs/mp5_official_pages/4199.html',
  'docs/mp5_official_images/20251029142432.jpeg',
  'docs/mp5_official_images/2025711103329.jpeg',
  'docs/mp5_official_images/2025711102122.jpeg'
]
const expectedHashes = [
  'c6f26519b262ff7c29e5a53930f7d634ff4047529e262627ed00c73d56fabc7f',
  '450df9e60c080b1ca51a21fe3a2f9e7451553c54f1854c493a537ee2a41bdfd8',
  '8f23242a630957d814a6167c015ff6437794cc68c8572270c1634805d8622443',
  '2bb9f435012f98a871ffc8d7a1f1adc11a5fc3ff6e7bf31a204d76f394c86c8c',
  '4701d14d2d166d9aa0200c0088627fa8cc672ecff50dc005f7f9dcf4aba49b51',
  'ea4a6f0e7f3288ac30b5c0980b2fec6c28ce942c05504bc3590a7fff172497cd'
]

function fail(message) { failures.push(message) }
function read(relative) { return fs.readFileSync(path.join(root, relative), 'utf8') }
function exists(relative) { return fs.existsSync(path.join(root, relative)) }

function walk(target) {
  if (!fs.existsSync(target)) return []
  const stat = fs.statSync(target)
  if (stat.isFile()) return [target]
  return fs.readdirSync(target, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'miniprogram_npm') return []
    return walk(path.join(target, entry.name))
  })
}

function verifyReadmeCounts(schoolCount, scoreCount) {
  const readme = read('README.md')
  const schoolMatch = readme.match(/正式学校数据：(\d+) 条/)
  const scoreMatch = readme.match(/历史录取分数线：(\d+) 条/)
  if (!schoolMatch || Number(schoolMatch[1]) !== schoolCount) fail(`README 学校数据数量不一致：${schoolMatch && schoolMatch[1]}`)
  if (!scoreMatch || Number(scoreMatch[1]) !== scoreCount) fail(`README 历史录取分数线数量不一致：${scoreMatch && scoreMatch[1]}`)
  if (!readme.includes('2026-07-06')) fail('README 缺少 2026-07-06 数据核对日期')
  if (!readme.includes('当前暂未收录 2026 年学校级录取分数线')) fail('README 缺少 2026 年学校级分数线暂未收录说明')
}

function verifySourceDocCounts(scores) {
  const doc = read('docs/mp5_official_scores_sources.md')
  const grouped = scores.reduce((result, item) => {
    result[item.sourceUrl] = (result[item.sourceUrl] || 0) + 1
    return result
  }, {})
  const tableCounts = {}
  for (const line of doc.split('\n')) {
    const cells = line.split('|').map((cell) => cell.trim()).filter(Boolean)
    if (cells.length >= 3 && allowedUrls.has(cells[0])) tableCounts[cells[0]] = Number(cells[1])
  }
  for (const url of allowedUrls) {
    if (!Object.hasOwn(tableCounts, url)) fail(`来源文档缺少 sourceUrl 统计：${url}`)
    else if (tableCounts[url] !== (grouped[url] || 0)) fail(`来源文档 ${url} 写入统计不一致：${tableCounts[url]} != ${grouped[url] || 0}`)
  }
  for (const hash of expectedHashes) if (!doc.includes(hash)) fail(`来源文档缺少 SHA256：${hash}`)
  for (const method of ['图片识别']) if (!doc.includes(`数据提取方式：${method}`)) fail(`来源文档缺少数据提取方式：${method}`)
  if (!doc.includes('当前暂未收录 2026 年学校级录取分数线')) fail('来源文档缺少 2026 年暂未收录说明')
}

function verifySecrets() {
  const files = ['app.js', 'app.json', 'project.config.json', 'config', 'data', 'pages', 'components', 'utils', 'scripts', 'README.md', 'docs']
    .flatMap((relative) => walk(path.join(root, relative)))
    .filter((file) => !fs.readFileSync(file).includes(0))
  const secretPatterns = [
    /sk-[A-Za-z0-9_-]{16,}/,
    /gh[pousr]_[A-Za-z0-9_]{20,}/,
    /github_pat_[A-Za-z0-9_]{20,}/,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /(?:appSecret|APP_SECRET|apiKey|API_KEY|token|TOKEN|cookie|COOKIE|password|PASSWORD|service_role)\s*[:=]\s*["'][^"']{8,}["']/
  ]
  for (const file of files) {
    const relative = path.relative(root, file)
    const source = fs.readFileSync(file, 'utf8')
    for (const pattern of secretPatterns) if (pattern.test(source)) fail(`${relative} 发现疑似真实密钥：${pattern}`)
  }
}

let schools = []
let admissionScores = []
try {
  schools = require('../data/schools').schools
  admissionScores = require('../data/admission-scores').admissionScores
} catch (error) {
  fail(`数据文件无法加载：${error.message}`)
}

if (!Array.isArray(admissionScores)) fail('admissionScores 必须是数组')
const schoolIds = new Set((Array.isArray(schools) ? schools : []).map((school) => school.id))
const ids = new Set()
for (const score of Array.isArray(admissionScores) ? admissionScores : []) {
  if (ids.has(score.id)) fail(`score.id 重复：${score.id}`)
  ids.add(score.id)
  if (!/^[a-z0-9_]+$/.test(score.id || '')) fail(`score.id 格式错误：${score.id}`)
  if (!schoolIds.has(score.schoolId)) fail(`${score.id} schoolId 不存在：${score.schoolId}`)
  if (score.year !== 2025) fail(`${score.id} year 必须是 2025`)
  if (score.year === 2026) fail(`${score.id} 不得出现 2026 年分数线`)
  if (!allowedUrls.has(score.sourceUrl)) fail(`${score.id} sourceUrl 不在固定 3 个官方页面内`)
  if (!allowedTitles.has(score.sourceTitle)) fail(`${score.id} sourceTitle 不在固定 3 个官方标题内`)
  if (score.sourceCheckedAt !== '2026-07-06') fail(`${score.id} sourceCheckedAt 必须为 2026-07-06`)
  if (!Number.isInteger(score.minScore)) fail(`${score.id} minScore 必须是数字`)
  if (score.minScore < 300 || score.minScore > 750) fail(`${score.id} minScore 超出范围：${score.minScore}`)
  if (score.minScore === 600 || score.minScore === 603) fail(`${score.id} minScore 不得为控制线数字 ${score.minScore}`)
  if (score.scoreType !== '录取最低分') fail(`${score.id} scoreType 必须为录取最低分`)
  if (score.region !== '苏州市六区') fail(`${score.id} region 必须为苏州市六区`)
  if (!allowedBatches.has(score.batch)) fail(`${score.id} batch 不合法：${score.batch}`)
  if (!score.admissionType || typeof score.admissionType !== 'string') fail(`${score.id} admissionType 必须是非空字符串`)
  if (Object.hasOwn(score, 'sameScoreRule')) {
    if (!score.sameScoreRule || typeof score.sameScoreRule !== 'string') fail(`${score.id} sameScoreRule 必须是非空字符串`)
    if (['无', '暂无', '暂未公布'].includes(score.sameScoreRule)) fail(`${score.id} sameScoreRule 不得使用占位值`)
  }
  const keywordText = [score.id, score.schoolId, score.admissionType, score.scoreType, score.sourceNote].join(' ')
  for (const keyword of ['现代职教', '职教', '中职', '高职', '五年制', '职业', '技工']) {
    if (keywordText.includes(keyword)) fail(`${score.id} 非 sourceTitle 字段出现禁止关键词：${keyword}`)
  }
}

for (const relative of requiredFiles) if (!exists(relative)) fail(`缺少 MP5 必要文件：${relative}`)

verifyReadmeCounts(Array.isArray(schools) ? schools.length : 0, Array.isArray(admissionScores) ? admissionScores.length : 0)
if (exists('docs/mp5_official_scores_sources.md')) verifySourceDocCounts(Array.isArray(admissionScores) ? admissionScores : [])

const projectConfig = JSON.parse(read('project.config.json'))
if ((projectConfig.description || '').includes('MP2')) fail('project.config.json description 不得再含 MP2')
const { APP_CONFIG } = require('../config/app-config')
if (!['1.3.0', '1.4.0'].includes(APP_CONFIG.version)) fail('config/app-config.js version 必须为 1.3.0 或 1.4.0')
if (/MP[1-9]|MP1[01]|AppID|提交前|真机预览|最终收口版/.test(String(APP_CONFIG.releaseStatus || ''))) {
  fail('config/app-config.js releaseStatus 不得再包含开发阶段或上架流程文案')
}

verifySecrets()

if (failures.length) {
  console.error('MP5 STATIC VERIFY FAILED')
  failures.forEach((message) => console.error(`- ${message}`))
  process.exit(1)
}

notes.push(`正式学校数据：${schools.length} 条`)
notes.push(`历史录取分数线：${admissionScores.length} 条`)
notes.push('MP5 官方来源证据文件：已检查')
console.log('MP5 STATIC VERIFY PASSED')
notes.forEach((message) => console.log(`- ${message}`))
