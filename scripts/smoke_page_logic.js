const assert = require('assert')
const { APP_CONFIG } = require('../config/app-config')

const memory = new Map()
const toastTitles = []
let writeFailure = false

global.wx = {
  getStorageSync: (key) => memory.get(key),
  setStorageSync: (key, value) => {
    if (writeFailure) throw new Error('simulated quota failure')
    memory.set(key, value)
  },
  removeStorageSync: (key) => memory.delete(key),
  showToast: ({ title }) => toastTitles.push(title),
  showModal: () => {}
}

let pageDefinition = null
global.Page = (definition) => { pageDefinition = definition }
require('../pages/targets/targets')

function createPageInstance(definition) {
  return {
    ...definition,
    data: JSON.parse(JSON.stringify(definition.data)),
    setData(values, callback) {
      Object.assign(this.data, values)
      if (callback) callback()
    }
  }
}

async function run() {
  const page = createPageInstance(pageDefinition)
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
  assert.strictEqual(firstRecords[0].schemaVersion, 1)
  assert.strictEqual(Object.hasOwn(firstRecords[0], 'gapText'), false)
  assert.ok(toastTitles.includes('目标记录已保存'))

  const originalConsoleError = console.error
  const expectedErrorLogs = []
  console.error = (...values) => expectedErrorLogs.push(values.join(' '))
  writeFailure = true
  page.saveRecord()
  writeFailure = false
  console.error = originalConsoleError
  assert.strictEqual(memory.get('mp1.target_records').length, 1)
  assert.ok(toastTitles.includes('本地存储失败，请清理空间后重试。'))
  assert.strictEqual(expectedErrorLogs.length, 1)

  page.onUnload()
  console.log('MP1 PAGE LOGIC SMOKE PASSED')
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
