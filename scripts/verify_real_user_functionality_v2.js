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

check('REAL-08 远程数据能力在 1.2.0 正式运行链路中保持开启', () => {
  const appSource = read('app.js')
  assert.strictEqual(APP_CONFIG.schoolData.remotePublicDataEnabled, true)
  assert.strictEqual(APP_CONFIG.schoolData.publicApiBase, 'https://api.royalcup.top')
  assert.ok(appSource.includes('loadInitial({ useCache: APP_CONFIG.schoolData.remotePublicDataEnabled })'))
  assert.strictEqual((appSource.match(/publicDataService\.refresh\(\)/g) || []).length, 2)
  assert.strictEqual((appSource.match(/if \(APP_CONFIG\.schoolData\.remotePublicDataEnabled\) publicDataService\.refresh\(\)/g) || []).length, 2)
  assert.ok(read('pages/targets/targets.js').includes("require('../../utils/public-data-service')"))
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
  assert.ok(backupPage.includes("wx.showToast({ title: '微信发送界面已打开', icon: 'success' })"))
  assert.ok(backupPage.includes("wx.showToast({ title: '已取消发送', icon: 'none' })"))
  assert.ok(backupPage.includes('备份文件没有发送成功，请稍后重试。'))
  assert.strictEqual(backupPage.includes('文件已发送'), false)
  assert.ok(backupPage.includes("wx.showToast({ title: overwrite ? '备份已恢复' : '备份已合并', icon: 'success' })"))
  assert.ok(backupPage.includes("else wx.showToast({ title: '当前档案数据已清除', icon: 'success' })"))
  assert.ok(backupPage.includes("else wx.showToast({ title: '本机数据已清除', icon: 'success' })"))
})

check('REAL-12 备份真实创建、文件读取、修改后覆盖恢复全链路成功', backupRestoreEndToEnd)

check('REAL-13 上传包排除和审核材料均与 1.2.0 实际能力一致', () => {
  const project = readJson('project.config.json')
  for (const entry of ['docs', 'scripts', 'shared-spec', 'utils/generated']) {
    assert.ok(project.packOptions.ignore.some((rule) => rule.type === 'folder' && rule.value === entry), entry)
  }
  const review = read('docs/wechat_review_1_2_0.md')
  const releaseNotes = read('docs/release_notes_1_2_0.md')
  const legacyReview = read('docs/wechat_review_v1.md')
  const legacyReleaseNotes = read('docs/release_notes_v1.md')
  const checklist = read('docs/user_final_acceptance_checklist.md')
  for (const text of [review, releaseNotes, checklist]) assert.ok(text.includes('1.2.0'))
  assert.ok(review.includes('https://api.royalcup.top'))
  assert.ok(review.includes('last-known-good'))
  assert.ok(review.includes('urlCheck'))
  assert.ok(releaseNotes.includes('https://api.royalcup.top'))
  assert.ok(legacyReview.includes('wechat_review_1_2_0.md'))
  assert.ok(legacyReleaseNotes.includes('release_notes_1_2_0.md'))
  assert.strictEqual(/正式上线前将通过|生产公开数据服务已完成时，能正常读取|必须完成生产公开数据服务/.test(`${review}\n${releaseNotes}\n${checklist}`), false)
})

check('REAL-14 十个正式页面关键按钮连接真实导航、Storage 或微信系统能力', () => {
  const contracts = {
    'pages/home/home.js': ['wx.navigateTo', 'wx.switchTab'],
    'pages/schools/schools.js': ['this.refresh()', 'wx.navigateTo'],
    'pages/school-detail/school-detail.js': ['saveTargetRecord', 'deleteTargetRecord', 'wx.setClipboardData', 'wx.navigateBack'],
    'pages/score-trend/score-trend.js': ['saveScoreRecord', 'deleteScoreRecord', 'this.refresh()'],
    'pages/targets/targets.js': ['deleteTargetRecord', 'wx.navigateTo', 'wx.switchTab'],
    'pages/profile/profile.js': ['wx.navigateTo'],
    'pages/profile-management/profile-management.js': ['createStudentProfile', 'switchStudentProfile', 'updateStudentProfile', 'deleteStudentProfile'],
    'pages/backup-restore/backup-restore.js': ['exportBackupFile', 'shareFile', 'importBackupEnvelope', 'clearCurrentProfileData', 'clearLocalData'],
    'pages/help/help.js': ['wx.setClipboardData'],
    'pages/privacy/privacy.js': ['Page({']
  }
  for (const [file, effects] of Object.entries(contracts)) {
    const source = read(file)
    for (const effect of effects) assert.ok(source.includes(effect), `${file} missing real effect ${effect}`)
    for (const match of source.matchAll(/(?:confirmText|cancelText)\s*:\s*['"]([^'"]+)['"]/gu)) {
      assert.ok([...match[1]].length <= 4, `${file} modal button text exceeds WeChat's 4-character limit: ${match[1]}`)
    }
  }
})

function installBackupPageHarness(options = {}) {
  installWxStorage()
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sucheng-v2-backup-buttons-'))
  const toasts = []
  const modals = []
  const shares = []
  const fileSystem = {
    writeFileSync(filePath, content, encoding) {
      if (options.failWrite) throw new Error('simulated backup write failure')
      fs.writeFileSync(filePath, content, encoding)
    },
    readFileSync(filePath, encoding) { return fs.readFileSync(filePath, encoding) },
    statSync(filePath) { return fs.statSync(filePath) },
    readdirSync(directory) { return fs.readdirSync(directory) }
  }
  Object.assign(wx, {
    env: { USER_DATA_PATH: tempRoot },
    getFileSystemManager: () => fileSystem,
    showToast: (value) => toasts.push(value),
    showModal: (value) => {
      modals.push(value)
      if (options.modalFailure) {
        value.fail({ errMsg: 'showModal:fail simulated' })
        return
      }
      const confirm = options.modalConfirm !== false
      value.success({ confirm, cancel: !confirm })
    },
    shareFileMessage: (value) => {
      shares.push({ filePath: value.filePath, fileName: value.fileName })
      if (options.shareOutcome === 'cancel') {
        value.fail({ errMsg: 'shareFileMessage:fail cancel' })
      } else if (options.shareOutcome === 'fail') {
        value.fail({ errMsg: 'shareFileMessage:fail system error' })
      } else {
        value.success({ errMsg: 'shareFileMessage:ok' })
      }
    }
  })
  const storage = loadStorageFresh()
  assert.strictEqual(storage.ensureStorageMigrated().ok, true)
  const pageModule = require.resolve('../pages/backup-restore/backup-restore')
  const shareModule = require.resolve('../utils/file-share')
  delete require.cache[pageModule]
  delete require.cache[shareModule]
  let definition = null
  global.Page = (value) => { definition = value }
  require('../pages/backup-restore/backup-restore')
  delete global.Page
  assert.ok(definition, 'backup page must register')
  const page = { ...definition, data: JSON.parse(JSON.stringify(definition.data)) }
  page.setData = (changes) => {
    for (const [key, value] of Object.entries(changes)) {
      const parts = key.split('.')
      let cursor = page.data
      while (parts.length > 1) {
        const part = parts.shift()
        cursor[part] = cursor[part] || {}
        cursor = cursor[part]
      }
      cursor[parts[0]] = value
    }
  }
  return {
    page,
    storage,
    tempRoot,
    toasts,
    modals,
    shares,
    backup: require('../utils/backup-restore'),
    cleanup() { fs.rmSync(tempRoot, { recursive: true, force: true }) }
  }
}

async function runBackupRealityChecks() {
  let passed = 0
  const verify = async (name, callback) => {
    await callback()
    passed += 1
    console.log(`✓ ${name}`)
  }

  const success = installBackupPageHarness()
  try {
    await verify('BACKUP-01 “查看备份范围”正式入口存在', () => {
      assert.match(read('pages/backup-restore/backup-restore.wxml'), /bindtap="previewExport"/)
    })
    await verify('BACKUP-02 点击范围入口产生可见范围结果', () => {
      assert.strictEqual(typeof success.page.previewExport, 'function')
      success.page.previewExport()
      assert.ok(success.page.data.exportScope)
      assert.ok(success.toasts.some((item) => item.title === '已显示本次备份范围'))
    })

    assert.strictEqual(success.storage.createStudentProfile({
      id: 'backup_p0_profile',
      nickname: '备份P0隔离档案',
      examYear: 2027
    }).ok, true)
    assert.strictEqual(success.storage.saveScoreRecord({
      id: 'backup_p0_score_1',
      examName: '备份P0隔离考试',
      examDate: '2026-08-16',
      totalScore: 641,
      createdAt: '2026-08-16T08:00:00.000Z',
      updatedAt: '2026-08-16T08:00:00.000Z'
    }).ok, true)
    assert.strictEqual(success.storage.saveTargetRecord({
      id: 'backup_p0_target_1',
      schoolId: schools[0].id,
      schoolName: schools[0].name,
      createdAt: '2026-08-16T08:01:00.000Z',
      updatedAt: '2026-08-16T08:01:00.000Z'
    }).ok, true)
    success.page.previewExport()
    const liveEnvelope = success.backup.createBackupEnvelope().backup

    await verify('BACKUP-03 范围由当前真实备份 Schema 生成', () => {
      assert.deepStrictEqual(success.page.data.exportScope.schema.rootFields, Object.keys(liveEnvelope).sort())
      assert.deepStrictEqual(
        success.page.data.exportScope.schema.profileDataFields,
        Object.keys(liveEnvelope.profileData.backup_p0_profile).sort()
      )
    })
    await verify('BACKUP-04 档案、成绩、目标数量含零值时均准确显示', () => {
      const byKey = Object.fromEntries(success.page.data.exportScope.items.map((item) => [item.key, item]))
      assert.strictEqual(byKey.profiles.count, 2)
      assert.strictEqual(byKey.scores.count, 1)
      assert.strictEqual(byKey.targets.count, 1)
      assert.strictEqual(byKey.learning.count, 0)
      assert.strictEqual(byKey.customConfigs.count, 0)
    })
    await verify('BACKUP-05 备份范围覆盖 JSON 全部用户字段并说明不包含项', () => {
      assert.deepStrictEqual(success.page.data.exportScope.schema.undisclosedRootFields, [])
      assert.deepStrictEqual(success.page.data.exportScope.schema.undisclosedProfileDataFields, [])
      assert.match(success.page.data.exportScope.excludedText, /学校公开数据库.*后台或远程数据.*系统文件/)
    })
    await verify('BACKUP-06 “发送备份”入口始终可见且有真实 handler', () => {
      const wxml = read('pages/backup-restore/backup-restore.wxml')
      assert.match(wxml, /bindtap="sendBackupFile"/)
      assert.strictEqual(/wx:if[^>]*bindtap="sendBackupFile"|bindtap="sendBackupFile"[^>]*wx:if/.test(wxml), false)
      assert.strictEqual(typeof success.page.sendBackupFile, 'function')
    })

    success.page.exportBackup()
    assert.strictEqual(success.storage.saveScoreRecord({
      id: 'backup_p0_score_latest',
      examName: '发送前最新成绩',
      examDate: '2026-08-16',
      totalScore: 655,
      createdAt: '2026-08-16T08:02:00.000Z',
      updatedAt: '2026-08-16T08:02:00.000Z'
    }).ok, true)
    const shareResult = await success.page.sendBackupFile()
    const shareCall = success.shares[0]
    const sharedJson = JSON.parse(fs.readFileSync(shareCall.filePath, 'utf8'))

    await verify('BACKUP-07 发送前重新生成包含最新数据的备份', () => {
      assert.strictEqual(shareResult.ok, true)
      assert.ok(sharedJson.profileData.backup_p0_profile.scoreRecords.some((item) => item.id === 'backup_p0_score_latest'))
    })
    await verify('BACKUP-08 发送文件路径真实存在且文件名清楚', () => {
      assert.strictEqual(fs.existsSync(shareCall.filePath), true)
      assert.match(shareCall.fileName, /^suzhou_highschool_backup_\d{14}\.json$/u)
      assert.strictEqual(path.basename(shareCall.filePath), shareCall.fileName)
    })
    await verify('BACKUP-09 发送文件为合法且通过校验的 JSON', () => {
      assert.ok(sharedJson && typeof sharedJson === 'object')
      assert.strictEqual(success.backup.readBackupFile(shareCall.filePath).ok, true)
    })
    await verify('BACKUP-10 wx.shareFileMessage 调用参数与最新文件完全一致', () => {
      assert.strictEqual(success.shares.length, 1)
      assert.ok(success.modals.some((item) => item.title === '发送最新备份' && item.confirmText.length <= 4))
      assert.strictEqual(shareCall.filePath, success.page.data.exportFileName
        ? `${success.tempRoot}/${success.page.data.exportFileName}`
        : '')
      assert.ok(success.toasts.some((item) => item.title === '微信发送界面已打开'))
    })
  } finally {
    success.cleanup()
  }

  const cancelled = installBackupPageHarness({ shareOutcome: 'cancel' })
  try {
    const result = await cancelled.page.sendBackupFile()
    await verify('BACKUP-11 用户取消不会提示或记录发送成功', () => {
      assert.strictEqual(result.status, 'cancelled')
      assert.ok(cancelled.toasts.some((item) => item.title === '已取消发送'))
      assert.strictEqual(cancelled.toasts.some((item) => ['微信发送界面已打开', '文件已发送', '发送成功'].includes(item.title)), false)
    })
  } finally {
    cancelled.cleanup()
  }

  const failed = installBackupPageHarness({ shareOutcome: 'fail' })
  try {
    const result = await failed.page.sendBackupFile()
    await verify('BACKUP-12 微信接口失败不会提示成功', () => {
      assert.strictEqual(result.ok, false)
      assert.strictEqual(failed.toasts.some((item) => ['微信发送界面已打开', '文件已发送', '发送成功'].includes(item.title)), false)
      assert.ok(failed.toasts.some((item) => item.title === '备份文件没有发送成功，请稍后重试。'))
    })
  } finally {
    failed.cleanup()
  }

  const writeFailed = installBackupPageHarness({ failWrite: true })
  try {
    const result = await writeFailed.page.sendBackupFile()
    await verify('BACKUP-13 文件生成失败时不调用发送接口', () => {
      assert.strictEqual(result.ok, false)
      assert.strictEqual(writeFailed.shares.length, 0)
      assert.ok(writeFailed.toasts.some((item) => item.title === '备份文件生成失败，请稍后重试。'))
    })
  } finally {
    writeFailed.cleanup()
  }

  const closedLoop = installBackupPageHarness()
  try {
    assert.strictEqual(closedLoop.storage.createStudentProfile({
      id: 'backup_closed_loop_profile',
      nickname: '闭环隔离档案',
      examYear: 2027
    }).ok, true)
    assert.strictEqual(closedLoop.storage.saveScoreRecord({
      id: 'backup_closed_loop_score',
      examName: '闭环隔离考试',
      examDate: '2026-08-16',
      totalScore: 632,
      createdAt: '2026-08-16T09:00:00.000Z',
      updatedAt: '2026-08-16T09:00:00.000Z'
    }).ok, true)
    assert.strictEqual(closedLoop.storage.saveTargetRecord({
      id: 'backup_closed_loop_target',
      schoolId: schools[1].id,
      schoolName: schools[1].name,
      createdAt: '2026-08-16T09:01:00.000Z',
      updatedAt: '2026-08-16T09:01:00.000Z'
    }).ok, true)
    const exported = closedLoop.backup.exportBackupFile()
    assert.strictEqual(exported.ok, true)
    assert.strictEqual(closedLoop.storage.clearLocalData({ operationId: 'backup_closed_loop_clear' }).ok, true)
    const selected = closedLoop.backup.readBackupFile(exported.filePath)
    assert.strictEqual(selected.ok, true)
    assert.strictEqual(closedLoop.backup.importBackupEnvelope(selected.backup, {
      mode: 'overwrite',
      operationId: 'backup_closed_loop_restore'
    }).ok, true)
    const restarted = loadStorageFresh()
    await verify('BACKUP-14 隔离数据导出、清除、恢复、重启与清理闭环通过', () => {
      assert.strictEqual(restarted.getActiveProfile().id, 'backup_closed_loop_profile')
      assert.ok(restarted.getScoreRecords().some((item) => item.id === 'backup_closed_loop_score'))
      assert.ok(restarted.getTargetRecords().some((item) => item.id === 'backup_closed_loop_target'))
      assert.strictEqual(restarted.deleteStudentProfile('backup_closed_loop_profile', {
        operationId: 'backup_closed_loop_cleanup'
      }).ok, true)
      assert.strictEqual(restarted.getProfiles().some((item) => item.id === 'backup_closed_loop_profile'), false)
    })
  } finally {
    closedLoop.cleanup()
  }

  assert.strictEqual(passed, 14)
  console.log('BACKUP REAL FUNCTIONALITY V2 VERIFY PASSED (14/14)')
}

runBackupRealityChecks()
  .then(() => console.log('REAL USER FUNCTIONALITY V2 VERIFY PASSED (14 ORIGINAL/SCAN + 14 BACKUP)'))
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
