const assert = require('assert')
const { read, runtimeText } = require('./rc9_test_helpers')

const legacy = read('pages/target-analysis/target-analysis.js')
for (const marker of ['analyzeScore(', 'saveTargetRecord(', 'setStorageSync(', 'getStorageSync(']) {
  assert.strictEqual(legacy.includes(marker), false, `旧转发页仍含业务逻辑：${marker}`)
}
assert.ok(legacy.includes('switchTab'))
assert.strictEqual(runtimeText().includes(`苏${'简'}记录`), false)
console.log('RC10 LEGACY CLEANUP VERIFY PASSED')
