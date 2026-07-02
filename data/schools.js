const schools = [
  {
    id: 'public_001',
    name: '苏州市吴江区新教育学校',
    district: '吴江区',
    schoolType: '高中阶段学校样本',
    boardingType: '住宿状态待核验',
    dataKind: 'public',
    dataStatus: '公开来源基础样本',
    intro: '公开来源基础样本，仅展示学校名称、区域和类型等安全字段。',
    tags: ['公开来源', '基础信息', '人工核对'],
    sourceNote: '来源：吴江区政府公开收费公示，基础字段已人工核对。'
  },
  {
    id: 'public_002',
    name: '苏州市吴江区世恒学校',
    district: '吴江区',
    schoolType: '高中阶段学校样本',
    boardingType: '住宿状态待核验',
    dataKind: 'public',
    dataStatus: '公开来源基础样本',
    intro: '公开来源基础样本，仅展示学校名称、区域和类型等安全字段。',
    tags: ['公开来源', '基础信息', '人工核对'],
    sourceNote: '来源：吴江区政府公开收费公示，基础字段已人工核对。'
  },
  {
    id: 'public_003',
    name: '人大附中苏州学校',
    district: '苏州市区',
    schoolType: '高中阶段项目样本',
    boardingType: '住宿状态待核验',
    dataKind: 'public',
    dataStatus: '公开来源基础样本',
    intro: '公开来源基础样本，仅展示学校名称、区域和类型等安全字段。',
    tags: ['公开来源', '基础信息', '人工核对'],
    sourceNote: '来源：苏州市政府公开教育通知，基础字段已人工核对。'
  },
  {
    id: 'demo_001',
    name: '示例高中 A',
    district: '示例区域一',
    schoolType: '公办示例',
    boardingType: '可住宿示例',
    dataKind: 'demo',
    dataStatus: '演示数据',
    intro: '明显虚构的学校资料，用于演示搜索、筛选、详情和收藏。',
    tags: ['虚构样本', '本地演示', '功能测试'],
    sourceNote: '本地虚构演示数据，不对应现实学校。'
  },
  {
    id: 'demo_002',
    name: '示例高中 B',
    district: '示例区域一',
    schoolType: '民办示例',
    boardingType: '走读示例',
    dataKind: 'demo',
    dataStatus: '演示数据',
    intro: '明显虚构的学校资料，用于演示多条件筛选和空状态。',
    tags: ['虚构样本', '本地演示', '走读示例'],
    sourceNote: '本地虚构演示数据，不对应现实学校。'
  },
  {
    id: 'demo_003',
    name: '示例高中 C',
    district: '示例区域二',
    schoolType: '公办示例',
    boardingType: '部分住宿示例',
    dataKind: 'demo',
    dataStatus: '演示数据',
    intro: '明显虚构的学校资料，用于演示学校标签和本地功能。',
    tags: ['虚构样本', '本地演示', '住宿示例'],
    sourceNote: '本地虚构演示数据，不对应现实学校。'
  }
]

module.exports = { schools }
