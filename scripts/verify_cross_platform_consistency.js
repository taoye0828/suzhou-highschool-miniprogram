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

const appSchoolsPath = path.join(appRoot, 'assets/local/schools_v1_4_0.json')
const appScoresPath = path.join(appRoot, 'assets/local/admission_scores_v1_4_0.json')
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
const appSupabaseSources = [
  'lib/data/sources/supabase_school_data_source.dart',
  'lib/data/sources/supabase_admission_score_data_source.dart'
].filter((relative) => fs.existsSync(path.join(appRoot, relative))).map(readApp).join('\n')

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
  appNoUserDataUpload: !/\.(?:insert|update|upsert|delete)\s*\(/.test(appSupabaseSources),
  miniPrivacyLocalOnly: APP_CONFIG.policy.privacySections.some((section) => section.items.some((item) => item.includes('不上传收藏、学习目标记录或输入草稿'))),
  appPrivacyLocalOnly: /只保存在本机|不会上传/.test(appRuntime)
}

const releaseWarnings = []
if (/defaultDataSourceMode\s*=\s*DataSourceMode\.mock/.test(appRuntime)) {
  releaseWarnings.push('Flutter 当前默认运行模式仍为 mock，虽然已提交正式 JSON 与小程序完全一致，但正式运行链路未完成。')
}
if (/supabase_flutter/.test(readApp('pubspec.yaml'))) {
  releaseWarnings.push('Flutter 仍包含 supabase_flutter 依赖，与 FINAL-RC4 的纯本地正式版范围不一致。')
}

const failedChecks = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name)
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
  schoolDiff,
  scoreDiff,
  releaseWarnings
}

function markdownList(items) {
  return items.length ? items.map((item) => `- ${typeof item === 'string' ? item : `\`${item.id}\`: ${item.fields.join(', ')}`}`).join('\n') : '- 无'
}

function buildReport() {
  const passedCount = Object.values(checks).filter(Boolean).length
  return `# FINAL-RC4 双端一致性报告\n\n` +
    `生成命令：\`node scripts/verify_cross_platform_consistency.js ../suzhou_highschool_app --write-report\`\n\n` +
    `结论：数据与本地隐私边界检查 ${failedChecks.length ? '未通过' : '通过'}（${passedCount}/${Object.keys(checks).length} 项）；Flutter 发布范围另有 ${releaseWarnings.length} 个运行时阻断。\n\n` +
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
    `## Flutter 运行时阻断\n\n${markdownList(releaseWarnings)}\n`
}

if (writeReport) {
  fs.writeFileSync(path.join(miniRoot, 'docs/cross_platform_consistency_report.md'), buildReport())
}

console.log(JSON.stringify(summary, null, 2))
if (failedChecks.length) process.exit(1)
