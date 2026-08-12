const { spawnSync } = require('child_process')

const gates = [
  'verify_fcp_mp_first_release.js',
  'verify_mp1.js',
  'verify_mp2.js',
  'verify_mp4.js',
  'verify_mp5.js',
  'verify_mp6.js',
  'verify_score_max_740.js',
  'verify_mp13_2026_scores.js',
  'verify_upload_package_ignore.js',
  'verify_production_public_data_v1.js',
  'verify_product_rules_generated.js',
  'verify_rc10_cross_platform_backup.js',
  'verify_rc10_transactional_storage.js',
  'verify_rc11_1_single_data_sources.js',
  'verify_rc11_2_fault_injection.js',
  'verify_rc11_2_idempotency.js',
  'verify_rc11_2_operation_locks.js',
  'verify_rc11_2_profile_restore_isolation.js',
  'verify_rc11_2_restore_execution.js',
  'verify_rc11_2_restore_point_checksum.js',
  'verify_rc11_2_restore_point_creation.js',
  'verify_rc11_2_restore_point_limits.js',
  'verify_rc11_2_restore_point_model.js',
  'verify_rc11_2_startup_recovery.js',
  'verify_rc11_2_version_conflicts.js',
  'verify_rc9_backup_restore.js',
  'verify_rc9_clear_data.js',
  'verify_rc9_full.js',
  'verify_rc9_stage_goals.js',
  'verify_rc9_storage_migration.js',
  'verify_rc9_student_profiles.js',
  'verify_v1_final_ux.js',
  'verify_v1_full.js',
  'smoke_local_logic.js',
  'smoke_page_logic.js'
]

for (const gate of gates) {
  const result = spawnSync(process.execPath, [require('path').join(__dirname, gate)], { stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status || 1)
}

console.log(`PRODUCTION RELEASE CANDIDATE GATES PASSED (${gates.length}/${gates.length})`)
