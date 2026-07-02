const TARGET_SCORE_MAX = 750

const APP_CONFIG = {
  version: '1.0.1-mp1',
  targetScore: {
    min: 0,
    max: TARGET_SCORE_MAX,
    maxLength: String(TARGET_SCORE_MAX).length,
    maxRecords: 100,
    draftDebounceMs: 400,
    scaleLabel: '学习测评分数'
  },
  schoolData: {
    version: '2026-07-02',
    publicSampleVerifiedAt: '2026-06-28'
  },
  policy: {
    homeSummary: '当前不展示真实分数线，不提供录取预测，不接 AI，不连接后台，也不需要登录。',
    targetDisclaimer: '用于记录阶段目标和学习差距，不代表录取判断，不输出学校推荐。',
    schoolDetailBoundaries: [
      '暂无已核验真实分数线',
      '不提供录取预测',
      '联系方式暂未开放',
      '照片暂未开放',
      '地图仅提供外部搜索'
    ],
    dataInfoBoundaries: [
      '当前不提供录取预测',
      '当前不接 AI',
      '当前不接后台或远程 API',
      '当前不上传用户数据',
      '收藏和目标记录仅保存在本机'
    ],
    privacyNonCollection: [
      '不主动要求用户填写姓名',
      '不主动要求用户填写手机号',
      '不主动要求用户填写身份证信息',
      '不请求或收集定位信息'
    ],
    privacyNonIntegration: [
      '不接广告',
      '不接支付',
      '不接推送',
      '不接第三方统计 SDK',
      '不接账号或远程同步'
    ]
  }
}

module.exports = { APP_CONFIG }
