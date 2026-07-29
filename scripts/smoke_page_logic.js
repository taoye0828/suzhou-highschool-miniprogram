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
let removeFailure = false

global.wx = {
  getStorageSync: (key) => memory.get(key),
  setStorageSync: (key, value) => {
    if (writeFailure) throw new Error('simulated quota failure')
    memory.set(key, value)
  },
  removeStorageSync: (key) => {
    if (removeFailure) throw new Error('simulated remove failure')
    memory.delete(key)
  },
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
  page.onLoad()
  page.onShow()
  assert.strictEqual(page.data.latestScoreText, '尚未记录')
  assert.strictEqual(page.data.targetCount, 0)
  assert.strictEqual(page.data.countdown.targetYear, APP_CONFIG.countdown.defaultYear)
  page.onScoreInput({ detail: { value: '650' } })
  page.startScoreAnalysis()
  assert.ok(navigations.includes('/pages/target-analysis/target-analysis'))
  assert.strictEqual(memory.get('mp1.target_draft').currentScore, '650')
  page.onScoreInput({ detail: { value: '741' } })
  page.startScoreAnalysis()
  assert.ok(page.data.scoreInputError.includes('0 至 740'))

  page.openSchools()
  assert.ok(navigations.includes('/pages/schools/schools'))

  const nextYearIndex = page.data.examYears.indexOf(APP_CONFIG.countdown.defaultYear + 1)
  page.onExamYearChange({ detail: { value: String(nextYearIndex) } })
  assert.strictEqual(memory.get('mp1.exam_year'), APP_CONFIG.countdown.defaultYear + 1)
}

function testTargetsPage() {
  const definition = loadPage('pages/targets/targets')
  const page = createPageInstance(definition)
  page.onShow()

  assert.strictEqual(page.data.records.length, 3)
  assert.deepStrictEqual(
    page.data.records.map((record) => [record.schoolName, record.levelLabel]).sort(),
    [
      ['江苏省苏州中学校', '冲刺'],
      ['江苏省苏州中学园区校', '目标'],
      ['江苏省苏州第十中学校', '保底']
    ].sort()
  )
  page.openSchool({ currentTarget: { dataset: { schoolId: 'suzhou_high_school' } } })
  assert.ok(navigations.includes('/pages/school-detail/school-detail?id=suzhou_high_school'))

  memory.set('mp1.target_records', [{
    schoolId: 'suzhou_high_school',
    schoolName: '江苏省苏州中学校',
    createdAt: '2026-07-02T00:00:00.000Z'
  }])
  page.onShow()
  assert.strictEqual(page.data.records.length, 1)
  assert.strictEqual(page.data.records[0].levelLabel, '目标')
  assert.strictEqual(page.data.records[0].schoolId, 'suzhou_high_school')

  page.deleteRecord({ currentTarget: { dataset: { id: page.data.records[0].id } } })
  assert.ok(toastTitles.includes('目标学校已删除'))
  assert.strictEqual(memory.has('mp1.target_records'), false)

  memory.set('mp1.target_records', [{
    id: 'target_suzhou_high_school',
    schoolId: 'suzhou_high_school',
    schoolName: '江苏省苏州中学校',
    level: 'sprint',
    createdAt: '2026-07-02T00:00:00.000Z'
  }])
  page.onShow()
  page.clearAllRecords()
  assert.strictEqual(memory.has('mp1.target_records'), false)
  assert.ok(toastTitles.includes('已清空'))
  page.onShow()
  assert.strictEqual(page.data.records.length, 0)

  const targetSource = [
    fs.readFileSync(path.join(__dirname, '..', 'pages/targets/targets.js'), 'utf8'),
    fs.readFileSync(path.join(__dirname, '..', 'pages/targets/targets.wxml'), 'utf8')
  ].join('\n')
  assert.strictEqual(targetSource.includes('admission-scores'), false)
  for (const requiredField of ['schoolId', 'schoolName', 'level']) {
    assert.strictEqual(targetSource.includes(requiredField), true)
  }
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
    page.openScoreSource({ currentTarget: { dataset: { url: page.data.scoreGroups[0].items[0].sourceUrl } } })
    assert.ok(navigations.some((url) => url.startsWith('/pages/web-view/web-view?url=')))
  }
  assert.strictEqual(page.data.emptyScoreText, EMPTY_SCORE_TEXT)

  const targetCases = [
    { id: 'suzhou_high_school', levelIndex: 0, level: 'sprint', schoolName: '江苏省苏州中学校' },
    { id: 'suzhou_high_school_sip', levelIndex: 1, level: 'target', schoolName: '江苏省苏州中学园区校' },
    { id: 'suzhou_no10_high_school', levelIndex: 2, level: 'safe', schoolName: '江苏省苏州第十中学校' }
  ]
  for (const targetCase of targetCases) {
    const targetPage = createPageInstance(definition)
    targetPage.onLoad({ id: targetCase.id })
    targetPage.onTargetLevelChange({ detail: { value: String(targetCase.levelIndex) } })
    targetPage.saveSchoolTarget()
    const saved = memory.get('mp1.target_records').find((record) => record.schoolId === targetCase.id)
    assert.strictEqual(saved.schoolName, targetCase.schoolName)
    assert.strictEqual(saved.level, targetCase.level)
  }
  assert.strictEqual(memory.get('mp1.target_records').length, 3)
  assert.ok(page.data.targetAnalysis)
  assert.ok(page.data.targetAnalysis.referenceScoreText.endsWith('分'))

  const failedTargetPage = createPageInstance(definition)
  failedTargetPage.onLoad({ id: 'suzhou_no10_high_school_jinchang' })
  writeFailure = true
  failedTargetPage.saveSchoolTarget()
  writeFailure = false
  assert.strictEqual(memory.get('mp1.target_records').length, 3)
  assert.ok(toastTitles.includes('本地存储失败，请清理空间后重试。'))

  page.toggleFavorite()
  assert.ok(memory.get('mp1.favorite_school_ids').includes('suzhou_high_school'))
  page.copySchoolName()
  page.copyMapKeyword()
  page.copySourceLink()
  page.openSourceLink()
  assert.ok(toastTitles.includes('学校名称已复制'))
  assert.ok(toastTitles.includes('地图搜索词已复制'))
  assert.ok(toastTitles.includes('来源链接已复制'))
  assert.ok(navigations.some((url) => url.startsWith('/pages/web-view/web-view?url=')))

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
  page.onKeywordInput({ detail: { value: '南航' } })
  page.onScoreRangeChange({ detail: { value: String(page.data.scoreRanges.indexOf('650以上')) } })
  assert.ok(page.data.results.some((item) => item.id === 'nuaa_suzhou_affiliated_high_school'))
  page.resetFilters()
  memory.set('mp1.target_records', [{
    id: 'target_suzhou_high_school',
    schoolId: 'suzhou_high_school',
    schoolName: '江苏省苏州中学校',
    level: 'sprint',
    createdAt: '2026-07-27T00:00:00.000Z'
  }])
  page.onTargetFilterChange({ detail: { value: String(page.data.targetFilters.findIndex((item) => item.value === 'sprint')) } })
  assert.deepStrictEqual(page.data.results.map((item) => item.id), ['suzhou_high_school'])
  page.resetFilters()
  page.onKeywordInput({ detail: { value: '不存在的学校关键词' } })
  assert.strictEqual(page.data.results.length, 0)
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
  const favoriteCandidate = page.data.results.find((item) => !item.isFavorite)
  page.toggleFavorite({ currentTarget: { dataset: { id: favoriteCandidate.id } } })
  assert.strictEqual(page.data.results.find((item) => item.id === favoriteCandidate.id).isFavorite, true)
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
  memory.set('mp1.target_records', [{
    id: 'target_suzhou_high_school',
    schoolId: 'suzhou_high_school',
    schoolName: '江苏省苏州中学校',
    level: 'sprint',
    createdAt: '2026-07-02T00:00:00.000Z'
  }])
  memory.set('mp1.target_draft', { currentScore: '500' })
  memory.set('mp1.score_records', [{
    id: 'score_profile',
    date: '2026-09-15',
    examName: '月考',
    score: 650,
    createdAt: '2026-09-15T08:00:00.000Z'
  }])
  memory.set('mp1.exam_year', 2028)
  const definition = loadPage('pages/profile/profile')
  const page = createPageInstance(definition)
  page.onShow()
  assert.strictEqual(page.data.favoriteCount, 1)
  assert.strictEqual(page.data.targetCount, 1)
  assert.strictEqual(page.data.scoreRecordCount, 1)
  assert.strictEqual(page.data.examYear, 2028)
  page.openFavorites()
  page.openSchoolCompare()
  page.openScoreTrend()
  page.openDataManagement()
  assert.ok(navigations.includes('/pages/favorites/favorites'))
  assert.ok(navigations.includes('/pages/school-compare/school-compare'))
  assert.ok(navigations.includes('/pages/score-trend/score-trend'))
  assert.ok(navigations.includes('/pages/data-management/data-management'))

  const management = createPageInstance(loadPage('pages/data-management/data-management'))
  management.onShow()
  management.clearAllLocalData()
  assert.strictEqual(memory.has('mp1.favorite_school_ids'), false)
  assert.strictEqual(memory.has('mp1.target_records'), false)
  assert.strictEqual(memory.has('mp1.target_draft'), false)
  assert.strictEqual(memory.has('mp1.score_records'), false)
  assert.strictEqual(memory.has('mp1.exam_year'), false)

  memory.set('mp1.favorite_school_ids', ['suzhou_high_school'])
  memory.set('mp1.target_records', [{
    id: 'target_suzhou_high_school',
    schoolId: 'suzhou_high_school',
    schoolName: '江苏省苏州中学校',
    level: 'target',
    createdAt: '2026-07-02T00:00:00.000Z'
  }])
  removeFailure = true
  management.clearAllLocalData()
  removeFailure = false
  assert.strictEqual(memory.has('mp1.favorite_school_ids'), true)
  assert.strictEqual(memory.has('mp1.target_records'), true)
  assert.ok(toastTitles.includes('部分本地数据清除失败，请重试。'))
}

function testTargetAnalysisPage() {
  const definition = loadPage('pages/target-analysis/target-analysis')
  const page = createPageInstance(definition)
  page.onScoreInput({ detail: { value: '650' } })
  page.analyze()
  assert.strictEqual(page.data.hasAnalyzed, true)
  assert.ok(page.data.resultCount > 0)
  assert.strictEqual(page.data.sections.length, 3)
  assert.ok(page.data.sections.some((section) => section.results.length > 0))
  const firstResult = page.data.sections.flatMap((section) => section.results)[0]
  page.openDetail({ currentTarget: { dataset: { id: firstResult.schoolId } } })
  assert.ok(navigations.includes(`/pages/school-detail/school-detail?id=${firstResult.schoolId}`))

  for (const score of ['0', '740']) {
    page.onScoreInput({ detail: { value: score } })
    page.analyze()
    assert.strictEqual(page.data.inputError, '')
    assert.strictEqual(page.data.hasAnalyzed, true)
  }

  page.onScoreInput({ detail: { value: '741' } })
  page.analyze()
  assert.strictEqual(page.data.hasAnalyzed, false)
  assert.ok(page.data.inputError.includes('0 至 740'))
}

function testSchoolComparePage() {
  memory.set('mp1.favorite_school_ids', ['suzhou_high_school'])
  const definition = loadPage('pages/school-compare/school-compare')
  const page = createPageInstance(definition)
  page.onLoad()
  page.onSchoolChange({ detail: { value: '0' } })
  assert.strictEqual(page.data.selectedSchools.length, 1)
  assert.strictEqual(page.data.canCompare, true)
  page.onSchoolChange({ detail: { value: '0' } })
  assert.strictEqual(page.data.selectedSchools.length, 2)
  assert.strictEqual(page.data.canCompare, true)
  assert.ok(page.data.selectedSchools.every((school) => school.scoreSummary))
  assert.ok(page.data.selectedSchools.every((school) => school.targetLevelText))
  assert.ok(page.data.selectedSchools.every((school) => school.referenceScoreText))
  page.onSchoolChange({ detail: { value: '0' } })
  assert.strictEqual(page.data.selectedSchools.length, 3)
  page.onSchoolChange({ detail: { value: '0' } })
  assert.strictEqual(page.data.selectedSchools.length, 3)
  assert.ok(toastTitles.includes('最多对比 3 所学校'))
  const firstId = page.data.selectedSchools[0].id
  page.openDetail({ currentTarget: { dataset: { id: firstId } } })
  assert.ok(navigations.includes(`/pages/school-detail/school-detail?id=${firstId}`))
  page.removeSchool({ currentTarget: { dataset: { id: firstId } } })
  assert.strictEqual(page.data.selectedSchools.length, 2)
}

function testScoreTrendPage() {
  memory.delete('mp1.score_records')
  const definition = loadPage('pages/score-trend/score-trend')
  const page = createPageInstance(definition)
  page.onLoad()
  page.onDateChange({ detail: { value: '2026-09-15' } })
  page.onExamNameInput({ detail: { value: '九月月考' } })
  page.onScoreInput({ detail: { value: '650' } })
  page.saveRecord()
  assert.strictEqual(page.data.records.length, 1)
  assert.strictEqual(page.data.visibleRecords.length, 1)
  assert.strictEqual(page.data.highestText, '650 分')
  assert.strictEqual(page.data.changeValueText, '暂无变化')
  assert.ok(toastTitles.includes('成绩记录已保存在本机'))

  page.onExamNameInput({ detail: { value: '无效成绩' } })
  page.onScoreInput({ detail: { value: '741' } })
  page.saveRecord()
  assert.strictEqual(page.data.records.length, 1)
  assert.ok(page.data.inputError.includes('0 至 740'))

  page.deleteRecord({ currentTarget: { dataset: { id: page.data.records[0].id } } })
  assert.strictEqual(page.data.records.length, 0)
  assert.strictEqual(memory.has('mp1.score_records'), false)

  for (let index = 0; index < 12; index += 1) {
    page.onDateChange({ detail: { value: `2026-10-${String(index + 1).padStart(2, '0')}` } })
    page.onExamNameInput({ detail: { value: `第${index + 1}次考试` } })
    page.onScoreInput({ detail: { value: String(600 + index * 5) } })
    page.saveRecord()
  }
  assert.strictEqual(page.data.records.length, 12)
  assert.strictEqual(page.data.visibleRecords.length, 10)
  assert.strictEqual(page.data.highestText, '655 分')
  assert.strictEqual(page.data.lowestText, '610 分')
  assert.strictEqual(page.data.averageText, '632.5 分')
  assert.strictEqual(page.data.changeText, '650 → 655')
  assert.strictEqual(page.data.changeValueText, '提升 +5 分')
  page.clearAllRecords()
  assert.strictEqual(page.data.records.length, 0)
  assert.strictEqual(memory.has('mp1.score_records'), false)
}

function testInfoPages() {
  const dataInfoDefinition = loadPage('pages/data-info/data-info')
  const dataInfoPage = createPageInstance(dataInfoDefinition)
  assert.ok(dataInfoPage.data.sections.length > 0)
  assert.ok(dataInfoPage.data.dataVersion)

  const privacyDefinition = loadPage('pages/privacy/privacy')
  const privacyPage = createPageInstance(privacyDefinition)
  assert.ok(privacyPage.data.sections.length > 0)
  const privacyText = JSON.stringify(privacyPage.data.sections)
  assert.ok(privacyText.includes('不上传收藏、学习目标记录、成绩记录、目标年份或输入草稿'))
  assert.ok(privacyText.includes('不进行后台网络请求或用户行为追踪'))
}

function testWebViewPage() {
  const definition = loadPage('pages/web-view/web-view')
  const page = createPageInstance(definition)
  page.onLoad({ url: encodeURIComponent('https://www.suzhou.gov.cn/example') })
  assert.strictEqual(page.data.url, 'https://www.suzhou.gov.cn/example')
  page.onWebViewError()
  assert.ok(modals.some((item) => item.title === '官方页面打开失败'))

  const invalidPage = createPageInstance(definition)
  invalidPage.onLoad({ url: 'javascript%3Aalert(1)' })
  assert.strictEqual(invalidPage.data.url, '')
  assert.ok(modals.some((item) => item.title === '来源链接无效'))
}

async function run() {
  testHomePage()
  testSchoolDetailPage()
  testTargetsPage()
  testSchoolsPage()
  testFavoritesPage()
  testTargetAnalysisPage()
  testSchoolComparePage()
  testScoreTrendPage()
  testProfilePage()
  testInfoPages()
  testWebViewPage()
  console.log('PAGE LOGIC SMOKE PASSED')
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
