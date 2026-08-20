const { schools } = require('../data/schools')
const { admissionScores } = require('../data/admission-scores')

const FALLBACK_FAQ = [
  { id: 'local_faq_sources', question: '学校和历史分数线来自哪里？', answer: '来自学校官网、教育局官网和政府公开网站等公开来源；学校详情会显示来源名称和核对日期。', sortOrder: 1 },
  { id: 'local_faq_history', question: '历史分数线应该怎么理解？', answer: '历史分数线按年份、招生区域、批次和招生类型区分，只用于了解过去公开信息。', sortOrder: 2 },
  { id: 'local_faq_local', question: '成绩和目标学校保存在哪里？', answer: '默认只保存在当前设备，不会自动上传到互联网。', sortOrder: 3 },
  { id: 'local_faq_backup', question: '如何备份和恢复？', answer: '进入“我的 → 数据备份与恢复”导出备份；恢复时选择备份文件，再选择合并或替换本机数据。', sortOrder: 4 },
  { id: 'local_faq_clear', question: '如何删除本机数据？', answer: '进入“我的 → 数据备份与恢复”，在“数据清理”中选择清除当前档案或清除全部本机数据。', sortOrder: 5 },
  { id: 'local_faq_limits', question: '为什么历史分数线不能代表未来录取结果？', answer: '招生计划、试卷难度、报名人数和政策都可能变化，因此历史数据不代表未来录取结果。', sortOrder: 6 }
]

const FALLBACK_CONTENT = Object.freeze({
  faq: FALLBACK_FAQ,
  contact: { email: '3341251927@qq.com', wechat: 'shsz1610', showEmail: true, showWechat: true },
  display: {
    showAnnouncements: true,
    showUpdatedAt: true,
    schoolDefaultSort: 'sort_order',
    scoreDefaultSort: 'year_desc',
    defaultHistoryYear: null,
    showContact: true,
    showFaq: true,
    publicNotice: ''
  },
  sources: []
})

function createFallbackSnapshot() {
  return {
    source: 'fallback',
    releaseVersion: 'bundled-v1',
    contentVersion: 'bundled-v1',
    schemaVersion: 1,
    publishedAt: '2026-07-09T00:00:00+08:00',
    downloadedAt: null,
    datasetVersions: {
      schools: 'bundled-v1', scores: 'bundled-v1', images: 'bundled-v1',
      announcements: 'bundled-v1', content: 'bundled-v1'
    },
    sha256: {},
    schools,
    scores: admissionScores,
    images: [],
    announcements: [],
    content: FALLBACK_CONTENT
  }
}

module.exports = { FALLBACK_CONTENT, FALLBACK_FAQ, createFallbackSnapshot }
