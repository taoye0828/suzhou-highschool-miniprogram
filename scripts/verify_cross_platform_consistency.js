const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const miniRoot = path.resolve(__dirname, '..')
const positional = process.argv.slice(2).find((value) => !value.startsWith('--'))
const appRoot = path.resolve(miniRoot, positional || '../suzhou_highschool_app')
const writeReport = process.argv.includes('--write-report')
const { schools } = require('../data/schools')
const { admissionScores } = require('../data/admission-scores')
const { APP_CONFIG, EXAM_TOTAL_SCORE } = require('../config/app-config')

const appSchoolsPath = path.join(appRoot, 'assets/data/schools.json')
const appScoresPath = path.join(appRoot, 'assets/data/admission_scores.json')
const appSchools = JSON.parse(fs.readFileSync(appSchoolsPath, 'utf8'))
const appScores = JSON.parse(fs.readFileSync(appScoresPath, 'utf8'))

const schoolFields = [
  'id', 'name', 'aliases', 'district', 'schoolType', 'campus', 'tags', 'programs',
  'sourceType', 'sourceTitle', 'sourceUrl', 'sourceCheckedAt', 'sourceNote'
]
const scoreFields = [
  'id', 'schoolId', 'year', 'region', 'batch', 'admissionType', 'scoreType',
  'minScore', 'sameScoreRule', 'sourceTitle', 'sourceUrl', 'sourceCheckedAt', 'sourceNote'
]

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]))
}

function project(records, fields) {
  return records
    .map((record) => Object.fromEntries(fields.map((field) => [field, record[field] === undefined ? null : record[field]])))
    .sort((left, right) => String(left.id).localeCompare(String(right.id)))
}

function sha256(value) {
  return crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')
}

function duplicates(records, key) {
  const seen = new Set()
  const repeated = new Set()
  for (const record of records) {
    const value = record[key]
    if (seen.has(value)) repeated.add(value)
    seen.add(value)
  }
  return [...repeated].sort()
}

function diffById(leftRecords, rightRecords, fields) {
  const left = new Map(leftRecords.map((record) => [record.id, record]))
  const right = new Map(rightRecords.map((record) => [record.id, record]))
  const missing = [...left.keys()].filter((id) => !right.has(id)).sort()
  const extra = [...right.keys()].filter((id) => !left.has(id)).sort()
  const changed = []
  for (const [id, source] of left) {
    const target = right.get(id)
    if (!target) continue
    const changedFields = fields.filter((field) => JSON.stringify(canonical(source[field] ?? null)) !== JSON.stringify(canonical(target[field] ?? null)))
    if (changedFields.length) changed.push({ id, fields: changedFields })
  }
  return { missing, extra, changed }
}

function yearCount(records, year) {
  return records.filter((record) => record.year === year).length
}

function readApp(relative) {
  return fs.readFileSync(path.join(appRoot, relative), 'utf8')
}

function readFilesRecursively(root, extension) {
  const values = []
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const target = path.join(root, entry.name)
    if (entry.isDirectory()) {
      values.push(...readFilesRecursively(target, extension))
    } else if (entry.isFile() && entry.name.endsWith(extension)) {
      values.push(fs.readFileSync(target, 'utf8'))
    }
  }
  return values
}

const miniSchoolProjection = project(schools, schoolFields)
const appSchoolProjection = project(appSchools, schoolFields)
const miniScoreProjection = project(admissionScores, scoreFields)
const appScoreProjection = project(appScores, scoreFields)
const schoolDiff = diffById(miniSchoolProjection, appSchoolProjection, schoolFields)
const scoreDiff = diffById(miniScoreProjection, appScoreProjection, scoreFields)
const miniSchoolIds = new Set(schools.map((record) => record.id))
const appSchoolIds = new Set(appSchools.map((record) => record.id))

const miniRuntime = [
  'app.js', 'app.json', 'config/app-config.js', 'utils/storage.js',
  'pages/privacy/privacy.js', 'pages/targets/targets.js'
].map((relative) => fs.readFileSync(path.join(miniRoot, relative), 'utf8')).join('\n')
const appRuntime = [
  'lib/core/config/data_source_mode.dart',
  'lib/core/config/exam_score_config.dart',
  'lib/data/services/local_user_data_service.dart',
  'lib/features/privacy/pages/privacy_page.dart',
  'ios/Runner/Info.plist'
].filter((relative) => fs.existsSync(path.join(appRoot, relative))).map(readApp).join('\n')
const appLibSource = readFilesRecursively(path.join(appRoot, 'lib'), '.dart').join('\n')
const appPubspec = readApp('pubspec.yaml')
const appMain = readApp('lib/main.dart')
const appDataSourceMode = readApp('lib/core/config/data_source_mode.dart')
const appSchoolRepository = readApp('lib/data/repositories/school_repository.dart')
const appScoreRepository = readApp('lib/data/repositories/admission_score_repository.dart')
const appLocalSchoolSource = readApp('lib/data/sources/local_school_data_source.dart')
const appLocalScoreSource = readApp('lib/data/sources/local_admission_score_data_source.dart')

const checks = {
  schoolCount: schools.length === appSchools.length,
  scoreCount: admissionScores.length === appScores.length,
  score2025Count: yearCount(admissionScores, 2025) === yearCount(appScores, 2025),
  score2026Count: yearCount(admissionScores, 2026) === yearCount(appScores, 2026),
  schoolIdsUnique: duplicates(schools, 'id').length === 0 && duplicates(appSchools, 'id').length === 0,
  scoreIdsUnique: duplicates(admissionScores, 'id').length === 0 && duplicates(appScores, 'id').length === 0,
  scoreReferencesValid: admissionScores.every((score) => miniSchoolIds.has(score.schoolId)) && appScores.every((score) => appSchoolIds.has(score.schoolId)),
  schoolFieldsEqual: schoolDiff.missing.length === 0 && schoolDiff.extra.length === 0 && schoolDiff.changed.length === 0,
  scoreFieldsEqual: scoreDiff.missing.length === 0 && scoreDiff.extra.length === 0 && scoreDiff.changed.length === 0,
  scoreRangeValid: admissionScores.concat(appScores).every((score) => Number.isFinite(score.minScore) && score.minScore >= 0 && score.minScore <= 740),
  targetMaxEqual740: EXAM_TOTAL_SCORE === 740 && /examTotalScore\s*=\s*740/.test(appRuntime),
  miniNoForbiddenApi: !/wx\.(?:login|getUserProfile|getPhoneNumber|getLocation|chooseLocation|cloud|uploadFile|requestPayment|request)\b/.test(miniRuntime),
  appNoLocationPermission: !/NSLocation|geolocator|LocationPermission/.test(appRuntime),
  appNoUserDataUpload: !/package:(?:http|dio|supabase|firebase)|Supabase\.|Firebase\.|uploadFile|http\.(?:post|put|delete)|Dio\s*\(/.test(appLibSource),
  miniPrivacyLocalOnly: APP_CONFIG.policy.privacySections.some((section) => section.items.some((item) => item.includes('不上传收藏、学习目标记录或输入草稿'))),
  appPrivacyLocalOnly: /只保存在本机|不会上传/.test(appRuntime)
}

const runtimeChecks = {
  singleLocalDataMode: /enum\s+DataSourceMode\s*\{\s*localAssets\s*\}/.test(appDataSourceMode) && /defaultDataSourceMode\s*=\s*DataSourceMode\.localAssets/.test(appDataSourceMode),
  defaultRepositoriesUseLocalSources: /return\s+LocalSchoolDataSource\s*\(/.test(appSchoolRepository) && /return\s+LocalAdmissionScoreDataSource\s*\(/.test(appScoreRepository),
  productionAssetsRegistered: /-\s+assets\/data\/schools\.json/.test(appPubspec) && /-\s+assets\/data\/admission_scores\.json/.test(appPubspec) && /-\s+assets\/data\/app_policy\.json/.test(appPubspec) && !/-\s+assets\/(?:mock|local)\//.test(appPubspec),
  productionSourcesReadFormalAssets: /assets\/data\/schools\.json/.test(appLocalSchoolSource) && /assets\/data\/admission_scores\.json/.test(appLocalScoreSource),
  noRuntimeDataSourceSelector: !/String\.fromEnvironment\s*\(\s*['"](?:DATA_SOURCE|SUPABASE_)/.test(appLibSource),
  noMockOrSupabaseRuntime: !/package:supabase_flutter|Supabase\.initialize|class\s+(?:Mock|Supabase)(?:School|AdmissionScore)DataSource|assets\/mock\//.test(`${appPubspec}\n${appMain}\n${appLibSource}`)
}

const releaseWarnings = []
if (!runtimeChecks.singleLocalDataMode || !runtimeChecks.defaultRepositoriesUseLocalSources) {
  releaseWarnings.push('Flutter 默认 Repository 尚未锁定为唯一正式本地数据链路。')
}
if (!runtimeChecks.productionAssetsRegistered || !runtimeChecks.productionSourcesReadFormalAssets) {
  releaseWarnings.push('Flutter 正式 JSON 的注册路径与生产 DataSource 读取路径不一致。')
}
if (!runtimeChecks.noRuntimeDataSourceSelector) {
  releaseWarnings.push('Flutter 仍存在运行时数据源环境变量切换逻辑。')
}
if (!runtimeChecks.noMockOrSupabaseRuntime) {
  releaseWarnings.push('Flutter 生产代码或依赖仍包含 mock/Supabase 运行链路。')
}

const failedChecks = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name)
const failedRuntimeChecks = Object.entries(runtimeChecks).filter(([, passed]) => !passed).map(([name]) => name)
const summary = {
  mini: {
    schools: schools.length,
    scores: admissionScores.length,
    scores2025: yearCount(admissionScores, 2025),
    scores2026: yearCount(admissionScores, 2026),
    duplicateSchoolIds: duplicates(schools, 'id').length,
    duplicateScoreIds: duplicates(admissionScores, 'id').length,
    invalidScoreReferences: admissionScores.filter((score) => !miniSchoolIds.has(score.schoolId)).length,
    over740: admissionScores.filter((score) => score.minScore > 740).length,
    schoolHash: sha256(miniSchoolProjection),
    scoreHash: sha256(miniScoreProjection)
  },
  app: {
    schools: appSchools.length,
    scores: appScores.length,
    scores2025: yearCount(appScores, 2025),
    scores2026: yearCount(appScores, 2026),
    duplicateSchoolIds: duplicates(appSchools, 'id').length,
    duplicateScoreIds: duplicates(appScores, 'id').length,
    invalidScoreReferences: appScores.filter((score) => !appSchoolIds.has(score.schoolId)).length,
    over740: appScores.filter((score) => score.minScore > 740).length,
    schoolHash: sha256(appSchoolProjection),
    scoreHash: sha256(appScoreProjection)
  },
  checks,
  failedChecks,
  runtimeChecks,
  failedRuntimeChecks,
  schoolDiff,
  scoreDiff,
  releaseWarnings
}

function markdownList(items) {
  return items.length ? items.map((item) => `- ${typeof item === 'string' ? item : `\`${item.id}\`: ${item.fields.join(', ')}`}`).join('\n') : '- 无'
}

function buildReport() {
  const passedCount = Object.values(checks).filter(Boolean).length
  const runtimePassedCount = Object.values(runtimeChecks).filter(Boolean).length
  return `# FINAL-RC4 双端一致性报告\n\n` +
    `生成命令：\`node scripts/verify_cross_platform_consistency.js ../suzhou_highschool_app --write-report\`\n\n` +
    `结论：数据与本地隐私边界检查 ${failedChecks.length ? '未通过' : '通过'}（${passedCount}/${Object.keys(checks).length} 项）；Flutter 正式本地运行链路检查 ${failedRuntimeChecks.length ? '未通过' : '通过'}（${runtimePassedCount}/${Object.keys(runtimeChecks).length} 项）；${releaseWarnings.length ? `仍有 ${releaseWarnings.length} 个运行时阻断` : 'Flutter FINAL-RC4 已完成'}。\n\n` +
    `| 指标 | 微信小程序 | Flutter App | 一致 |\n|---|---:|---:|---|\n` +
    `| 学校数量 | ${summary.mini.schools} | ${summary.app.schools} | ${checks.schoolCount ? '是' : '否'} |\n` +
    `| 分数线总数 | ${summary.mini.scores} | ${summary.app.scores} | ${checks.scoreCount ? '是' : '否'} |\n` +
    `| 2025 分数线 | ${summary.mini.scores2025} | ${summary.app.scores2025} | ${checks.score2025Count ? '是' : '否'} |\n` +
    `| 2026 分数线 | ${summary.mini.scores2026} | ${summary.app.scores2026} | ${checks.score2026Count ? '是' : '否'} |\n` +
    `| 重复 schoolId | ${summary.mini.duplicateSchoolIds} | ${summary.app.duplicateSchoolIds} | ${checks.schoolIdsUnique ? '是' : '否'} |\n` +
    `| 重复 scoreId | ${summary.mini.duplicateScoreIds} | ${summary.app.duplicateScoreIds} | ${checks.scoreIdsUnique ? '是' : '否'} |\n` +
    `| 无效 score.schoolId | ${summary.mini.invalidScoreReferences} | ${summary.app.invalidScoreReferences} | ${checks.scoreReferencesValid ? '是' : '否'} |\n` +
    `| 超过 740 的分数 | ${summary.mini.over740} | ${summary.app.over740} | ${checks.scoreRangeValid ? '是' : '否'} |\n` +
    `| 学校核心字段 SHA-256 | \`${summary.mini.schoolHash}\` | \`${summary.app.schoolHash}\` | ${checks.schoolFieldsEqual ? '是' : '否'} |\n` +
    `| 分数线核心字段 SHA-256 | \`${summary.mini.scoreHash}\` | \`${summary.app.scoreHash}\` | ${checks.scoreFieldsEqual ? '是' : '否'} |\n\n` +
    `## 学校差异\n\n缺失：\n${markdownList(schoolDiff.missing)}\n\n多余：\n${markdownList(schoolDiff.extra)}\n\n字段变化：\n${markdownList(schoolDiff.changed)}\n\n` +
    `## 分数线差异\n\n缺失：\n${markdownList(scoreDiff.missing)}\n\n多余：\n${markdownList(scoreDiff.extra)}\n\n字段变化：\n${markdownList(scoreDiff.changed)}\n\n` +
    `## 隐私和能力边界\n\n${Object.entries(checks).slice(10).map(([name, passed]) => `- ${passed ? 'PASS' : 'FAIL'}: ${name}`).join('\n')}\n\n` +
    `## Flutter 正式本地运行链路\n\n${Object.entries(runtimeChecks).map(([name, passed]) => `- ${passed ? 'PASS' : 'FAIL'}: ${name}`).join('\n')}\n\n` +
    `## Flutter 运行时阻断\n\n${markdownList(releaseWarnings)}\n`
}

if (writeReport) {
  fs.writeFileSync(path.join(miniRoot, 'docs/cross_platform_consistency_report.md'), buildReport())
}

console.log(JSON.stringify(summary, null, 2))
if (failedChecks.length || failedRuntimeChecks.length) process.exit(1)
