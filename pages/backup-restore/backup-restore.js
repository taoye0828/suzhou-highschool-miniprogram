const {
  createBackupEnvelope,
  exportBackupFile,
  readBackupFile,
  importBackupEnvelope
} = require('../../utils/backup-restore')

Page({
  data: {
    exportPreview: null,
    exportPath: '',
    importPreview: null,
    importFileName: '',
    importErrors: [],
    hasPendingImport: false
  },

  previewExport() {
    const result = createBackupEnvelope()
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    const profiles = result.backup.payload.profiles
    const profileData = result.backup.payload.profileData
    this.setData({
      exportPreview: {
        profileCount: profiles.length,
        scoreCount: profiles.reduce((sum, profile) => sum + profileData[profile.id].scoreRecords.length, 0),
        targetCount: profiles.reduce((sum, profile) => sum + profileData[profile.id].targetRecords.length, 0),
        stageGoalCount: profiles.reduce((sum, profile) => sum + profileData[profile.id].stageGoals.length, 0),
        checksum: result.backup.checksum.value
      }
    })
  },

  exportBackup() {
    const result = exportBackupFile()
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    this.setData({
      exportPath: result.filePath,
      exportPreview: {
        ...result.preview,
        checksum: result.backup.checksum.value
      }
    })
    wx.showModal({
      title: '本地备份已生成',
      content: '文件已保存在微信小程序本地沙盒。微信不提供把 JSON 直接保存到系统文件夹的统一接口；本功能不会上传服务器。',
      showCancel: false
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
            importErrors: validation.errors || [validation.message || '备份校验失败'],
            hasPendingImport: false
          })
          return
        }
        this._pendingBackup = validation.backup
        this.setData({
          importFileName: file.name || '备份文件',
          importPreview: validation.preview,
          importErrors: [],
          hasPendingImport: true
        })
      },
      fail: () => wx.showToast({ title: '未选择备份文件', icon: 'none' })
    })
  },

  confirmImport(event) {
    if (!this._pendingBackup) return
    const mode = event.currentTarget.dataset.mode
    const overwrite = mode === 'overwrite'
    wx.showModal({
      title: overwrite ? '覆盖本机用户数据' : '合并本机用户数据',
      content: overwrite
        ? '覆盖会以备份中的档案和用户数据替换当前本机用户数据。导入前会自动创建安全快照。正式学校和分数线不会被导入或修改。'
        : '同 ID 记录以更新时间较新的为准，不同 ID 新增；收藏合并去重，档案不会串档。导入前会自动创建安全快照。',
      confirmText: overwrite ? '确认覆盖' : '确认合并',
      confirmColor: overwrite ? '#b42318' : '#0f766e',
      success: (modal) => {
        if (!modal.confirm) return
        const result = importBackupEnvelope(this._pendingBackup, { mode })
        if (!result.ok) {
          wx.showToast({ title: result.message, icon: 'none' })
          return
        }
        this._pendingBackup = null
        this.setData({
          importFileName: '',
          importPreview: null,
          importErrors: [],
          hasPendingImport: false
        })
        wx.showToast({ title: overwrite ? '备份已覆盖恢复' : '备份已合并', icon: 'success' })
      }
    })
  }
})
