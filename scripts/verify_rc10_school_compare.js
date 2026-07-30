const assert = require('assert')
const { read } = require('./rc9_test_helpers')

const source = `${read('pages/school-compare/school-compare.js')}\n${read('pages/school-compare/school-compare.wxml')}`
for (const marker of ['stageDifferenceText', 'finalDifferenceText', 'moveSchool', 'officialSource', 'userNotes']) {
  assert.ok(source.includes(marker), `学校对比缺少 ${marker}`)
}
for (const forbidden of ['推荐指数', '录取概率', '综合排名', '最佳学校']) {
  assert.strictEqual(source.includes(forbidden), false)
}
assert.ok(source.includes('selectedSchools.length >= 2'))
console.log('RC10 SCHOOL COMPARE VERIFY PASSED')
