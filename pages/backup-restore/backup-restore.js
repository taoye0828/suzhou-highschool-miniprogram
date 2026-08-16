const {
  createBackupEnvelope,
  createBackupScope,
  exportBackupFile,
  readBackupFile,
  importBackupEnvelope
} = require('../../utils/backup-restore')
const { clearCurrentProfileData, clearLocalData } = require('../../utils/storage')
const { FileShareAdapter } = require('../../utils/file-share')
const { operationOptions } = require('../../utils/operation-context')

const fileShare = new FileShareAdapter()

function logTechnical(event, detail) {
  if (typeof console === 'undefined' || typeof console.error !== 'function') return
  const code = detail && (detail.code || detail.errMsg || detail.message)
  console.error(`[backup-restore] ${event}`, code || 'UNKNOWN')
}

function exportState(result) {
  return {
    exportScope: result.scope || createBackupScope(result.backup),
    exportFileName: result.fileName || ''
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
    exportScope: null,
    exportFileName: '',
    sharing: false,
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
    this.setData({ exportScope: createBackupScope(result.backup) })
    wx.showToast({ title: '已显示本次备份范围', icon: 'none' })
  },

  exportBackup() {
    const result = exportBackupFile()
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    this.setData(exportState(result))
    wx.showToast({ title: '备份已生成', icon: 'success' })
  },

  sendBackupFile() {
    if (this.data.sharing) return Promise.resolve({ ok: false, status: 'busy', code: 'SHARE_IN_PROGRESS' })
    const exported = exportBackupFile()
    if (!exported.ok) {
      logTechnical('export-before-share-failed', exported)
      wx.showToast({ title: '备份文件生成失败，请稍后重试。', icon: 'none' })
      return Promise.resolve(exported)
    }
    this.setData(exportState(exported))
    return new Promise((resolve) => {
      wx.showModal({
        title: '发送最新备份',
        content: `已生成并校验最新备份“${exported.fileName}”。文件只包含本机用户数据，请只发送给可信接收方。`,
        confirmText: '去发送',
        success: (modal) => {
          if (!modal.confirm) {
            resolve({ ok: false, status: 'cancelled', code: 'CONFIRM_CANCELLED' })
            return
          }
          this.setData({ sharing: true })
          fileShare.shareFile({ filePath: exported.filePath, fileName: exported.fileName })
            .then((result) => {
              if (result.ok) {
                wx.showToast({ title: '微信发送界面已打开', icon: 'success' })
              } else if (result.status === 'cancelled') {
                wx.showToast({ title: '已取消发送', icon: 'none' })
              } else {
                logTechnical('share-file-failed', result)
                wx.showToast({
                  title: result.message || '备份文件没有发送成功，请稍后重试。',
                  icon: 'none'
                })
              }
              return result
            }, (error) => {
              logTechnical('share-file-rejected', error)
              wx.showToast({ title: '备份文件没有发送成功，请稍后重试。', icon: 'none' })
              return { ok: false, status: 'failed', code: 'SHARE_REJECTED' }
            })
            .then((result) => {
              this.setData({ sharing: false })
              resolve(result)
            })
        },
        fail: (error) => {
          logTechnical('share-confirm-failed', error)
          wx.showToast({ title: '备份文件没有发送成功，请稍后重试。', icon: 'none' })
          resolve({ ok: false, status: 'failed', code: 'CONFIRM_FAILED' })
        }
      })
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
      },
      fail: (error) => {
        if (/cancel/iu.test(String(error && error.errMsg || ''))) return
        logTechnical('choose-import-file-failed', error)
        wx.showToast({ title: '备份文件没有选择成功，请稍后重试。', icon: 'none' })
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
