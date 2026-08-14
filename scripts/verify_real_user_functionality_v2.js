const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { installWxStorage, loadStorageFresh } = require('./rc9_test_helpers')
const { schools } = require('../data/schools')
const { admissionScores } = require('../data/admission-scores')
const { admissionScores2026 } = require('../data/admission-scores-2026')
const { APP_CONFIG } = require('../config/app-config')
const { FALLBACK_CONTENT, createFallbackSnapshot } = require('../utils/public-data-fallback')

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

function check(name, callback) {
  callback()
  console.log(`✓ ${name}`)
}

function navigationTargets(source) {
  return [...source.matchAll(/wx\.(?:navigateTo|redirectTo|switchTab|reLaunch)\s*\(\s*\{[\s\S]*?url\s*:\s*['"`]\/?([^?'"`$]+)/g)]
    .map((match) => match[1])
}

function installIsolatedFileSystem() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sucheng-v2-backup-e2e-'))
  wx.env = { USER_DATA_PATH: tempRoot }
  wx.getFileSystemManager = () => ({
    writeFileSync(filePath, content, encoding) { fs.writeFileSync(filePath, content, encoding) },
    readFileSync(filePath, encoding) { return fs.readFileSync(filePath, encoding) },
    statSync(filePath) { return fs.statSync(filePath) },
    readdirSync(directory) { return fs.readdirSync(directory) }
  })
  return tempRoot
}

function backupRestoreEndToEnd() {
  installWxStorage()
  const tempRoot = installIsolatedFileSystem()
  try {
    const storage = loadStorageFresh()
    assert.strictEqual(storage.ensureStorageMigrated().ok, true)
    assert.strictEqual(storage.createStudentProfile({
      id: 'final_usability_profile',
      nickname: '终审隔离档案',
      examYear: 2027
    }).ok, true)
    assert.strictEqual(storage.saveScoreRecord({
      id: 'final_usability_score',
      examName: '终审隔离考试',
      examDate: '2026-08-13',
      totalScore: 638,
      createdAt: '2026-08-13T08:00:00.000Z',
      updatedAt: '2026-08-13T08:00:00.000Z'
    }).ok, true)
    assert.strictEqual(storage.saveTargetRecord({
      id: 'final_usability_target',
      schoolId: schools[0].id,
      schoolName: schools[0].name,
      createdAt: '2026-08-13T08:01:00.000Z',
      updatedAt: '2026-08-13T08:01:00.000Z'
    }).ok, true)

    delete require.cache[require.resolve('../utils/backup-restore')]
    const backup = require('../utils/backup-restore')
    const exported = backup.exportBackupFile()
    assert.strictEqual(exported.ok, true, '真实备份文件必须写入成功')
    assert.strictEqual(fs.existsSync(exported.filePath), true, '导出的备份文件必须真实存在')
    assert.ok(fs.statSync(exported.filePath).size > 0, '导出的备份文件不能为空')
    assert.strictEqual(backup.readBackupFile(exported.filePath).ok, true, '导出的文件必须可读并通过校验')

    const originalScore = storage.getScoreRecords()[0]
    assert.strictEqual(storage.saveScoreRecord({ ...originalScore, totalScore: 700, score: 700 }).ok, true)
    assert.strictEqual(storage.deleteTargetRecord(storage.getTargetRecords()[0].id).ok, true)
    assert.strictEqual(storage.updateStudentProfile('final_usability_profile', { nickname: '已修改待恢复' }).ok, true)
    assert.strictEqual(storage.getScoreRecords()[0].totalScore, 700)
    assert.strictEqual(storage.getTargetRecords().length, 0)

    const selected = backup.readBackupFile(exported.filePath)
    assert.strictEqual(backup.importBackupEnvelope(selected.backup, {
      mode: 'overwrite',
      operationId: 'final_usability_restore'
    }).ok, true)
    assert.strictEqual(storage.getActiveProfile().nickname, '终审隔离档案')
    assert.strictEqual(storage.getScoreRecords()[0].examName, '终审隔离考试')
    assert.strictEqual(storage.getScoreRecords()[0].totalScore, 638)
    assert.strictEqual(storage.getTargetRecords()[0].schoolId, schools[0].id)
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true })
  }
}

check('REAL-01 正式页面严格为 10 页且四类页面文件齐全', () => {
  const app = readJson('app.json')
  assert.deepStrictEqual(app.pages, expectedPages)
  for (const page of expectedPages) {
    for (const suffix of ['js', 'wxml', 'json', 'wxss']) assert.ok(exists(`${page}.${suffix}`), `${page}.${suffix} missing`)
  }
})

check('REAL-02 五个 Tab 均指向存在的正式页面', () => {
  const app = readJson('app.json')
  assert.strictEqual(app.tabBar.list.length, 5)
  for (const item of app.tabBar.list) assert.ok(app.pages.includes(item.pagePath), `invalid tab ${item.pagePath}`)
})

check('REAL-03 所有静态页面跳转目标均存在', () => {
  const source = ['app.js', ...expectedPages.map((page) => `${page}.js`)].map(read).join('\n')
  for (const target of navigationTargets(source)) assert.ok(expectedPages.includes(target), `invalid route ${target}`)
  assert.strictEqual(/wx:\/\/not-found|page not found/i.test(source), false)
})

check('REAL-04 所有用户可见 WXML handler 均有实现', () => {
  for (const page of expectedPages) {
    const source = read(`${page}.js`)
    const wxml = read(`${page}.wxml`)
    const handlers = [...wxml.matchAll(/(?:bind|catch)(?:tap|change|input|confirm|submit|longpress|touchstart|touchend|blur|focus)\s*=\s*["']([A-Za-z_$][\w$]*)["']/g)]
      .map((match) => match[1])
    for (const handler of new Set(handlers)) {
      const escaped = handler.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      assert.ok(new RegExp(`(?:^|[, {\\n])${escaped}\\s*\\(`, 'm').test(source), `${page} missing ${handler}`)
    }
  }
})

check('REAL-05 正式界面无待开发、演示、测试或假入口文案', () => {
  const visible = expectedPages.map((page) => read(`${page}.wxml`)).join('\n')
  assert.strictEqual(/TODO|FIXME|coming\s*soon|待开发|开发中|敬请期待|暂未开放|Lorem\s+ipsum|example\.com|测试学校|示例学校|假数据/i.test(visible), false)
})

check('REAL-06 正式学校和分数数据数量、引用、范围与标识真实', () => {
  assert.strictEqual(schools.length, 55)
  assert.strictEqual(admissionScores.length, 146)
  assert.strictEqual(admissionScores2026.length, 43)
  assert.strictEqual(admissionScores.filter((item) => item.year === 2025).length, 103)
  assert.strictEqual(admissionScores.filter((item) => item.year === 2026).length, 43)
  const schoolIds = new Set(schools.map((item) => item.id))
  const scoreIds = new Set(admissionScores.map((item) => item.id))
  assert.strictEqual(schoolIds.size, schools.length)
  assert.strictEqual(scoreIds.size, admissionScores.length)
  assert.strictEqual(admissionScores.some((item) => !schoolIds.has(item.schoolId)), false)
  assert.strictEqual(admissionScores.some((item) => Number(item.minScore) < 0 || Number(item.minScore) > 740), false)
  const formalText = JSON.stringify({ schools, admissionScores })
  assert.strictEqual(/(?:^|[_\s-])(test|demo|fake|dummy|example)(?:[_\s-]|$)/i.test(formalText), false)
  assert.strictEqual(schools.some((item) => !/^https:\/\//.test(item.sourceUrl || '')), false)
  assert.strictEqual(admissionScores.some((item) => !/^https:\/\//.test(item.sourceUrl || '')), false)
})

check('REAL-07 AppID 与正式项目安全配置正确', () => {
  const project = readJson('project.config.json')
  assert.strictEqual(project.appid, 'wxc2a2a94f767438dd')
  assert.strictEqual(project.setting.urlCheck, true)
  assert.strictEqual(project.setting.ignoreDevUnusedFiles, false)
  assert.strictEqual(project.setting.uploadWithSourceMap, false)
})

check('REAL-08 未上线远程数据在 2.0 正式运行链路中关闭', () => {
  const appSource = read('app.js')
  assert.strictEqual(APP_CONFIG.schoolData.remotePublicDataEnabled, false)
  assert.ok(appSource.includes('loadInitial({ useCache: APP_CONFIG.schoolData.remotePublicDataEnabled })'))
  assert.strictEqual((appSource.match(/publicDataService\.refresh\(\)/g) || []).length, 2)
  assert.strictEqual((appSource.match(/if \(APP_CONFIG\.schoolData\.remotePublicDataEnabled\) publicDataService\.refresh\(\)/g) || []).length, 2)
  for (const page of ['pages/home/home', 'pages/schools/schools']) {
    assert.strictEqual(Boolean(readJson(`${page}.json`).enablePullDownRefresh), false)
    assert.strictEqual(read(`${page}.js`).includes('onPullDownRefresh'), false)
  }
  assert.strictEqual(['app.js', ...expectedPages.map((page) => `${page}.js`)].map(read).join('\n').includes('数据已更新'), false)
})

check('REAL-09 当前图片和公告为零且 FAQ/客服有真实包内兜底', () => {
  const snapshot = createFallbackSnapshot()
  assert.deepStrictEqual(snapshot.images, [])
  assert.deepStrictEqual(snapshot.announcements, [])
  assert.strictEqual(FALLBACK_CONTENT.faq.length, 6)
  assert.strictEqual(FALLBACK_CONTENT.contact.email, '3341251927@qq.com')
  assert.strictEqual(FALLBACK_CONTENT.contact.wechat, 'shsz1610')
  assert.ok(read('pages/home/home.wxml').includes('wx:if="{{announcements.length}}"'))
  assert.ok(read('pages/school-detail/school-detail.wxml').includes('wx:if="{{images.length}}"'))
})

check('REAL-10 用户隐私能力与正式运行代码一致', () => {
  const runtime = ['app.js', ...expectedPages.map((page) => `${page}.js`), ...fs.readdirSync(path.join(root, 'utils')).filter((name) => name.endsWith('.js')).map((name) => `utils/${name}`)]
    .map(read).join('\n')
  for (const forbidden of ['wx.login', 'wx.getUserProfile', 'wx.getPhoneNumber', 'wx.getLocation', 'wx.chooseLocation', 'wx.requestPayment', 'wx.uploadFile', 'wx.downloadFile', 'wx.getClipboardData']) {
    assert.strictEqual(runtime.includes(forbidden), false, forbidden)
  }
  const privacy = read('pages/privacy/privacy.js')
  for (const phrase of ['openid', 'unionid', '手机号', '定位', '支付', '云同步', 'Clipboard', 'MessageFile']) assert.ok(privacy.includes(phrase))
})

check('REAL-11 成功提示只在真实成功分支出现且清理有明确反馈', () => {
  const backupPage = read('pages/backup-restore/backup-restore.js')
  assert.ok(backupPage.includes("if (!result.ok) {\n      wx.showToast"))
  assert.ok(backupPage.includes("wx.showToast({ title: '备份已生成', icon: 'success' })"))
  assert.ok(backupPage.includes("title: result.ok ? '文件已发送' : result.message || '发送失败，可重试'"))
  assert.ok(backupPage.includes("wx.showToast({ title: overwrite ? '备份已恢复' : '备份已合并', icon: 'success' })"))
  assert.ok(backupPage.includes("else wx.showToast({ title: '当前档案数据已清除', icon: 'success' })"))
  assert.ok(backupPage.includes("else wx.showToast({ title: '本机数据已清除', icon: 'success' })"))
})

check('REAL-12 备份真实创建、文件读取、修改后覆盖恢复全链路成功', backupRestoreEndToEnd)

check('REAL-13 上传包排除和审核材料均与 2.0 实际能力一致', () => {
  const project = readJson('project.config.json')
  for (const entry of ['docs', 'scripts', 'shared-spec', 'utils/generated']) {
    assert.ok(project.packOptions.ignore.some((rule) => rule.type === 'folder' && rule.value === entry), entry)
  }
  const review = read('docs/wechat_review_v1.md')
  const releaseNotes = read('docs/release_notes_v1.md')
  const checklist = read('docs/user_final_acceptance_checklist.md')
  for (const text of [review, releaseNotes, checklist]) assert.ok(text.includes('2.0'))
  assert.ok(review.includes('不访问远程公开数据接口'))
  assert.ok(releaseNotes.includes('不依赖尚未上线的远程接口'))
  assert.strictEqual(/正式上线前将通过|生产公开数据服务已完成时，能正常读取|必须完成生产公开数据服务/.test(`${review}\n${releaseNotes}\n${checklist}`), false)
})

console.log('REAL USER FUNCTIONALITY V2 VERIFY PASSED (13/13)')
