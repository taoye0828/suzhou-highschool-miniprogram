const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const sourcePath = path.join(root, 'shared-spec', 'product_rules_v1.json')
const outputPath = path.join(root, 'utils', 'generated', 'product-rules.js')

function readRules() {
  const rules = JSON.parse(fs.readFileSync(sourcePath, 'utf8'))
  const required = [
    'productName', 'officialAppId', 'releaseStatus', 'productStage',
    'storageSchemaVersion', 'backupFormatVersion', 'restorePointFormatVersion',
    'operationLockTtlMs', 'examTotalScoreMax', 'limits'
  ]
  for (const key of required) {
    if (rules[key] === undefined || rules[key] === null || rules[key] === '') {
      throw new Error(`product rule missing: ${key}`)
    }
  }
  if (rules.examTotalScoreMax !== 740 || rules.storageSchemaVersion !== 5 ||
      rules.backupFormatVersion !== 3 || rules.restorePointFormatVersion !== 2) {
    throw new Error('V1 version or score invariant mismatch')
  }
  return rules
}

function render(rules) {
  return `'use strict'\n\n// Generated from shared-spec/product_rules_v1.json. Do not edit by hand.\nconst PRODUCT_RULES = Object.freeze(${JSON.stringify(rules, null, 2)})\n\nmodule.exports = { PRODUCT_RULES }\n`
}

function generate() {
  const rules = readRules()
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, render(rules), 'utf8')
  return outputPath
}

if (require.main === module) {
  process.stdout.write(`${generate()}\n`)
}

module.exports = { sourcePath, outputPath, readRules, render, generate }
