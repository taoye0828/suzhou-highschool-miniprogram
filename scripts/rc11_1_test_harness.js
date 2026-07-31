const assert = require('assert')
const path = require('path')
const {
  clone,
  installWxStorage,
  loadStorageFresh
} = require('./rc9_test_helpers')

class FixedClock {
  constructor(iso) {
    this.iso = iso
  }

  now() {
    return new Date(this.iso)
  }

  nowIso() {
    return this.now().toISOString()
  }
}

class FixedIdGenerator {
  constructor(ids) {
    this.ids = [...ids]
  }

  next() {
    assert.ok(this.ids.length, 'fixed id generator exhausted')
    return this.ids.shift()
  }
}

class MemoryStorage {
  constructor(initial = {}) {
    this.harness = installWxStorage(initial)
  }

  get memory() {
    return this.harness.memory
  }

  snapshot() {
    return Object.fromEntries(
      [...this.memory.entries()].map(([key, value]) => [key, clone(value)])
    )
  }
}

class InMemoryRepository {
  constructor(storage) {
    this.storage = storage
  }

  scores() {
    return this.storage.getScoreRecords()
  }

  targets() {
    return this.storage.getTargetRecords()
  }

  tasks() {
    return this.storage.getLearningTasks()
  }
}

class FakeFileAdapter {
  constructor() {
    this.files = new Map()
  }

  write(name, content) {
    this.files.set(name, String(content))
  }

  read(name) {
    return this.files.get(name)
  }
}

class FakeShareAdapter {
  constructor() {
    this.shared = []
  }

  share(payload) {
    this.shared.push(clone(payload))
  }
}

class FakeNavigationObserver {
  constructor() {
    this.events = []
  }

  record(kind, url) {
    this.events.push({ kind, url })
  }
}

function loadPage(relative) {
  const modulePath = path.join(__dirname, '..', relative)
  let definition = null
  const previous = global.Page
  global.Page = (value) => { definition = value }
  delete require.cache[require.resolve(modulePath)]
  require(modulePath)
  global.Page = previous
  assert.ok(definition, `${relative} did not register a Page`)
  return definition
}

function createPageInstance(definition) {
  return {
    ...definition,
    data: clone(definition.data || {}),
    setData(values, callback) {
      Object.assign(this.data, values)
      if (callback) callback()
    }
  }
}

function installApp(observer = new FakeNavigationObserver()) {
  const app = { globalData: {} }
  global.getApp = () => app
  global.wx.showToast = () => {}
  global.wx.showModal = (options) => {
    if (options && typeof options.success === 'function') {
      options.success({ confirm: true, content: options.content || '' })
    }
  }
  global.wx.switchTab = ({ url, success }) => {
    observer.record('switchTab', url)
    if (success) success()
  }
  global.wx.navigateTo = ({ url, success }) => {
    observer.record('navigateTo', url)
    if (success) success()
  }
  global.wx.redirectTo = ({ url, success }) => {
    observer.record('redirectTo', url)
    if (success) success()
  }
  global.wx.reLaunch = ({ url, success }) => {
    observer.record('reLaunch', url)
    if (success) success()
  }
  return { app, observer }
}

function setupProfile(profile = {
  id: 'profile-default',
  nickname: '默认档案',
  examYear: 2027
}) {
  const memoryStorage = new MemoryStorage()
  const storage = loadStorageFresh()
  assert.strictEqual(storage.ensureStorageMigrated().ok, true)
  const generatedDefaultId = storage.getActiveProfile().id
  if (profile.id !== generatedDefaultId) {
    const created = storage.createStudentProfile(profile)
    assert.strictEqual(created.ok, true)
    assert.strictEqual(storage.deleteStudentProfile(generatedDefaultId).ok, true)
  } else {
    assert.strictEqual(storage.updateStudentProfile(generatedDefaultId, profile).ok, true)
  }
  assert.strictEqual(storage.saveExamYear(profile.examYear).ok, true)
  const app = installApp()
  return {
    memoryStorage,
    storage,
    repository: new InMemoryRepository(storage),
    ...app
  }
}

const fixtures = Object.freeze({
  profile: Object.freeze({
    id: 'profile-default',
    nickname: '默认档案',
    examYear: 2027
  }),
  firstExam: Object.freeze({
    id: 'exam-first-monthly',
    examName: '第一次月考',
    examDate: '2026-09-20',
    createdAt: '2026-09-20T02:10:00.000Z',
    updatedAt: '2026-09-20T02:10:00.000Z',
    totalScore: 650
  }),
  secondExam: Object.freeze({
    id: 'exam-midterm',
    examName: '期中考试',
    examDate: '2026-11-10',
    createdAt: '2026-11-10T02:10:00.000Z',
    updatedAt: '2026-11-10T02:10:00.000Z',
    totalScore: 660
  })
})

module.exports = {
  FixedClock,
  FixedIdGenerator,
  MemoryStorage,
  InMemoryRepository,
  FakeFileAdapter,
  FakeShareAdapter,
  FakeNavigationObserver,
  loadPage,
  createPageInstance,
  installApp,
  setupProfile,
  fixtures
}
