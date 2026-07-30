const {
  getProfilesResult,
  getActiveProfile,
  createStudentProfile,
  updateStudentProfile,
  switchStudentProfile,
  deleteStudentProfile
} = require('../../utils/storage')

const FAVORITES_MODES = [
  { value: 'independent', label: '收藏独立' },
  { value: 'shared', label: '收藏共享' }
]

function presentProfiles(result) {
  return result.profiles.map((profile) => ({
    ...profile,
    isActive: profile.id === result.activeProfileId,
    favoritesModeLabel: profile.favoritesMode === 'shared' ? '收藏共享' : '收藏独立'
  }))
}

Page({
  data: {
    profiles: [],
    activeProfile: null,
    favoritesModes: FAVORITES_MODES
  },

  onShow() {
    this.refresh()
  },

  refresh() {
    const result = getProfilesResult()
    if (!result.ok) {
      wx.showToast({ title: result.message || '档案读取失败', icon: 'none' })
      return
    }
    this.setData({
      profiles: presentProfiles(result),
      activeProfile: getActiveProfile()
    })
  },

  createProfile() {
    wx.showModal({
      title: '新建学生档案',
      content: '',
      editable: true,
      placeholderText: '输入昵称，不需要真实姓名',
      confirmText: '创建',
      success: (modal) => {
        if (!modal.confirm) return
        const nickname = String(modal.content || '').trim()
        if (!nickname) {
          wx.showToast({ title: '请填写档案昵称', icon: 'none' })
          return
        }
        const result = createStudentProfile({ nickname })
        if (!result.ok) {
          wx.showToast({ title: result.message, icon: 'none' })
          return
        }
        this.refresh()
        wx.showToast({ title: '档案已创建并切换', icon: 'success' })
      }
    })
  },

  switchProfile(event) {
    const result = switchStudentProfile(event.currentTarget.dataset.id)
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    this.refresh()
    wx.showToast({ title: '已切换档案', icon: 'success' })
  },

  renameProfile(event) {
    const profile = this.data.profiles.find((item) => item.id === event.currentTarget.dataset.id)
    if (!profile) return
    wx.showModal({
      title: '修改档案昵称',
      content: profile.nickname,
      editable: true,
      placeholderText: '不需要填写真实姓名',
      confirmText: '保存',
      success: (modal) => {
        if (!modal.confirm) return
        const nickname = String(modal.content || '').trim()
        if (!nickname) {
          wx.showToast({ title: '档案昵称不能为空', icon: 'none' })
          return
        }
        const result = updateStudentProfile(profile.id, { nickname })
        if (!result.ok) {
          wx.showToast({ title: result.message, icon: 'none' })
          return
        }
        this.refresh()
      }
    })
  },

  changeFavoritesMode(event) {
    const profileId = event.currentTarget.dataset.id
    const mode = FAVORITES_MODES[Number(event.detail.value)]
    if (!mode) return
    const result = updateStudentProfile(profileId, { favoritesMode: mode.value })
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    this.refresh()
    wx.showToast({ title: mode.label, icon: 'success' })
  },

  deleteProfile(event) {
    const profile = this.data.profiles.find((item) => item.id === event.currentTarget.dataset.id)
    if (!profile) return
    wx.showModal({
      title: '删除学生档案',
      content: `将删除“${profile.nickname}”的成绩、复盘、目标学校和阶段目标，其他档案不受影响。`,
      confirmText: '确认删除',
      confirmColor: '#b42318',
      success: (modal) => {
        if (!modal.confirm) return
        const result = deleteStudentProfile(profile.id)
        if (!result.ok) {
          wx.showToast({ title: result.message, icon: 'none' })
          return
        }
        this.refresh()
        wx.showToast({ title: '档案已删除', icon: 'success' })
      }
    })
  }
})
