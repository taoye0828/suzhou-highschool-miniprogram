const {
  getActiveProfile,
  getScoreRecords,
  getTargetRecords,
  getSchoolUserStates
} = require('../../utils/storage')
const {
  createReportSnapshot,
  reportToText,
  writeReportFile
} = require('../../utils/report-export')
const { FileShareAdapter } = require('../../utils/file-share')

const fileShare = new FileShareAdapter()

Page({
  data: {
    activeProfileName: '默认档案',
    reportType: 'score_stage',
    reportFormat: 'text',
    reportPreview: '',
    reportDataRange: '',
    reportPath: '',
    reportFileName: '',
    reportError: ''
  },

  onShow() {
    this.setData({ activeProfileName: (getActiveProfile() || {}).nickname || '默认档案' })
  },

  selectReportType(event) {
    const reportType = event.currentTarget.dataset.type
    if (['score_stage', 'target_school'].includes(reportType)) this.setData({ reportType, reportPath: '', reportPreview: '' })
  },

  selectReportFormat(event) {
    const reportFormat = event.currentTarget.dataset.format
    if (['text', 'json'].includes(reportFormat)) this.setData({ reportFormat, reportPath: '', reportPreview: '' })
  },

  generateReport() {
    const profile = getActiveProfile()
    if (!profile) return this.setData({ reportError: '未找到当前档案。' })
    const snapshot = createReportSnapshot(this.data.reportType, profile, {
      scoreRecords: getScoreRecords(),
      targetRecords: getTargetRecords(),
      schoolUserStates: getSchoolUserStates()
    })
    const file = writeReportFile(snapshot, this.data.reportFormat)
    if (!file.ok) return this.setData({ reportError: file.message })
    this._reportSnapshot = snapshot
    this.setData({
      reportPreview: this.data.reportFormat === 'text' ? file.content : reportToText(snapshot),
      reportDataRange: snapshot.dataRange,
      reportPath: file.filePath,
      reportFileName: file.fileName,
      reportError: ''
    })
  },

  sendReportFile() {
    if (!this.data.reportPath || !this._reportSnapshot) return
    wx.showModal({
      title: '发送报告文件',
      content: `文件包含${this.data.reportDataRange}。报告可能含成绩、目标学校、个人标签或备注，请只发送给可信接收方。小程序不会自动上传。`,
      confirmText: '选择接收方',
      success: (modal) => {
        if (!modal.confirm) return
        fileShare.shareFile({ filePath: this.data.reportPath, fileName: this.data.reportFileName }).then((result) => {
          wx.showToast({ title: result.ok ? '报告已发送' : result.message || '发送失败，可重试', icon: result.ok ? 'success' : 'none' })
        })
      }
    })
  }
})
