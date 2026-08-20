const {
  getTargetRecords,
  saveTargetRecord,
  deleteTargetRecord
} = require('../../utils/storage')
const { operationOptions } = require('../../utils/operation-context')
const { selectLatestReference, referenceScoreValue } = require('../../utils/planning')
const { publicDataService, effectiveContent } = require('../../utils/public-data-service')
const { shareConfig } = require('../../utils/share')

function schoolById(schools, id) {
  return schools.find((item) => item.id === id) || null
}

function scoreRows(scores, schoolId, sortOrder) {
  const direction = sortOrder === 'year_asc' ? 1 : -1
  return scores
    .filter((item) => item.schoolId === schoolId)
    .slice()
    .sort((left, right) => direction * (left.year - right.year) || direction * (Number(left.minScore) - Number(right.minScore)))
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
    mapSearchText: '',
    images: []
  },

  onShareAppMessage() {
    return this.schoolId
      ? shareConfig('pages/school-detail/school-detail', `id=${encodeURIComponent(this.schoolId)}`)
      : shareConfig('pages/school-detail/school-detail')
  },

  onShareTimeline() {
    return this.schoolId
      ? shareConfig('pages/school-detail/school-detail', `id=${encodeURIComponent(this.schoolId)}`)
      : shareConfig('pages/school-detail/school-detail')
  },

  onLoad(options) {
    const rawId = String(options && options.id || '')
    try {
      this.schoolId = decodeURIComponent(rawId)
    } catch (error) {
      this.schoolId = ''
    }
    this.unsubscribePublicData = publicDataService.subscribe((snapshot) => this.applyPublicData(snapshot))
    this.applyPublicData(publicDataService.getSnapshot())
  },

  onUnload() {
    if (this.unsubscribePublicData) this.unsubscribePublicData()
  },

  applyPublicData(snapshot) {
    if (!this.schoolId) return
    const schools = Array.isArray(snapshot.schools) ? snapshot.schools : []
    const scores = Array.isArray(snapshot.scores) ? snapshot.scores : []
    const school = schoolById(schools, this.schoolId)
    if (!school) {
      wx.setNavigationBarTitle({ title: '学校不存在' })
      this.setData({ school: null, notFound: true, scores: [], images: [] })
      return
    }
    const display = effectiveContent(snapshot.content).display
    const images = (Array.isArray(snapshot.images) ? snapshot.images : [])
      .filter((item) => item.schoolId === school.id)
      .slice()
      .sort((left, right) => Number(Boolean(right.isCover)) - Number(Boolean(left.isCover)) || Number(left.sortOrder || 0) - Number(right.sortOrder || 0))
    wx.setNavigationBarTitle({ title: school.name })
    this.setData({
      school: { ...school, phone: school.phone || school.officialPhone || '' },
      notFound: false,
      scores: scoreRows(scores, school.id, display.scoreDefaultSort),
      images,
      aliasesText: (school.aliases || []).join('、'),
      programsText: (school.programs || []).join('、'),
      mapSearchText: [school.name, school.address].filter(Boolean).join(' ')
    })
  },

  onImageError(event) {
    const imageId = event.currentTarget.dataset.id
    this.setData({ images: this.data.images.map((item) => item.imageId === imageId ? { ...item, failed: true } : item) })
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
    const reference = selectLatestReference(publicDataService.getSnapshot().scores, { schoolId: school.id })
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
