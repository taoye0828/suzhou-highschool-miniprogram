const assert = require('assert')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const root = path.resolve(__dirname, '..')
const backendRoot = process.env.MP21_BACKEND_ROOT || '/Users/tom/Dev/sucheng_admin'
const database = path.join(backendRoot, 'data', 'sucheng.db')
const apiBase = (process.env.MP21_API_BASE || 'https://api.royalcup.top').replace(/\/$/, '')
const skipRemote = process.env.MP21_SKIP_REMOTE === '1'

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function latestReleaseRoot() {
  if (process.env.MP21_RELEASE_ROOT) return path.resolve(process.env.MP21_RELEASE_ROOT)
  return execFileSync('sqlite3', [database, 'SELECT release_path FROM publish_versions ORDER BY id DESC LIMIT 1;'], { encoding: 'utf8' }).trim()
}

function assertLocalChain(releaseRoot) {
  const manifest = readJson(path.join(releaseRoot, 'manifest.json'))
  assert.strictEqual(manifest.schemaVersion, 3, 'MP21 release schemaVersion 必须为 3')
  assert.strictEqual(manifest.contentVersion, manifest.releaseVersion, 'contentVersion 必须指向当前不可变 release')
  assert.strictEqual(manifest.schoolContentVersion, manifest.releaseVersion, '逐学校内容版本必须与 release 一致')

  const datasets = {}
  for (const [name, item] of Object.entries(manifest.files)) {
    const buffer = fs.readFileSync(path.join(releaseRoot, item.path))
    assert.strictEqual(buffer.length, item.size, `${name} 文件大小必须一致`)
    assert.strictEqual(sha256(buffer), item.sha256, `${name} SHA-256 必须一致`)
    datasets[name] = JSON.parse(buffer.toString('utf8'))
  }
  assert.strictEqual(datasets.schools.length, 55, '学校数量必须保持 55')
  assert.strictEqual(datasets.scores.length, 146, '分数线总数必须保持 146')
  assert.strictEqual(datasets.scores.filter((item) => item.year === 2025).length, 103, '2025 分数线必须保持 103')
  assert.strictEqual(datasets.scores.filter((item) => item.year === 2026).length, 43, '2026 分数线必须保持 43')
  assert.strictEqual(datasets.scores.some((item) => Number(item.score) > 740), false, '分数不得超过 740')

  const schools = new Map(datasets.schools.map((item) => [item.id, item]))
  assert.strictEqual(schools.size, 55, 'schoolId 必须唯一')
  assert.strictEqual(Object.keys(manifest.schoolContentFiles || {}).length, 55, '必须为每所学校生成聚合内容文件')
  for (const [schoolId, item] of Object.entries(manifest.schoolContentFiles)) {
    const buffer = fs.readFileSync(path.join(releaseRoot, item.path))
    assert.strictEqual(buffer.length, item.size, `${schoolId} 内容文件大小必须一致`)
    assert.strictEqual(sha256(buffer), item.sha256, `${schoolId} 内容文件 SHA-256 必须一致`)
    const payload = JSON.parse(buffer.toString('utf8'))
    assert.deepStrictEqual(payload.school, schools.get(schoolId), `${schoolId} 学校内容必须与 schools.json 一致`)
    assert.deepStrictEqual(payload.images, datasets.images.filter((row) => row.schoolId === schoolId), `${schoolId} 图片必须一致`)
    assert.deepStrictEqual(payload.announcements, datasets.announcements.filter((row) => !row.schoolId || row.schoolId === schoolId), `${schoolId} 公告必须一致`)
    assert.strictEqual(payload.contentVersion, manifest.contentVersion)
  }

  const appJson = readJson(path.join(root, 'app.json'))
  assert.ok(appJson.pages.includes('pages/announcement-detail/announcement-detail'), '公告详情页必须注册')
  const service = fs.readFileSync(path.join(root, 'utils/public-data-service.js'), 'utf8')
  const home = fs.readFileSync(path.join(root, 'pages/home/home.wxml'), 'utf8')
  const detail = fs.readFileSync(path.join(root, 'pages/school-detail/school-detail.wxml'), 'utf8')
  const schoolsJs = fs.readFileSync(path.join(root, 'pages/schools/schools.js'), 'utf8')
  const schoolsWxml = fs.readFileSync(path.join(root, 'pages/schools/schools.wxml'), 'utf8')
  const announcementJs = fs.readFileSync(path.join(root, 'pages/announcement-detail/announcement-detail.js'), 'utf8')
  const announcementWxml = fs.readFileSync(path.join(root, 'pages/announcement-detail/announcement-detail.wxml'), 'utf8')
  assert.ok(service.includes('contentVersion') && service.includes('manifestContentVersion'), '数据服务必须按 contentVersion 刷新')
  assert.ok(home.includes('最新公告') && home.includes('openAnnouncement'), '首页必须展示可点击最新公告')
  assert.ok(detail.includes('<swiper') && detail.includes('学校公告') && detail.includes('内容更新时间'), '学校详情必须展示轮播、公告和更新时间')
  assert.ok(schoolsJs.includes('thumbnailUrl') && schoolsWxml.includes('image-placeholder'), '学校列表必须显示封面并提供无图占位')
  assert.ok(announcementJs.includes('onShareAppMessage') && announcementJs.includes('onShareTimeline'), '公告详情必须支持分享回调')
  assert.ok(announcementJs.includes('notFound: true') && announcementWxml.includes('wx:elif="{{notFound}}"'), '公告详情必须处理无效或已下线公告')
  for (const forbidden of ['wx.login', 'wx.cloud', 'wx.requestPayment']) {
    assert.strictEqual(service.includes(forbidden), false, `公开数据服务禁止 ${forbidden}`)
  }
  return { manifest, datasets }
}

async function fetchBuffer(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' } })
  assert.strictEqual(response.status, 200, `${url} 必须返回 HTTP 200`)
  return Buffer.from(await response.arrayBuffer())
}

async function assertRemoteChain(local) {
  const remoteManifestBuffer = await fetchBuffer(`${apiBase}/api/v1/manifest`)
  const remoteManifest = JSON.parse(remoteManifestBuffer.toString('utf8'))
  assert.strictEqual(remoteManifest.releaseVersion, local.manifest.releaseVersion, '生产 API releaseVersion 必须与本地发布版本一致')
  assert.strictEqual(remoteManifest.contentVersion, local.manifest.contentVersion, '生产 API contentVersion 必须一致')
  for (const [name, item] of Object.entries(remoteManifest.files)) {
    const endpoint = name === 'sources' ? 'sources-public' : name
    const buffer = await fetchBuffer(`${apiBase}/api/v1/${endpoint}`)
    assert.strictEqual(sha256(buffer), item.sha256, `生产 ${name} SHA-256 必须一致`)
  }
  for (const [schoolId, item] of Object.entries(remoteManifest.schoolContentFiles || {})) {
    const buffer = await fetchBuffer(`${apiBase}/api/v1/schools/${encodeURIComponent(schoolId)}`)
    assert.strictEqual(sha256(buffer), item.sha256, `生产学校接口 ${schoolId} 必须与 release 一致`)
  }
}

async function main() {
  const releaseRoot = latestReleaseRoot()
  const local = assertLocalChain(releaseRoot)
  if (!skipRemote) await assertRemoteChain(local)
  console.log(`MP21 CONTENT CHAIN VERIFY PASSED (${local.manifest.releaseVersion}; schools=55; scores=146; images=${local.datasets.images.length}; announcements=${local.datasets.announcements.length}; remote=${skipRemote ? 'SKIPPED' : 'PASSED'})`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
