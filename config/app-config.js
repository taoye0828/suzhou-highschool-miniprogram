const EXAM_TOTAL_SCORE = 740
const SOURCE_CHECKED_AT = '2026-07-09'
const DEFAULT_EXAM_YEAR = 2027
const TARGET_LEVELS = [
  { value: 'sprint', label: '冲刺' },
  { value: 'target', label: '目标' },
  { value: 'safe', label: '保底' }
]

const APP_CONFIG = {
  name: '苏程记录',
  version: '1.8.0',
  releaseStatus: 'RC8 产品体验升级版',
  targetScore: {
    min: 0,
    max: EXAM_TOTAL_SCORE,
    maxLength: String(EXAM_TOTAL_SCORE).length,
    maxRecords: 100,
    draftDebounceMs: 400,
    levels: TARGET_LEVELS
  },
  scoreRecord: {
    maxRecords: 100,
    examNameMaxLength: 40
  },
  learningTarget: {
    maxRecords: 100,
    stageMaxLength: 40,
    noteMaxLength: 200
  },
  onboarding: {
    version: 1
  },
  countdown: {
    defaultYear: DEFAULT_EXAM_YEAR,
    examMonth: 6,
    examDay: 17,
    minYear: 2020,
    maxYear: 2100
  },
  scoreAnalysis: {
    targetYears: [2026, 2027],
    levels: [
      {
        value: 'sprint',
        label: '冲刺',
        description: '历史参考分高于当前成绩 1 至 30 分。'
      },
      {
        value: 'target',
        label: '目标',
        description: '当前成绩与历史参考分相差 0 至 15 分。'
      },
      {
        value: 'safe',
        label: '保底',
        description: '当前成绩高于历史参考分 15 分以上。'
      }
    ]
  },
  schoolData: {
    version: SOURCE_CHECKED_AT,
    sourceCheckedAt: SOURCE_CHECKED_AT
  },
  policy: {
    homeTagline: '从当前成绩出发，分析、选择并持续跟进自己的高中目标。',
    homeBoundary: '历史分数线和固定分差区间仅供参考，不判断未来录取结果。',
    localBoundary: '不登录、不上传，收藏、成绩和学习目标只保存在本机。',
    currentCapabilities: [
      '查看苏州高中阶段学校基础信息',
      '按区域、类型、办学性质和分数线收录情况筛选',
      '查看学校数据来源和核对日期',
      '查看官方来源可核验的 2025、2026 年历史录取分数线',
      '收藏关注学校',
      '按固定历史分差区间查看目标参考',
      '最多对比 3 所高中',
      '查看本地中考倒计时',
      '记录本机成绩趋势',
      '为具体学校记录冲刺、目标或保底等级'
    ],
    currentLimits: [
      '不做录取预测',
      '不提供志愿填报结论',
      '不判断学校能否录取',
      '不登录',
      '不上传用户数据',
      '不请求定位'
    ],
    usageSteps: [
      '输入成绩',
      '分析目标高中',
      '选择目标学校',
      '记录成绩变化',
      '查看提升趋势'
    ],
    targetHint: '目标等级只与已选择的具体学校绑定，不根据分数判断录取结果。',
    targetStorageHint: '目标学校和等级只保存在本机，可在我的页面清除。',
    schoolDetailNotice: '学校信息以公开来源为准，未核实字段不进入正式页面。',
    scoreSafetyNotice: '历史录取分数线仅供了解，不代表未来录取结果。本小程序不做录取预测，不提供志愿填报结论。',
    planningDisclaimer: '以上分析基于已收录的历史公开数据和固定分差区间，仅作为高中目标参考，实际录取情况以当年招生政策和考试成绩为准。',
    scoreAnalysisNotice: '每所学校使用不晚于目标年份的最新已收录分数线；同校同年多条记录取最高参考分。',
    dataInfoSections: [
      {
        title: '数据从哪里来',
        items: [
          '学校基础信息来自学校官网、教育局官网和政府公开网站。',
          '历史录取分数线只收录官方来源可核验数据。',
          '当前已收录 2025、2026 年官方历史录取分数线；2026 数据来自官方公开来源或官方图片核验。',
          '当前只展示已核实字段。',
          '未核实字段不进入正式页面。'
        ]
      },
      {
        title: '未收录代表什么',
        items: [
          '未收录不代表学校不存在。',
          '未收录不代表学校没有分数线。',
          '它只代表当前版本没有录入官方核实数据。'
        ]
      },
      {
        title: '历史分数线怎么理解',
        items: [
          '历史录取分数线按年份、招生区域、批次、招生类型和分数口径区分。',
          '历史录取分数线不代表未来录取结果。',
          '本小程序不做录取预测，不提供志愿填报结论。',
          '成绩分析只执行固定历史分差区间分类，不判断学校能否录取。'
        ]
      },
      {
        title: '成绩分析口径',
        items: [
          '每所学校使用不晚于目标考试年份的最新已收录分数线。',
          '同一学校同一年有多条记录时，使用其中最高参考分。',
          '冲刺为当前成绩低于参考分 1 至 30 分；目标为达到参考分且高出不超过 15 分；保底为高出参考分 15 分以上。',
          '各分类按分差稳定排序，每组最多展示 5 所学校。',
          '结果根据历史公开数据整理，仅供目标规划参考。'
        ]
      },
      {
        title: '本机记录',
        items: [
          '收藏、学习目标、成绩记录、目标年份和输入草稿只保存在本机。',
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
          '成绩记录和中考目标年份只保存在本机。',
          '输入草稿只保存在本机。',
          '不上传收藏、学习目标记录、成绩记录、目标年份或输入草稿。',
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
          '不进行后台网络请求或用户行为追踪。',
          '不接入 AI。'
        ]
      },
      {
        title: '个人信息边界',
        items: [
          '不读取微信头像或昵称。',
          '不读取手机号。',
          '不读取微信身份标识。',
          '不读取身份证。',
          '不收集学生姓名。',
          '备注框会提醒不要填写个人敏感信息。'
        ]
      }
    ]
  }
}

module.exports = { APP_CONFIG, EXAM_TOTAL_SCORE, DEFAULT_EXAM_YEAR, TARGET_LEVELS }
