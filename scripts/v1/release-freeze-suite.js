const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { assert, runTest } = require('./test-helpers')
const { PRODUCT_RULES } = require('../../utils/generated/product-rules')
const { canonicalJson } = require('../../utils/canonical-json')
const { schools } = require('../../data/schools')
const { admissionScores2025, admissionScores } = require('../../data/admission-scores')
const { admissionScores2026 } = require('../../data/admission-scores-2026')

const ROOT = path.resolve(__dirname, '../..')
const DOCS = path.join(ROOT, 'docs')
const SHA40 = /^[0-9a-f]{40}$/
const EXPECTED_RAW_HASHES = {
  'data/schools.js': 'c185182c8dd8577b3165278c16014dbff98249585cf76bd1182b6ea1581d62f2',
  'data/admission-scores.js': '0d6257cd336dee5afe853d6c4d9ece68e1cefe2bb56a652cb8f8c651a14ccf88',
  'data/admission-scores-2026.js': '3091136605728315653049fb4802e83b87d9f86cb568746027ec9ef21417d75c'
}
const EXPECTED_SEMANTIC_HASHES = {
  schools: '102c0df402548d46ee5c1b4ea190acdc08b4940f0c525ff0eb75012e6aa273e4',
  scores2025: '97be24ee4d042ad631c0183b1feee199c38da330cf8d57aeb3dff7021c654a8a',
  scores2026: '6e789117f4a7ec312020a65f7717bcbb48d5b4d5fb29678f088c36822c794a1b'
}

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath))
}

function walk(relativePath) {
  const target = path.join(ROOT, relativePath)
  if (!fs.existsSync(target)) return []
  if (fs.statSync(target).isFile()) return [target]
  return fs.readdirSync(target, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(target, entry.name)
    return entry.isDirectory() ? walk(path.relative(ROOT, child)) : [child]
  })
}

function runtimeText() {
  return ['app.js', 'app.json', 'app.wxss', 'sitemap.json', 'pages', 'components', 'utils', 'config', 'data', 'styles']
    .flatMap(walk)
    .filter((file) => /\.(?:js|json|wxml|wxss)$/.test(file))
    .map((file) => fs.readFileSync(file, 'utf8'))
    .join('\n')
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function semanticHash(items) {
  return sha256(canonicalJson(items.slice().sort((left, right) => String(left.id).localeCompare(String(right.id)))))
}

function testIdentityAndNavigation() {
  const project = readJson('project.config.json')
  const app = readJson('app.json')
  assert.strictEqual(project.appid, PRODUCT_RULES.officialAppId)
  assert.strictEqual(project.projectname, PRODUCT_RULES.productName)
  assert.strictEqual(project.description, PRODUCT_RULES.productName)
  assert.strictEqual(app.window.navigationBarTitleText, PRODUCT_RULES.productName)
  assert.deepStrictEqual(app.tabBar.list.map((item) => item.text), ['首页', '学校库', '成绩', '目标规划', '我的'])
  assert.strictEqual(app.tabBar.list.length, 5)
  for (const route of ['pages/exam-settings/exam-settings', 'pages/global-search/global-search', 'pages/reports/reports']) {
    assert.ok(app.pages.includes(route), `missing formal route ${route}`)
  }
  assert.strictEqual(JSON.stringify(project).includes('wx17e903f81714736f'), false)
}

function testInternalVersionContract() {
  assert.strictEqual(PRODUCT_RULES.releaseStatus, 'V1 功能冻结版')
  assert.strictEqual(PRODUCT_RULES.productStage, 'pre_release_ux_freeze')
  assert.strictEqual(PRODUCT_RULES.featureFreezeVersion, 1)
  assert.strictEqual(PRODUCT_RULES.storageSchemaVersion, 5)
  assert.strictEqual(PRODUCT_RULES.backupFormatVersion, 3)
  assert.strictEqual(PRODUCT_RULES.restorePointFormatVersion, 2)
}

function testFeatureManifest() {
  const manifest = readJson('docs/v1_feature_freeze_manifest.json')
  assert.strictEqual(manifest.freezeStatus, 'V1_CODE_FREEZE_READY')
  assert.strictEqual(manifest.features.some((item) => item.status === 'partial'), false)
  const byName = new Map(manifest.features.map((item) => [item.name, item.status]))
  for (const name of ['学校库', '考试模板', '分值方案', '错题', '周计划', '阶段复盘', '全局搜索', '文本报告', 'JSON 报告', '备份分享', '启动恢复']) {
    assert.strictEqual(byName.get(name), 'included', `${name} must be included`)
  }
  for (const name of ['PDF', 'PIN', 'Face ID', 'Touch ID', '登录', '云同步', 'AI', '正式 2027 数据']) {
    assert.strictEqual(byName.get(name), 'excluded', `${name} must be excluded`)
  }
  assert.strictEqual(byName.get('2027 候选工具'), 'developer_only')
}

function testLifecycleMatrix() {
  const matrix = readJson('docs/v1_entity_lifecycle_matrix.json')
  const requiredEntities = [
    'examRecord', 'scoreReview', 'scoreLossReason', 'mistakeRecord', 'examTemplate', 'scoreScheme',
    'learningTask', 'weeklyPlan', 'stageGoal', 'stageReview', 'targetRecord', 'schoolUserState',
    'studentProfile', 'userBackup', 'restorePoint', 'recentHistory', 'reportSnapshot'
  ]
  const requiredFields = [
    'create', 'read', 'update', 'delete', 'backup', 'restore', 'migrate', 'clear', 'healthCheck',
    'profileScope', 'versionConflict', 'idempotency', 'formalEntry', 'service', 'storageField', 'tests'
  ]
  assert.deepStrictEqual(matrix.entities.map((item) => item.entity).sort(), requiredEntities.slice().sort())
  for (const entity of matrix.entities) {
    for (const field of requiredFields) assert.ok(entity[field], `${entity.entity}.${field} missing`)
    assert.ok(Array.isArray(entity.tests) && entity.tests.length > 0, `${entity.entity}.tests missing`)
  }
}

function testCoverageMatrix() {
  const matrix = readJson('docs/v1_test_coverage_matrix.json')
  const defects = matrix.entries.filter((item) => /^D\d{3}$/.test(item.id))
  assert.strictEqual(defects.length, 44)
  assert.deepStrictEqual(defects.map((item) => item.id), Array.from({ length: 44 }, (_, index) => `D${String(index + 1).padStart(3, '0')}`))
  for (const entry of matrix.entries) {
    assert.ok(entry.formalFiles.length > 0, `${entry.id} formalFiles missing`)
    assert.ok(entry.functions.length > 0, `${entry.id} functions missing`)
    assert.ok(entry.testIds.length > 0, `${entry.id} testIds missing`)
    assert.ok(entry.testFiles.length > 0, `${entry.id} testFiles missing`)
    assert.strictEqual(entry.result, 'PASS')
    assert.match(entry.commit, SHA40)
  }
  assert.ok(matrix.summary.testIdCount >= 100)
}

function testDefectClosure() {
  const defects = read('docs/rc11_final_existing_defects.md')
  for (let index = 1; index <= 44; index += 1) {
    const id = `D${String(index).padStart(3, '0')}`
    assert.match(defects, new RegExp(`\\| ${id} \\| fixed_verified \\|`), `${id} not fixed_verified`)
  }
  assert.doesNotMatch(defects, /\| D\d{3} \| (?:confirmed|blocked) \|/)
  assert.match(defects, /\| D044 \| fixed_verified \|[^\n]+\| V1-FREEZE-044 \| [0-9a-f]{40} \|/)
}

function testProductionPathRegressionClosure() {
  const storage = read('utils/rc9-storage.js')
  const context = read('utils/operation-context.js')
  const pages = ['profile-management', 'profile', 'home', 'favorites', 'schools', 'school-detail', 'school-compare', 'score-trend', 'targets', 'restore-points', 'data-management', 'backup-restore', 'exam-settings', 'reports']
    .map((name) => fs.existsSync(path.join(ROOT, `pages/${name}/${name}.js`)) ? read(`pages/${name}/${name}.js`) : '')
    .join('\n')
  assert.doesNotMatch(storage, /if\s*\(\s*!operationId\s*\)\s*return\s+action\s*\(/)
  assert.match(storage, /function protectedCall[\s\S]+createOperationContext/)
  assert.match(context, /operationId/)
  assert.match(pages, /beginOperation|operationContext|operationId/)
  assert.doesNotMatch(pages, /wx\.(?:setStorage|setStorageSync|removeStorage|removeStorageSync)\s*\(/)
}

function testFormalDataInvariants() {
  assert.strictEqual(schools.length, 55)
  assert.strictEqual(admissionScores2025.length, 103)
  assert.strictEqual(admissionScores2026.length, 43)
  assert.strictEqual(admissionScores.length, 146)
  assert.strictEqual(admissionScores.filter((item) => item.year === 2027).length, 0)
  assert.ok(admissionScores.every((item) => Number(item.minScore ?? item.score) <= 740))
  for (const [file, expected] of Object.entries(EXPECTED_RAW_HASHES)) {
    assert.strictEqual(sha256(fs.readFileSync(path.join(ROOT, file))), expected, `${file} raw hash changed`)
  }
  assert.strictEqual(semanticHash(schools), EXPECTED_SEMANTIC_HASHES.schools)
  assert.strictEqual(semanticHash(admissionScores2025), EXPECTED_SEMANTIC_HASHES.scores2025)
  assert.strictEqual(semanticHash(admissionScores2026), EXPECTED_SEMANTIC_HASHES.scores2026)
}

function testPrivacyAndExcludedCapabilities() {
  const runtime = runtimeText()
  for (const marker of [
    /wx\.login\s*\(/, /wx\.request\s*\(/, /wx\.uploadFile\s*\(/, /wx\.cloud/, /wx\.requestPayment\s*\(/,
    /wx\.getLocation\s*\(/, /wx\.chooseMedia\s*\(/, /wx\.chooseImage\s*\(/, /openId|unionId/, /supabase/i
  ]) assert.doesNotMatch(runtime, marker)
  for (const phrase of ['录取概率', '一定能上', '精准预测', 'AI 推荐', '官方推荐']) assert.strictEqual(runtime.includes(phrase), false)
  assert.match(runtime, /历史公开数据整理，仅供目标规划参考。/)
  assert.match(runtime, /不构成录取判断或志愿建议/)
}

function testDeveloperOnly2027Isolation() {
  const runtime = runtimeText()
  assert.strictEqual(runtime.includes('annual_data_2027_candidates'), false)
  assert.strictEqual(runtime.includes('generate_2027'), false)
  const project = readJson('project.config.json')
  const ignore = project.packOptions.ignore
  assert.ok(ignore.some((item) => item.type === 'folder' && item.value === 'docs'))
  assert.ok(ignore.some((item) => item.type === 'folder' && item.value === 'scripts'))
  assert.ok(ignore.some((item) => item.type === 'folder' && item.value === 'shared-spec'))
  assert.ok(ignore.some((item) => item.type === 'file' && item.value === 'README.md'))
  assert.ok(fs.existsSync(path.join(DOCS, 'annual_data_2027_candidates')))
}

function testEvidenceAndReadme() {
  for (const file of [
    'docs/v1_feature_freeze_report.md', 'docs/v1_first_release_acceptance.md',
    'docs/rc11_final_full_report.md', 'docs/rc11_final_evidence.json',
    'docs/rc11_final_evidence_index.md', 'README.md'
  ]) assert.ok(fs.existsSync(path.join(ROOT, file)), `${file} missing`)
  const evidence = readJson('docs/rc11_final_evidence.json')
  assert.strictEqual(evidence.freezeStatus.code, 'V1_CODE_FREEZE_READY')
  assert.strictEqual(evidence.freezeStatus.preReleaseUxFreezeConfirmed, false)
  assert.strictEqual(evidence.tests.v1TestIdCount >= 100, true)
  const readme = read('README.md')
  for (const marker of ['苏程记录', 'wxc2a2a94f767438dd', 'Schema v5', 'Backup v3', 'Restore Point v2', 'V1_CODE_FREEZE_READY', 'PRE_RELEASE_UX_FREEZE_CONFIRMED']) {
    assert.ok(readme.includes(marker), `README missing ${marker}`)
  }
}

function run() {
  return [
    runTest('V1-FREEZE-001', testIdentityAndNavigation),
    runTest('V1-FREEZE-002', testInternalVersionContract),
    runTest('V1-FREEZE-003', testFeatureManifest),
    runTest('V1-FREEZE-004', testLifecycleMatrix),
    runTest('V1-FREEZE-005', testCoverageMatrix),
    runTest('V1-FREEZE-006', testDefectClosure),
    runTest('V1-FREEZE-044', testProductionPathRegressionClosure),
    runTest('V1-FREEZE-007', testFormalDataInvariants),
    runTest('V1-FREEZE-008', testPrivacyAndExcludedCapabilities),
    runTest('V1-FREEZE-009', testDeveloperOnly2027Isolation),
    runTest('V1-FREEZE-010', testEvidenceAndReadme)
  ]
}

module.exports = { run, EXPECTED_RAW_HASHES, EXPECTED_SEMANTIC_HASHES }
