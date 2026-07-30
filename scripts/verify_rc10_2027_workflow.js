const assert = require('assert')
const fs = require('fs')
const { admissionScores } = require('../data/admission-scores')
const { validateCandidate } = require('./annual_data_2027_tool')
const { read } = require('./rc9_test_helpers')

assert.strictEqual(admissionScores.some((item) => item.year === 2027), false)
assert.deepStrictEqual(validateCandidate({ year: 2027, records: [] }), {
  ok: true,
  errors: [],
  recordCount: 0
})
assert.ok(fs.existsSync('docs/annual_data_update_2027_workflow.md'))
assert.ok(read('project.config.json').includes('"value": "docs"'))
console.log('RC10 2027 WORKFLOW VERIFY PASSED')
