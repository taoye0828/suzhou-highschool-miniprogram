const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const assert = require('assert')

const ROOT = path.resolve(__dirname, '..')
const CORE_SUITES = [
  './v1/transaction-suite',
  './v1/recovery-suite',
  './v1/migration-suite',
  './v1/backup-suite',
  './v1/business-consistency-suite',
  './v1/exam-suite',
  './v1/learning-loop-suite',
  './v1/school-planning-suite',
  './v1/ui-contract-suite',
  './v1/performance-suite'
]

function runV1({ coreOnly = false } = {}) {
  const suites = coreOnly ? CORE_SUITES : CORE_SUITES.concat('./v1/release-freeze-suite')
  const results = suites.flatMap((name) => require(name).run())
  const ids = results.map((item) => item.id)
  assert.strictEqual(new Set(ids).size, ids.length, 'duplicate V1 TEST-ID')
  assert.ok(results.every((item) => item.status === 'PASS'))
  console.log(`V1 FULL VERIFY PASS (${results.length} TEST-ID${coreOnly ? ', core only' : ''})`)
  return results
}

function runAllVerifyScripts() {
  const self = path.basename(__filename)
  const scripts = fs.readdirSync(__dirname)
    .filter((name) => /^verify_.*\.js$/.test(name) && name !== self)
    .sort()
  for (const script of scripts) {
    console.log(`VERIFY-SCRIPT START ${script}`)
    const result = spawnSync(process.execPath, [path.join('scripts', script)], {
      cwd: ROOT,
      encoding: 'utf8',
      env: { ...process.env, V1_FULL_CHILD: '1' }
    })
    if (result.stdout) process.stdout.write(result.stdout)
    if (result.stderr) process.stderr.write(result.stderr)
    assert.strictEqual(result.status, 0, `${script} failed`)
    console.log(`VERIFY-SCRIPT PASS ${script}`)
  }
  console.log(`ALL VERIFY SCRIPTS PASS (${scripts.length} scripts; ${self} excluded to prevent recursion)`)
  return scripts
}

const coreOnly = process.argv.includes('--core')
runV1({ coreOnly })
if (process.argv.includes('--all-verify')) runAllVerifyScripts()

module.exports = { runV1, runAllVerifyScripts }
