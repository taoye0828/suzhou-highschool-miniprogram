const { PRODUCT_RULES } = require('./generated/product-rules')

const DISCLAIMER = '历史公开数据整理，仅供目标规划参考。'
const RECOMMENDATION_NOTICE = '分组仅根据用户选择的历史成绩与学校历史公开分数线计算分差，不考虑招生计划、排名、指标生、批次变化、政策变化和当年试卷难度，不构成录取判断或志愿建议。'

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function createReportSnapshot(type, profile, data, generatedAt = new Date().toISOString()) {
  const profileSnapshot = { id: profile.id, nickname: profile.nickname || '默认档案' }
  if (type === 'score_stage') {
    const records = clone(data.scoreRecords || [])
    return {
      reportType: type,
      reportVersion: 1,
      generatedAt,
      profile: profileSnapshot,
      dataRange: `当前档案的 ${records.length} 条成绩记录`,
      records,
      disclaimer: DISCLAIMER
    }
  }
  if (type === 'target_school') {
    const targets = clone(data.targetRecords || [])
    const states = clone((data.schoolUserStates || []).filter((state) => targets.some((target) => target.schoolId === state.schoolId)))
    return {
      reportType: type,
      reportVersion: 1,
      generatedAt,
      profile: profileSnapshot,
      dataRange: `当前档案的 ${targets.length} 所目标学校及对应个人状态`,
      targets,
      schoolUserStates: states,
      disclaimer: DISCLAIMER,
      recommendationNotice: RECOMMENDATION_NOTICE
    }
  }
  throw new Error('不支持的报告类型')
}

function reportToText(snapshot) {
  const lines = [
    snapshot.reportType === 'score_stage' ? '苏程记录 · 成绩阶段报告' : '苏程记录 · 目标学校报告',
    `档案：${snapshot.profile.nickname}`,
    `生成时间：${snapshot.generatedAt}`,
    `数据范围：${snapshot.dataRange}`,
    ''
  ]
  if (snapshot.reportType === 'score_stage') {
    for (const item of snapshot.records) {
      lines.push(`${item.examDate || item.date || ''}｜${item.examName}｜${item.totalScore}/${item.totalMaxScore}｜得分率 ${Number.isInteger(item.scoreRateBasisPoints) ? (item.scoreRateBasisPoints / 100).toFixed(2) + '%' : '—'}`)
    }
  } else {
    for (const item of snapshot.targets) {
      const state = snapshot.schoolUserStates.find((entry) => entry.schoolId === item.schoolId)
      lines.push(`${item.schoolName}｜${item.level}｜标签 ${(state && state.tags || []).join('、') || '无'}｜备注 ${state && state.note || '无'}`)
    }
    lines.push('', snapshot.recommendationNotice)
  }
  lines.push('', snapshot.disclaimer)
  return lines.join('\n')
}

function reportToJson(snapshot) {
  return JSON.stringify(snapshot, null, 2)
}

function writeReportFile(snapshot, format, api = typeof wx === 'undefined' ? null : wx) {
  if (!api || !api.env || !api.env.USER_DATA_PATH || typeof api.getFileSystemManager !== 'function') {
    return { ok: false, code: 'FILE_API_UNAVAILABLE', message: '当前微信环境不支持生成报告文件。' }
  }
  const content = format === 'json' ? reportToJson(snapshot) : reportToText(snapshot)
  if (unescape(encodeURIComponent(content)).length > PRODUCT_RULES.limits.maxReportFileBytes) {
    return { ok: false, code: 'FILE_TOO_LARGE', message: '报告文件超过 1MB，请缩小数据范围。' }
  }
  const extension = format === 'json' ? 'json' : 'txt'
  const filePath = `${api.env.USER_DATA_PATH}/sucheng_report_${snapshot.reportType}_${Date.now()}.${extension}`
  try {
    api.getFileSystemManager().writeFileSync(filePath, content, 'utf8')
    return { ok: true, filePath, fileName: `苏程记录_${snapshot.reportType}.${extension}`, content }
  } catch (error) {
    return { ok: false, code: 'FILE_WRITE_FAILED', message: '报告文件生成失败，请检查本机存储空间。' }
  }
}

module.exports = {
  DISCLAIMER,
  RECOMMENDATION_NOTICE,
  createReportSnapshot,
  reportToText,
  reportToJson,
  writeReportFile
}
