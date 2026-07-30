const assert = require('assert')
const fs = require('fs')
const path = require('path')
const { schools } = require('../data/schools')

function validateCandidate(input) {
  const errors = []
  const document = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  const records = Array.isArray(document.records) ? document.records : []
  const schoolIds = new Set(schools.map((item) => item.id))
  const ids = new Set()
  const businessKeys = new Set()
  for (const [index, record] of records.entries()) {
    const label = `records[${index}]`
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      errors.push(`${label} 结构无效`)
      continue
    }
    if (!record.id || ids.has(record.id)) errors.push(`${label} ID 缺失或重复`)
    ids.add(record.id)
    if (!schoolIds.has(record.schoolId)) errors.push(`${label} schoolId 无效`)
    if (record.year !== 2027) errors.push(`${label} year 必须为 2027`)
    if (!Number.isInteger(record.minScore) || record.minScore < 0 || record.minScore > 740) {
      errors.push(`${label} minScore 必须为 0—740 的整数`)
    }
    for (const field of ['region', 'batch', 'admissionType', 'scoreType', 'sourceTitle']) {
      if (!String(record[field] || '').trim()) errors.push(`${label} 缺少 ${field}`)
    }
    if (!/^https:\/\//.test(String(record.sourceUrl || ''))) errors.push(`${label} 来源必须为 HTTPS`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(record.sourceCheckedAt || ''))) errors.push(`${label} 核对日期无效`)
    if (record.humanConfirmed !== true) errors.push(`${label} 尚未人工确认`)
    const businessKey = [
      record.schoolId,
      record.year,
      record.region,
      record.batch,
      record.admissionType,
      record.scoreType
    ].join('|')
    if (businessKeys.has(businessKey)) errors.push(`${label} 业务记录重复`)
    businessKeys.add(businessKey)
  }
  return { ok: errors.length === 0, errors, recordCount: records.length }
}

if (require.main === module) {
  const file = process.argv[2]
  assert.ok(file, '用法：node scripts/annual_data_2027_tool.js <候选 JSON>')
  const document = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'))
  const result = validateCandidate(document)
  if (!result.ok) {
    process.stderr.write(`${result.errors.join('\n')}\n`)
    process.exitCode = 1
  } else {
    console.log(`2027 CANDIDATE VALIDATION PASSED (${result.recordCount} records)`)
  }
}

module.exports = { validateCandidate }
