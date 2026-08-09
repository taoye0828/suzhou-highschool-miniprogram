const {
  getProfilesResult,
  createStudentProfile,
  updateStudentProfile,
  switchStudentProfile,
  deleteStudentProfile
} = require('../../utils/storage')
const { operationOptions } = require('../../utils/operation-context')

const currentYear = new Date().getFullYear()
const EXAM_YEARS = Array.from({ length: 13 }, (_, index) => currentYear + index)

function presentProfiles(result) {
  return result.profiles.map((profile) => ({
    ...profile,
    examYearIndex: Math.max(0, EXAM_YEARS.indexOf(profile.examYear)),
    isActive: profile.id === result.activeProfileId
  }))
}

Page({
  data: {
    profiles: [],
    examYears: EXAM_YEARS,
    draftNickname: '',
    draftYearIndex: Math.max(0, EXAM_YEARS.indexOf(2027)),
    creating: false
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
    this.setData({ profiles: presentProfiles(result) })
  },

  onNicknameInput(event) {
    this.setData({ draftNickname: event.detail.value })
  },

  onDraftYearChange(event) {
    this.setData({ draftYearIndex: Number(event.detail.value) })
  },

  createProfile() {
    if (this.data.creating) return
    const nickname = String(this.data.draftNickname || '').trim()
    if (!nickname) {
      wx.showToast({ title: '请填写档案昵称', icon: 'none' })
      return
    }
    this.setData({ creating: true })
    const examYear = EXAM_YEARS[this.data.draftYearIndex]
    const result = createStudentProfile(
      { nickname, examYear },
      operationOptions('create_profile', nickname)
    )
    this.setData({ creating: false })
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    this.setData({ draftNickname: '' })
    this.refresh()
  },

  switchProfile(event) {
    const id = event.currentTarget.dataset.id
    const result = switchStudentProfile(id, operationOptions('switch_profile', id))
    if (!result.ok) wx.showToast({ title: result.message, icon: 'none' })
    else this.refresh()
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
        if (nickname.length > 20) {
          wx.showToast({ title: '档案昵称最多 20 个字符', icon: 'none' })
          return
        }
        const result = updateStudentProfile(
          profile.id,
          { nickname },
          operationOptions('update_profile', profile.id)
        )
        if (!result.ok) wx.showToast({ title: result.message, icon: 'none' })
        else this.refresh()
      }
    })
  },

  changeExamYear(event) {
    const profileId = event.currentTarget.dataset.id
    const examYear = EXAM_YEARS[Number(event.detail.value)]
    const result = updateStudentProfile(
      profileId,
      { examYear },
      operationOptions('update_profile', profileId)
    )
    if (!result.ok) wx.showToast({ title: result.message, icon: 'none' })
    else this.refresh()
  },

  deleteProfile(event) {
    const profile = this.data.profiles.find((item) => item.id === event.currentTarget.dataset.id)
    if (!profile) return
    wx.showModal({
      title: '删除学生档案',
      content: `将删除“${profile.nickname}”的考试成绩和目标学校，且无法撤销。`,
      confirmText: '确认删除',
      confirmColor: '#b42318',
      success: (modal) => {
        if (!modal.confirm) return
        const result = deleteStudentProfile(
          profile.id,
          operationOptions('delete_profile', profile.id)
        )
        if (!result.ok) wx.showToast({ title: result.message, icon: 'none' })
        else this.refresh()
      }
    })
  }
})
