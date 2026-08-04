const assert = require('assert')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const {
  installWxStorage,
  loadStorageFresh,
  read,
  readJson,
  runtimeText
} = require('./rc9_test_helpers')
const { schools } = require('../data/schools')
const { admissionScores } = require('../data/admission-scores')
const {
  calculateTrendXPositions,
  prepareScoreTrendData
} = require('../utils/score-trend')
const { EXAM_TOTAL_SCORE } = require('../config/app-config')
const { PRODUCT_RULES } = require('../utils/generated/product-rules')

const root = path.resolve(__dirname, '..')
const NEW_FEEDBACK_URL = 'https://ycn8xfqnmoql.feishu.cn/share/base/form/shrcng2vmqyiVYLULDAEbJNWhtg'
const OLD_FEEDBACK_URL = `${NEW_FEEDBACK_URL}55`
const closeTo = (left, right, tolerance = 1e-9) => Math.abs(left - right) <= tolerance

console.log('V1-FINAL-UX: 验证首发前 UX 收口修复...')

console.log('\n[TEST] 公共趋势图横坐标')
for (const count of [0, 1, 2, 3, 5, 10]) {
  const positions = calculateTrendXPositions(count, 390, 38)
  assert.strictEqual(positions.length, count)
  positions.forEach((position) => {
    assert.ok(Number.isFinite(position.x))
    assert.ok(closeTo(position.leftPercent, position.x / 390 * 100))
  })
  if (count === 1) assert.strictEqual(positions[0].x, 195)
  if (count > 1) {
    assert.strictEqual(positions[0].x, 38)
    assert.strictEqual(positions[count - 1].x, 352)
    const spacing = (390 - 76) / (count - 1)
    for (let index = 1; index < positions.length; index += 1) {
      assert.ok(closeTo(positions[index].x - positions[index - 1].x, spacing))
    }
  }
}
assert.deepStrictEqual(calculateTrendXPositions(0, 390, 38), [])
assert.strictEqual(calculateTrendXPositions(1, 0, 38)[0].x, 0.5)
assert.deepStrictEqual(
  calculateTrendXPositions(2, 100, -10).map((item) => item.x),
  [0, 100]
)
assert.deepStrictEqual(
  calculateTrendXPositions(3, 100, 100).map((item) => item.x),
  [50, 50, 50]
)

const specifiedRecords = [740, 680, 650, 700, 725].map((score, index) => ({
  id: `specified-${index + 1}`,
  examName: String(index + 1),
  examDate: `2026-08-0${index + 1}`,
  createdAt: `2026-08-0${index + 1}T08:00:00.000Z`,
  score
}))
const specified = prepareScoreTrendData(specifiedRecords, {
  width: 390,
  height: 280,
  padding: 38
})
assert.deepStrictEqual(specified.visibleRecords.map((item) => item.examName), ['1', '2', '3', '4', '5'])
assert.deepStrictEqual(specified.visibleTrendPoints.map((item) => item.score), [740, 680, 650, 700, 725])
assert.ok(specified.visibleTrendPoints[0].y < specified.visibleTrendPoints[1].y)
assert.ok(specified.visibleTrendPoints[1].y < specified.visibleTrendPoints[2].y)
assert.ok(specified.visibleTrendPoints[3].y < specified.visibleTrendPoints[2].y)
assert.ok(specified.visibleTrendPoints[4].y < specified.visibleTrendPoints[3].y)
specified.visibleTrendPoints.forEach((point) => {
  assert.ok(point.x >= 38 && point.x <= 352)
  assert.ok(closeTo(point.leftPercent, point.x / 390 * 100))
})

const sameDateRecords = Array.from({ length: 11 }, (_, index) => ({
  id: `same-date-${index + 1}`,
  examName: String(index + 1),
  examDate: '2026-08-01',
  createdAt: `2026-08-01T08:00:${String(index).padStart(2, '0')}.000Z`,
  score: index === 0 ? 0 : index === 10 ? 740 : 600
}))
const limited = prepareScoreTrendData(sameDateRecords, { width: 390, height: 280, padding: 38 })
assert.strictEqual(limited.visibleRecords.length, 10)
assert.deepStrictEqual(limited.visibleRecords.map((item) => item.examName), ['2', '3', '4', '5', '6', '7', '8', '9', '10', '11'])
assert.strictEqual(limited.visibleRecords[9].score, 740)
const zeroPoint = prepareScoreTrendData([
  { id: 'zero', examName: '真实 0 分', examDate: '2026-08-02', createdAt: 1, score: 0 }
]).visibleTrendPoints[0]
assert.strictEqual(zeroPoint.score, 0)

const scoreTrendJs = read('pages/score-trend/score-trend.js')
const targetsJs = read('pages/targets/targets.js')
const trajectoryBlock = targetsJs.slice(
  targetsJs.indexOf('function trajectoryPresentation'),
  targetsJs.indexOf('function presentTarget')
)
assert.ok(scoreTrendJs.includes('calculateTrendXPositions('))
assert.ok(scoreTrendJs.includes('calculateChartPoints('))
assert.ok(targetsJs.includes("const { calculateTrendXPositions } = require('../../utils/score-trend')"))
assert.ok(trajectoryBlock.includes('calculateTrendXPositions(count, plotWidthRpx, TRAJECTORY_PADDING_RPX)'))
assert.strictEqual(/(?:index\s*\*\s*100|100\s*\*\s*index)\s*\/\s*\(count\s*-\s*1\)/.test(trajectoryBlock), false)
for (const styleName of ['pointStyle', 'scoreStyle', 'labelStyle']) {
  assert.ok(trajectoryBlock.includes(`${styleName}: \`left:\${leftPercent.toFixed(4)}%`))
}
assert.strictEqual(read('pages/targets/targets.wxss').includes('padding: 0 56rpx;'), false)
const targetPositions = calculateTrendXPositions(5, 580, 56)
assert.deepStrictEqual(targetPositions.map((item) => item.x), [56, 173, 290, 407, 524])
console.log('✓ 成绩图和目标图真实共用 calculateTrendXPositions，指定数据与边界通过')

console.log('\n[TEST] 学生档案收藏模式兼容')
installWxStorage()
const storage = loadStorageFresh()
assert.strictEqual(storage.ensureStorageMigrated().ok, true)
const created = storage.createStudentProfile({ nickname: '首发测试档案' })
assert.strictEqual(created.ok, true)
assert.strictEqual(created.profile.favoritesMode, 'independent')
assert.strictEqual(storage.updateStudentProfile(created.profile.id, { favoritesMode: 'shared' }).ok, true)
assert.strictEqual(storage.setFavorite(schools[0].id, true).ok, true)
assert.strictEqual(storage.updateStudentProfile(created.profile.id, { nickname: '改名后档案' }).ok, true)
assert.strictEqual(storage.getActiveProfile().favoritesMode, 'shared')
assert.deepStrictEqual(storage.getFavoriteIds(), [schools[0].id])
const profileWxml = read('pages/profile-management/profile-management.wxml')
assert.strictEqual(profileWxml.includes('收藏模式'), false)
assert.strictEqual(profileWxml.includes('favoritesModeLabel'), false)
assert.ok(read('pages/profile-management/profile-management.js').includes('{ nickname }'))
console.log('✓ 新建默认 independent；改名不覆盖 shared，收藏数据保留')

console.log('\n[TEST] 新手教程与可见按钮')
const onboarding = require('../utils/onboarding')
onboarding.replayOnboarding('full')
onboarding.handleOnboardingAction({ detail: { action: 'skip' } })
assert.strictEqual(storage.getOnboardingState().skipped, true)
onboarding.replayOnboarding('score_trend')
onboarding.handleOnboardingAction({ detail: { action: 'complete' } })
assert.strictEqual(storage.getOnboardingState().completed, true)

const overlayJs = read('components/onboarding-overlay/onboarding-overlay.js')
const overlayWxml = read('components/onboarding-overlay/onboarding-overlay.wxml')
assert.ok(overlayJs.includes('highlightVisible: false'))
assert.ok(overlayWxml.includes('wx:if="{{highlightVisible}}"'))
for (const handler of ['previous', 'next', 'skip']) {
  assert.ok(new RegExp(`${handler}\\(\\)`).test(overlayJs), `教程缺少 ${handler} handler`)
  assert.ok(overlayWxml.includes(`bindtap="${handler}"`), `教程未绑定 ${handler}`)
}

function loadOverlayComponent(rect) {
  const previousComponent = global.Component
  const previousWx = global.wx
  let definition
  global.Component = (value) => { definition = value }
  global.wx = {
    createSelectorQuery: () => ({
      select() { return this },
      boundingClientRect() { return this },
      exec(callback) { callback([rect]) }
    }),
    getWindowInfo: () => ({ windowWidth: 390, windowHeight: 700, safeArea: { top: 44, bottom: 666 } })
  }
  delete require.cache[require.resolve('../components/onboarding-overlay/onboarding-overlay')]
  require('../components/onboarding-overlay/onboarding-overlay')
  const instance = {
    properties: { visible: true, step: { selector: '.target', index: 0, total: 1 } },
    data: { ...definition.data },
    _measureAttempts: 3,
    setData(changes) { Object.assign(this.data, changes) }
  }
  for (const [name, method] of Object.entries(definition.methods)) {
    instance[name] = method.bind(instance)
  }
  instance.measureTarget()
  global.Component = previousComponent
  global.wx = previousWx
  return instance.data
}

assert.strictEqual(loadOverlayComponent(null).highlightVisible, false)
assert.strictEqual(loadOverlayComponent({ left: 20, top: 120, width: 300, height: 80 }).highlightVisible, true)
assert.strictEqual(loadOverlayComponent({ left: 20, top: 760, width: 300, height: 80 }).highlightVisible, false)

for (const base of ['pages', 'components']) {
  for (const entry of fs.readdirSync(path.join(root, base), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const wxmlPath = path.join(root, base, entry.name, `${entry.name}.wxml`)
    const jsPath = path.join(root, base, entry.name, `${entry.name}.js`)
    if (!fs.existsSync(wxmlPath) || !fs.existsSync(jsPath)) continue
    const wxml = fs.readFileSync(wxmlPath, 'utf8')
    const js = fs.readFileSync(jsPath, 'utf8')
    const handlers = [...wxml.matchAll(/(?:bind|catch)tap\s*=\s*["']([A-Za-z_$][\w$]*)["']/g)]
      .map((match) => match[1])
    for (const handler of new Set(handlers)) {
      const escaped = handler.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      assert.ok(
        new RegExp(`(?:^|[,{\\s])${escaped}\\s*\\(`, 'm').test(js),
        `${path.relative(root, wxmlPath)} 绑定的 ${handler} 在 JS 中不存在`
      )
    }
  }
}
console.log('✓ 教程跳过/完成、测量失败降级、成功高亮及可见 tap handler 通过')

console.log('\n[TEST] 帮助与反馈')
const helpJs = read('pages/help/help.js')
const helpWxml = read('pages/help/help.wxml')
const helpJson = readJson('pages/help/help.json')
assert.ok(helpJs.includes(NEW_FEEDBACK_URL))
assert.strictEqual(helpJs.includes(OLD_FEEDBACK_URL), false)
assert.ok(helpJs.includes('wx.setClipboardData'))
assert.ok(helpJs.includes('反馈链接已复制，请粘贴到浏览器中打开。'))
assert.ok(helpJs.includes('复制失败，请稍后重试。'))
assert.ok(helpWxml.includes('使用说明'))
assert.ok(helpWxml.includes('提交截图前，请注意遮挡姓名、联系方式等个人信息。请勿提交密码、身份证号等敏感信息。'))
for (const phrase of [
  '苏程记录会进行录取预测吗',
  '不会自动把学生档案、成绩、收藏或目标上传',
  '当前提供志愿填报建议吗',
  '历史分数线仅用于目标规划参考'
]) {
  assert.ok(helpJs.includes(phrase), `帮助页缺少：${phrase}`)
}
assert.strictEqual(helpJson.navigationBarTitleText, '帮助与反馈')
assert.ok(read('pages/profile/profile.wxml').includes('帮助与反馈'))

function runFeedbackHarness(mode) {
  const previousPage = global.Page
  const previousWx = global.wx
  let definition
  const calls = []
  global.Page = (value) => { definition = value }
  global.wx = {
    setClipboardData(options) {
      calls.push({ type: 'clipboard', data: options.data })
      options[mode]()
    },
    showModal(options) { calls.push({ type: 'modal', ...options }) },
    showToast(options) { calls.push({ type: 'toast', ...options }) }
  }
  delete require.cache[require.resolve('../pages/help/help')]
  require('../pages/help/help')
  definition.copyFeedbackLink()
  global.Page = previousPage
  global.wx = previousWx
  return calls
}

const successCalls = runFeedbackHarness('success')
assert.deepStrictEqual(successCalls[0], { type: 'clipboard', data: NEW_FEEDBACK_URL })
assert.ok(successCalls.some((call) => call.content === '反馈链接已复制，请粘贴到浏览器中打开。'))
const failCalls = runFeedbackHarness('fail')
assert.ok(failCalls.some((call) => call.title === '复制失败，请稍后重试。'))
assert.strictEqual(runtimeText().includes(OLD_FEEDBACK_URL), false)
assert.strictEqual(runtimeText().includes('wx.' + 'request'), false)
console.log('✓ 正式链接、复制成功/失败、隐私与四项 FAQ 通过')

console.log('\n[TEST] 正式数据与配置保护')
assert.strictEqual(schools.length, 55)
assert.strictEqual(admissionScores.length, 146)
assert.strictEqual(admissionScores.filter((item) => item.year === 2025).length, 103)
assert.strictEqual(admissionScores.filter((item) => item.year === 2026).length, 43)
assert.strictEqual(EXAM_TOTAL_SCORE, 740)
assert.strictEqual(PRODUCT_RULES.productName, '苏程记录')
assert.strictEqual(PRODUCT_RULES.storageSchemaVersion, 5)
assert.strictEqual(PRODUCT_RULES.backupFormatVersion, 3)
assert.strictEqual(PRODUCT_RULES.restorePointFormatVersion, 2)
assert.strictEqual(readJson('project.config.json').appid, 'wxc2a2a94f767438dd')

function sha256(relative) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(root, relative))).digest('hex')
}

const expectedHashes = {
  'data/schools.js': 'c185182c8dd8577b3165278c16014dbff98249585cf76bd1182b6ea1581d62f2',
  'data/admission-scores.js': '0d6257cd336dee5afe853d6c4d9ece68e1cefe2bb56a652cb8f8c651a14ccf88',
  'data/admission-scores-2026.js': '3091136605728315653049fb4802e83b87d9f86cb568746027ec9ef21417d75c'
}
for (const [relative, expected] of Object.entries(expectedHashes)) {
  assert.strictEqual(sha256(relative), expected, `${relative} 正式数据哈希变化`)
}
console.log('✓ 55/103/43/146、740、AppID、名称、Schema、Backup/Restore 与数据哈希通过')

console.log('\n✅ V1-FINAL-UX: 所有自动验证通过')
console.log('external_manual_acceptance: 微信开发者工具、Problems、Console、320/375/390/414/430、iPhone 真机、教程位置、档案弹窗、剪贴板、趋势图裁切')
