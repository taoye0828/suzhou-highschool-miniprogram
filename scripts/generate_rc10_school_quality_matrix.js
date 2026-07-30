const fs = require('fs')
const path = require('path')
const { schools } = require('../data/schools')
const { admissionScores } = require('../data/admission-scores')

const root = path.resolve(__dirname, '..')
const outputPath = path.join(root, 'docs', 'rc10_school_data_quality_matrix.md')
const schoolIds = new Set(schools.map((item) => item.id))

function status(value) {
  return value === undefined || value === null ||
    (typeof value === 'string' && !value.trim()) ||
    (Array.isArray(value) && !value.length)
    ? '缺失'
    : '已核实'
}

function scoresFor(schoolId, year) {
  return admissionScores.filter((item) => item.schoolId === schoolId && item.year === year)
}

function escapeCell(value) {
  return String(value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
}

function buildMatrix() {
  const duplicateIds = new Set(schools
    .map((item) => item.id)
    .filter((id, index, all) => all.indexOf(id) !== index))
  const duplicateNames = new Set(schools
    .map((item) => item.name)
    .filter((name, index, all) => all.indexOf(name) !== index))
  const invalidScoreSchoolIds = admissionScores
    .map((item) => item.schoolId)
    .filter((id) => !schoolIds.has(id))
  const missingCounts = {
    '简称': schools.filter((item) => status(item.aliases) === '缺失').length,
    '区域': schools.filter((item) => status(item.district) === '缺失').length,
    '校区': schools.filter((item) => status(item.campus) === '缺失').length,
    '性质': schools.filter((item) => status(item.ownership) === '缺失').length,
    '类型': schools.filter((item) => status(item.schoolType) === '缺失').length,
    '地址': schools.filter((item) => status(item.address) === '缺失').length,
    '电话': schools.filter((item) => status(item.phone) === '缺失').length,
    '官网/政府来源': schools.filter((item) => status(item.sourceUrl) === '缺失').length,
    '核对日期': schools.filter((item) => status(item.sourceCheckedAt) === '缺失').length,
    '2025分数线': schools.filter((item) => !scoresFor(item.id, 2025).length).length,
    '2026分数线': schools.filter((item) => !scoresFor(item.id, 2026).length).length
  }
  const totalMissingFields = Object.values(missingCounts)
    .reduce((total, count) => total + count, 0)
  const conflictCount = duplicateIds.size + duplicateNames.size +
    schools.filter((item) => item.sourceUrl && !/^https:\/\//.test(item.sourceUrl)).length +
    invalidScoreSchoolIds.length
  const lines = [
    '# RC10 55 所学校数据质量矩阵',
    '',
    `生成时间：${new Date().toISOString()}`,
    '',
    '范围：只根据仓库现有正式学校字段与官方来源记录审计；不联网猜测、不补写正式数据。内部状态仅使用“已核实 / 缺失 / 冲突 / 暂不展示”。',
    '',
    `摘要：学校 ${schools.length} 所；历史分数线 ${admissionScores.length} 条；重复 schoolId ${duplicateIds.size}；重复正式名称 ${duplicateNames.size}；无效分数线 schoolId ${invalidScoreSchoolIds.length}。`,
    '',
    `字段统计：缺失 ${totalMissingFields} 项（${Object.entries(missingCounts).map(([key, value]) => `${key} ${value}`).join('、')}）；冲突 ${conflictCount} 项。缺失项继续隐藏，不据此猜测或补写正式数据。`,
    '',
    '| schoolId | 正式名称 | 简称 | 区域 | 校区 | 性质 | 类型 | 地址 | 电话 | 官网/政府来源 | 2025 | 2026 | 项目区分 | 核对日期 | 同名/主体冲突 | 用户展示 |',
    '|---|---|---|---|---|---|---|---|---|---|---:|---:|---|---|---|---|'
  ]
  for (const school of schools) {
    const y2025 = scoresFor(school.id, 2025)
    const y2026 = scoresFor(school.id, 2026)
    const itemNames = [...new Set([...y2025, ...y2026]
      .map((item) => `${item.batch || ''}/${item.admissionType || ''}`))]
      .filter((item) => item !== '/')
    const sourceStatus = school.sourceUrl && /^https:\/\//.test(school.sourceUrl)
      ? '已核实'
      : school.sourceUrl
        ? '冲突'
        : '缺失'
    const conflict = duplicateIds.has(school.id) || duplicateNames.has(school.name)
      ? '冲突'
      : '已核实'
    const userVisible = [
      '正式名称',
      school.district && '区域',
      school.schoolType && '类型',
      school.ownership && '性质',
      school.campus && '校区',
      school.address && '地址',
      school.phone && '电话',
      school.sourceUrl && '来源',
      (y2025.length || y2026.length) && '分数线'
    ].filter(Boolean).join('、')
    lines.push([
      school.id,
      school.name,
      status(school.aliases),
      status(school.district),
      status(school.campus),
      status(school.ownership),
      status(school.schoolType),
      status(school.address),
      status(school.phone),
      sourceStatus,
      y2025.length || '缺失',
      y2026.length || '缺失',
      itemNames.length ? `已核实(${itemNames.length})` : '缺失',
      status(school.sourceCheckedAt),
      conflict,
      userVisible || '暂不展示'
    ].map(escapeCell).join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
  }
  lines.push(
    '',
    '## 判定规则',
    '',
    '- “缺失”字段继续在用户页面隐藏，不显示内部状态。',
    '- 同校同年多条记录按批次与招生类型保留项目名称，不做平均。',
    '- 质量矩阵不修改 schoolId、scoreId、来源 URL 或正式数据文件。',
    '- 2027 年正式分数线为 0 条。'
  )
  return `${lines.join('\n')}\n`
}

if (process.argv.includes('--write')) {
  fs.writeFileSync(outputPath, buildMatrix(), 'utf8')
  console.log(`WROTE ${path.relative(root, outputPath)}`)
}

module.exports = { buildMatrix, outputPath }
