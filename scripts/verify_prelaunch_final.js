const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath))
}

function walk(relativePath) {
  const target = path.join(root, relativePath)
  if (!fs.existsSync(target)) return []
  if (fs.statSync(target).isFile()) return [target]
  return fs.readdirSync(target, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(target, entry.name)
    return entry.isDirectory() ? walk(path.relative(root, child)) : [child]
  })
}

const project = readJson('project.config.json')
const app = readJson('app.json')
const userVisible = [
  'config/app-config.js',
  'pages/help/help.js',
  'pages/backup-restore/backup-restore.js',
  'pages/backup-restore/backup-restore.wxml',
  'pages/reports/reports.js',
  'pages/reports/reports.wxml',
  'pages/privacy/privacy.wxml',
  'pages/data-info/data-info.wxml'
].map(read).join('\n')
const runtime = ['app.js', 'app.json', 'app.wxss', 'sitemap.json', 'pages', 'components', 'utils', 'config', 'data', 'styles']
  .flatMap(walk)
  .filter((file) => /\.(?:js|json|wxml|wxss)$/.test(file))
  .map((file) => fs.readFileSync(file, 'utf8'))
  .join('\n')

assert.strictEqual(project.appid, 'wxc2a2a94f767438dd')
assert.strictEqual(project.projectname, '苏程记录')
assert.strictEqual(project.description, '苏程记录')
assert.strictEqual(project.compileType, 'miniprogram')
assert.strictEqual(project.miniprogramRoot, './')
assert.deepStrictEqual(app.tabBar.list.map((item) => item.text), ['首页', '学校库', '成绩', '目标规划', '我的'])

for (const phrase of [
  '不会自动上传到开发者服务器',
  '不主动分享时',
  '不主动发送时文件只保存在本机',
  '选择的接收方',
  '可信接收方',
  '取消或失败不会修改本机数据，也不会记录为成功'
]) assert.ok(userVisible.includes(phrase), `missing privacy copy: ${phrase}`)

for (const phrase of [
  '不上传服务器',
  '不上传用户数据',
  '所有数据永远不会离开本机',
  '录取概率',
  '录取可能性',
  '精准预测',
  '保证录取',
  '稳录',
  '保录',
  '一定能上',
  '建议填报',
  '志愿推荐',
  '最佳学校',
  '教育部门指定',
  '官方合作',
  'AI推荐'
]) assert.strictEqual(userVisible.includes(phrase), false, `forbidden user-visible copy: ${phrase}`)

for (const marker of [
  /wx\.login\s*\(/,
  /wx\.request\s*\(/,
  /wx\.uploadFile\s*\(/,
  /wx\.cloud/,
  /wx\.requestPayment\s*\(/,
  /wx\.getLocation\s*\(/,
  /wx\.chooseMedia\s*\(/,
  /wx\.chooseImage\s*\(/,
  /supabase/i
]) assert.doesNotMatch(runtime, marker)

assert.match(runtime, /历史公开数据整理，仅供目标规划参考。/)
assert.match(runtime, /不构成录取判断或志愿建议。/)
assert.strictEqual(runtime.includes('wx17e903f81714736f'), false)

console.log('PRELAUNCH FINAL STATIC VERIFY PASSED')
