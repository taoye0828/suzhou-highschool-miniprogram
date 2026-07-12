const assert = require('assert')
const fs = require('fs')
const path = require('path')
const { APP_CONFIG } = require('../config/app-config')
const { EMPTY_SCORE_TEXT } = require('../utils/admission-scores')

const memory = new Map()
const toastTitles = []
const modals = []
const navigations = []
let writeFailure = false

global.wx = {
  getStorageSync: (key) => memory.get(key),
  setStorageSync: (key, value) => {
    if (writeFailure) throw new Error('simulated quota failure')
    memory.set(key, value)
  },
  removeStorageSync: (key) => memory.delete(key),
  showToast: ({ title }) => toastTitles.push(title),
  showModal: (options) => {
    modals.push(options)
    if (options && typeof options.success === 'function') options.success({ confirm: true })
  },
  navigateTo: ({ url }) => navigations.push(url),
  switchTab: ({ url }) => navigations.push(url),
  setClipboardData: ({ success }) => {
    if (success) success()
  }
}

function loadPage(relative) {
  const modulePath = path.join(__dirname, '..', relative)
  let definition = null
  const previousPage = global.Page
  global.Page = (value) => { definition = value }
  delete require.cache[require.resolve(modulePath)]
  require(modulePath)
  global.Page = previousPage
  return definition
}

function createPageInstance(definition) {
  return {
    ...definition,
    data: JSON.parse(JSON.stringify(definition.data || {})),
    setData(values, callback) {
      Object.assign(this.data, values)
      if (callback) callback()
    }
  }
}

function testHomePage() {
  const definition = loadPage('pages/home/home')
  const page = createPageInstance(definition)
  assert.strictEqual(page.data.scoreStats.schoolCount, 55)
  assert.strictEqual(page.data.scoreStats.scoreCount, 146)
  assert.strictEqual(page.data.scoreStats.yearsText, '2025、2026')
  assert.strictEqual(page.data.sourceCheckedAt, APP_CONFIG.schoolData.sourceCheckedAt)
  assert.ok(page.data.homeBoundary.includes('不判断未来录取结果'))
  assert.ok(page.data.localBoundary.includes('只保存在本机'))

  for (const entry of page.data.entries) {
    page.openEntry({ currentTarget: { dataset: entry } })
  }
  assert.ok(navigations.includes('/pages/schools/schools'))
  assert.ok(navigations.includes('/pages/data-info/data-info'))
  assert.ok(navigations.includes('/pages/targets/targets'))
  assert.ok(navigations.includes('/pages/favorites/favorites'))
}

async function testTargetsPage() {
  const definition = loadPage('pages/targets/targets')
  const page = createPageInstance(definition)
  page.onLoad()
  page.onShow()

  page.onCurrentInput({ detail: { value: '500' } })
  page.onTargetInput({ detail: { value: '550' } })
  page.onNoteInput({ detail: { value: '复盘数学' } })

  assert.strictEqual(memory.has('mp1.target_draft'), false)
  await new Promise((resolve) => setTimeout(resolve, APP_CONFIG.targetScore.draftDebounceMs + 50))
  assert.deepStrictEqual(memory.get('mp1.target_draft'), {
    currentScore: '500',
    targetScore: '550',
    note: '复盘数学'
  })

  page.saveRecord()
  const firstRecords = memory.get('mp1.target_records')
  assert.strictEqual(firstRecords.length, 1)
  assert.strictEqual(Object.hasOwn(firstRecords[0], 'schoolId'), false)
  assert.strictEqual(Object.hasOwn(firstRecords[0], 'admissionScore'), false)
  assert.ok(toastTitles.includes('学习目标已保存'))
  assert.strictEqual(page.data.records.length, 1)

  page.onCurrentInput({ detail: { value: '700' } })
  page.onTargetInput({ detail: { value: String(APP_CONFIG.targetScore.max) } })
  page.saveRecord()
  assert.ok(toastTitles.includes('学习目标已保存'))

  for (const invalidTarget of [APP_CONFIG.targetScore.max + 1, APP_CONFIG.targetScore.max + 10]) {
    const countBefore = memory.get('mp1.target_records').length
    page.onTargetInput({ detail: { value: String(invalidTarget) } })
    page.saveRecord()
    assert.strictEqual(memory.get('mp1.target_records').length, countBefore)
    assert.ok(toastTitles.includes(`目标分不能超过 ${APP_CONFIG.targetScore.max} 分`))
  }
  const boundaryRecord = memory.get('mp1.target_records').find((item) => item.targetScore === APP_CONFIG.targetScore.max)
  page.deleteRecord({ currentTarget: { dataset: { id: boundaryRecord.id } } })

  page.onCurrentInput({ detail: { value: 'abc' } })
  page.saveRecord()
  assert.ok(toastTitles.some((title) => title.includes('请输入')))

  page.deleteRecord({ currentTarget: { dataset: { id: firstRecords[0].id } } })
  assert.ok(toastTitles.includes('记录已删除'))
  assert.strictEqual(memory.has('mp1.target_records'), false)

  page.onCurrentInput({ detail: { value: '500' } })
  page.onTargetInput({ detail: { value: '560' } })
  page.saveRecord()
  assert.strictEqual(memory.get('mp1.target_records').length, 1)
  page.clearAllRecords()
  assert.strictEqual(memory.has('mp1.target_records'), false)
  assert.ok(toastTitles.includes('已清空'))
  page.clearInputs()
  assert.strictEqual(page.data.currentScore, '')

  const targetSource = fs.readFileSync(path.join(__dirname, '..', 'pages/targets/targets.js'), 'utf8')
  assert.strictEqual(targetSource.includes('admission-scores'), false)
  for (const forbiddenField of ['schoolId', 'targetSchool', 'admissionResult', 'admissionScore']) {
    assert.strictEqual(targetSource.includes(forbiddenField), false)
  }

  const originalConsoleError = console.error
  const expectedErrorLogs = []
  console.error = (...values) => expectedErrorLogs.push(values.join(' '))
  page.onCurrentInput({ detail: { value: '500' } })
  page.onTargetInput({ detail: { value: '550' } })
  writeFailure = true
  page.saveRecord()
  writeFailure = false
  console.error = originalConsoleError
  assert.strictEqual(memory.has('mp1.target_records'), false)
  assert.ok(toastTitles.includes('本地存储失败，请清理空间后重试。'))
  assert.strictEqual(expectedErrorLogs.length, 1)
}

function testSchoolDetailPage() {
  const definition = loadPage('pages/school-detail/school-detail')
  const page = createPageInstance(definition)
  page.onLoad({ id: 'suzhou_high_school' })
  assert.strictEqual(page.data.school.id, 'suzhou_high_school')
  assert.strictEqual(Object.prototype.hasOwnProperty.call(page.data.school, 'boardingDisplay'), false)
  assert.ok(Array.isArray(page.data.scoreGroups))
  if (page.data.scoreGroups.length > 0) {
    assert.ok(page.data.scoreGroups[0].items.length > 0)
    assert.strictEqual(page.data.scoreGroups[0].year, '2026')
    assert.ok(page.data.scoreGroups[0].items.every((score) => score.sourceCheckedAt === '2026-07-09'))
    assert.ok(page.data.scoreGroups[0].items.some((score) => score.sameScoreRule))
    page.copyScoreSource({ currentTarget: { dataset: { url: page.data.scoreGroups[0].items[0].sourceUrl } } })
    assert.ok(toastTitles.includes('分数线来源链接已复制'))
  }
  assert.strictEqual(page.data.emptyScoreText, EMPTY_SCORE_TEXT)

  page.toggleFavorite()
  assert.ok(memory.get('mp1.favorite_school_ids').includes('suzhou_high_school'))
  page.copySchoolName()
  page.copyMapKeyword()
  page.copySourceLink()
  assert.ok(toastTitles.includes('学校名称已复制'))
  assert.ok(toastTitles.includes('地图搜索词已复制'))
  assert.ok(toastTitles.includes('来源链接已复制'))

  const missingPage = createPageInstance(definition)
  missingPage.onLoad({ id: 'removed_school' })
  assert.strictEqual(missingPage.data.school, null)
  missingPage.openSchools()
  assert.ok(navigations.includes('/pages/schools/schools'))
}

function testSchoolsPage() {
  const definition = loadPage('pages/schools/schools')
  const page = createPageInstance(definition)
  page.onLoad()
  assert.ok(page.data.results.length >= 50)
  page.onKeywordInput({ detail: { value: '南航苏附' } })
  assert.ok(page.data.results.some((item) => item.id === 'nuaa_suzhou_affiliated_high_school'))
  page.resetFilters()
  page.onScoreStatusChange({ detail: { value: String(page.data.scoreStatuses.indexOf('已收录已核实历史分数线')) } })
  const scoredIds = page.data.results.map((item) => item.id)
  assert.strictEqual(new Set(scoredIds).size, scoredIds.length)
  if (page.data.results.length > 0) {
    assert.ok(page.data.results.every((item) => item.hasAdmissionScores))
  }
  page.resetFilters()
  page.onTagChange({ detail: { value: String(page.data.tags.indexOf('工业园区')) } })
  assert.ok(page.data.results.length > 0)
  assert.ok(page.data.results.every((item) => item.tags.includes('工业园区')))
  page.resetFilters()
  assert.ok(page.data.results.length >= 50)
}

function testFavoritesPage() {
  memory.set('mp1.favorite_school_ids', ['suzhou_high_school', 'removed_school'])
  const definition = loadPage('pages/favorites/favorites')
  const page = createPageInstance(definition)
  page.onShow()
  assert.strictEqual(page.data.favorites.length, 1)
  assert.deepStrictEqual(memory.get('mp1.favorite_school_ids'), ['suzhou_high_school'])
  assert.strictEqual(page.data.invalidCount, 0)

  memory.set('mp1.favorite_school_ids', ['suzhou_high_school', 'removed_school'])
  writeFailure = true
  page.refresh()
  writeFailure = false
  assert.strictEqual(page.data.invalidCount, 1)
  assert.ok(toastTitles.includes('本地存储失败，请清理空间后重试。'))
  page.cleanInvalidFavorites()
  assert.deepStrictEqual(memory.get('mp1.favorite_school_ids'), ['suzhou_high_school'])
  assert.strictEqual(page.data.invalidCount, 0)

  memory.set('mp1.favorite_school_ids', { broken: true })
  page.refresh()
  assert.strictEqual(page.data.favorites.length, 0)
  assert.strictEqual(page.data.invalidCount, 0)
}

function testProfilePage() {
  memory.set('mp1.favorite_school_ids', ['suzhou_high_school'])
  memory.set('mp1.target_records', [{ id: 'target_1', currentScore: 500, targetScore: 550, note: '', createdAt: '2026-07-02T00:00:00.000Z' }])
  memory.set('mp1.target_draft', { currentScore: '500' })
  const definition = loadPage('pages/profile/profile')
  const page = createPageInstance(definition)
  page.onShow()
  assert.strictEqual(page.data.favoriteCount, 1)
  assert.strictEqual(page.data.targetCount, 1)
  assert.ok(page.data.schoolCount >= 50)
  assert.ok(page.data.scoreCount >= 0)
  assert.strictEqual(page.data.sourceCheckedAt, '2026-07-09')
  page.clearLocalData()
  assert.strictEqual(memory.has('mp1.favorite_school_ids'), false)
  assert.strictEqual(memory.has('mp1.target_records'), false)
  assert.strictEqual(memory.has('mp1.target_draft'), false)
}

function testInfoPages() {
  const dataInfoDefinition = loadPage('pages/data-info/data-info')
  const dataInfoPage = createPageInstance(dataInfoDefinition)
  assert.ok(dataInfoPage.data.sections.length > 0)
  assert.ok(dataInfoPage.data.dataVersion)

  const privacyDefinition = loadPage('pages/privacy/privacy')
  const privacyPage = createPageInstance(privacyDefinition)
  assert.ok(privacyPage.data.sections.length > 0)
}

async function run() {
  testHomePage()
  await testTargetsPage()
  testSchoolDetailPage()
  testSchoolsPage()
  testFavoritesPage()
  testProfilePage()
  testInfoPages()
  console.log('PAGE LOGIC SMOKE PASSED')
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
