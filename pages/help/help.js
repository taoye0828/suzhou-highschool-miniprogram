const { replayOnboarding, tutorialSteps } = require('../../utils/onboarding')

const TUTORIALS = [
  { flow: 'home', label: '首页' },
  { flow: 'school_filters', label: '学校筛选' },
  { flow: 'score_records', label: '成绩记录' },
  { flow: 'score_trend', label: '成绩趋势' },
  { flow: 'target_planning', label: '目标规划' },
  { flow: 'backup_restore', label: '备份恢复' },
  { flow: 'student_profiles', label: '多学生档案' }
]

Page({
  data: {
    tutorials: TUTORIALS,
    faqs: [
      {
        question: '分数线从哪里来？',
        answer: '来自学校官网、教育局官网和政府公开网站等公开来源；详情页可查看对应来源。'
      },
      {
        question: '推荐是不是录取预测？',
        answer: '不是。推荐只按历史参考分和固定分差区间分类，不判断未来录取结果。'
      },
      {
        question: '数据保存在哪里？',
        answer: '学生档案、成绩、收藏和目标只保存在当前设备的本地存储中，不上传服务器。'
      },
      {
        question: '如何备份？',
        answer: '进入“我的 → 备份与恢复”，先预览范围，再生成带版本和校验摘要的 JSON。'
      },
      {
        question: '如何切换学生？',
        answer: '进入“我的 → 学生档案”，选择目标档案后切换；各档案业务数据互不串用。'
      },
      {
        question: '为什么某些学校字段不显示？',
        answer: '只有已有可靠值的字段才展示；空值或未确认字段会直接隐藏。'
      },
      {
        question: '如何清除数据？',
        answer: '进入“我的 → 数据管理”，可单独清除当前档案或二次确认后清除全部本地数据。'
      },
      {
        question: '如何重新播放教程？',
        answer: '在本页选择完整教程或某个功能教程；教程不会创建或修改业务数据。'
      }
    ]
  },

  replayFullTutorial() {
    replayOnboarding('full')
    wx.switchTab({ url: '/pages/home/home' })
  },

  replayFeatureTutorial(event) {
    const flow = event.currentTarget.dataset.flow
    const steps = tutorialSteps(flow)
    replayOnboarding(flow)
    const first = steps[0]
    const tabPages = [
      '/pages/home/home',
      '/pages/schools/schools',
      '/pages/score-trend/score-trend',
      '/pages/targets/targets',
      '/pages/profile/profile'
    ]
    if (tabPages.includes(first.page)) wx.switchTab({ url: first.page })
    else wx.navigateTo({ url: first.page })
  }
})
