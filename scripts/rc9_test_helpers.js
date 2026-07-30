const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')

function clone(value) {
  if (value === undefined) return undefined
  return JSON.parse(JSON.stringify(value))
}

function read(relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8')
}

function readJson(relative) {
  return JSON.parse(read(relative))
}

function walk(relative) {
  const target = path.join(root, relative)
  if (!fs.existsSync(target)) return []
  const stat = fs.statSync(target)
  if (stat.isFile()) return [target]
  return fs.readdirSync(target, { withFileTypes: true }).flatMap((entry) => {
    if (['.git', 'node_modules', 'miniprogram_npm'].includes(entry.name)) return []
    const child = path.join(target, entry.name)
    return entry.isDirectory()
      ? walk(path.relative(root, child))
      : [child]
  })
}

function runtimeText() {
  return ['app.js', 'app.json', 'config', 'data', 'pages', 'components', 'utils']
    .flatMap(walk)
    .filter((file) => /\.(?:js|json|wxml|wxss)$/.test(file))
    .map((file) => fs.readFileSync(file, 'utf8'))
    .join('\n')
}

function installWxStorage(initial = {}, options = {}) {
  const memory = new Map(
    Object.entries(initial).map(([key, value]) => [key, clone(value)])
  )
  const writes = []
  const removals = []
  let writeCount = 0
  global.wx = {
    getStorageSync(key) {
      if (options.failReadKey === key) throw new Error('simulated read failure')
      return clone(memory.get(key))
    },
    setStorageSync(key, value) {
      writeCount += 1
      if (options.failWriteKey === key || options.failWriteAt === writeCount) {
        throw new Error('simulated write failure')
      }
      memory.set(key, clone(value))
      writes.push({ key, value: clone(value) })
    },
    removeStorageSync(key) {
      if (options.failRemoveKey === key) throw new Error('simulated remove failure')
      memory.delete(key)
      removals.push(key)
    },
    showToast() {},
    showModal() {},
    switchTab() {},
    navigateTo() {}
  }
  return { memory, writes, removals }
}

function loadStorageFresh() {
  for (const relative of [
    '../utils/storage',
    '../utils/rc9-storage',
    '../utils/backup-restore',
    '../utils/onboarding'
  ]) {
    const resolved = require.resolve(relative)
    delete require.cache[resolved]
  }
  return require('../utils/storage')
}

function makeExam(id, score, date = '2026-09-01', overrides = {}) {
  return {
    id,
    examName: `考试 ${id}`,
    examDate: date,
    totalScore: score,
    createdAt: `${date}T08:00:00.000Z`,
    updatedAt: `${date}T08:00:00.000Z`,
    ...overrides
  }
}

module.exports = {
  root,
  clone,
  read,
  readJson,
  walk,
  runtimeText,
  installWxStorage,
  loadStorageFresh,
  makeExam
}
