const { sha256 } = require('./checksum')
const { FALLBACK_CONTENT, createFallbackSnapshot } = require('./public-data-fallback')

const PUBLIC_DATA_CACHE_KEY = 'sucheng.publicData.lastKnownGood.v1'
const SUPPORTED_SCHEMA_VERSION = 2
const DEFAULT_API_BASE = 'https://api.royalcup.top'
const FOREGROUND_THROTTLE_MS = 30 * 60 * 1000
const REQUEST_TIMEOUT_MS = 8000
const DATASET_KEYS = ['schools', 'scores', 'images', 'announcements', 'content']
const ENDPOINTS = {
  schools: 'schools', scores: 'scores', images: 'images',
  announcements: 'announcements', content: 'content'
}

function publicDataError(message, code) {
  return Object.assign(new Error(message), { code })
}

function parseJson(raw, label) {
  try { return JSON.parse(raw) } catch (error) {
    throw publicDataError(`${label}返回内容损坏`, 'INVALID_JSON')
  }
}

function utf8Size(value) {
  return unescape(encodeURIComponent(String(value))).length
}

function countRecords(value) {
  return Array.isArray(value)
    ? value.length
    : Object.values(value || {}).reduce((sum, item) => sum + (Array.isArray(item) ? item.length : 0), 0)
}

function assertManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw publicDataError('版本信息无效', 'INVALID_MANIFEST')
  }
  const schema = Number(manifest.schemaVersion)
  if (!Number.isInteger(schema) || schema < 1 || schema > SUPPORTED_SCHEMA_VERSION) {
    throw publicDataError('当前数据版本暂不兼容', 'UNSUPPORTED_SCHEMA')
  }
  if (!String(manifest.releaseVersion || '').trim() || !String(manifest.publishedAt || '').trim() ||
      !manifest.files || typeof manifest.files !== 'object') {
    throw publicDataError('版本信息不完整', 'INVALID_MANIFEST')
  }
  for (const key of DATASET_KEYS) {
    const file = manifest.files[key]
    if (!file || typeof file.path !== 'string' || !/^[a-z0-9._-]+$/i.test(file.path) ||
        !/^[a-f0-9]{64}$/i.test(file.sha256 || '') ||
        !Number.isInteger(file.recordCount) || file.recordCount < 0 ||
        !Number.isInteger(file.size) || file.size < 2) {
      throw publicDataError(`${key}文件信息不完整`, 'INVALID_MANIFEST')
    }
  }
  return manifest
}

function assertPublicData(data, manifest) {
  if (!Array.isArray(data.schools) || data.schools.length < 1) throw publicDataError('学校数据异常为空', 'EMPTY_SCHOOLS')
  if (!Array.isArray(data.scores) || data.scores.length < 1) throw publicDataError('分数线数据异常为空', 'EMPTY_SCORES')
  if (!Array.isArray(data.images) || !Array.isArray(data.announcements) ||
      !data.content || typeof data.content !== 'object' || Array.isArray(data.content)) {
    throw publicDataError('公开数据格式不完整', 'INVALID_DATASET')
  }
  const schoolIds = new Set()
  for (const school of data.schools) {
    if (!school || typeof school.id !== 'string' || !school.id ||
        typeof school.name !== 'string' || !school.name || schoolIds.has(school.id)) {
      throw publicDataError('学校标识或名称无效', 'INVALID_SCHOOL')
    }
    schoolIds.add(school.id)
  }
  const scoreIds = new Set()
  for (const score of data.scores) {
    const value = Number(score && (score.score === undefined ? score.minScore : score.score))
    if (!score || typeof score.id !== 'string' || !score.id || scoreIds.has(score.id) ||
        typeof score.schoolId !== 'string' || !schoolIds.has(score.schoolId) ||
        !Number.isInteger(Number(score.year)) || !Number.isInteger(value) || value < 0 || value > 740) {
      throw publicDataError('分数线内容或学校引用无效', 'INVALID_SCORE')
    }
    scoreIds.add(score.id)
  }
  for (const image of data.images) {
    if (!image || typeof image.imageId !== 'string' || !image.imageId ||
        !schoolIds.has(image.schoolId) || typeof image.publicPath !== 'string' ||
        !/^assets\/schools\/[a-z0-9_-]+\/[a-z0-9._-]+$/i.test(image.publicPath)) {
      throw publicDataError('学校图片引用无效', 'INVALID_IMAGE')
    }
  }
  for (const announcement of data.announcements) {
    if (!announcement || typeof announcement.id !== 'string' || !announcement.id ||
        typeof announcement.title !== 'string' || !announcement.title) {
      throw publicDataError('公告内容无效', 'INVALID_ANNOUNCEMENT')
    }
  }
  for (const key of DATASET_KEYS) {
    if (countRecords(data[key]) !== manifest.files[key].recordCount) {
      throw publicDataError(`${key}记录数量不一致`, 'COUNT_MISMATCH')
    }
  }
  return data
}

function publicAssetUrl(path, baseUrl = DEFAULT_API_BASE) {
  const value = String(path || '').trim()
  if (!value) return ''
  if (/^https:\/\//.test(value)) return value
  return `${baseUrl.replace(/\/$/, '')}/${value.replace(/^\//, '')}`
}

function effectiveContent(content) {
  const remote = content && typeof content === 'object' && !Array.isArray(content) ? content : {}
  const contact = remote.contact && typeof remote.contact === 'object' && !Array.isArray(remote.contact)
    ? remote.contact : {}
  const display = remote.display && typeof remote.display === 'object' && !Array.isArray(remote.display)
    ? remote.display : {}
  const faq = Array.isArray(remote.faq)
    ? remote.faq.filter((item) => item && typeof item.question === 'string' && item.question && typeof item.answer === 'string' && item.answer)
    : []
  return {
    faq: faq.length ? faq : FALLBACK_CONTENT.faq,
    contact: {
      email: String(contact.email || FALLBACK_CONTENT.contact.email),
      wechat: String(contact.wechat || FALLBACK_CONTENT.contact.wechat),
      showEmail: contact.showEmail === undefined ? FALLBACK_CONTENT.contact.showEmail : Boolean(contact.showEmail),
      showWechat: contact.showWechat === undefined ? FALLBACK_CONTENT.contact.showWechat : Boolean(contact.showWechat)
    },
    display: {
      ...FALLBACK_CONTENT.display,
      showAnnouncements: display.showAnnouncements === undefined ? FALLBACK_CONTENT.display.showAnnouncements : Boolean(display.showAnnouncements),
      showUpdatedAt: display.showUpdatedAt === undefined ? FALLBACK_CONTENT.display.showUpdatedAt : Boolean(display.showUpdatedAt),
      schoolDefaultSort: ['sort_order', 'name'].includes(display.schoolDefaultSort) ? display.schoolDefaultSort : FALLBACK_CONTENT.display.schoolDefaultSort,
      scoreDefaultSort: ['year_desc', 'year_asc'].includes(display.scoreDefaultSort) ? display.scoreDefaultSort : FALLBACK_CONTENT.display.scoreDefaultSort,
      defaultHistoryYear: Number.isInteger(display.defaultHistoryYear) ? display.defaultHistoryYear : null,
      showContact: display.showContact === undefined ? FALLBACK_CONTENT.display.showContact : Boolean(display.showContact),
      showFaq: display.showFaq === undefined ? FALLBACK_CONTENT.display.showFaq : Boolean(display.showFaq),
      publicNotice: typeof display.publicNotice === 'string' ? display.publicNotice.trim() : ''
    },
    sources: Array.isArray(remote.sources) ? remote.sources : []
  }
}

function normalizeSnapshot(snapshot, source, baseUrl = DEFAULT_API_BASE) {
  return {
    ...snapshot,
    source,
    content: effectiveContent(snapshot.content),
    images: (snapshot.images || []).map((item) => ({
      ...item,
      publicUrl: publicAssetUrl(item.publicPath, baseUrl),
      thumbnailUrl: publicAssetUrl(item.thumbnailPath || item.publicPath, baseUrl)
    }))
  }
}

function parseAndValidateFiles(rawFiles, manifest) {
  const data = {}
  const hashes = {}
  if (!rawFiles || typeof rawFiles !== 'object') throw publicDataError('缓存文件不完整', 'INVALID_CACHE')
  for (const key of DATASET_KEYS) {
    const raw = rawFiles[key]
    const file = manifest.files[key]
    if (typeof raw !== 'string') throw publicDataError(`${key}缓存文件缺失`, 'INVALID_CACHE')
    const digest = sha256(raw)
    if (digest !== file.sha256) throw publicDataError(`${key}文件校验失败`, 'SHA_MISMATCH')
    if (utf8Size(raw) !== file.size) throw publicDataError(`${key}文件大小不一致`, 'SIZE_MISMATCH')
    data[key] = parseJson(raw, key)
    hashes[key] = digest
  }
  assertPublicData(data, manifest)
  return { data, hashes }
}

function assertCachedSnapshot(value, baseUrl = DEFAULT_API_BASE) {
  if (!value || typeof value !== 'object' || value.cacheFormatVersion !== 1 || !value.manifest || !value.rawFiles) {
    throw publicDataError('缓存信息无效', 'INVALID_CACHE')
  }
  const manifest = assertManifest(value.manifest)
  const { data, hashes } = parseAndValidateFiles(value.rawFiles, manifest)
  return normalizeSnapshot({
    releaseVersion: manifest.releaseVersion,
    schemaVersion: manifest.schemaVersion,
    publishedAt: manifest.publishedAt,
    downloadedAt: value.downloadedAt,
    datasetVersions: value.datasetVersions || {},
    sha256: hashes,
    ...data
  }, 'cache', baseUrl)
}

function createWxStorage() {
  return {
    get(key) { return wx.getStorageSync(key) },
    set(key, value) { wx.setStorageSync(key, value) }
  }
}

function createWxTransport() {
  return {
    getText(url, timeout = REQUEST_TIMEOUT_MS) {
      return new Promise((resolve, reject) => {
        wx.request({
          url,
          method: 'GET',
          dataType: 'text',
          responseType: 'text',
          timeout,
          header: { Accept: 'application/json' },
          success(response) {
            if (response.statusCode !== 200) {
              reject(publicDataError(`请求失败：${response.statusCode}`, `HTTP_${response.statusCode}`))
              return
            }
            resolve(typeof response.data === 'string' ? response.data : JSON.stringify(response.data))
          },
          fail(error) { reject(publicDataError(error.errMsg || '网络请求失败', 'NETWORK_ERROR')) }
        })
      })
    }
  }
}

function createPublicDataService(options = {}) {
  const transport = options.transport || createWxTransport()
  const storage = options.storage || createWxStorage()
  const now = options.now || (() => Date.now())
  const baseUrl = (options.baseUrl || DEFAULT_API_BASE).replace(/\/$/, '')
  const listeners = new Set()
  let snapshot = normalizeSnapshot(createFallbackSnapshot(), 'fallback', baseUrl)
  let lastCheckAt = 0
  let inflight = null

  function emit() {
    listeners.forEach((listener) => {
      try { listener(snapshot) } catch (error) { /* A page listener must not break the shared service. */ }
    })
  }

  function loadInitial() {
    try { snapshot = assertCachedSnapshot(storage.get(PUBLIC_DATA_CACHE_KEY), baseUrl) } catch (error) {
      snapshot = normalizeSnapshot(createFallbackSnapshot(), 'fallback', baseUrl)
    }
    emit()
    return snapshot
  }

  async function fetchTextWithRetry(url) {
    let lastError
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try { return await transport.getText(url, REQUEST_TIMEOUT_MS) } catch (error) { lastError = error }
    }
    throw lastError
  }

  async function performRefresh({ force = false } = {}) {
    const checkedAt = now()
    if (!force && checkedAt - lastCheckAt < FOREGROUND_THROTTLE_MS) {
      return { ok: true, changed: false, throttled: true, snapshot }
    }
    lastCheckAt = checkedAt
    try {
      const manifest = assertManifest(parseJson(await fetchTextWithRetry(`${baseUrl}/api/v1/manifest`), '版本信息'))
      if (snapshot.releaseVersion === manifest.releaseVersion && snapshot.source === 'cache') {
        return { ok: true, changed: false, snapshot }
      }
      const rawFiles = {}
      for (const key of DATASET_KEYS) {
        rawFiles[key] = await fetchTextWithRetry(`${baseUrl}/api/v1/${ENDPOINTS[key]}`)
      }
      const { data, hashes } = parseAndValidateFiles(rawFiles, manifest)
      const envelope = {
        cacheFormatVersion: 1,
        manifest,
        downloadedAt: new Date(checkedAt).toISOString(),
        datasetVersions: DATASET_KEYS.reduce((result, key) => ({
          ...result,
          [key]: manifest[`${key}Version`] || manifest.releaseVersion
        }), {}),
        sha256: hashes,
        rawFiles
      }
      storage.set(PUBLIC_DATA_CACHE_KEY, envelope)
      snapshot = normalizeSnapshot({
        releaseVersion: manifest.releaseVersion,
        schemaVersion: manifest.schemaVersion,
        publishedAt: manifest.publishedAt,
        downloadedAt: envelope.downloadedAt,
        datasetVersions: envelope.datasetVersions,
        sha256: hashes,
        ...data
      }, 'cache', baseUrl)
      emit()
      return { ok: true, changed: true, snapshot }
    } catch (error) {
      return {
        ok: false,
        changed: false,
        code: error.code || 'REMOTE_UNAVAILABLE',
        message: snapshot.source === 'fallback' ? '当前使用本机数据。' : '暂时无法获取最新数据，当前内容仍可正常使用。',
        snapshot
      }
    }
  }

  function refresh(options) {
    if (!inflight) inflight = performRefresh(options).finally(() => { inflight = null })
    return inflight
  }

  return {
    loadInitial,
    getSnapshot: () => snapshot,
    refresh,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener) },
    _setLastCheckAt(value) { lastCheckAt = value }
  }
}

function activeAnnouncements(snapshot, timestamp = Date.now()) {
  const display = effectiveContent(snapshot && snapshot.content).display
  if (!display.showAnnouncements) return []
  return (Array.isArray(snapshot && snapshot.announcements) ? snapshot.announcements : [])
    .filter((item) => {
      const starts = item.startsAt ? Date.parse(item.startsAt) : null
      const ends = item.endsAt ? Date.parse(item.endsAt) : null
      return (!Number.isFinite(starts) || starts <= timestamp) && (!Number.isFinite(ends) || ends >= timestamp)
    })
    .slice()
    .sort((left, right) => Number(Boolean(right.pinned)) - Number(Boolean(left.pinned)) || Number(left.sortOrder || 0) - Number(right.sortOrder || 0))
}

function publishedDateText(value) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

const singleton = createPublicDataService()

module.exports = {
  PUBLIC_DATA_CACHE_KEY,
  SUPPORTED_SCHEMA_VERSION,
  DEFAULT_API_BASE,
  FOREGROUND_THROTTLE_MS,
  REQUEST_TIMEOUT_MS,
  DATASET_KEYS,
  utf8Size,
  countRecords,
  assertManifest,
  assertPublicData,
  assertCachedSnapshot,
  publicAssetUrl,
  effectiveContent,
  activeAnnouncements,
  publishedDateText,
  createPublicDataService,
  publicDataService: singleton
}
