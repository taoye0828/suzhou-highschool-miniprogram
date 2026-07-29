const assert = require('assert')
const fs = require('fs')
const path = require('path')

const trend = require('../utils/score-trend')

const root = path.resolve(__dirname, '..')
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')
const HEIGHT = 280
const PADDING = 38
const EPSILON = 1e-9

function closeTo(left, right, tolerance = EPSILON) {
  return Math.abs(left - right) <= tolerance
}

function makeRecord(index, overrides = {}) {
  const day = String(index + 1).padStart(2, '0')
  return {
    id: `score-${index + 1}`,
    examName: `第 ${index + 1} 次考试`,
    examDate: `2026-07-${day}`,
    createdAt: index + 1,
    score: 600 + index,
    ...overrides
  }
}

function makeRecords(count) {
  return Array.from({ length: count }, (_, index) => makeRecord(index))
}

function labelsFrom(points) {
  return {
    examNameLabels: points.map((point) => ({
      id: point.id,
      text: point.examName,
      x: point.x,
      leftPercent: point.leftPercent
    })),
    dateLabels: points.map((point) => ({
      id: point.id,
      text: point.displayDate,
      x: point.x,
      leftPercent: point.leftPercent
    }))
  }
}

function verifyGeometry(records, width) {
  const prepared = trend.prepareScoreTrendData(records, {
    width,
    height: HEIGHT,
    padding: PADDING
  })
  const points = prepared.visibleTrendPoints
  const { examNameLabels, dateLabels } = labelsFrom(points)

  assert.strictEqual(points.length, prepared.visibleRecords.length)
  assert.strictEqual(examNameLabels.length, points.length)
  assert.strictEqual(dateLabels.length, points.length)

  points.forEach((point, index) => {
    assert.strictEqual(point.id, prepared.visibleRecords[index].id)
    assert.strictEqual(point.id, examNameLabels[index].id)
    assert.strictEqual(point.id, dateLabels[index].id)
    assert.ok(closeTo(point.x, examNameLabels[index].x))
    assert.ok(closeTo(point.x, dateLabels[index].x))
    assert.ok(closeTo(point.leftPercent, point.x / width * 100))
    assert.ok(point.x >= PADDING - EPSILON)
    assert.ok(point.x <= width - PADDING + EPSILON)
    assert.ok(point.x - point.labelWidth / 2 >= -EPSILON)
    assert.ok(point.x + point.labelWidth / 2 <= width + EPSILON)
  })

  if (points.length === 1) {
    assert.ok(closeTo(points[0].x, width / 2))
  } else if (points.length > 1) {
    assert.ok(closeTo(points[0].x, PADDING))
    assert.ok(closeTo(points[points.length - 1].x, width - PADDING))
    const expectedSpacing = (width - PADDING * 2) / (points.length - 1)
    for (let index = 1; index < points.length; index += 1) {
      assert.ok(closeTo(points[index].x - points[index - 1].x, expectedSpacing))
    }
  }

  return prepared
}

function logicalGeometryAtDpr(records, cssWidth, dpr) {
  assert.ok([1, 2, 3].includes(dpr))
  return {
    cssWidth,
    backingWidth: cssWidth * dpr,
    prepared: verifyGeometry(records, cssWidth)
  }
}

const threeRecordCase = [
  {
    id: 'score-1',
    examName: '第一次月考',
    examDate: '2026-07-27',
    createdAt: 1,
    score: 740
  },
  {
    id: 'score-2',
    examName: '期中考试',
    examDate: '2026-07-27',
    createdAt: 2,
    score: 740
  },
  {
    id: 'score-3',
    examName: '第二次月考',
    examDate: '2026-07-27',
    createdAt: 3,
    score: 650
  }
]
const threePrepared = verifyGeometry(threeRecordCase, 360)
const threePoints = threePrepared.visibleTrendPoints
const threeLabels = labelsFrom(threePoints)

assert.strictEqual(threePrepared.visibleRecords.length, 3)
assert.strictEqual(threePoints.length, 3)
assert.strictEqual(threeLabels.examNameLabels.length, 3)
assert.strictEqual(threeLabels.dateLabels.length, 3)
assert.deepStrictEqual(threePoints.map((point) => point.displayIndex), [1, 2, 3])
assert.deepStrictEqual(threePoints.map((point) => point.score), [740, 740, 650])
assert.deepStrictEqual(
  threeLabels.examNameLabels.map((label) => label.text),
  ['第一次月考', '期中考试', '第二次月考']
)
assert.deepStrictEqual(threeLabels.dateLabels.map((label) => label.text), ['07-27', '07-27', '07-27'])
assert.strictEqual(threePoints[0].y, threePoints[1].y)
assert.ok(threePoints[2].y > threePoints[1].y)
assert.ok(closeTo(threePoints[1].x, 180))
assert.ok(threePoints[2].x > 360 * 0.8)

const countResults = {}
for (const count of [0, 1, 2, 3, 5, 9, 10]) {
  const prepared = verifyGeometry(makeRecords(count), 360)
  countResults[count] = prepared.visibleTrendPoints.map((point) => Number(point.x.toFixed(3)))
}
assert.deepStrictEqual(countResults[0], [])
assert.deepStrictEqual(countResults[1], [180])
assert.deepStrictEqual(countResults[2], [38, 322])
assert.deepStrictEqual(countResults[3], [38, 180, 322])
assert.strictEqual(countResults[5].length, 5)
assert.strictEqual(countResults[9].length, 9)
assert.strictEqual(countResults[10].length, 10)

const elevenPrepared = verifyGeometry(makeRecords(11), 360)
assert.strictEqual(elevenPrepared.visibleRecords.length, 10)
assert.deepStrictEqual(
  elevenPrepared.visibleRecords.map((record) => record.id),
  makeRecords(11).slice(1).map((record) => record.id)
)
assert.ok(closeTo(elevenPrepared.visibleTrendPoints[0].x, PADDING))
assert.ok(closeTo(elevenPrepared.visibleTrendPoints[9].x, 360 - PADDING))

const twoPoints = verifyGeometry(makeRecords(2), 360).visibleTrendPoints
assert.ok(twoPoints[1].x > PADDING + (360 - PADDING * 2) / 9)

const sameDateReverseInput = [
  makeRecord(2, { id: 'c', examDate: '2026-07-27', createdAt: 2 }),
  makeRecord(1, { id: 'b', examDate: '2026-07-27', createdAt: 1 }),
  makeRecord(0, { id: 'a', examDate: '2026-07-27', createdAt: 1 })
]
assert.deepStrictEqual(
  trend.getVisibleTrendRecords(sameDateReverseInput).map((record) => record.id),
  ['a', 'b', 'c']
)

const fallbackPoint = trend.calculateChartPoints([
  makeRecord(0, { examName: '' })
], 360, HEIGHT, PADDING)[0]
assert.strictEqual(fallbackPoint.examName, '第 1 次考试')

const widths = [320, 375, 390, 414, 430]
const widthResults = {}
for (const width of widths) {
  widthResults[width] = {}
  for (const count of [1, 2, 3, 5, 10]) {
    const baseline = logicalGeometryAtDpr(makeRecords(count), width, 1)
    widthResults[width][count] = baseline.prepared.visibleTrendPoints.map(
      (point) => Number(point.x.toFixed(3))
    )
    for (const dpr of [2, 3]) {
      const compared = logicalGeometryAtDpr(makeRecords(count), width, dpr)
      assert.deepStrictEqual(
        compared.prepared.visibleTrendPoints.map((point) => point.x),
        baseline.prepared.visibleTrendPoints.map((point) => point.x)
      )
      assert.deepStrictEqual(
        labelsFrom(compared.prepared.visibleTrendPoints).examNameLabels.map((label) => label.x),
        labelsFrom(baseline.prepared.visibleTrendPoints).examNameLabels.map((label) => label.x)
      )
      assert.deepStrictEqual(
        labelsFrom(compared.prepared.visibleTrendPoints).dateLabels.map((label) => label.x),
        labelsFrom(baseline.prepared.visibleTrendPoints).dateLabels.map((label) => label.x)
      )
      assert.strictEqual(compared.cssWidth, baseline.cssWidth)
      assert.strictEqual(compared.backingWidth, width * dpr)
    }
  }
}

const pageJs = read('pages/score-trend/score-trend.js')
const pageWxml = read('pages/score-trend/score-trend.wxml')
const pageWxss = read('pages/score-trend/score-trend.wxss')
const utilitySource = read('utils/score-trend.js')

assert.ok(pageJs.includes('visibleRecords'))
assert.ok(pageJs.includes('visibleTrendPoints'))
assert.ok(pageJs.includes('renderTrendCanvas(points, width)'))
assert.ok(pageJs.includes('fillText(String(point.score), point.x'))
assert.ok(pageJs.includes('onReady()'))
assert.ok(pageJs.includes('onResize()'))
assert.ok(pageJs.includes('_chartDrawToken'))
assert.ok(pageJs.includes('_chartDisposed'))
assert.ok(pageJs.includes('MAX_LAYOUT_RETRIES'))
assert.strictEqual(pageJs.includes('|| 320'), false)
assert.ok(pageWxml.includes('wx:for="{{visibleTrendPoints}}"'))
assert.ok(pageWxml.includes('left: {{item.leftPercent}}%'))
assert.ok(pageWxml.includes('{{item.examName}}'))
assert.ok(pageWxml.includes('{{item.displayDate}}'))
assert.strictEqual(pageWxml.includes('chart-label-scroll'), false)
assert.ok(pageWxss.includes('position: absolute'))
assert.ok(pageWxss.includes('transform: translateX(-50%)'))
assert.strictEqual(pageWxss.includes('flex: 0 0 128rpx'), false)
assert.ok(utilitySource.includes('items.length - 1'))
assert.strictEqual(utilitySource.includes('index / DEFAULT_LIMIT'), false)
assert.strictEqual(utilitySource.includes('index / 10'), false)

function runPageRenderingHarness() {
  const previous = {
    wx: global.wx,
    Page: global.Page,
    setTimeout: global.setTimeout,
    clearTimeout: global.clearTimeout
  }
  const storageMemory = new Map()
  const queryCallbacks = []
  const fakeTimers = new Map()
  const canvasRuns = []
  let nextTimerId = 0

  const storedThreeRecords = threeRecordCase.map((record, index) => ({
    schemaVersion: 1,
    id: record.id,
    date: record.examDate,
    examName: record.examName,
    score: record.score,
    createdAt: `2026-07-27T00:00:0${index + 1}.000Z`
  }))
  storageMemory.set('mp1.score_records', storedThreeRecords)

  global.setTimeout = (callback) => {
    nextTimerId += 1
    fakeTimers.set(nextTimerId, callback)
    return nextTimerId
  }
  global.clearTimeout = (timerId) => fakeTimers.delete(timerId)
  global.wx = {
    getStorageSync: (key) => storageMemory.get(key),
    setStorageSync: (key, value) => storageMemory.set(key, value),
    removeStorageSync: (key) => storageMemory.delete(key),
    showToast: () => {},
    createSelectorQuery: () => ({
      select() {
        return this
      },
      boundingClientRect() {
        return this
      },
      exec(callback) {
        queryCallbacks.push(callback)
      }
    }),
    createCanvasContext: () => {
      const run = { arcs: [], scoreTexts: [], clears: [] }
      canvasRuns.push(run)
      return {
        clearRect: (...args) => run.clears.push(args),
        setFillStyle: () => {},
        fillRect: () => {},
        setStrokeStyle: () => {},
        setLineWidth: () => {},
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        stroke: () => {},
        setLineJoin: () => {},
        setLineCap: () => {},
        arc: (x, y) => run.arcs.push({ x, y }),
        fill: () => {},
        setFontSize: () => {},
        setTextAlign: () => {},
        fillText: (text, x, y) => run.scoreTexts.push({ text, x, y }),
        draw: () => {}
      }
    }
  }

  function flushQuery(width) {
    assert.ok(queryCallbacks.length > 0, 'expected a pending SelectorQuery')
    const callback = queryCallbacks.shift()
    callback(Number.isFinite(width) ? [{ width }] : [])
  }

  function runNextTimer() {
    assert.ok(fakeTimers.size > 0, 'expected a pending retry timer')
    const [timerId, callback] = fakeTimers.entries().next().value
    fakeTimers.delete(timerId)
    callback()
  }

  try {
    let pageDefinition = null
    global.Page = (definition) => {
      pageDefinition = definition
    }
    const pageModule = path.join(root, 'pages/score-trend/score-trend.js')
    delete require.cache[require.resolve(pageModule)]
    require(pageModule)
    assert.ok(pageDefinition)
    global.Page = previous.Page

    const page = {
      ...pageDefinition,
      data: JSON.parse(JSON.stringify(pageDefinition.data)),
      setData(values, callback) {
        Object.assign(this.data, values)
        if (callback) callback()
      }
    }

    page.onLoad()
    page.onReady()
    assert.strictEqual(queryCallbacks.length, 2)

    flushQuery(320)
    assert.strictEqual(page.data.canvasWidth, null)
    flushQuery(360)
    assert.strictEqual(page.data.canvasWidth, 360)
    flushQuery(360)

    assert.deepStrictEqual(page.data.visibleTrendPoints.map((point) => point.x), [38, 180, 322])
    assert.deepStrictEqual(canvasRuns[0].arcs.map((item) => item.x), [38, 180, 322])
    assert.deepStrictEqual(canvasRuns[0].scoreTexts.map((item) => item.x), [38, 180, 322])

    canvasRuns.length = 0
    page.onResize()
    flushQuery(320)
    flushQuery(320)
    assert.deepStrictEqual(page.data.visibleTrendPoints.map((point) => point.x), [38, 160, 282])
    assert.deepStrictEqual(canvasRuns[0].arcs.map((item) => item.x), [38, 160, 282])
    assert.deepStrictEqual(canvasRuns[0].scoreTexts.map((item) => item.x), [38, 160, 282])

    storageMemory.set('mp1.score_records', storedThreeRecords.slice(0, 2))
    canvasRuns.length = 0
    page.loadRecords()
    assert.deepStrictEqual(page.data.visibleTrendPoints, [])
    for (let retry = 0; retry <= 3; retry += 1) {
      flushQuery(null)
      if (retry < 3) {
        assert.strictEqual(fakeTimers.size, 1)
        runNextTimer()
      }
    }
    assert.strictEqual(fakeTimers.size, 0)
    assert.strictEqual(canvasRuns.length, 1)
    assert.strictEqual(canvasRuns[0].clears.length, 1)
    assert.deepStrictEqual(canvasRuns[0].arcs, [])
    assert.deepStrictEqual(canvasRuns[0].scoreTexts, [])

    canvasRuns.length = 0
    page.onResize()
    flushQuery(320)
    assert.deepStrictEqual(page.data.visibleTrendPoints.map((point) => point.x), [38, 282])
    assert.deepStrictEqual(canvasRuns[0].arcs.map((item) => item.x), [38, 282])

    page.onResize()
    flushQuery(null)
    assert.strictEqual(fakeTimers.size, 1)
    page.onUnload()
    assert.strictEqual(fakeTimers.size, 0)
    const pendingAfterUnload = queryCallbacks.length
    page.scheduleTrendChartDraw()
    assert.strictEqual(queryCallbacks.length, pendingAfterUnload)

    return {
      initialX: [38, 180, 322],
      resizedX: [38, 160, 282],
      retryQueries: 4,
      staleQueryIgnored: true,
      terminalFailureClearedCanvas: true,
      unloadClearedTimer: true
    }
  } finally {
    if (previous.wx === undefined) delete global.wx
    else global.wx = previous.wx
    if (previous.Page === undefined) delete global.Page
    else global.Page = previous.Page
    global.setTimeout = previous.setTimeout
    global.clearTimeout = previous.clearTimeout
  }
}

const pageHarnessResult = runPageRenderingHarness()

console.log('RC8 CHART VERTICAL ALIGNMENT VERIFY PASSED')
console.log(`three-record-x=${JSON.stringify(threePoints.map((point) => point.x))}`)
console.log(`three-record-name-x=${JSON.stringify(threeLabels.examNameLabels.map((label) => label.x))}`)
console.log(`three-record-date-x=${JSON.stringify(threeLabels.dateLabels.map((label) => label.x))}`)
console.log(`count-results=${JSON.stringify(countResults)}`)
console.log(`eleven-visible-ids=${JSON.stringify(elevenPrepared.visibleRecords.map((record) => record.id))}`)
console.log(`width-results=${JSON.stringify(widthResults)}`)
console.log('dpr-results={"scope":"logical-css-coordinates","1":"same-css-x","2":"same-css-x","3":"same-css-x","canvas-rendering":"not-run"}')
console.log(`page-harness=${JSON.stringify(pageHarnessResult)}`)
