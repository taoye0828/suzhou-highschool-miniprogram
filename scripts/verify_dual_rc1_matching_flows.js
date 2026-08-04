const assert = require('assert')
const fs = require('fs')
const path = require('path')
const {
  root,
  installWxStorage,
  loadStorageFresh,
  makeExam,
  read,
  readJson
} = require('./rc9_test_helpers')
const { EXAM_TOTAL_SCORE } = require('../config/app-config')
const { PRODUCT_RULES } = require('../utils/generated/product-rules')
const { schools } = require('../data/schools')
const { admissionScores } = require('../data/admission-scores')

console.log('DUAL-RC1: 验证小程序对应档案、提示、教程与总分流程...')

const profileManagementJs = read('pages/profile-management/profile-management.js')
const profileJs = read('pages/profile/profile.js')
const storageJs = read('utils/rc9-storage.js')
const onboardingJs = read('utils/onboarding.js')
const overlayJs = read('components/onboarding-overlay/onboarding-overlay.js')
const scoreJs = read('pages/score-trend/score-trend.js')
const scoreWxml = read('pages/score-trend/score-trend.wxml')
const targetsJs = read('pages/targets/targets.js')
const targetsWxml = read('pages/targets/targets.wxml')
const examSettingsJs = read('pages/exam-settings/exam-settings.js')
const examSettingsWxml = read('pages/exam-settings/exam-settings.wxml')

console.log('\n[TEST] 档案创建防重复与失败恢复')
assert.ok(profileManagementJs.includes('creatingProfile: false'))
assert.ok(profileManagementJs.includes('if (this.data.creatingProfile) return'))
assert.ok(profileManagementJs.includes('this.setData({ creatingProfile: true })'))
assert.ok(profileManagementJs.includes('complete: () => this.setData({ creatingProfile: false })'))
assert.ok(profileJs.includes('this.setData({ dynamicHelp: current })'))
assert.ok(profileJs.includes("title: result.message || '关闭提示失败，请重试'"))

installWxStorage()
let storage = loadStorageFresh()
assert.strictEqual(storage.ensureStorageMigrated().ok, true)
const firstProfile = storage.getActiveProfile()
assert.ok(firstProfile)
assert.strictEqual(storage.updateStudentProfile(firstProfile.id, { favoritesMode: 'shared' }).ok, true)
const createdProfile = storage.createStudentProfile({ nickname: 'DUAL-RC1 新档案' })
assert.strictEqual(createdProfile.ok, true)
assert.strictEqual(createdProfile.profile.favoritesMode, 'independent')
assert.strictEqual(storage.switchStudentProfile(firstProfile.id).ok, true)
assert.strictEqual(storage.getActiveProfile().favoritesMode, 'shared')

let pageDefinition
const previousPage = global.Page
const modalCalls = []
global.Page = (value) => { pageDefinition = value }
global.wx.showModal = (options) => { modalCalls.push(options) }
delete require.cache[require.resolve('../pages/profile-management/profile-management')]
require('../pages/profile-management/profile-management')
const profileManagementPage = {
  data: { ...pageDefinition.data },
  setData(changes) { Object.assign(this.data, changes) }
}
pageDefinition.createProfile.call(profileManagementPage)
pageDefinition.createProfile.call(profileManagementPage)
assert.strictEqual(modalCalls.length, 1)
assert.strictEqual(profileManagementPage.data.creatingProfile, true)
modalCalls[0].complete()
assert.strictEqual(profileManagementPage.data.creatingProfile, false)
global.Page = previousPage
console.log('✓ 连点只打开一个创建弹窗；新档案默认 independent；旧 shared 档案保持不变')

console.log('\n[TEST] 动态帮助按档案隔离并在写入失败时恢复')
installWxStorage()
storage = loadStorageFresh()
assert.strictEqual(storage.ensureStorageMigrated().ok, true)
const profileA = storage.getActiveProfile()
delete require.cache[require.resolve('../utils/onboarding')]
let onboarding = require('../utils/onboarding')
assert.strictEqual(onboarding.dismissDynamicHelp('target_school_empty').ok, true)
assert.ok(storage.getDynamicHelpDismissed().target_school_empty)
const profileB = storage.createStudentProfile({ nickname: '隔离档案' }).profile
assert.deepStrictEqual(storage.getDynamicHelpDismissed(), {})
assert.strictEqual(storage.switchStudentProfile(profileA.id).ok, true)
assert.ok(storage.getDynamicHelpDismissed().target_school_empty)
assert.strictEqual(storage.switchStudentProfile(profileB.id).ok, true)
assert.deepStrictEqual(storage.getDynamicHelpDismissed(), {})
assert.ok(storageJs.includes('legacyExtensions'))
assert.ok(storageJs.includes('dynamicHelpDismissed'))

const toastCalls = []
const originalSetStorageSync = global.wx.setStorageSync
global.wx.setStorageSync = () => { throw new Error('simulated dismiss write failure') }
global.wx.showToast = (options) => toastCalls.push(options)
pageDefinition = null
global.Page = (value) => { pageDefinition = value }
delete require.cache[require.resolve('../pages/profile/profile')]
require('../pages/profile/profile')
const help = { id: 'target_school_empty', message: 'test' }
const profilePage = {
  data: { ...pageDefinition.data, dynamicHelp: help },
  setData(changes) { Object.assign(this.data, changes) }
}
pageDefinition.dismissDynamicHelp.call(profilePage)
assert.deepStrictEqual(profilePage.data.dynamicHelp, help)
assert.ok(toastCalls.some((item) => item.icon === 'none' && item.title.includes('原数据已保留')))
global.wx.setStorageSync = originalSetStorageSync
global.Page = previousPage
console.log('✓ 提示关闭状态按档案隔离；持久化失败会恢复提示并显示错误')

console.log('\n[TEST] 教程第 6/7 步真实目标与异步竞态')
assert.ok(onboardingJs.includes("selector: '.onboarding-target-school-entry'"))
assert.ok(targetsWxml.includes('onboarding-target-school-entry'))
assert.ok(onboardingJs.includes("selector: '.onboarding-score-form'"))
assert.ok(scoreJs.includes("hasRecords ? '.onboarding-score-trend' : '.onboarding-score-form'"))
assert.ok(scoreWxml.includes('onboarding-score-form'))
assert.ok(scoreWxml.includes('onboarding-score-trend'))
assert.ok(overlayJs.includes('_measureGeneration'))
assert.ok(overlayJs.includes('generation !== this._measureGeneration'))
assert.ok(overlayJs.includes("highlightVisible: false, highlightStyle: ''"))

let componentDefinition
let pendingQueryCallback
const previousComponent = global.Component
const previousWx = global.wx
global.Component = (value) => { componentDefinition = value }
global.wx = {
  createSelectorQuery: () => ({
    select() { return this },
    boundingClientRect() { return this },
    exec(callback) { pendingQueryCallback = callback }
  }),
  getWindowInfo: () => ({ windowWidth: 390, windowHeight: 844, safeArea: { top: 47, bottom: 810 } })
}
delete require.cache[require.resolve('../components/onboarding-overlay/onboarding-overlay')]
require('../components/onboarding-overlay/onboarding-overlay')
const overlay = {
  properties: { visible: true, step: { selector: '.target', index: 5, total: 7 } },
  data: { ...componentDefinition.data },
  _measureGeneration: 1,
  _measureAttempts: 3,
  setData(changes) { Object.assign(this.data, changes) }
}
for (const [name, method] of Object.entries(componentDefinition.methods)) {
  overlay[name] = method.bind(overlay)
}
overlay.measureTarget()
overlay._measureGeneration = 2
pendingQueryCallback([{ left: 20, top: 120, width: 300, height: 60 }])
assert.strictEqual(overlay.data.highlightVisible, false)
overlay._measureGeneration = 3
overlay.measureTarget()
pendingQueryCallback([null])
assert.strictEqual(overlay.data.highlightVisible, false)
global.Component = previousComponent
global.wx = previousWx
console.log('✓ 第 6 步定位添加学校；第 7 步按有无成绩分流；旧回调和测量失败均不显示假高亮')

console.log('\n[TEST] 单科正式 UI 暂缓与旧字段兼容')
for (const [relative, source] of [
  ['pages/score-trend/score-trend.wxml', scoreWxml],
  ['pages/targets/targets.wxml', targetsWxml],
  ['pages/exam-settings/exam-settings.wxml', examSettingsWxml]
]) {
  for (const marker of [
    '学科成绩', '学科趋势', '添加学科', '单科', 'subjectScores',
    'subjectRules', 'subject_score', 'targetSubjects', 'subjectName'
  ]) {
    assert.strictEqual(source.includes(marker), false, `${relative} 仍显示 ${marker}`)
  }
}
assert.strictEqual(scoreWxml.includes('lossSubjectOptions'), false)
assert.ok(scoreWxml.includes('填写排名和复盘（可选）'))
assert.ok(scoreWxml.includes('记录总分失分原因'))
assert.ok(scoreJs.includes('subjectScores: original && Array.isArray(original.subjectScores)'))
assert.ok(scoreJs.includes('subjectScores: Array.isArray(record.subjectScores) ? record.subjectScores : []'))
assert.ok(scoreJs.includes('subjectScores: []'))
assert.ok(scoreJs.includes("getScoreSchemes().filter((item) => item.metricType !== 'single_subject')"))
assert.ok(scoreJs.includes("record.metricType === 'single_subject'"))
assert.ok(targetsJs.includes('const targetSubjects = []'))
assert.ok(targetsJs.includes("metricType === 'subject_score'"))
assert.ok(examSettingsJs.includes(".filter((value) => value !== 'single_subject')"))
assert.strictEqual(examSettingsWxml.includes('item.metricLabel'), false)
assert.ok(examSettingsJs.includes("? '自定义总分'"))
assert.ok(examSettingsJs.includes("selectableSchemes = scoreSchemes.filter((item) => item.metricType !== 'single_subject')"))
assert.ok(examSettingsJs.includes('templateEnableSubjectScores: item.enableSubjectScores'))
assert.ok(examSettingsJs.includes('schemeSubjectRulesInput: subjectRulesText(item.subjectRules)'))
assert.ok(read('utils/rc9-models.js').includes('subjectScores'))
assert.ok(read('utils/rc9-models.js').includes('targetSubjects'))
console.log('✓ 正式 WXML 无单科入口；新记录写空数组；编辑旧记录保留隐藏字段')

console.log('\n[TEST] 总分边界、正式数据与配置不变量')
installWxStorage()
storage = loadStorageFresh()
assert.strictEqual(storage.ensureStorageMigrated().ok, true)
assert.strictEqual(storage.saveScoreRecord(makeExam('dual_rc1_zero', 0)).ok, true)
assert.strictEqual(storage.saveScoreRecord(makeExam('dual_rc1_max', 740, '2026-09-02')).ok, true)
assert.deepStrictEqual(storage.getScoreRecords().map((item) => item.totalScore).sort((a, b) => a - b), [0, 740])
assert.strictEqual(EXAM_TOTAL_SCORE, 740)
assert.strictEqual(schools.length, 55)
assert.strictEqual(admissionScores.length, 146)
assert.strictEqual(admissionScores.filter((item) => item.year === 2025).length, 103)
assert.strictEqual(admissionScores.filter((item) => item.year === 2026).length, 43)
assert.strictEqual(readJson('project.config.json').appid, 'wxc2a2a94f767438dd')
assert.strictEqual(PRODUCT_RULES.storageSchemaVersion, 5)
assert.strictEqual(PRODUCT_RULES.backupFormatVersion, 3)
assert.strictEqual(PRODUCT_RULES.restorePointFormatVersion, 2)
console.log('✓ 0/740、55 所学校、146 条分数线、AppID 与 Schema/Backup/Restore 版本通过')

console.log('\n[TEST] 本轮 WXML handler 完整性')
for (const relative of [
  'pages/targets/targets.wxml',
  'pages/score-trend/score-trend.wxml',
  'pages/exam-settings/exam-settings.wxml'
]) {
  const wxml = read(relative)
  const js = read(relative.replace(/\.wxml$/, '.js'))
  const handlers = [...wxml.matchAll(/(?:bind|catch)(?:tap|change|input|confirm|submit|longpress|touchstart|touchend|blur|focus)\s*=\s*["']([A-Za-z_$][\w$]*)["']/g)]
    .map((match) => match[1])
  for (const handler of new Set(handlers)) {
    const escaped = handler.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    assert.ok(
      new RegExp(`(?:^|[,{}\\s])${escaped}\\s*\\(`, 'm').test(js),
      `${relative} 绑定的 ${handler} 在 JS 中不存在`
    )
  }
}
assert.ok(fs.existsSync(path.join(root, 'components/onboarding-overlay/onboarding-overlay.wxml')))
console.log('✓ 三个修改页面的 tap/change/input handler 全部存在')

console.log('\nDUAL-RC1 MATCHING FLOWS VERIFY PASSED')
