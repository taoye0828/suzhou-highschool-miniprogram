const TARGET_SCORE_MAX = 750

const APP_CONFIG = {
  version: '1.0.2',
  targetScore: {
    min: 0,
    max: TARGET_SCORE_MAX,
    maxLength: String(TARGET_SCORE_MAX).length,
    maxRecords: 100,
    draftDebounceMs: 400
  },
  schoolData: {
    version: '2026-07-02',
    publicSampleVerifiedAt: '2026-06-28'
  },
  policy: {
    homeTagline: '查找学校、收藏信息、记录学习目标',
    targetHint: '填写当前分数和目标分数，查看学习差距。',
    schoolDetailNotice: '学校信息仅供查询参考，暂不展示录取分数线。',
    dataInfoItems: [
      '学校库包含公开资料和标记为“示例学校”的体验内容。',
      '当前不展示录取分数线，学校信息请以官方发布为准。',
      '收藏和目标记录只保存在本机。'
    ],
    privacyItems: [
      '无需登录，收藏、目标记录和草稿只保存在本机。',
      '不上传数据，不获取定位，不接入支付、广告或第三方统计。',
      '请勿在备注中填写姓名、手机号、身份证等个人敏感信息。'
    ]
  }
}

module.exports = { APP_CONFIG }
