const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const projectConfigPath = path.join(root, 'project.config.json')
const projectConfig = JSON.parse(fs.readFileSync(projectConfigPath, 'utf8'))
const ignoreRules = projectConfig.packOptions && projectConfig.packOptions.ignore
const gitignore = fs.readFileSync(path.join(root, '.gitignore'), 'utf8').split(/\r?\n/).filter(Boolean)

assert.ok(Array.isArray(ignoreRules), 'packOptions.ignore must be an array')
assert.strictEqual(projectConfig.appid, 'wxc2a2a94f767438dd')
assert.strictEqual(projectConfig.compileType, 'miniprogram')
assert.strictEqual(projectConfig.miniprogramRoot, './')
assert.strictEqual(projectConfig.setting && projectConfig.setting.ignoreDevUnusedFiles, false, 'runtime pages must not be removed by the DevTools unused-file filter')
assert.strictEqual(projectConfig.setting && projectConfig.setting.uploadWithSourceMap, false, 'release uploads must not include source maps')
assert.strictEqual(Object.hasOwn(projectConfig, 'cloudfunctionRoot'), false)
assert.strictEqual(Object.hasOwn(projectConfig, 'cloudfunctionTemplateRoot'), false)
for (const rule of [
  '.env*',
  '*.p12',
  '*.mobileprovision',
  'build/',
  'DerivedData/',
  'xcuserdata/',
  '*.xcuserstate',
  'project.private.config.json',
  'node_modules/',
  '*.log',
  '.vscode/',
  '.idea/',
  'coverage/',
  'tmp/',
  '*.tmp',
  '*.bak_[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]_[0-9][0-9][0-9][0-9][0-9][0-9]'
]) {
  assert.ok(gitignore.includes(rule), `.gitignore rule missing: ${rule}`)
}

function normalize(relativePath) {
  return relativePath.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '')
}

function ruleMatches(rule, relativePath) {
  const target = normalize(relativePath)
  const value = normalize(String(rule.value || ''))

  if (rule.type === 'file') return target === value
  if (rule.type === 'folder') return target === value || target.startsWith(`${value}/`)
  if (rule.type === 'suffix') return target.endsWith(value)
  if (rule.type === 'prefix') return path.basename(target).startsWith(value)
  if (rule.type === 'regexp') return new RegExp(rule.value).test(target)
  return false
}

function isIgnored(relativePath) {
  return ignoreRules.some((rule) => ruleMatches(rule, relativePath))
}

function hasRule(type, value) {
  return ignoreRules.some((rule) => rule.type === type && rule.value === value)
}

function assertIgnored(relativePath) {
  assert.strictEqual(isIgnored(relativePath), true, `${relativePath} should be ignored from upload package`)
}

function assertNotIgnored(relativePath) {
  assert.strictEqual(isIgnored(relativePath), false, `${relativePath} must remain in upload package`)
}

assert.ok(hasRule('folder', 'docs'), 'docs folder ignore rule missing')
assert.ok(hasRule('folder', 'scripts'), 'scripts folder ignore rule missing')
assert.ok(hasRule('folder', 'shared-spec'), 'shared-spec folder ignore rule missing')
assert.ok(hasRule('folder', 'utils/generated'), 'generated development rules ignore missing')
assert.ok(hasRule('file', 'README.md'), 'README.md ignore rule missing')
assert.ok(hasRule('file', 'project.private.config.json'), 'private DevTools config ignore rule missing')
assert.ok(hasRule('suffix', '.md'), '*.md suffix ignore rule missing')
assert.ok(hasRule('suffix', '.DS_Store'), 'nested .DS_Store ignore rule missing')
assert.ok(hasRule('folder', 'docs/mp5_official_images'), 'official image cache ignore rule missing')
assert.ok(hasRule('folder', 'docs/mp5_official_pages'), 'official page cache ignore rule missing')
assert.ok(hasRule('regexp', '^docs/.*\\.html$'), 'docs html regexp ignore rule missing')
assert.ok(hasRule('regexp', '^docs/.*\\.jpe?g$'), 'docs jpg/jpeg regexp ignore rule missing')
assert.ok(hasRule('regexp', '^docs/.*\\.png$'), 'docs png regexp ignore rule missing')
assert.ok(hasRule('regexp', '^docs/.*\\.md$'), 'docs md regexp ignore rule missing')
assert.ok(hasRule('file', 'package-lock.json'), 'package-lock.json ignore rule missing')
assert.ok(hasRule('file', 'package.json'), 'package.json ignore rule missing')
assert.ok(hasRule('folder', '.vscode'), '.vscode ignore rule missing')
assert.ok(hasRule('folder', '.idea'), '.idea ignore rule missing')
assert.ok(hasRule('suffix', '.log'), '*.log ignore rule missing')
assert.ok(hasRule('regexp', '\\.bak_[0-9]{8}_[0-9]{6}$'), 'timestamped backup ignore rule missing')

;[
  'docs/audit_fix_report.md',
  'docs/mp5_official_images/20251029142432.jpeg',
  'docs/mp5_official_images/source.png',
  'docs/mp5_official_pages/4199.html',
  'docs/mp5_scores_to_confirm.md',
  'scripts/verify_mp1.js',
  'shared-spec/product_rules_v1.json',
  'utils/generated/product-rules.js',
  'README.md',
  'project.private.config.json',
  '.git/config',
  '.DS_Store',
  'pages/.DS_Store',
  'utils/.DS_Store',
  'node_modules/example/index.js',
  'package-lock.json',
  'package.json',
  'coverage/lcov.info',
  'tmp/result.json',
  'backups/project.config.json.bak_20260710_000000',
  'debug.log',
  '.vscode/settings.json',
  '.idea/workspace.xml',
  'app.js.bak_20260812_093253',
  'pages/home/home.wxml.bak_20260812_093253'
].forEach(assertIgnored)

;[
  'app.js',
  'app.json',
  'app.wxss',
  'sitemap.json',
  'pages/home/home.js',
  'pages/schools/schools.wxml',
  'pages/help/help.js',
  'pages/privacy/privacy.wxml',
  'data/schools.js',
  'data/admission-scores.js',
  'data/admission-scores-2026.js',
  'utils/storage.js',
  'utils/runtime-constants.js',
  'config/app-config.js',
  'styles/common.wxss'
].forEach(assertNotIgnored)

function walk(relative) {
  const target = path.join(root, relative)
  if (!fs.existsSync(target)) return []
  const stat = fs.statSync(target)
  if (stat.isFile()) return [target]
  return fs.readdirSync(target, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === 'backups') return []
    return walk(path.relative(root, path.join(target, entry.name)))
  })
}

const runtimeFiles = ['app.js', 'app.json', 'app.wxss', 'sitemap.json', 'pages', 'data', 'utils', 'config', 'styles']
  .flatMap(walk)
  .filter((file) => fs.statSync(file).isFile())

for (const file of runtimeFiles) {
  const source = fs.readFileSync(file, 'utf8')
  assert.strictEqual(/wx\.cloud|cloudfunctions|uploadCloudFunctions|快速了解云开发|云开发/.test(source), false, `${path.relative(root, file)} enables or references cloud development`)
  assert.strictEqual(/app\s*secret|appsecret|service_role|password\s*[:=]/i.test(source), false, `${path.relative(root, file)} contains a secret-like key`)
}

const serializedConfig = JSON.stringify(projectConfig)
assert.strictEqual(/app\s*secret|appsecret|service_role|password/i.test(serializedConfig), false, 'project.config.json contains a secret-like key')

console.log('UPLOAD PACKAGE IGNORE VERIFY PASSED')
