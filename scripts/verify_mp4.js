const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'))
const project = JSON.parse(fs.readFileSync(path.join(root, 'project.config.json'), 'utf8'))
const expectedPages = [
  'pages/home/home',
  'pages/schools/schools',
  'pages/school-detail/school-detail',
  'pages/announcement-detail/announcement-detail',
  'pages/score-trend/score-trend',
  'pages/targets/targets',
  'pages/profile/profile',
  'pages/profile-management/profile-management',
  'pages/backup-restore/backup-restore',
  'pages/help/help',
  'pages/privacy/privacy'
]
const expectedTabs = [
  'pages/home/home',
  'pages/schools/schools',
  'pages/score-trend/score-trend',
  'pages/targets/targets',
  'pages/profile/profile'
]

assert.deepStrictEqual(app.pages, expectedPages, 'FCP 正式版必须保持11个页面')
assert.deepStrictEqual(app.tabBar.list.map((item) => item.pagePath), expectedTabs, 'FCP 正式版必须保持5个Tab')
for (const page of expectedPages) {
  for (const extension of ['js', 'json', 'wxml', 'wxss']) {
    assert.ok(fs.existsSync(path.join(root, `${page}.${extension}`)), `${page}.${extension} missing`)
  }
}
assert.strictEqual(project.appid, 'wxc2a2a94f767438dd')
assert.strictEqual(project.compileType, 'miniprogram')
assert.strictEqual(project.setting.ignoreDevUnusedFiles, false)
assert.strictEqual(project.setting.uploadWithSourceMap, false)

const { schools } = require('../data/schools')
const { admissionScores } = require('../data/admission-scores')
assert.strictEqual(schools.length, 55)
assert.strictEqual(admissionScores.length, 146)
assert.strictEqual(admissionScores.filter((item) => item.year === 2025).length, 103)
assert.strictEqual(admissionScores.filter((item) => item.year === 2026).length, 43)
const schoolIds = new Set(schools.map((item) => item.id))
assert.strictEqual(schoolIds.size, 55)
assert.ok(admissionScores.every((item) => schoolIds.has(item.schoolId)))
assert.ok(admissionScores.every((item) => Number.isInteger(item.minScore) && item.minScore >= 0 && item.minScore <= 740))

const service = fs.readFileSync(path.join(root, 'utils/public-data-service.js'), 'utf8')
const privacy = fs.readFileSync(path.join(root, 'pages/privacy/privacy.js'), 'utf8')
assert.ok(service.includes('wx.request'), '只读公开数据服务必须使用统一 wx.request')
assert.strictEqual((service.match(/wx\.request/g) || []).length, 1, 'wx.request 只能集中在统一服务层')
assert.ok(service.includes("method: 'GET'"), '公开数据请求必须为GET')
assert.ok(privacy.includes('不需要微信登录') && /openid/i.test(privacy) && /unionid/i.test(privacy), '隐私页必须明确说明不登录且不采集身份标识')
assert.strictEqual(/wx\.login|getUserProfile|getPhoneNumber|wx\.getLocation|wx\.requestPayment|wx\.cloud/.test(service), false)

require('./smoke_page_logic')
console.log('MP4 STATIC VERIFY PASSED（FCP 11页面 + 公开只读数据兼容规则）')
