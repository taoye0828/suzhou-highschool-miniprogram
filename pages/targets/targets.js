const {
  getScoreRecords,
  getTargetRecords,
  deleteTargetRecord
} = require('../../utils/storage')
const { operationOptions } = require('../../utils/operation-context')
const { selectLatestReference, referenceScoreValue } = require('../../utils/planning')
const { publicDataService } = require('../../utils/public-data-service')
const { shareConfig } = require('../../utils/share')

function scoreValue(record) {
  return Number(record && (record.totalScore === undefined ? record.score : record.totalScore))
}

function latestScore(records) {
  const ordered = (Array.isArray(records) ? records : []).slice().sort((left, right) => {
    const dateCompare = String(left.examDate || left.date || '').localeCompare(String(right.examDate || right.date || ''))
    return dateCompare || String(left.createdAt || '').localeCompare(String(right.createdAt || ''))
  })
  return ordered.length ? ordered[ordered.length - 1] : null
}

function differenceText(value) {
  if (!Number.isFinite(value)) return '—'
  if (value > 0) return `+${value}`
  return String(value)
}

Page({
  data: {
    currentScore: null,
    latestExamName: '',
    targetCards: []
  },

  onShareAppMessage() {
    return shareConfig('pages/targets/targets')
  },

  onShareTimeline() {
    return shareConfig('pages/targets/targets')
  },

  onLoad() {
    this.unsubscribePublicData = publicDataService.subscribe((snapshot) => this.applyPublicData(snapshot))
    this.applyPublicData(publicDataService.getSnapshot())
  },

  onShow() {
    // 与学校列表/学校详情使用同一套公开数据 snapshot；目标记录本身仍只存本机。
    this.applyPublicData(publicDataService.getSnapshot())
  },

  onUnload() {
    if (this.unsubscribePublicData) this.unsubscribePublicData()
  },

  applyPublicData(snapshot) {
    this.publicSchools = Array.isArray(snapshot.schools) ? snapshot.schools : []
    this.publicScores = Array.isArray(snapshot.scores) ? snapshot.scores : []
    this.refresh()
  },

  refresh() {
    const latest = latestScore(getScoreRecords())
    const currentScore = latest ? scoreValue(latest) : null
    const schools = this.publicSchools || []
    const admissionScores = this.publicScores || []
    const schoolMap = new Map(schools.map((item) => [item.id, item]))
    const targetCards = getTargetRecords().map((record) => {
      const school = schoolMap.get(record.schoolId)
      const reference = selectLatestReference(admissionScores, { schoolId: record.schoolId })
      const referenceScore = reference ? referenceScoreValue(reference) : null
      const difference = Number.isFinite(currentScore) && Number.isFinite(referenceScore)
        ? currentScore - referenceScore
        : null
      return {
        id: record.id,
        schoolId: record.schoolId,
        schoolName: school ? school.name : record.schoolName,
        referenceYear: reference ? reference.year : '—',
        referenceScore: Number.isFinite(referenceScore) ? `${referenceScore} 分` : '暂无',
        currentScore: Number.isFinite(currentScore) ? `${currentScore} 分` : '暂无',
        difference: differenceText(difference)
      }
    })
    this.setData({
      currentScore,
      latestExamName: latest ? latest.examName : '',
      targetCards
    })
  },

  openSchools() {
    wx.switchTab({ url: '/pages/schools/schools' })
  },

  openSchool(event) {
    wx.navigateTo({ url: `/pages/school-detail/school-detail?id=${encodeURIComponent(event.currentTarget.dataset.id)}` })
  },

  removeTarget(event) {
    const record = this.data.targetCards.find((item) => item.id === event.currentTarget.dataset.id)
    if (!record) return
    wx.showModal({
      title: '移出目标学校',
      content: `确认将“${record.schoolName}”移出目标学校吗？`,
      confirmText: '确认移出',
      confirmColor: '#b42318',
      success: (modal) => {
        if (!modal.confirm) return
        const result = deleteTargetRecord(record.id, operationOptions('delete_target', record.id))
        if (!result.ok) wx.showToast({ title: result.message, icon: 'none' })
        else this.refresh()
      }
    })
  }
})
