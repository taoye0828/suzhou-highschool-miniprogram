const TARGET_SCORE_MAX = 750
const SOURCE_CHECKED_AT = '2026-07-05'

const APP_CONFIG = {
  name: '苏州高中目标查询助手',
  version: '1.2.0',
  releaseStatus: 'MP4 上架前复测准备版',
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
    homeTagline: '查询苏州高中阶段学校基础信息，查看已核实历史录取分数线，记录阶段学习目标。',
    homeBoundary: '历史分数线仅供了解，不判断未来录取结果。',
    localBoundary: '不登录、不上传，收藏和学习目标记录只保存在本机。',
    currentCapabilities: [
      '查看苏州高中阶段学校基础信息',
      '按区域、类型、办学性质和分数线收录情况筛选',
      '查看学校数据来源和核对日期',
      '收藏关注学校',
      '记录阶段学习目标'
    ],
    currentLimits: [
      '不做录取预测',
      '不提供志愿填报结论',
      '不按分数给出报考结论',
      '不请求定位',
      '不上传本机记录'
    ],
    usageSteps: [
      '先进入学校库筛选或搜索学校',
      '再打开详情查看来源和历史分数线说明',
      '需要关注时可本地收藏',
      '阶段学习目标可在本机记录和清除'
    ],
    targetHint: '本页只用于记录阶段学习目标，不根据分数判断录取结果。',
    targetStorageHint: '学习目标记录只保存在本机，可在我的页面清除。',
    schoolDetailNotice: '学校信息以公开来源为准，未核实字段不进入正式页面。',
    scoreSafetyNotice: '历史录取分数线仅供了解，不代表未来录取结果。本小程序不做录取预测，不提供志愿填报结论。',
    dataInfoSections: [
      {
        title: '数据从哪里来',
        items: [
          '学校基础信息来自学校官网、教育局官网和政府公开网站。',
          '当前只展示已核实字段。',
          '未核实字段不进入正式页面。'
        ]
      },
      {
        title: '未收录代表什么',
        items: [
          '未收录不代表学校不存在。',
          '未收录分数线不代表该校没有分数线。',
          '它只代表当前版本还没有录入官方核实数据。'
        ]
      },
      {
        title: '历史分数线怎么理解',
        items: [
          '历史录取分数线按年份、招生区域、批次、招生类型和分数口径区分。',
          '历史录取分数线不代表未来录取结果。',
          '本小程序不做录取预测，不提供志愿填报结论。'
        ]
      },
      {
        title: '本机记录',
        items: [
          '收藏、学习目标记录和输入草稿只保存在本机。',
          '本版本不提供账号功能。',
          '不读取微信个人资料、手机号或微信身份标识。',
          '更换设备或清除微信小程序缓存后，本机记录可能丢失。'
        ]
      }
    ],
    privacySections: [
      {
        title: '本地数据',
        items: [
          '无需登录即可使用。',
          '收藏只保存在本机。',
          '学习目标记录只保存在本机。',
          '输入草稿只保存在本机。',
          '可在“我的”页面清除。'
        ]
      },
      {
        title: '不会主动使用的能力',
        items: [
          '不请求定位。',
          '不接入支付。',
          '不接入广告。',
          '不接入推送。',
          '不接入第三方统计 SDK。',
          '不接入 AI。'
        ]
      },
      {
        title: '个人信息边界',
        items: [
          '不读取微信头像或昵称。',
          '不读取手机号。',
          '不读取微信身份标识。',
          '备注框会提醒不要填写个人敏感信息。'
        ]
      }
    ]
  }
}

module.exports = { APP_CONFIG }
