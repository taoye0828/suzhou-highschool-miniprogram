const assert = require('assert')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { installWxStorage, loadStorageFresh, makeExam } = require('./rc9_test_helpers')
const { schools } = require('../data/schools')
const { admissionScores } = require('../data/admission-scores')
const { PRODUCT_RULES } = require('../utils/runtime-constants')

const root = path.resolve(__dirname, '..')
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')
const readJson = (relative) => JSON.parse(read(relative))
const exists = (relative) => fs.existsSync(path.join(root, relative))
const expectedPages = [
  'pages/home/home',
  'pages/schools/schools',
  'pages/school-detail/school-detail',
  'pages/score-trend/score-trend',
  'pages/targets/targets',
  'pages/profile/profile',
  'pages/profile-management/profile-management',
  'pages/backup-restore/backup-restore',
  'pages/help/help',
  'pages/privacy/privacy'
]
const removedPages = [
  'target-analysis',
  'school-compare',
  'web-view',
  'favorites',
  'data-info',
  'data-management',
  'restore-points',
  'exam-settings',
  'global-search',
  'reports'
]

console.log('FCP-MP: 验证微信小程序首发收口...')

const app = readJson('app.json')
assert.deepStrictEqual(app.pages, expectedPages)
assert.deepStrictEqual(app.tabBar.list.map((item) => item.text), ['首页', '学校库', '成绩', '目标', '我的'])
assert.deepStrictEqual(app.tabBar.list.map((item) => item.pagePath), [
  'pages/home/home',
  'pages/schools/schools',
  'pages/score-trend/score-trend',
  'pages/targets/targets',
  'pages/profile/profile'
])
const actualPageDirs = fs.readdirSync(path.join(root, 'pages'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => `pages/${entry.name}/${entry.name}`)
  .sort()
assert.deepStrictEqual(actualPageDirs, expectedPages.slice().sort())
for (const name of removedPages) assert.strictEqual(exists(`pages/${name}`), false)
console.log('✓ FCP-01 正式页面为 10 页，五个 Tab 保持稳定')

const runtimeSurface = [
  'app.js',
  'app.json',
  ...expectedPages.flatMap((page) => [`${page}.js`, `${page}.wxml`, `${page}.json`, `${page}.wxss`]),
  'config/app-config.js'
].map(read).join('\n')
for (const page of removedPages) assert.strictEqual(runtimeSurface.includes(`pages/${page}/`), false)
for (const token of [
  'recommendation', 'scenario', 'sprint', 'safe', 'targetClassification', 'primaryTarget',
  'targetLevel', 'schoolCompare', 'comparisonSchoolIds', 'favorite', 'favorites',
  'candidateStatus', 'userTags', 'userNote', 'learningTask', 'weeklyPlan', 'stageGoal',
  'stageReview', 'mistake', 'lossReason', 'subjectScores', 'scoreScheme', 'onboarding',
  'tutorial', 'dynamicHelp'
]) {
  assert.strictEqual(new RegExp(`\\b${token}\\b`, 'i').test(runtimeSurface), false, `runtime surface contains ${token}`)
}
assert.strictEqual(exists('components/onboarding-overlay'), false)
assert.strictEqual(exists('utils/onboarding.js'), false)
console.log('✓ FCP-02 被删除功能无正式页面、路由、handler 或教程组件残留')

const userVisible = expectedPages.map((page) => read(`${page}.wxml`)).join('\n')
for (const phrase of [
  '版本更新', '当前数据版本', '功能冻结', 'Schema', 'Backup v', 'Restore Point',
  'checksum', '校验摘要', '本地路径', '当前步骤提示', '重播教程',
  '数据健康', '只读扫描', '安全修复', 'JSON 报告', '文本报告', '冲刺', '保底',
  '录取概率', '推荐学校', '考试模板', '分值方案', '考试复盘', '错题',
  '学习任务', '周计划', '收藏', '学校对比'
]) {
  assert.strictEqual(userVisible.includes(phrase), false, `visible UI contains ${phrase}`)
}
assert.strictEqual(/>[^<]*schoolId[^<]*</i.test(userVisible), false, 'schoolId must not be visible text')
console.log('✓ FCP-03 用户界面无版本、维护术语或已删除功能文案')

const scoreWxml = read('pages/score-trend/score-trend.wxml')
for (const field of ['考试名称', '考试日期', '总分（0—740）']) assert.ok(scoreWxml.includes(field))
for (const phrase of ['单科', '排名', '得分率', '复盘', '错题', '模板', '方案']) {
  assert.strictEqual(scoreWxml.includes(phrase), false)
}
assert.ok(read('pages/score-trend/score-trend.js').includes('slice(-10)'))
assert.ok(scoreWxml.includes('trendCanvas'))
console.log('✓ FCP-04 成绩录入仅保留名称、日期、总分，趋势最多 10 条')

const targetsWxml = read('pages/targets/targets.wxml')
for (const phrase of ['历史参考年份', '历史公开参考分', '当前总分', '数字差值']) assert.ok(targetsWxml.includes(phrase))
assert.ok(targetsWxml.includes('按历史公开分数计算，仅供了解，不代表未来录取结果。'))
console.log('✓ FCP-05 目标页仅保留手动目标学校和历史数字差值')

const help = `${read('pages/help/help.js')}\n${read('pages/help/help.wxml')}`
assert.ok(help.includes('3341251927@qq.com'))
assert.ok(help.includes('shsz1610'))
assert.ok(help.includes('复制邮箱'))
assert.ok(help.includes('复制微信号'))
assert.ok(help.includes('wx.setClipboardData'))
assert.strictEqual(/feishu|问卷|WebView|反馈链接/i.test(help), false)
console.log('✓ FCP-06 静态帮助、六项 FAQ 与两种人工客服复制方式存在')

const privacy = `${read('pages/privacy/privacy.js')}\n${read('pages/privacy/privacy.wxml')}`
for (const phrase of ['学生档案昵称', '中考年份', '考试总分记录', '目标学校', '必要用户设置']) assert.ok(privacy.includes(phrase))
for (const phrase of ['openid', 'unionid', '手机号', '身份证', '定位', '支付', '云同步']) assert.ok(privacy.includes(phrase))
console.log('✓ FCP-07 隐私说明与首发实际能力一致')

for (const page of expectedPages) {
  const js = read(`${page}.js`)
  const wxml = read(`${page}.wxml`)
  const handlers = [...wxml.matchAll(/(?:bind|catch)(?:tap|change|input|confirm|submit|longpress|touchstart|touchend|blur|focus)\s*=\s*["']([A-Za-z_$][\w$]*)["']/g)]
    .map((match) => match[1])
  for (const handler of new Set(handlers)) {
    const escaped = handler.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    assert.ok(new RegExp(`(?:^|[, {\\n])${escaped}\\s*\\(`, 'm').test(js), `${page} missing ${handler}`)
  }
}
console.log('✓ FCP-08 所有可见 WXML handler 均有对应实现')

const project = readJson('project.config.json')
const privateProject = readJson('project.private.config.json')
assert.strictEqual(project.appid, 'wxc2a2a94f767438dd')
assert.strictEqual(project.setting.ignoreDevUnusedFiles, false)
assert.strictEqual(privateProject.setting.ignoreDevUnusedFiles, false)
assert.strictEqual(project.setting.uploadWithSourceMap, false)
assert.ok(project.packOptions.ignore.some((rule) => rule.type === 'folder' && rule.value === 'utils/generated'))
const sitemap = readJson('sitemap.json')
assert.strictEqual(sitemap.rules.some((rule) => rule.action === 'allow' && rule.page === '*'), false)
for (const page of ['pages/home/home', 'pages/schools/schools', 'pages/school-detail/school-detail', 'pages/help/help', 'pages/privacy/privacy']) {
  assert.ok(sitemap.rules.some((rule) => rule.action === 'allow' && rule.page === page))
}
assert.ok(sitemap.rules.some((rule) => rule.action === 'disallow' && rule.page === '*'))
console.log('✓ FCP-09 Source Map、unused-file 保护、Sitemap 与开发文件隔离符合要求')

assert.strictEqual(PRODUCT_RULES.storageSchemaVersion, 5)
assert.strictEqual(PRODUCT_RULES.backupFormatVersion, 3)
assert.strictEqual(PRODUCT_RULES.restorePointFormatVersion, 2)
assert.strictEqual(PRODUCT_RULES.examTotalScoreMax, 740)
assert.strictEqual(PRODUCT_RULES.limits.maxProfiles, 10)
assert.strictEqual(PRODUCT_RULES.limits.maxExamRecordsPerProfile, 100)
assert.strictEqual(PRODUCT_RULES.limits.maxTargetRecordsPerProfile, 100)
assert.strictEqual(PRODUCT_RULES.limits.maxImportFileBytes, 4194304)
assert.strictEqual(/releaseStatus|productStage|featureFreezeVersion|performanceBudgetsMs/.test(read('utils/runtime-constants.js')), false)
assert.strictEqual(/version|storageMigration|startupRecovery|targetCenterSegment/.test(read('app.js')), false)
console.log('✓ FCP-10 正式运行常量只保留核心限制和兼容版本')

assert.strictEqual(schools.length, 55)
assert.strictEqual(admissionScores.length, 146)
assert.strictEqual(admissionScores.filter((item) => item.year === 2025).length, 103)
assert.strictEqual(admissionScores.filter((item) => item.year === 2026).length, 43)
assert.strictEqual(admissionScores.filter((item) => item.minScore > 740).length, 0)
const expectedHashes = {
  'data/schools.js': 'c185182c8dd8577b3165278c16014dbff98249585cf76bd1182b6ea1581d62f2',
  'data/admission-scores.js': '0d6257cd336dee5afe853d6c4d9ece68e1cefe2bb56a652cb8f8c651a14ccf88',
  'data/admission-scores-2026.js': '3091136605728315653049fb4802e83b87d9f86cb568746027ec9ef21417d75c'
}
for (const [relative, expected] of Object.entries(expectedHashes)) {
  const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, relative))).digest('hex')
  assert.strictEqual(actual, expected)
}
console.log('✓ FCP-11 55/103/43/146、740、AppID 与三份正式数据 SHA 不变')

installWxStorage()
const storage = loadStorageFresh()
assert.strictEqual(storage.ensureStorageMigrated().ok, true)
const activeProfile = storage.getActiveProfile()
const profileId = activeProfile.id
const coreExam = makeExam('legacy-exam', 650, '2026-08-01', {
  subjectScores: [{ subjectId: 'math', subjectName: '数学', maxScore: 130, score: 110 }],
  review: { summary: '旧记录内嵌复盘' }
})
const targetSchool = schools[0]
const stateResult = storage.getVersionedState()
assert.strictEqual(stateResult.ok, true)
const state = stateResult.state
state.profileData[profileId] = {
  ...state.profileData[profileId],
  favoriteSchoolIds: [targetSchool.id],
  scoreRecords: [coreExam],
  scoreReviews: [{ id: 'review-1', examRecordId: coreExam.id, summary: '旧复盘' }],
  targetRecords: [{ id: 'target-1', schoolId: targetSchool.id, schoolName: targetSchool.name }],
  stageGoals: [{ id: 'goal-1', title: '旧阶段目标' }],
  learningTasks: [{ id: 'task-1', title: '旧学习任务' }],
  examTemplates: [{ id: 'template-1', name: '旧模板' }],
  scoreSchemes: [{ id: 'scheme-1', name: '旧方案', metricType: 'full_total', totalMaxScore: 740 }],
  mistakeRecords: [{ id: 'mistake-1', examRecordId: coreExam.id, subjectId: 'math' }],
  weeklyPlans: [{ id: 'week-1', weekStartDate: '2026-08-03', weekEndDate: '2026-08-09' }],
  stageReviews: [{ id: 'stage-review-1', stageGoalId: 'goal-1', summary: '旧阶段复盘' }],
  schoolUserStates: [{ id: 'state-1', schoolId: targetSchool.id, candidateStatus: 'focused', tags: ['重点'], note: '旧备注' }],
  comparisonSchoolIds: [targetSchool.id],
  primaryTargetSchoolId: targetSchool.id
}
state.sharedFavoriteSchoolIds = [targetSchool.id]
state.onboarding = { version: 2, completed: true }
assert.strictEqual(storage.replaceVersionedState(state).ok, true)
delete require.cache[require.resolve('../utils/backup-restore')]
const backup = require('../utils/backup-restore')
const envelope = backup.createBackupEnvelope({ exportedAt: '2026-08-07T00:00:00.000Z' })
assert.strictEqual(envelope.ok, true)
assert.strictEqual(backup.validateBackupEnvelope(envelope.backup).ok, true)
assert.strictEqual(backup.importBackupEnvelope(envelope.backup, { mode: 'overwrite' }).ok, true)
const restored = storage.getVersionedState().state.profileData[profileId]
assert.strictEqual(restored.scoreRecords[0].totalScore, 650)
assert.strictEqual(restored.targetRecords[0].schoolId, targetSchool.id)
for (const field of ['scoreReviews', 'stageGoals', 'learningTasks', 'examTemplates', 'scoreSchemes', 'mistakeRecords', 'weeklyPlans', 'stageReviews', 'schoolUserStates']) {
  assert.strictEqual(restored[field].length, 1, `legacy field ${field} lost`)
}
assert.strictEqual(restored.scoreRecords[0].subjectScores.length, 1)
assert.strictEqual(restored.favoriteSchoolIds.length, 1)
assert.strictEqual(restored.comparisonSchoolIds.length, 1)
assert.strictEqual(storage.getVersionedState().state.onboarding.completed, true)
console.log('✓ FCP-12 旧单科、复盘、学习、收藏、对比、状态和教程数据可备份、校验并恢复')

console.log('FCP MP FIRST RELEASE VERIFY PASSED (12 TEST-ID)')
