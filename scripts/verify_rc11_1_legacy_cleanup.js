const assert = require('assert')
const fs = require('fs')
const path = require('path')
const { read, readJson } = require('./rc9_test_helpers')

const root = path.resolve(__dirname, '..')
const app = readJson('app.json')
const legacyMap = read('docs/rc11_1_legacy_reference_map.md')
assert.ok(legacyMap.includes('pages/target-analysis/target-analysis.js'))
assert.ok(legacyMap.includes('B 类'))
for (const route of app.pages) {
  for (const extension of ['js', 'json', 'wxml', 'wxss']) {
    assert.ok(fs.existsSync(path.join(root, `${route}.${extension}`)))
  }
}
const redirect = read('pages/target-analysis/target-analysis.js')
assert.ok(redirect.includes('switchTab'))
for (const marker of ['setStorageSync', 'saveTargetRecord', 'analyzeScore(']) {
  assert.strictEqual(redirect.includes(marker), false)
}
assert.strictEqual(app.tabBar.list.some((item) => item.pagePath.includes('target-analysis')), false)

console.log('RC11-1 LEGACY CLEANUP PASSED')
