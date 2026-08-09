const { schools } = require('../../data/schools')
const { admissionScores } = require('../../data/admission-scores')
const {
  getTargetRecords,
  saveTargetRecord,
  deleteTargetRecord
} = require('../../utils/storage')
const { operationOptions } = require('../../utils/operation-context')
const { selectLatestReference, referenceScoreValue } = require('../../utils/planning')

function schoolById(id) {
  return schools.find((item) => item.id === id) || null
}

function scoreRows(schoolId) {
  return admissionScores
    .filter((item) => item.schoolId === schoolId)
    .slice()
    .sort((left, right) => right.year - left.year || right.minScore - left.minScore)
    .map((item) => ({
      ...item,
      detail: [item.region, item.batch, item.admissionType].filter(Boolean).join(' · ')
    }))
}

Page({
  data: {
    school: null,
    notFound: false,
    scores: [],
    targetRecord: null,
    aliasesText: '',
    programsText: '',
    mapSearchText: ''
  },

  onLoad(options) {
    const rawId = String(options && options.id || '')
    try {
      this.schoolId = decodeURIComponent(rawId)
    } catch (error) {
      this.schoolId = ''
    }
    const school = schoolById(this.schoolId)
    if (!school) {
      this.schoolId = ''
      wx.setNavigationBarTitle({ title: '学校不存在' })
      this.setData({ notFound: true })
      return
    }
    wx.setNavigationBarTitle({ title: school.name })
    this.setData({
      school,
      scores: scoreRows(school.id),
      aliasesText: (school.aliases || []).join('、'),
      programsText: (school.programs || []).join('、'),
      mapSearchText: [school.name, school.address].filter(Boolean).join(' ')
    })
  },

  goBack() {
    const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
    if (pages.length > 1) {
      wx.navigateBack({ delta: 1 })
      return
    }
    wx.switchTab({ url: '/pages/schools/schools' })
  },

  onShow() {
    if (!this.schoolId) return
    const targetRecord = getTargetRecords().find((item) => item.schoolId === this.schoolId) || null
    this.setData({ targetRecord })
  },

  addTarget() {
    const school = this.data.school
    if (!school) return
    const reference = selectLatestReference(admissionScores, { schoolId: school.id })
    const result = saveTargetRecord({
      id: `target_${school.id}`,
      schoolId: school.id,
      schoolName: school.name,
      referenceScore: reference ? referenceScoreValue(reference) : null,
      referenceYear: reference ? reference.year : null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, operationOptions('save_target', school.id))
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    this.onShow()
  },

  removeTarget() {
    const target = this.data.targetRecord
    if (!target) return
    wx.showModal({
      title: '移出目标学校',
      content: `确认将“${target.schoolName}”移出目标学校吗？`,
      confirmText: '确认移出',
      confirmColor: '#b42318',
      success: (modal) => {
        if (!modal.confirm) return
        const result = deleteTargetRecord(target.id, operationOptions('delete_target', target.id))
        if (!result.ok) wx.showToast({ title: result.message, icon: 'none' })
        else this.onShow()
      }
    })
  },

  copyText(event) {
    const value = String(event.currentTarget.dataset.value || '')
    const successText = event.currentTarget.dataset.success || '已复制'
    if (!value) return
    wx.setClipboardData({
      data: value,
      success: () => wx.showToast({ title: successText, icon: 'success' }),
      fail: () => wx.showToast({ title: '复制失败，请稍后重试', icon: 'none' })
    })
  }
})
