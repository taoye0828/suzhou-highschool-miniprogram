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
const appState = { globalData: {} }

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
  reLaunch: ({ url }) => navigations.push(url),
  setClipboardData: ({ success }) => {
    if (success) success()
  }
}
global.getApp = () => appState

const storage = require('../utils/storage')
assert.strictEqual(storage.ensureStorageMigrated().ok, true)

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
  assert.strictEqual(storage.clearCurrentProfileData().ok, true)
  appState.globalData = {}
  const definition = loadPage('pages/home/home')
  const page = createPageInstance(definition)
  page.onLoad()
  page.onShow()
  assert.strictEqual(page.data.hasScores, false)
  assert.strictEqual(page.data.hasTarget, false)
  assert.strictEqual(page.data.hasStageGoal, false)
  assert.strictEqual(page.data.latestScoreText, '')
  assert.strictEqual(page.data.countdown.targetYear, APP_CONFIG.countdown.defaultYear)

  page.openScoreCenter()
  assert.ok(navigations.includes('/pages/score-trend/score-trend'))
  assert.strictEqual(appState.globalData.scoreCenterSegment, 'records')
  page.openRecommendations()
  assert.ok(navigations.includes('/pages/targets/targets'))
  assert.strictEqual(appState.globalData.targetCenterSegment, 'recommendation')
  page.openTargetPlanning()
  assert.strictEqual(appState.globalData.targetCenterSegment, 'schools')

  assert.strictEqual(storage.saveScoreRecord({
    id: 'home_old',
    examName: '九月月考',
    examDate: '2026-09-15',
    totalScore: 620,
    createdAt: '2026-09-15T08:00:00.000Z'
  }).ok, true)
  assert.strictEqual(storage.saveScoreRecord({
    id: 'home_latest',
    examName: '期中考试',
    examDate: '2026-10-20',
    totalScore: 650,
    createdAt: '2026-10-20T08:00:00.000Z'
  }).ok, true)
  assert.strictEqual(storage.saveTargetRecord({
    id: 'target_suzhou_high_school',
    schoolId: 'suzhou_high_school',
    schoolName: '江苏省苏州中学校',
    level: 'target',
    createdAt: '2026-07-02T00:00:00.000Z'
  }).ok, true)
  assert.strictEqual(storage.setPrimaryTargetSchool('suzhou_high_school').ok, true)
  assert.strictEqual(storage.saveLearningTargetRecord({
    id: 'stage_home',
    title: '期末阶段目标',
    startDate: '2026-10-01',
    endDate: '2026-12-31',
    targetTotalScore: 680,
    status: 'in_progress',
    createdAt: '2026-10-01T00:00:00.000Z'
  }).ok, true)
  page.onShow()
  assert.strictEqual(page.data.hasScores, true)
  assert.strictEqual(page.data.latestExamName, '期中考试')
  assert.strictEqual(page.data.latestExamDate, '2026-10-20')
  assert.strictEqual(page.data.latestScoreText, '650 分')
  assert.strictEqual(page.data.scoreChangeText, '比上次提高 30 分')
  assert.strictEqual(page.data.hasTarget, true)
  assert.strictEqual(page.data.primaryTargetName, '江苏省苏州中学校')
  assert.ok(page.data.targetReferenceText.endsWith('年）'))
  assert.ok(page.data.targetDifferenceText.includes('历史参考分'))
  assert.strictEqual(page.data.hasStageGoal, true)
  assert.strictEqual(page.data.stageGoalTitle, '期末阶段目标')
  assert.strictEqual(page.data.stageGoalDeadline, '2026-12-31')
  assert.strictEqual(page.data.stageGoalProgressText, '距离阶段总分目标还有 30 分')

  const nextYearIndex = page.data.examYears.indexOf(APP_CONFIG.countdown.defaultYear + 1)
  page.onExamYearChange({ detail: { value: String(nextYearIndex) } })
  assert.strictEqual(storage.getExamYear(), APP_CONFIG.countdown.defaultYear + 1)
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

  assert.strictEqual(storage.clearTargetRecords().ok, true)
  assert.strictEqual(storage.saveTargetRecord({
    id: 'target_suzhou_high_school',
    schoolId: 'suzhou_high_school',
    schoolName: '江苏省苏州中学校',
    createdAt: '2026-07-02T00:00:00.000Z'
  }).ok, true)
  page.onShow()
  assert.strictEqual(page.data.records.length, 1)
  assert.strictEqual(page.data.records[0].levelLabel, '目标')
  assert.strictEqual(page.data.records[0].schoolId, 'suzhou_high_school')

  page.deleteTarget({ currentTarget: { dataset: { id: page.data.records[0].id } } })
  assert.ok(toastTitles.includes('目标学校已删除'))
  assert.strictEqual(storage.getTargetRecords().length, 0)

  assert.strictEqual(storage.saveTargetRecord({
    id: 'target_suzhou_high_school',
    schoolId: 'suzhou_high_school',
    schoolName: '江苏省苏州中学校',
    level: 'sprint',
    createdAt: '2026-07-02T00:00:00.000Z'
  }).ok, true)
  page.onShow()
  page.clearAllTargets()
  assert.strictEqual(storage.getTargetRecords().length, 0)
  assert.ok(toastTitles.includes('目标学校已清空'))
  page.onShow()
  assert.strictEqual(page.data.records.length, 0)

  const targetSource = [
    fs.readFileSync(path.join(__dirname, '..', 'pages/targets/targets.js'), 'utf8'),
    fs.readFileSync(path.join(__dirname, '..', 'pages/targets/targets.wxml'), 'utf8')
  ].join('\n')
  assert.ok(targetSource.includes("require('../../utils/planning')"))
  assert.ok(targetSource.includes('selectReferenceForSchool'))
  assert.ok(targetSource.includes('analyzeScore'))
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
    const saved = storage.getTargetRecords()
      .find((record) => record.schoolId === targetCase.id)
    assert.strictEqual(saved.schoolName, targetCase.schoolName)
    assert.strictEqual(saved.level, targetCase.level)
  }
  assert.strictEqual(storage.getTargetRecords().length, 3)
  assert.ok(page.data.targetAnalysis)
  assert.ok(page.data.targetAnalysis.referenceScoreText.endsWith('分'))

  const failedTargetPage = createPageInstance(definition)
  failedTargetPage.onLoad({ id: 'suzhou_no10_high_school_jinchang' })
  writeFailure = true
  failedTargetPage.saveSchoolTarget()
  writeFailure = false
  assert.strictEqual(storage.getTargetRecords().length, 3)
  assert.ok(toastTitles.some((title) => title.includes('原数据已保留')))

  page.toggleFavorite()
  assert.ok(storage.getFavoriteIds().includes('suzhou_high_school'))
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
  page.onMinScoreInput({ detail: { value: '580' } })
  page.onMaxScoreInput({ detail: { value: '590' } })
  page.onScoreRangeCommit()
  const nuaa = page.data.results.find((item) => item.id === 'nuaa_suzhou_affiliated_high_school')
  assert.strictEqual(nuaa.referenceYear, 2026)
  assert.strictEqual(nuaa.referenceScore, 583)
  page.resetFilters()
  assert.strictEqual(storage.clearTargetRecords().ok, true)
  assert.strictEqual(storage.saveTargetRecord({
    id: 'target_suzhou_high_school',
    schoolId: 'suzhou_high_school',
    schoolName: '江苏省苏州中学校',
    level: 'sprint',
    createdAt: '2026-07-27T00:00:00.000Z'
  }).ok, true)
  page.onTargetLevelsChange({ detail: { value: ['sprint'] } })
  assert.deepStrictEqual(page.data.results.map((item) => item.id), ['suzhou_high_school'])
  page.resetFilters()
  page.onKeywordInput({ detail: { value: '不存在的学校关键词' } })
  assert.strictEqual(page.data.results.length, 0)
  page.resetFilters()
  page.onReferenceYearTap({ currentTarget: { dataset: { value: 'latest' } } })
  const scoredIds = page.data.results.map((item) => item.id)
  assert.strictEqual(new Set(scoredIds).size, scoredIds.length)
  if (page.data.results.length > 0) {
    assert.ok(page.data.results.every((item) => item.hasReference))
  }
  page.resetFilters()
  page.onDistrictsChange({ detail: { value: ['工业园区'] } })
  assert.ok(page.data.results.length > 0)
  assert.ok(page.data.results.every((item) => item.district === '工业园区'))
  page.resetFilters()
  assert.ok(page.data.results.length >= 50)
  const favoriteCandidate = page.data.results.find((item) => !item.isFavorite)
  page.toggleFavorite({ currentTarget: { dataset: { id: favoriteCandidate.id } } })
  assert.strictEqual(page.data.results.find((item) => item.id === favoriteCandidate.id).isFavorite, true)
}

function testFavoritesPage() {
  assert.strictEqual(storage.replaceFavoriteIds(['suzhou_high_school', 'removed_school']).ok, true)
  const definition = loadPage('pages/favorites/favorites')
  const page = createPageInstance(definition)
  page.onShow()
  assert.strictEqual(page.data.favorites.length, 1)
  assert.deepStrictEqual(storage.getFavoriteIds(), ['removed_school', 'suzhou_high_school'])
  assert.strictEqual(page.data.invalidCount, 1)

  writeFailure = true
  page.cleanInvalidFavorites()
  writeFailure = false
  assert.strictEqual(page.data.invalidCount, 1)
  assert.ok(toastTitles.some((title) => title.includes('原数据已保留')))
  page.cleanInvalidFavorites()
  assert.deepStrictEqual(storage.getFavoriteIds(), ['suzhou_high_school'])
  assert.strictEqual(page.data.invalidCount, 0)

  assert.strictEqual(storage.replaceFavoriteIds([]).ok, true)
  page.refresh()
  assert.strictEqual(page.data.favorites.length, 0)
  assert.strictEqual(page.data.invalidCount, 0)
}

function testProfilePage() {
  assert.strictEqual(storage.clearCurrentProfileData().ok, true)
  assert.strictEqual(storage.replaceFavoriteIds(['suzhou_high_school']).ok, true)
  assert.strictEqual(storage.saveTargetRecord({
    id: 'target_suzhou_high_school',
    schoolId: 'suzhou_high_school',
    schoolName: '江苏省苏州中学校',
    level: 'sprint',
    createdAt: '2026-07-02T00:00:00.000Z'
  }).ok, true)
  assert.strictEqual(storage.saveTargetDraft({ currentScore: '500' }).ok, true)
  assert.strictEqual(storage.saveScoreRecord({
    id: 'score_profile',
    examDate: '2026-09-15',
    examName: '月考',
    totalScore: 650,
    createdAt: '2026-09-15T08:00:00.000Z'
  }).ok, true)
  assert.strictEqual(storage.saveExamYear(2028).ok, true)
  const definition = loadPage('pages/profile/profile')
  const page = createPageInstance(definition)
  page.onShow()
  assert.strictEqual(page.data.favoriteCount, 1)
  assert.strictEqual(page.data.targetCount, 1)
  assert.strictEqual(page.data.scoreRecordCount, 1)
  assert.strictEqual(page.data.examYear, 2028)
  page.openFavorites()
  page.openProfiles()
  page.openBackupRestore()
  page.openHelp()
  page.openDataManagement()
  assert.ok(navigations.includes('/pages/favorites/favorites'))
  assert.ok(navigations.includes('/pages/profile-management/profile-management'))
  assert.ok(navigations.includes('/pages/backup-restore/backup-restore'))
  assert.ok(navigations.includes('/pages/help/help'))
  assert.ok(navigations.includes('/pages/data-management/data-management'))

  const management = createPageInstance(loadPage('pages/data-management/data-management'))
  management.onShow()
  management.clearAllLocalData()
  assert.deepStrictEqual(storage.getFavoriteIds(), [])
  assert.deepStrictEqual(storage.getTargetRecords(), [])
  assert.deepStrictEqual(storage.getTargetDraft(), {})
  assert.deepStrictEqual(storage.getScoreRecords(), [])
  assert.strictEqual(memory.get(storage.KEYS.storageSchemaVersion), storage.STORAGE_SCHEMA_VERSION)

  assert.strictEqual(storage.replaceFavoriteIds(['suzhou_high_school']).ok, true)
  assert.strictEqual(storage.saveTargetRecord({
    id: 'target_suzhou_high_school',
    schoolId: 'suzhou_high_school',
    schoolName: '江苏省苏州中学校',
    level: 'target',
    createdAt: '2026-07-02T00:00:00.000Z'
  }).ok, true)
  removeFailure = true
  management.clearAllLocalData()
  removeFailure = false
  assert.deepStrictEqual(storage.getFavoriteIds(), ['suzhou_high_school'])
  assert.strictEqual(storage.getTargetRecords().length, 1)
  assert.ok(toastTitles.includes('上一次操作已结束，但临时锁清理失败。'))
}

function testTargetAnalysisPage() {
  const definition = loadPage('pages/target-analysis/target-analysis')
  const page = createPageInstance(definition)
  page.onLoad()
  assert.strictEqual(appState.globalData.targetCenterSegment, 'recommendation')
  assert.ok(navigations.includes('/pages/targets/targets'))
}

function testSchoolComparePage() {
  assert.strictEqual(storage.replaceFavoriteIds(['suzhou_high_school']).ok, true)
  const definition = loadPage('pages/school-compare/school-compare')
  const page = createPageInstance(definition)
  page.onLoad()
  page.onSchoolChange({ detail: { value: '0' } })
  assert.strictEqual(page.data.selectedSchools.length, 1)
  assert.strictEqual(page.data.canCompare, false)
  page.onSchoolChange({ detail: { value: '0' } })
  assert.strictEqual(page.data.selectedSchools.length, 2)
  assert.strictEqual(page.data.canCompare, true)
  assert.ok(page.data.selectedSchools.every((school) => school.scoreSummary))
  assert.ok(page.data.selectedSchools.every((school) => school.targetStatusText))
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
  assert.strictEqual(storage.clearScoreRecords().ok, true)
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
  assert.strictEqual(storage.getScoreRecords().length, 0)

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
  assert.strictEqual(storage.getScoreRecords().length, 0)
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
  assert.ok(privacyText.includes('不会自动、静默或后台上传收藏、成绩、目标、错题、任务、备份或报告'))
  assert.ok(privacyText.includes('只有你主动点击发送备份或报告并选择接收方时'))
  assert.ok(privacyText.includes('不进行后台网络请求或用户行为追踪'))
}

function testExamSettingsPage() {
  const definition = loadPage('pages/exam-settings/exam-settings')
  const page = createPageInstance(definition)
  page.onShow()
  assert.strictEqual(page.data.templates.filter((item) => item.isBuiltIn).length, 4)
  assert.strictEqual(page.data.scoreSchemes.some((item) => item.id === 'suzhou_admission_740_v1'), true)
  page.copyScheme({ currentTarget: { dataset: { id: 'suzhou_admission_740_v1' } } })
  page.saveScheme()
  const customScheme = storage.getCustomScoreSchemes()[0]
  assert.ok(customScheme)
  assert.strictEqual(customScheme.totalMaxScore, 740)
  page.copyTemplate({ currentTarget: { dataset: { id: 'builtin_monthly_exam_v1' } } })
  page.saveTemplate()
  assert.strictEqual(storage.getCustomExamTemplates().length, 1)
}

function testP6Pages() {
  const searchDefinition = loadPage('pages/global-search/global-search')
  const searchPage = createPageInstance(searchDefinition)
  searchPage.onShow()
  searchPage.onKeywordInput({ detail: { value: '苏州中学' } })
  assert.ok(searchPage.data.results.some((item) => item.type === 'school'))

  const reportsDefinition = loadPage('pages/reports/reports')
  const reportsPage = createPageInstance(reportsDefinition)
  reportsPage.onShow()
  assert.strictEqual(reportsPage.data.reportType, 'score_stage')
  assert.strictEqual(reportsPage.data.reportFormat, 'text')
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
  testExamSettingsPage()
  testP6Pages()
  testInfoPages()
  testWebViewPage()
  console.log('PAGE LOGIC SMOKE PASSED')
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
