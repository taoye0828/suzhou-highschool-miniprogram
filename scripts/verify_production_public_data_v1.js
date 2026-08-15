const assert = require('assert')
const fs = require('fs')
const path = require('path')
const { sha256 } = require('../utils/checksum')
const {
  PUBLIC_DATA_CACHE_KEY,
  activeAnnouncements,
  createPublicDataService,
  effectiveContent,
  utf8Size
} = require('../utils/public-data-service')

const root = path.resolve(__dirname, '..')

function raw(value) { return JSON.stringify(value) }

function release(version = 'V1', overrides = {}) {
  const data = {
    schools: [{ id: 'school-1', name: '第一中学', district: '姑苏区', schoolType: '普通高中' }],
    scores: [{ id: 'score-1', schoolId: 'school-1', year: 2026, score: 600, minScore: 600 }],
    images: [],
    announcements: [],
    content: { faq: [], contact: {}, display: {}, sources: [] },
    ...overrides
  }
  const rawFiles = Object.fromEntries(Object.entries(data).map(([key, value]) => [key, raw(value)]))
  const files = Object.fromEntries(Object.entries(rawFiles).map(([key, value]) => [key, {
    path: `${key}.json`,
    recordCount: Array.isArray(data[key]) ? data[key].length : Object.values(data[key]).reduce((sum, item) => sum + (Array.isArray(item) ? item.length : 0), 0),
    size: utf8Size(value),
    sha256: sha256(value)
  }]))
  return {
    manifest: {
      schemaVersion: 1,
      releaseVersion: version,
      publishedAt: '2026-08-12T01:00:00+00:00',
      schoolsVersion: version,
      scoresVersion: version,
      imagesVersion: version,
      announcementsVersion: version,
      contentVersion: version,
      files
    },
    data,
    rawFiles
  }
}

function envelope(candidate) {
  return {
    cacheFormatVersion: 1,
    manifest: candidate.manifest,
    downloadedAt: '2026-08-12T01:01:00.000Z',
    datasetVersions: {},
    rawFiles: candidate.rawFiles
  }
}

function memoryStorage(initial, failWrites = false) {
  const values = new Map(Object.entries(initial || {}))
  return {
    get(key) { return values.get(key) },
    set(key, value) {
      if (failWrites) throw Object.assign(new Error('storage full'), { code: 'STORAGE_FAILED' })
      values.set(key, value)
    },
    values
  }
}

function transportFor(candidate, failures = {}) {
  const calls = []
  return {
    calls,
    async getText(url) {
      calls.push(url)
      const endpoint = url.split('/').pop()
      const failure = failures[endpoint]
      if (failure) throw Object.assign(new Error(failure.message || 'network failed'), { code: failure.code || 'NETWORK_ERROR' })
      if (endpoint === 'manifest') return raw(candidate.manifest)
      if (!Object.hasOwn(candidate.rawFiles, endpoint)) throw Object.assign(new Error('404'), { code: 'HTTP_404' })
      return candidate.rawFiles[endpoint]
    }
  }
}

async function refresh(candidate, options = {}) {
  const storage = options.storage || memoryStorage()
  const transport = options.transport || transportFor(candidate, options.failures)
  const service = createPublicDataService({ storage, transport, now: options.now || (() => 100000000) })
  const initial = service.loadInitial()
  const result = await service.refresh({ force: true })
  return { service, storage, transport, initial, result }
}

async function main() {
  const v1 = release('V1')
  const success = await refresh(v1)
  assert.strictEqual(success.result.ok, true, 'manifest正常')
  assert.strictEqual(success.result.changed, true, '首次完整下载应切换')
  assert.strictEqual(success.result.snapshot.releaseVersion, 'V1')
  assert.ok(success.storage.values.has(PUBLIC_DATA_CACHE_KEY), '完整版本应写入单一缓存Key')
  assert.strictEqual(success.storage.values.get(PUBLIC_DATA_CACHE_KEY).sha256.schools, v1.manifest.files.schools.sha256, '缓存metadata必须记录每文件SHA')

  for (const failure of [
    { name: 'manifest超时', error: { manifest: { code: 'NETWORK_TIMEOUT' } } },
    { name: 'manifest 404', error: { manifest: { code: 'HTTP_404' } } }
  ]) {
    const checked = await refresh(v1, { failures: failure.error })
    assert.strictEqual(checked.result.ok, false, failure.name)
    assert.strictEqual(checked.result.snapshot.source, 'fallback')
    assert.strictEqual(checked.result.snapshot.schools.length, 55, '首次无缓存必须使用包内55校')
    assert.strictEqual(checked.result.snapshot.scores.length, 146, '首次无缓存必须使用包内146条分数')
    assert.strictEqual(checked.transport.calls.length, 2, '网络只有限重试一次')
  }

  const sameTransport = transportFor(v1)
  const sameStorage = memoryStorage({ [PUBLIC_DATA_CACHE_KEY]: envelope(v1) })
  const sameService = createPublicDataService({ storage: sameStorage, transport: sameTransport, now: () => 100000000 })
  sameService.loadInitial()
  const unchanged = await sameService.refresh({ force: true })
  assert.strictEqual(unchanged.changed, false, '版本未变化不得重复下载')
  assert.strictEqual(sameTransport.calls.length, 1, '版本未变化只请求manifest')

  const future = release('V2')
  future.manifest.schemaVersion = 999
  const unsupported = await refresh(future, { storage: memoryStorage({ [PUBLIC_DATA_CACHE_KEY]: envelope(v1) }) })
  assert.strictEqual(unsupported.result.code, 'UNSUPPORTED_SCHEMA', '不支持Schema')
  assert.strictEqual(unsupported.result.snapshot.releaseVersion, 'V1', '不支持Schema继续旧缓存')

  const expanded = release('V2', {
    schools: [
      ...v1.data.schools,
      { id: 'school-2', name: '第二中学', district: '工业园区', schoolType: '普通高中' }
    ],
    scores: [
      ...v1.data.scores,
      { id: 'score-2', schoolId: 'school-2', year: 2026, score: 610, minScore: 610 }
    ],
    images: [{ imageId: 'image-1', schoolId: 'school-2', publicPath: 'assets/schools/school-2/cover.webp', thumbnailPath: 'assets/schools/school-2/cover.thumb.webp', isCover: true }],
    announcements: [{ id: 'notice-1', title: '公开说明', body: '内容', startsAt: null, endsAt: null }],
    content: {
      faq: [{ id: 'faq-1', question: '新问题', answer: '新答案' }],
      contact: { email: 'service@example.com', wechat: 'service-id' },
      display: { showAnnouncements: true, showFaq: true, showContact: true },
      sources: []
    }
  })
  const upgraded = await refresh(expanded, { storage: memoryStorage({ [PUBLIC_DATA_CACHE_KEY]: envelope(v1) }) })
  assert.strictEqual(upgraded.result.snapshot.releaseVersion, 'V2', '版本升级整体切换')
  assert.strictEqual(upgraded.result.snapshot.schools.length, 2, 'schools更新')
  assert.strictEqual(upgraded.result.snapshot.scores.length, 2, 'scores更新')
  assert.strictEqual(upgraded.result.snapshot.images.length, 1, 'images更新')
  assert.strictEqual(upgraded.result.snapshot.announcements.length, 1, 'announcements更新')
  assert.strictEqual(upgraded.result.snapshot.content.faq[0].question, '新问题', 'content更新')

  const badSha = release('V2')
  badSha.manifest.files.scores.sha256 = '0'.repeat(64)
  assert.strictEqual((await refresh(badSha, { storage: memoryStorage({ [PUBLIC_DATA_CACHE_KEY]: envelope(v1) }) })).result.code, 'SHA_MISMATCH', 'SHA错误')

  const badJson = release('V2')
  badJson.rawFiles.content = '{bad json'
  badJson.manifest.files.content.sha256 = sha256(badJson.rawFiles.content)
  badJson.manifest.files.content.size = utf8Size(badJson.rawFiles.content)
  assert.strictEqual((await refresh(badJson, { storage: memoryStorage({ [PUBLIC_DATA_CACHE_KEY]: envelope(v1) }) })).result.code, 'INVALID_JSON', 'JSON损坏')

  for (const test of [
    ['未知schoolId', { scores: [{ id: 'bad', schoolId: 'missing', year: 2026, score: 600 }] }, 'INVALID_SCORE'],
    ['score=-1', { scores: [{ id: 'bad', schoolId: 'school-1', year: 2026, score: -1 }] }, 'INVALID_SCORE'],
    ['score=741', { scores: [{ id: 'bad', schoolId: 'school-1', year: 2026, score: 741 }] }, 'INVALID_SCORE'],
    ['schools为空', { schools: [] }, 'EMPTY_SCHOOLS'],
    ['scores异常为空', { scores: [] }, 'EMPTY_SCORES']
  ]) {
    const candidate = release('V2', test[1])
    const checked = await refresh(candidate, { storage: memoryStorage({ [PUBLIC_DATA_CACHE_KEY]: envelope(v1) }) })
    assert.strictEqual(checked.result.code, test[2], test[0])
    assert.strictEqual(checked.result.snapshot.releaseVersion, 'V1', `${test[0]}不得覆盖旧缓存`)
  }

  for (const endpoint of ['schools', 'scores', 'images', 'announcements', 'content']) {
    const interrupted = await refresh(expanded, {
      storage: memoryStorage({ [PUBLIC_DATA_CACHE_KEY]: envelope(v1) }),
      failures: { [endpoint]: { code: endpoint === 'images' ? 'HTTP_404' : 'DOWNLOAD_INTERRUPTED' } }
    })
    assert.strictEqual(interrupted.result.ok, false, `${endpoint}下载中断`)
    assert.strictEqual(interrupted.result.snapshot.releaseVersion, 'V1', '部分下载成功也不得混合版本')
  }

  const writeFailed = await refresh(expanded, { storage: memoryStorage({ [PUBLIC_DATA_CACHE_KEY]: envelope(v1) }, true) })
  assert.strictEqual(writeFailed.result.code, 'STORAGE_FAILED', '缓存写入失败')
  assert.strictEqual(writeFailed.result.snapshot.releaseVersion, 'V1', '缓存写失败继续旧缓存')

  const corruptCache = memoryStorage({ [PUBLIC_DATA_CACHE_KEY]: { cacheFormatVersion: 1, manifest: {}, rawFiles: {} } })
  const corruptService = createPublicDataService({ storage: corruptCache, transport: transportFor(v1) })
  assert.strictEqual(corruptService.loadInitial().source, 'fallback', '缓存metadata损坏回退包内')

  const missingOptionalContent = effectiveContent({ faq: null, contact: null, display: null })
  assert.ok(missingOptionalContent.faq.length >= 1, 'FAQ失败使用本地帮助')
  assert.strictEqual(missingOptionalContent.contact.email, '3341251927@qq.com', '客服失败使用兜底邮箱')
  assert.strictEqual(missingOptionalContent.contact.wechat, 'shsz1610', '客服失败使用兜底微信')
  assert.deepStrictEqual(activeAnnouncements({ announcements: [], content: missingOptionalContent }), [], '公告为空不显示区域')

  const schoolWxml = fs.readFileSync(path.join(root, 'pages/schools/schools.wxml'), 'utf8')
  const detailWxml = fs.readFileSync(path.join(root, 'pages/school-detail/school-detail.wxml'), 'utf8')
  assert.ok(schoolWxml.includes('lazy-load="true"') && schoolWxml.includes('catcherror="onImageError"'), '列表图片必须懒加载并处理404/超时')
  assert.ok(detailWxml.includes('lazy-load="true"') && detailWxml.includes('catcherror="onImageError"'), '详情图片必须懒加载并处理404/超时')
  assert.ok(detailWxml.includes('图片暂时无法显示'), '图片失败必须显示中文占位')

  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8')
  const { APP_CONFIG } = require('../config/app-config')
  const serviceSource = fs.readFileSync(path.join(root, 'utils/public-data-service.js'), 'utf8')
  assert.ok(app.includes('publicDataService.loadInitial({ useCache: APP_CONFIG.schoolData.remotePublicDataEnabled })'), '启动时必须按正式开关选择缓存或包内正式数据')
  assert.strictEqual(APP_CONFIG.schoolData.remotePublicDataEnabled, false, '2.0 正式版必须关闭远程公开数据入口')
  assert.strictEqual((app.match(/if \(APP_CONFIG\.schoolData\.remotePublicDataEnabled\) publicDataService\.refresh\(\)/g) || []).length, 2, '远程检查只能在显式开关启用时执行')
  const disabledService = createPublicDataService({ storage: memoryStorage({ [PUBLIC_DATA_CACHE_KEY]: envelope(v1) }), transport: transportFor(v1) })
  assert.strictEqual(disabledService.loadInitial({ useCache: false }).source, 'fallback', '关闭远程功能时不得加载历史远程缓存')
  assert.strictEqual(disabledService.getSnapshot().schools.length, 55, '关闭远程功能时必须使用包内55校')
  assert.strictEqual(disabledService.getSnapshot().scores.length, 146, '关闭远程功能时必须使用包内146条分数')
  assert.ok(serviceSource.includes('sucheng.publicData.lastKnownGood.v1'), '必须使用独立单一公开数据缓存Key')
  assert.strictEqual(/saveScore|saveTarget|profile|backup/i.test(serviceSource), false, '公开数据服务不得上传或修改个人数据')

  console.log('PRODUCTION PUBLIC DATA V1 VERIFY PASSED (29 SCENARIOS)')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
