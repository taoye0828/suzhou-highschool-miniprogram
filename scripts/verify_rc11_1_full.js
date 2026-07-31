const assert = require('assert')
const path = require('path')
const { spawnSync } = require('child_process')

const scripts = [
  'verify_rc11_1_feature_inventory.js',
  'verify_rc11_1_runtime_graph.js',
  'verify_rc11_1_navigation.js',
  'verify_rc11_1_storage_keys.js',
  'verify_rc11_1_single_data_sources.js',
  'verify_rc11_1_business_rules.js',
  'verify_rc11_1_legacy_cleanup.js',
  'verify_rc11_1_refresh_matrix.js',
  'verify_rc11_1_user_journey_first_use.js',
  'verify_rc11_1_user_journey_second_exam.js',
  'verify_rc11_1_user_journey_multi_profile.js',
  'verify_rc11_1_cross_platform_consistency.js'
]

for (const script of scripts) {
  const result = spawnSync(process.execPath, [path.join(__dirname, script)], {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8'
  })
  process.stdout.write(result.stdout || '')
  process.stderr.write(result.stderr || '')
  assert.strictEqual(result.status, 0, `${script} failed`)
}

console.log(`RC11-1 FULL VERIFY PASSED (${scripts.length} child gates)`)
