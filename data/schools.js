const { APP_CONFIG } = require('../config/app-config')

const publicSampleMeta = {
  dataVersion: APP_CONFIG.schoolData.version,
  sourceVerifiedAt: APP_CONFIG.schoolData.publicSampleVerifiedAt
}

const demoMeta = {
  dataVersion: APP_CONFIG.schoolData.version,
  sourceVerifiedAt: null
}

const schools = [
  {
    ...publicSampleMeta,
    id: 'public_001',
    name: '苏州市吴江区新教育学校',
    district: '吴江区',
    schoolType: '高中阶段学校',
    boardingType: '待核实',
    dataKind: 'public',
    dataStatus: '公开资料',
    intro: '学校基础信息来自公开资料。',
    sourceNote: '来源：吴江区政府公开收费公示。'
  },
  {
    ...publicSampleMeta,
    id: 'public_002',
    name: '苏州市吴江区世恒学校',
    district: '吴江区',
    schoolType: '高中阶段学校',
    boardingType: '待核实',
    dataKind: 'public',
    dataStatus: '公开资料',
    intro: '学校基础信息来自公开资料。',
    sourceNote: '来源：吴江区政府公开收费公示。'
  },
  {
    ...publicSampleMeta,
    id: 'public_003',
    name: '人大附中苏州学校',
    district: '苏州市区',
    schoolType: '高中阶段项目',
    boardingType: '待核实',
    dataKind: 'public',
    dataStatus: '公开资料',
    intro: '学校基础信息来自公开资料。',
    sourceNote: '来源：苏州市政府公开教育通知。'
  },
  {
    ...demoMeta,
    id: 'demo_001',
    name: '示例高中 A',
    district: '示例区域一',
    schoolType: '公办（示例）',
    boardingType: '可住宿（示例）',
    dataKind: 'demo',
    dataStatus: '示例学校',
    intro: '用于体验查询、筛选和收藏功能。',
    sourceNote: '示例内容，不对应现实学校。'
  },
  {
    ...demoMeta,
    id: 'demo_002',
    name: '示例高中 B',
    district: '示例区域一',
    schoolType: '民办（示例）',
    boardingType: '走读（示例）',
    dataKind: 'demo',
    dataStatus: '示例学校',
    intro: '用于体验查询、筛选和收藏功能。',
    sourceNote: '示例内容，不对应现实学校。'
  },
  {
    ...demoMeta,
    id: 'demo_003',
    name: '示例高中 C',
    district: '示例区域二',
    schoolType: '公办（示例）',
    boardingType: '部分住宿（示例）',
    dataKind: 'demo',
    dataStatus: '示例学校',
    intro: '用于体验查询、筛选和收藏功能。',
    sourceNote: '示例内容，不对应现实学校。'
  }
]

module.exports = { schools }
