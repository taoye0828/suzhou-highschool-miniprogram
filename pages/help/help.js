const CUSTOMER_EMAIL = '3341251927@qq.com'
const CUSTOMER_WECHAT = 'shsz1610'

Page({
  data: {
    email: CUSTOMER_EMAIL,
    wechat: CUSTOMER_WECHAT,
    instructions: [
      '在“学校库”按学校名称或简称搜索，并可按区域等条件筛选。',
      '进入学校详情查看已收录的历史公开录取分数线和来源。',
      '在学校详情手动加入目标学校。',
      '在“成绩”记录考试名称、日期和总分。',
      '成绩页会展示最近最多 10 次总分趋势。',
      '在“我的 → 学生档案管理”创建或切换档案。',
      '在“我的 → 数据备份与恢复”导出备份并在需要时恢复。'
    ],
    faqs: [
      {
        question: '学校和历史分数线来自哪里？',
        answer: '来自学校官网、教育局官网和政府公开网站等公开来源；学校详情会显示来源名称和核对日期。'
      },
      {
        question: '历史分数线应该怎么理解？',
        answer: '历史分数线按年份、招生区域、批次和招生类型区分，只用于了解过去公开信息。'
      },
      {
        question: '成绩和目标学校保存在哪里？',
        answer: '默认只保存在当前设备，不会自动上传到互联网。'
      },
      {
        question: '如何备份和恢复？',
        answer: '进入“我的 → 数据备份与恢复”导出备份；恢复时选择备份文件，再选择合并或替换本机数据。'
      },
      {
        question: '如何删除本机数据？',
        answer: '进入“我的 → 数据备份与恢复”，在“数据清理”中选择清除当前档案或清除全部本机数据。'
      },
      {
        question: '为什么历史分数线不能代表未来录取结果？',
        answer: '招生计划、试卷难度、报名人数和政策都可能变化，因此历史数据不代表未来录取结果。'
      }
    ]
  },

  copyEmail() {
    wx.setClipboardData({
      data: CUSTOMER_EMAIL,
      success: () => wx.showToast({ title: '邮箱已复制', icon: 'success' }),
      fail: () => wx.showToast({ title: '复制失败，请稍后重试', icon: 'none' })
    })
  },

  copyWechat() {
    wx.setClipboardData({
      data: CUSTOMER_WECHAT,
      success: () => wx.showToast({ title: '微信号已复制', icon: 'success' }),
      fail: () => wx.showToast({ title: '复制失败，请稍后重试', icon: 'none' })
    })
  }
})
