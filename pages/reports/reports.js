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
    reportError: '',
    loading: true,
    saving: false,
    sharing: false
  },

  onShow() {
    this.setData({
      activeProfileName: (getActiveProfile() || {}).nickname || '默认档案',
      loading: false,
      reportError: ''
    })
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
    if (this.data.saving) return
    const profile = getActiveProfile()
    if (!profile) return this.setData({ reportError: '未找到当前档案。' })
    this.setData({ saving: true, reportError: '' })
    try {
      const snapshot = createReportSnapshot(this.data.reportType, profile, {
        scoreRecords: getScoreRecords(),
        targetRecords: getTargetRecords(),
        schoolUserStates: getSchoolUserStates()
      })
      const file = writeReportFile(snapshot, this.data.reportFormat)
      if (!file.ok) return this.setData({ reportError: file.message })
      this._reportSnapshot = snapshot
      const fullPreview = this.data.reportFormat === 'text' ? file.content : reportToText(snapshot)
      const reportPreview = fullPreview.length > 50000
        ? `${fullPreview.slice(0, 50000)}\n\n预览已截断，发送的文件仍包含完整内容。`
        : fullPreview
      this.setData({
        reportPreview,
        reportDataRange: snapshot.dataRange,
        reportPath: file.filePath,
        reportFileName: file.fileName,
        reportError: ''
      })
    } catch (error) {
      this.setData({ reportError: '报告生成失败，用户数据未修改。' })
    } finally {
      this.setData({ saving: false })
    }
  },

  sendReportFile() {
    if (!this.data.reportPath || !this._reportSnapshot || this.data.sharing) return
    wx.showModal({
      title: '发送报告文件',
      content: `文件包含${this.data.reportDataRange}。报告可能含成绩、目标学校、个人标签或备注。小程序不会自动上传到开发者服务器；确认后文件会通过微信系统能力交给你选择的接收方，请只发送给可信接收方。`,
      confirmText: '选择接收方',
      success: (modal) => {
        if (!modal.confirm) return
        this.setData({ sharing: true, reportError: '' })
        fileShare.shareFile({ filePath: this.data.reportPath, fileName: this.data.reportFileName }).then((result) => {
          this.setData({ sharing: false, reportError: result.ok ? '' : result.message || '发送失败，可重试' })
          wx.showToast({ title: result.ok ? '报告已发送' : result.message || '发送失败，可重试', icon: result.ok ? 'success' : 'none' })
        }).catch(() => {
          this.setData({ sharing: false, reportError: '发送失败，可重试' })
          wx.showToast({ title: '发送失败，可重试', icon: 'none' })
        })
      }
    })
  }
})
