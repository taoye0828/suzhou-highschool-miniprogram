const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'))
const project = JSON.parse(fs.readFileSync(path.join(root, 'project.config.json'), 'utf8'))
const privacy = fs.readFileSync(path.join(root, 'pages/privacy/privacy.js'), 'utf8')
const service = fs.readFileSync(path.join(root, 'utils/public-data-service.js'), 'utf8')
const storage = fs.readFileSync(path.join(root, 'utils/storage.js'), 'utf8')
const localStore = fs.readFileSync(path.join(root, 'utils/rc9-storage.js'), 'utf8') + fs.readFileSync(path.join(root, 'utils/rc9-models.js'), 'utf8')

assert.strictEqual(app.pages.length, 11, '正式页面必须为11个')
assert.strictEqual(app.tabBar.list.length, 5, 'Tab必须为5个')
assert.strictEqual(project.appid, 'wxc2a2a94f767438dd')
assert.strictEqual(project.setting.ignoreDevUnusedFiles, false)
assert.strictEqual(project.setting.uploadWithSourceMap, false)
for (const phrase of ['不需要微信登录', 'openid', 'unionid', '不读取手机号', '不请求定位', '不接入支付']) {
  assert.ok(privacy.includes(phrase), `隐私说明缺少：${phrase}`)
}
assert.ok(service.includes("method: 'GET'"), '服务器仅获取公开数据')
assert.strictEqual(/POST|PUT|PATCH|DELETE/.test(service), false, '客户端公开数据服务不得写服务器')
assert.strictEqual(/saveScore|saveTarget|profile|backup/i.test(service), false, '公开数据服务不得接触个人数据')
assert.ok(storage.includes("require('./rc9-storage')") && /score/i.test(localStore) && /target/i.test(localStore) && /profile/i.test(localStore), '用户数据必须继续由本机 storage 管理')
assert.strictEqual(/wx\.login|getUserProfile|getPhoneNumber|wx\.getLocation|wx\.requestPayment|wx\.cloud/.test(service + privacy), false)

require('./verify_upload_package_ignore')
console.log('FORMAL STATIC VERIFY PASSED（FCP 隐私边界 + 本地用户数据 + 只读公开请求）')
