const assert = require('assert')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const { root, readJson, runtimeText } = require('./rc9_test_helpers')

const scripts = [
  'verify_rc10_post_audit.js',
  'verify_rc10_legacy_cleanup.js',
  'verify_rc10_transactional_storage.js',
  'verify_rc10_score_scenarios.js',
  'verify_rc10_loss_reasons.js',
  'verify_rc10_learning_tasks.js',
  'verify_rc10_goal_progress.js',
  'verify_rc10_target_gap_trend.js',
  'verify_rc10_school_quality_matrix.js',
  'verify_rc10_school_detail_trend.js',
  'verify_rc10_school_compare.js',
  'verify_rc10_recent_history.js',
  'verify_rc10_cross_platform_backup.js',
  'verify_rc10_data_health.js',
  'verify_rc10_performance.js',
  'verify_rc10_accessibility.js',
  'verify_rc10_dynamic_help.js',
  'verify_rc10_2027_workflow.js'
]
for (const script of scripts) {
  const result = spawnSync(process.execPath, [path.join('scripts', script)], { cwd: root, encoding: 'utf8' })
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
  assert.strictEqual(result.status, 0, `${script} failed`)
}
const hashes = {
  'data/schools.js': 'c185182c8dd8577b3165278c16014dbff98249585cf76bd1182b6ea1581d62f2',
  'data/admission-scores.js': '0d6257cd336dee5afe853d6c4d9ece68e1cefe2bb56a652cb8f8c651a14ccf88',
  'data/admission-scores-2026.js': '3091136605728315653049fb4802e83b87d9f86cb568746027ec9ef21417d75c'
}
for (const [file, hash] of Object.entries(hashes)) {
  assert.strictEqual(crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex'), hash)
}
assert.strictEqual(readJson('project.config.json').appid, 'wxc2a2a94f767438dd')
const runtime = runtimeText()
for (const marker of ['wx.login', 'wx.request', 'wx.uploadFile', 'wx.cloud', '录取概率', '成功率']) {
  assert.strictEqual(runtime.includes(marker), false, `禁止项：${marker}`)
}
console.log(`RC10 FULL VERIFY PASSED (${scripts.length}专项脚本)`)
