const { replayOnboarding, tutorialSteps, resetDynamicHelp } = require('../../utils/onboarding')

const FEEDBACK_URL = 'https://ycn8xfqnmoql.feishu.cn/share/base/form/shrcng2vmqyiVYLULDAEbJNWhtg55'

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
        answer: '小程序不会自动把学生档案、成绩、收藏或目标上传到开发者服务器；不主动分享备份或报告时，这些数据只保存在当前设备。'
      },
      {
        question: '如何备份？',
        answer: '进入“我的 → 备份与恢复”，先预览范围，再生成带版本和校验摘要的 JSON；只有你主动点击发送并选择接收方时，微信系统才会处理该文件。'
      },
      {
        question: '如何生成和发送报告？',
        answer: '进入“我的 → 文本和 JSON 报告”，选择成绩阶段或目标学校以及文件格式。本机生成后会先显示数据范围和隐私提醒；取消或发送失败都不会修改用户数据。'
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
      },
      {
        question: '如何恢复本地数据？',
        answer: '在“我的 → 备份与恢复”选择 JSON，校验通过后选择合并或覆盖；导入前会创建安全快照。'
      },
      {
        question: '如何修复本地数据？',
        answer: '进入“我的 → 数据管理 → 数据检查”先只读扫描，再确认是否修复可安全判断的项目。'
      },
      {
        question: '为什么趋势需要至少两条记录？',
        answer: '一条记录可以显示点位和摘要，但至少两条记录才能计算最近变化。'
      },
      {
        question: '为什么不显示住宿未核实等状态？',
        answer: '用户页面只展示已有可靠值，不显示内部核验状态；缺失字段会直接隐藏。'
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
  },

  replayDynamicHelp() {
    resetDynamicHelp()
    wx.showToast({ title: '状态提示已重置', icon: 'success' })
  },

  copyFeedbackLink() {
    wx.setClipboardData({
      data: FEEDBACK_URL,
      success: () => {
        wx.showToast({
          title: '链接已复制，请在浏览器中打开',
          icon: 'success',
          duration: 3000
        })
      },
      fail: () => {
        wx.showToast({
          title: '复制失败，请重试',
          icon: 'none'
        })
      }
    })
  }
})
