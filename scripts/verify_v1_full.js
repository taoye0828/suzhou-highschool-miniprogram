const { spawnSync } = require('child_process')
const path = require('path')

const root = path.resolve(__dirname, '..')
const gates = [
  'verify_fcp_mp_first_release.js',
  'verify_dual_final_hardening.js',
  'smoke_local_logic.js',
  'smoke_page_logic.js',
  'verify_upload_package_ignore.js',
  'verify_score_max_740.js',
  'verify_mp13_2026_scores.js'
]

for (const gate of gates) {
  const result = spawnSync(process.execPath, [path.join(__dirname, gate)], {
    cwd: root,
    encoding: 'utf8'
  })
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
  if (result.status !== 0) process.exit(result.status || 1)
}

console.log('V1 FULL VERIFY PASS (FCP 12 TEST-ID)')
if (process.argv.includes('--all-verify')) {
  console.log(`ALL CURRENT RELEASE GATES PASS (${gates.length} scripts)`)
}
