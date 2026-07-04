const TARGET_SCORE_MAX = 750
const SOURCE_CHECKED_AT = '2026-07-04'

const APP_CONFIG = {
  name: '苏州高中目标查询助手',
  version: '1.1.0',
  releaseStatus: '上架准备版',
  targetScore: {
    min: 0,
    max: TARGET_SCORE_MAX,
    maxLength: String(TARGET_SCORE_MAX).length,
    maxRecords: 100,
    draftDebounceMs: 400
  },
  schoolData: {
    version: SOURCE_CHECKED_AT,
    sourceCheckedAt: SOURCE_CHECKED_AT
  },
  policy: {
    homeTagline: '查询学校基础信息，收藏关注学校，记录阶段学习目标',
    currentCapabilities: [
      '查看苏州高中阶段学校基础信息',
      '按区域、类型、办学性质和住宿状态筛选',
      '收藏关注学校',
      '记录阶段学习目标',
      '查看数据来源和隐私说明'
    ],
    currentLimits: [
      '不展示真实录取分数线',
      '不做录取预测',
      '不提供志愿填报结论',
      '不请求定位',
      '不上传用户数据'
    ],
    usageSteps: [
      '第一步：进入学校库查看基础信息',
      '第二步：收藏关注学校',
      '第三步：记录阶段学习目标',
      '第四步：定期复盘差距变化'
    ],
    targetHint: '这里仅用于记录学习目标，不代表中考录取判断，也不提供择校推荐。',
    schoolDetailNotice: '学校信息仅供查询参考，当前版本暂不展示真实录取分数线。',
    dataInfoSections: [
      {
        title: '当前数据包含什么',
        items: [
          '学校库包含苏州高中阶段学校基础信息、少量示例学校和公开来源样本。',
          '基础信息包括学校名称、区域、学校类型、办学性质、住宿状态、标签和来源说明。'
        ]
      },
      {
        title: '数据来源',
        items: [
          '优先来自学校官网、教育局官网和政府公开网站。',
          '每条学校数据均标注来源标题、来源链接、查询日期和数据状态。'
        ]
      },
      {
        title: '示例学校说明',
        items: [
          '示例学校仅用于体验搜索、筛选、收藏和详情页功能，不对应现实学校。'
        ]
      },
      {
        title: '当前暂不展示什么',
        items: [
          '不展示真实录取分数线',
          '不展示录取概率',
          '不展示学校排名',
          '不展示联系方式',
          '不展示未经核实地址和坐标'
        ]
      },
      {
        title: '为什么不展示录取分数线',
        items: [
          '分数线需要逐年、批次、区域、招生类型核对；当前版本为避免误导，暂不展示。'
        ]
      },
      {
        title: '信息以官方发布为准',
        items: [
          '本小程序只做基础信息整理，最终以学校、教育局和招生主管部门发布为准。'
        ]
      },
      {
        title: '数据更新计划',
        items: [
          '后续会逐步补充更多学校基础信息、来源说明和人工复核记录。'
        ]
      }
    ],
    privacySections: [
      {
        title: '本地数据',
        items: [
          '无需登录。',
          '收藏只保存在本机。',
          '目标记录只保存在本机。',
          '草稿只保存在本机。',
          '不上传服务器。'
        ]
      },
      {
        title: '不会主动使用的能力',
        items: [
          '不获取定位。',
          '不接入支付。',
          '不接入广告。',
          '不接入推送。',
          '不接入第三方统计 SDK。'
        ]
      },
      {
        title: '敏感信息提醒',
        items: [
          '本小程序不主动要求填写姓名、手机号、身份证、准考证号等个人敏感信息。',
          '备注框会提醒用户不要填写个人敏感信息。',
          '可在“我的”页面清除收藏、目标记录和草稿。'
        ]
      }
    ]
  }
}

module.exports = { APP_CONFIG }
