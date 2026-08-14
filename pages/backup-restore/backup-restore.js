const {
  createBackupEnvelope,
  exportBackupFile,
  readBackupFile,
  importBackupEnvelope
} = require('../../utils/backup-restore')
const { clearCurrentProfileData, clearLocalData } = require('../../utils/storage')
const { FileShareAdapter } = require('../../utils/file-share')
const { operationOptions } = require('../../utils/operation-context')

const fileShare = new FileShareAdapter()

function corePreview(result) {
  const profiles = result.backup.profiles
  const profileData = result.backup.profileData
  return {
    profileCount: profiles.length,
    scoreCount: profiles.reduce((sum, profile) => sum + profileData[profile.id].scoreRecords.length, 0),
    targetCount: profiles.reduce((sum, profile) => sum + profileData[profile.id].targetRecords.length, 0)
  }
}

function safeImportMessage(validation) {
  const detail = String(validation.message || (validation.errors && validation.errors[0]) || '')
  return detail.includes('4 MB')
    ? detail
    : '备份文件无法使用，请确认文件完整且来自本小程序。'
}

Page({
  data: {
    exportPreview: null,
    exportReady: false,
    importPreview: null,
    importFileName: '',
    importError: '',
    hasPendingImport: false
  },

  previewExport() {
    const result = createBackupEnvelope()
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    this.setData({ exportPreview: corePreview(result) })
  },

  exportBackup() {
    const result = exportBackupFile()
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    this._exportPath = result.filePath
    this.setData({
      exportReady: true,
      exportPreview: {
        profileCount: result.preview.profileCount,
        scoreCount: result.preview.scoreCount,
        targetCount: result.preview.targetCount
      }
    })
    wx.showToast({ title: '备份已生成', icon: 'success' })
  },

  sendBackupFile() {
    if (!this._exportPath) return
    wx.showModal({
      title: '发送备份文件',
      content: '备份包含本机学生档案、考试成绩、目标学校和必要设置。请只发送给可信接收方。',
      confirmText: '选择接收方',
      success: (modal) => {
        if (!modal.confirm) return
        fileShare.shareFile({ filePath: this._exportPath, fileName: '苏程记录本地备份.json' })
          .then((result) => wx.showToast({
            title: result.ok ? '文件已发送' : result.message || '发送失败，可重试',
            icon: result.ok ? 'success' : 'none'
          }))
      }
    })
  },

  chooseImportFile() {
    if (typeof wx.chooseMessageFile !== 'function') {
      wx.showToast({ title: '当前微信版本不支持选择文件', icon: 'none' })
      return
    }
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['json'],
      success: (result) => {
        const file = result.tempFiles && result.tempFiles[0]
        if (!file) return
        const validation = readBackupFile(file.path)
        if (!validation.ok) {
          this._pendingBackup = null
          this.setData({
            importFileName: file.name || '备份文件',
            importPreview: null,
            importError: safeImportMessage(validation),
            hasPendingImport: false
          })
          return
        }
        this._pendingBackup = validation.backup
        this.setData({
          importFileName: file.name || '备份文件',
          importPreview: {
            profileCount: validation.preview.profileCount,
            scoreCount: validation.preview.scoreCount,
            targetCount: validation.preview.targetCount
          },
          importError: '',
          hasPendingImport: true
        })
      }
    })
  },

  confirmImport(event) {
    if (!this._pendingBackup) return
    const mode = event.currentTarget.dataset.mode
    const overwrite = mode === 'overwrite'
    wx.showModal({
      title: overwrite ? '替换本机数据' : '合并本机数据',
      content: overwrite
        ? '将用备份中的学生档案、考试成绩和目标学校替换当前本机数据。操作失败时原数据不会被修改。'
        : '将备份内容合并到本机，同一条记录以更新时间较新的内容为准。操作失败时原数据不会被修改。',
      confirmText: overwrite ? '确认替换' : '确认合并',
      confirmColor: overwrite ? '#b42318' : '#0f766e',
      success: (modal) => {
        if (!modal.confirm) return
        const result = importBackupEnvelope(this._pendingBackup, { mode })
        if (!result.ok) {
          wx.showToast({ title: '数据操作失败，原数据未被修改。', icon: 'none' })
          return
        }
        this._pendingBackup = null
        this.setData({
          importFileName: '',
          importPreview: null,
          importError: '',
          hasPendingImport: false
        })
        wx.showToast({ title: overwrite ? '备份已恢复' : '备份已合并', icon: 'success' })
      }
    })
  },

  clearCurrentProfile() {
    wx.showModal({
      title: '清除当前档案数据',
      content: '将清除当前档案的考试成绩和目标学校，且无法撤销。其他学生档案不受影响。',
      confirmText: '确认清除',
      confirmColor: '#b42318',
      success: (modal) => {
        if (!modal.confirm) return
        const result = clearCurrentProfileData(operationOptions('clear_profile_data', 'current'))
        if (!result.ok) wx.showToast({ title: '数据操作失败，原数据未被修改。', icon: 'none' })
        else wx.showToast({ title: '当前档案数据已清除', icon: 'success' })
      }
    })
  },

  clearAllData() {
    wx.showModal({
      title: '清除全部本机数据',
      content: '将清除本机所有学生档案、考试成绩和目标学校，且无法撤销。建议先导出备份。',
      confirmText: '确认清除',
      confirmColor: '#b42318',
      success: (modal) => {
        if (!modal.confirm) return
        const result = clearLocalData(operationOptions('clear_all_data', 'all'))
        if (!result.ok) wx.showToast({ title: '数据操作失败，原数据未被修改。', icon: 'none' })
        else wx.showToast({ title: '本机数据已清除', icon: 'success' })
      }
    })
  }
})
