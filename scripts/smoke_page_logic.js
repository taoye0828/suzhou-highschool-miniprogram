const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'))

for (const pagePath of app.pages) {
  const jsPath = path.join(root, `${pagePath}.js`)
  const wxmlPath = path.join(root, `${pagePath}.wxml`)
  const jsonPath = path.join(root, `${pagePath}.json`)
  assert.ok(fs.existsSync(jsPath), `${pagePath}.js missing`)
  assert.ok(fs.existsSync(wxmlPath), `${pagePath}.wxml missing`)
  assert.ok(fs.existsSync(jsonPath), `${pagePath}.json missing`)
  const source = fs.readFileSync(jsPath, 'utf8')
  const wxml = fs.readFileSync(wxmlPath, 'utf8')
  const handlers = [...wxml.matchAll(/(?:bind|catch)(?:tap|change|input|confirm|submit|longpress|touchstart|touchend|blur|focus)\s*=\s*["']([A-Za-z_$][\w$]*)["']/g)]
    .map((match) => match[1])
  for (const handler of new Set(handlers)) {
    const escaped = handler.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    assert.ok(new RegExp(`(?:^|[, {\\n])${escaped}\\s*\\(`, 'm').test(source), `${pagePath} missing handler ${handler}`)
  }
}

const home = fs.readFileSync(path.join(root, 'pages/home/home.wxml'), 'utf8')
for (const label of ['当前档案', '中考倒计时', '最近成绩', '目标学校', '记录成绩', '查找学校']) {
  assert.ok(home.includes(label), `home missing ${label}`)
}

const helpJs = fs.readFileSync(path.join(root, 'pages/help/help.js'), 'utf8')
assert.ok(helpJs.includes('3341251927@qq.com'))
assert.ok(helpJs.includes('shsz1610'))
assert.ok(helpJs.includes('wx.setClipboardData'))

console.log('SMOKE PAGE LOGIC PASSED')
