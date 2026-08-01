const fs = require('fs')
const { outputPath, readRules, render } = require('./generate_product_rules')

const expected = render(readRules())
const actual = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf8') : ''
if (actual !== expected) {
  throw new Error('utils/generated/product-rules.js is stale; run scripts/generate_product_rules.js')
}
process.stdout.write('V1-RULES-001 PASS generated product rules match the authoritative JSON\n')
