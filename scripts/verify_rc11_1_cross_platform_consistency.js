const assert = require('assert')
const path = require('path')
const { spawnSync } = require('child_process')

const root = path.resolve(__dirname, '..')
const appRoot = path.resolve(root, '../suzhou_highschool_app')
const result = spawnSync(process.execPath, [
  path.join(root, 'scripts/verify_cross_platform_consistency.js'),
  appRoot
], { cwd: root, encoding: 'utf8' })
process.stdout.write(result.stdout || '')
process.stderr.write(result.stderr || '')
assert.strictEqual(result.status, 0)
const report = JSON.parse(result.stdout)
assert.strictEqual(Object.values(report.checks).length, 16)
assert.ok(Object.values(report.checks).every(Boolean))
assert.strictEqual(Object.values(report.runtimeChecks).length, 6)
assert.ok(Object.values(report.runtimeChecks).every(Boolean))
assert.deepStrictEqual(report.failedChecks, [])
assert.deepStrictEqual(report.failedRuntimeChecks, [])

console.log('RC11-1 CROSS PLATFORM CONSISTENCY PASSED')
