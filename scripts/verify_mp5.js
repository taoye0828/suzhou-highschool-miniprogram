const fs = require('fs')
const path = require('path')
const { APP_CONFIG, EXAM_TOTAL_SCORE } = require('../config/app-config')
const {
  MP13_2026_VERIFIED_COUNT,
  SOURCE_URL_2026_EARLY,
  SOURCE_TITLE_2026_EARLY,
  SOURCE_IMAGE_URL_2026_EARLY,
  SOURCE_CHECKED_AT_2026
} = require('../data/admission-scores-2026')

const root = path.resolve(__dirname, '..')
const failures = []
const notes = []
const official2025Urls = new Set([
  'https://www.szjyksy.com/Item/4202.aspx',
  'https://www.szjyksy.com/Item/4201.aspx',
  'https://www.szjyksy.com/Item/4199.aspx'
])
const official2025Titles = new Set([
  '2025年苏州市六区第一批次普通高中学校及现代职教体系项目录取分数线',
  '2025年苏州市六区普通高中提前录取批次各校分数线公布',
  '2025年苏州市六区跨区招生各校分数线及最低控制线、自主招生最低控制线公布'
])
const allowedBatches = new Set(['提前录取批次', '第一批次', '跨区招生'])
const requiredFiles = [
  'docs/mp5_scores_to_confirm.md',
  'docs/mp5_official_scores_sources.md',
  'docs/mp13_2026_scores_to_confirm.md',
  'docs/mp13_2026_scores_sync_report.md',
  'data/admission-scores-2026.js'
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

function verifyReadmeCounts(schoolCount, scoreCount) {
  const readme = read('README.md')
  const schoolMatch = readme.match(/正式学校数据：(\d+) 条/)
  const scoreMatch = readme.match(/历史录取分数线：(\d+) 条/)
  if (!schoolMatch || Number(schoolMatch[1]) !== schoolCount) fail(`README 学校数据数量不一致：${schoolMatch && schoolMatch[1]}`)
  if (!scoreMatch || Number(scoreMatch[1]) !== scoreCount) fail(`README 历史录取分数线数量不一致：${scoreMatch && scoreMatch[1]}`)
  if (!readme.includes('2025、2026 年官方历史分数线')) fail('README 缺少 2025、2026 年官方历史分数线说明')
  if (!readme.includes('740')) fail('README 缺少 740 满分说明')
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
  if (![2025, 2026].includes(score.year)) fail(`${score.id} year 不在允许范围：${score.year}`)
  if (!Number.isInteger(score.minScore)) fail(`${score.id} minScore 必须是整数`)
  if (score.minScore < 300 || score.minScore > EXAM_TOTAL_SCORE) fail(`${score.id} minScore 超出范围：${score.minScore}`)
  if ([600, 603].includes(score.minScore)) fail(`${score.id} minScore 不得为控制线数字 ${score.minScore}`)
  if (score.scoreType !== '录取最低分') fail(`${score.id} scoreType 必须为录取最低分`)
  if (score.region !== '苏州市六区') fail(`${score.id} region 必须为苏州市六区`)
  if (!allowedBatches.has(score.batch)) fail(`${score.id} batch 不合法：${score.batch}`)
  if (!score.admissionType || typeof score.admissionType !== 'string') fail(`${score.id} admissionType 必须是非空字符串`)
  if (Object.hasOwn(score, 'sameScoreRule')) {
    if (!score.sameScoreRule || typeof score.sameScoreRule !== 'string') fail(`${score.id} sameScoreRule 必须是非空字符串`)
    if (['无', '暂无', '暂未公布', '待核实'].includes(score.sameScoreRule)) fail(`${score.id} sameScoreRule 不得使用占位值`)
  }
  if (score.year === 2025) {
    if (!official2025Urls.has(score.sourceUrl)) fail(`${score.id} 2025 sourceUrl 不在固定 3 个官方页面内`)
    if (!official2025Titles.has(score.sourceTitle)) fail(`${score.id} 2025 sourceTitle 不在固定 3 个官方标题内`)
    if (score.sourceCheckedAt !== '2026-07-06') fail(`${score.id} 2025 sourceCheckedAt 必须为 2026-07-06`)
  }
  if (score.year === 2026) {
    if (score.sourceType !== 'officialImageViaMedia') fail(`${score.id} 2026 sourceType 必须为 officialImageViaMedia`)
    if (score.status !== 'verified') fail(`${score.id} 2026 status 必须为 verified`)
    if (score.sourceUrl !== SOURCE_URL_2026_EARLY) fail(`${score.id} 2026 sourceUrl 不匹配`)
    if (score.sourceTitle !== SOURCE_TITLE_2026_EARLY) fail(`${score.id} 2026 sourceTitle 不匹配`)
    if (score.sourceImageUrl !== SOURCE_IMAGE_URL_2026_EARLY) fail(`${score.id} 2026 sourceImageUrl 不匹配`)
    if (score.sourceCheckedAt !== SOURCE_CHECKED_AT_2026) fail(`${score.id} 2026 sourceCheckedAt 必须为 ${SOURCE_CHECKED_AT_2026}`)
    if (!score.sameScoreMin || !Number.isInteger(score.sameScoreMin.chineseMathEnglish)) fail(`${score.id} 缺少 sameScoreMin.chineseMathEnglish`)
  }
  const keywordText = [score.id, score.schoolId, score.admissionType, score.scoreType, score.sourceNote].join(' ')
  for (const keyword of ['现代职教', '职教', '中职', '高职', '五年制', '职业', '技工', '控制线']) {
    if (keywordText.includes(keyword)) fail(`${score.id} 非 sourceTitle 字段出现禁止关键词：${keyword}`)
  }
}

for (const relative of requiredFiles) if (!exists(relative)) fail(`缺少必要文件：${relative}`)
verifyReadmeCounts(Array.isArray(schools) ? schools.length : 0, Array.isArray(admissionScores) ? admissionScores.length : 0)
if (admissionScores.filter((item) => item.year === 2025).length !== 103) fail('2025 分数线数量必须保持 103')
if (admissionScores.filter((item) => item.year === 2026).length !== MP13_2026_VERIFIED_COUNT) fail('2026 分数线数量与 MP13 常量不一致')
if (!['1.4.0', '1.5.0'].includes(APP_CONFIG.version)) fail('config/app-config.js version 必须为 1.4.0 或 1.5.0')
verifySecrets()

if (failures.length) {
  console.error('MP5 STATIC VERIFY FAILED')
  failures.forEach((message) => console.error(`- ${message}`))
  process.exit(1)
}

notes.push(`正式学校数据：${schools.length} 条`)
notes.push(`2025 历史录取分数线：103 条`)
notes.push(`2026 历史录取分数线：${MP13_2026_VERIFIED_COUNT} 条`)
console.log('MP5 STATIC VERIFY PASSED')
notes.forEach((message) => console.log(`- ${message}`))
