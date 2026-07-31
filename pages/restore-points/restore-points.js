const {
  getActiveProfile,
  listRestorePoints,
  createRestorePoint,
  restoreFromRestorePoint,
  deleteRestorePoint,
  clearRestorePoints
} = require('../../utils/storage')

const REASON_LABELS = {
  before_migration: '迁移前',
  before_import: '导入前',
  before_data_repair: '数据修复前',
  before_clear_profile: '清除档案前',
  before_clear_all: '清除全部前',
  before_bulk_edit: '批量修改前',
  before_restore: '恢复前',
  manual: '手动创建'
}

Page({
  data: {
    loading: true,
    operating: false,
    points: [],
    errorMessage: ''
  },

  onShow() {
    this.refresh()
  },

  refresh() {
    try {
      const profile = getActiveProfile()
      const points = listRestorePoints().map((point) => ({
        ...point,
        reasonLabel: REASON_LABELS[point.reason] || '安全恢复点',
        scopeLabel: point.profileScope.type === 'single_profile'
          ? `当前档案${point.profileScope.profileId === (profile || {}).id ? ` · ${(profile || {}).nickname || '默认档案'}` : ''}`
          : point.profileScope.type === 'all_profiles' ? '全部档案' : '完整用户状态',
        createdAtLabel: String(point.createdAt || '').replace('T', ' ').slice(0, 19)
      }))
      this.setData({ loading: false, points, errorMessage: '' })
    } catch (error) {
      this.setData({ loading: false, points: [], errorMessage: '恢复点读取失败，请返回后重试。' })
    }
  },

  createManual() {
    if (this.data.operating) return
    const profile = getActiveProfile()
    if (!profile) return
    this.setData({ operating: true })
    const result = createRestorePoint({
      reason: 'manual',
      profileScope: { type: 'single_profile', profileId: profile.id },
      operationId: `manual_restore_point_${Date.now()}`,
      createdBy: 'manual'
    })
    this.setData({ operating: false })
    if (!result.ok) {
      wx.showToast({ title: result.message || '恢复点创建失败', icon: 'none' })
      return
    }
    this.refresh()
    wx.showToast({ title: '恢复点已创建', icon: 'success' })
  },

  restorePoint(event) {
    if (this.data.operating) return
    const id = event.currentTarget.dataset.id
    wx.showModal({
      title: '恢复此恢复点',
      content: '恢复前会先保存当前状态。恢复失败时当前数据会保留，是否继续？',
      confirmText: '确认恢复',
      success: (modal) => {
        if (!modal.confirm || this.data.operating) return
        this.setData({ operating: true })
        const result = restoreFromRestorePoint(id, { operationId: `ui_restore_${id}_${Date.now()}` })
        this.setData({ operating: false })
        if (!result.ok) {
          wx.showToast({ title: result.message || '恢复未完成，当前数据已保留', icon: 'none' })
          return
        }
        this.refresh()
        wx.showToast({ title: '恢复完成', icon: 'success' })
      }
    })
  },

  deletePoint(event) {
    if (this.data.operating) return
    const id = event.currentTarget.dataset.id
    wx.showModal({
      title: '删除恢复点',
      content: '只删除这一份恢复点，不会修改当前用户数据。',
      confirmText: '确认删除',
      success: (modal) => {
        if (!modal.confirm || this.data.operating) return
        this.setData({ operating: true })
        const result = deleteRestorePoint(id, { operationId: `ui_delete_restore_${id}_${Date.now()}` })
        this.setData({ operating: false })
        if (!result.ok) wx.showToast({ title: result.message || '删除失败', icon: 'none' })
        else { this.refresh(); wx.showToast({ title: '已删除', icon: 'success' }) }
      }
    })
  },

  clearAll() {
    if (this.data.operating || !this.data.points.length) return
    wx.showModal({
      title: '清除全部恢复点',
      content: '清除后无法使用这些恢复点，但不会修改当前用户数据。',
      confirmText: '继续',
      success: (first) => {
        if (!first.confirm) return
        wx.showModal({
          title: '再次确认',
          content: `确认清除全部 ${this.data.points.length} 个恢复点吗？`,
          confirmText: '确认清除',
          success: (second) => {
            if (!second.confirm || this.data.operating) return
            this.setData({ operating: true })
            const result = clearRestorePoints({ operationId: `ui_clear_restore_points_${Date.now()}` })
            this.setData({ operating: false })
            if (!result.ok) wx.showToast({ title: '清除失败，请重试', icon: 'none' })
            else { this.refresh(); wx.showToast({ title: '已清除', icon: 'success' }) }
          }
        })
      }
    })
  }
})
