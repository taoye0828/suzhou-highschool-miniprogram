const assert = require('assert')
const fs = require('fs')
const path = require('path')
const { readJson, read } = require('./rc9_test_helpers')

const graph = read('docs/rc11_1_runtime_call_graph.md')
for (const marker of [
  '用户入口', '路由', '页面', '页面状态', 'Service', 'Repository', 'Storage adapter',
  '存储键', 'Model', '迁移函数', '导出字段', '导入字段', '清除逻辑', '刷新机制', '测试'
]) assert.ok(graph.includes(marker), `runtime graph missing ${marker}`)
for (const feature of [
  '首页摘要', '学校搜索', '学校筛选', '学校详情', '收藏', '对比', '成绩新增', '成绩编辑',
  '成绩删除', '成绩趋势', '学科成绩', '考试复盘', '失分原因', '学习任务', '推荐', '目标学校',
  '主要目标', '目标分差', '阶段目标', '多档案', '备份导出', '备份导入', '数据检查', '数据修复',
  '动态帮助', '清除数据', '最近浏览'
]) assert.ok(graph.includes(feature), `runtime graph missing ${feature}`)

const app = readJson('app.json')
for (const route of app.pages) {
  assert.ok(fs.existsSync(path.join(__dirname, '..', `${route}.js`)))
}
assert.ok(read('pages/home/home.js').includes("require('../../utils/storage')"))
assert.ok(read('pages/score-trend/score-trend.js').includes('saveScoreRecord'))
assert.ok(read('pages/targets/targets.js').includes('saveLearningTask'))
assert.ok(read('pages/profile/profile.js').includes('openBackupRestore'))

console.log('RC11-1 RUNTIME GRAPH PASSED')
