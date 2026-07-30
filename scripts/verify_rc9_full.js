const assert = require('assert')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const {
  root,
  read,
  readJson,
  walk,
  runtimeText
} = require('./rc9_test_helpers')

const childScripts = [
  'verify_rc8_chart_vertical_alignment.js',
  'verify_rc9_navigation_fusion.js',
  'verify_rc9_school_filters.js',
  'verify_rc9_school_integration.js',
  'verify_rc9_score_center.js',
  'verify_rc9_target_center.js',
  'verify_rc9_subject_scores.js',
  'verify_rc9_exam_review.js',
  'verify_rc9_stage_goals.js',
  'verify_rc9_storage_migration.js',
  'verify_rc9_backup_restore.js',
  'verify_rc9_student_profiles.js',
  'verify_rc9_clear_data.js',
  'verify_rc9_onboarding_help.js'
]

for (const script of childScripts) {
  const relative = path.join('scripts', script)
  assert.ok(fs.existsSync(path.join(root, relative)), `缺少专项脚本：${relative}`)
  const result = spawnSync(process.execPath, [relative], {
    cwd: root,
    encoding: 'utf8'
  })
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
  assert.strictEqual(result.status, 0, `${relative} 执行失败`)
}

const { APP_CONFIG, EXAM_TOTAL_SCORE } = require('../config/app-config')
const { schools } = require('../data/schools')
const { admissionScores } = require('../data/admission-scores')
const projectConfig = readJson('project.config.json')
const appJson = readJson('app.json')

assert.strictEqual(APP_CONFIG.name, '苏程记录')
assert.strictEqual(APP_CONFIG.version, '2.0.0')
assert.strictEqual(projectConfig.appid, 'wx17e903f81714736f')
assert.strictEqual(appJson.window.navigationBarTitleText, '苏程记录')
assert.strictEqual(EXAM_TOTAL_SCORE, 740)
assert.strictEqual(schools.length, 55)
assert.strictEqual(admissionScores.length, 146)
assert.strictEqual(admissionScores.filter((item) => item.year === 2025).length, 103)
assert.strictEqual(admissionScores.filter((item) => item.year === 2026).length, 43)

function sha256(relative) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(root, relative))).digest('hex')
}

const expectedHashes = {
  'data/schools.js': 'c185182c8dd8577b3165278c16014dbff98249585cf76bd1182b6ea1581d62f2',
  'data/admission-scores.js': '0d6257cd336dee5afe853d6c4d9ece68e1cefe2bb56a652cb8f8c651a14ccf88',
  'data/admission-scores-2026.js': '3091136605728315653049fb4802e83b87d9f86cb568746027ec9ef21417d75c'
}
for (const [relative, expected] of Object.entries(expectedHashes)) {
  assert.strictEqual(sha256(relative), expected, `${relative} 正式数据哈希变化`)
}

const source = runtimeText()
for (const phrase of [
  '保证录取',
  '一定考上',
  '成功率',
  '录取概率',
  '精准预测',
  '保录',
  '官方推荐志愿',
  '教育部门合作',
  '官方指定工具',
  '智能录取预测'
]) {
  assert.strictEqual(source.includes(phrase), false, `运行代码存在禁止文案：${phrase}`)
}
for (const marker of [
  'wx.' + 'login',
  'wx.' + 'request',
  'wx.' + 'uploadFile',
  'wx.' + 'cloud',
  'cloudfunctionRoot',
  'cloudbaseRoot'
]) {
  assert.strictEqual(source.includes(marker), false, `运行代码存在禁止 API：${marker}`)
}

const userFacingText = ['pages', 'components']
  .flatMap(walk)
  .filter((file) => /\.(?:wxml|wxss|json)$/.test(file))
  .map((file) => fs.readFileSync(file, 'utf8'))
  .join('\n')
for (const marker of [
  '住宿未核实',
  '信息未核实',
  '数据待核实',
  '地址未核实',
  '电话未核实',
  'verified',
  'unverified',
  'needs_review'
]) {
  assert.strictEqual(userFacingText.includes(marker), false, `用户界面存在内部状态：${marker}`)
}

const chartSource = [
  read('pages/score-trend/score-trend.js'),
  read('pages/score-trend/score-trend.wxml'),
  read('pages/score-trend/score-trend.wxss'),
  read('pages/targets/targets.js'),
  read('pages/targets/targets.wxml'),
  read('pages/targets/targets.wxss')
].join('\n')
for (const pattern of [
  /width\s*:\s*10%/,
  /flex-basis\s*:\s*10%/,
  /index\s*\/\s*10/,
  /index\s*\*\s*10%/,
  /Array\s*\(\s*10\s*\).*label/is
]) {
  assert.strictEqual(pattern.test(chartSource), false, `趋势图存在固定十格逻辑：${pattern}`)
}
assert.ok(chartSource.includes('visibleTrendPoints'))
assert.ok(chartSource.includes('point.x'))

console.log('RC9 FULL VERIFY PASSED')
console.log(`- 专项脚本：${childScripts.length} 个全部通过`)
console.log('- 名称、AppID、2.0.0、55/103/43/146、740 与三份正式数据哈希通过')
console.log('- 禁止 API、禁止文案、内部状态 UI 与固定十格扫描通过')
