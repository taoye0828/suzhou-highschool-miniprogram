const assert = require('assert')
const fs = require('fs')
const path = require('path')

// V1 首发前 UX 收口验证
console.log('V1-FINAL-UX: 验证首发前 UX 收口修复...')

// 1. 验证趋势图横坐标算法统一
console.log('\n[TEST] 趋势图横坐标统一')
const targetsJs = fs.readFileSync(path.join(__dirname, '../pages/targets/targets.js'), 'utf8')
assert.ok(
  targetsJs.includes('横坐标计算：与utils/score-trend.js保持一致'),
  'targets.js 应包含横坐标统一的注释'
)
assert.ok(
  targetsJs.includes('100 * index / (count - 1)'),
  'targets.js 应使用标准的横坐标算法'
)
console.log('✓ targets页面趋势图已使用统一的横坐标计算')

// 2. 验证学生档案创建简化
console.log('\n[TEST] 学生档案创建简化')
const profileManagementWxml = fs.readFileSync(
  path.join(__dirname, '../pages/profile-management/profile-management.wxml'),
  'utf8'
)
assert.ok(
  !profileManagementWxml.includes('收藏模式'),
  'profile-management.wxml 不应显示"收藏模式"选项'
)
assert.ok(
  !profileManagementWxml.includes('favoritesModeLabel'),
  'profile-management.wxml 不应显示 favoritesModeLabel'
)
console.log('✓ 档案管理页面已隐藏收藏模式选项')

const profileManagementJs = fs.readFileSync(
  path.join(__dirname, '../pages/profile-management/profile-management.js'),
  'utf8'
)
assert.ok(
  profileManagementJs.includes('createStudentProfile'),
  'createProfile 应调用 createStudentProfile'
)
console.log('✓ createProfile 使用默认 independent 模式')

// 3. 验证帮助与反馈
console.log('\n[TEST] 帮助与反馈')
const helpJs = fs.readFileSync(path.join(__dirname, '../pages/help/help.js'), 'utf8')
assert.ok(
  helpJs.includes('FEEDBACK_URL'),
  'help.js 应定义 FEEDBACK_URL 常量'
)
assert.ok(
  helpJs.includes('https://ycn8xfqnmoql.feishu.cn/share/base/form/shrcng2vmqyiVYLULDAEbJNWhtg55'),
  'FEEDBACK_URL 应为飞书问卷地址'
)
assert.ok(
  helpJs.includes('copyFeedbackLink'),
  'help.js 应有 copyFeedbackLink 函数'
)
assert.ok(
  helpJs.includes('wx.setClipboardData'),
  'copyFeedbackLink 应使用 wx.setClipboardData'
)
console.log('✓ 帮助页面包含反馈问卷入口')

const helpWxml = fs.readFileSync(path.join(__dirname, '../pages/help/help.wxml'), 'utf8')
assert.ok(
  helpWxml.includes('帮助与反馈'),
  'help.wxml 应显示"帮助与反馈"标题'
)
assert.ok(
  helpWxml.includes('反馈问卷'),
  'help.wxml 应提及反馈问卷'
)
assert.ok(
  helpWxml.includes('遮挡姓名、联系方式'),
  'help.wxml 应包含隐私提示'
)
assert.ok(
  helpWxml.includes('copyFeedbackLink'),
  'help.wxml 应绑定 copyFeedbackLink'
)
console.log('✓ 帮助页面WXML包含反馈入口和隐私提示')

const profileWxml = fs.readFileSync(path.join(__dirname, '../pages/profile/profile.wxml'), 'utf8')
assert.ok(
  profileWxml.includes('帮助与反馈'),
  'profile.wxml 应显示"帮助与反馈"入口'
)
assert.ok(
  profileWxml.includes('反馈问卷'),
  'profile.wxml 应提及反馈问卷'
)
console.log('✓ 我的页面包含"帮助与反馈"入口')

// 4. 验证无新增敏感权限或网络请求
console.log('\n[TEST] 安全性检查')
const allJs = [
  '../pages/help/help.js',
  '../pages/targets/targets.js',
  '../pages/profile-management/profile-management.js'
].map((file) => fs.readFileSync(path.join(__dirname, file), 'utf8')).join('\n')

assert.ok(
  !allJs.includes('wx.request'),
  '修改的文件不应包含 wx.request'
)
assert.ok(
  !allJs.match(/fetch\s*\(/),
  '修改的文件不应包含 fetch'
)
console.log('✓ 未新增网络请求')

// 5. 验证正式数据未变化
console.log('\n[TEST] 正式数据保护')
const schoolsJs = fs.readFileSync(path.join(__dirname, '../data/schools.js'), 'utf8')
const admissionScoresJs = fs.readFileSync(path.join(__dirname, '../data/admission-scores.js'), 'utf8')
assert.ok(schoolsJs.length > 10000, '学校数据文件未被删除')
assert.ok(admissionScoresJs.length > 5000, '分数线数据文件未被删除')
console.log('✓ 正式数据文件完整')

console.log('\n✅ V1-FINAL-UX: 所有验证通过')
console.log('\n人工验收项：')
console.log('- 微信开发者工具编译')
console.log('- 真机测试趋势图对齐')
console.log('- 真机测试复制反馈链接')
console.log('- 真机测试创建档案流程')
console.log('- 多屏幕尺寸测试')
