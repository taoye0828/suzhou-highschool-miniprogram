const { getSchoolById, presentSchool } = require('../../utils/school')
const {
  getFavoriteIdsResult,
  setFavorite,
  getTargetRecordsResult,
  saveTargetRecord
} = require('../../utils/storage')
const { notifyStorageReadResult } = require('../../utils/storage-feedback')
const { mapSearchKeyword, copyText } = require('../../utils/map')
const { openExternalLink } = require('../../utils/external-link')
const {
  EMPTY_SCORE_TEXT,
  SCORE_SAFETY_NOTICE,
  groupScoresByYear
} = require('../../utils/admission-scores')
const { APP_CONFIG } = require('../../config/app-config')

Page({
  data: {
    schoolId: '',
    school: null,
    scoreGroups: [],
    isFavorite: false,
    isTargetSchool: false,
    targetLevels: APP_CONFIG.targetScore.levels,
    targetLevelIndex: APP_CONFIG.targetScore.levels.findIndex((item) => item.value === 'target'),
    mapKeyword: '',
    emptyScoreText: EMPTY_SCORE_TEXT,
    scoreSafetyNotice: SCORE_SAFETY_NOTICE,
    detailNotice: APP_CONFIG.policy.schoolDetailNotice
  },

  onLoad(options) {
    this.setData({ schoolId: options.id || '' })
    this.refresh()
  },

  onShow() {
    if (this.data.schoolId) this.refresh()
  },

  refresh() {
    const school = getSchoolById(this.data.schoolId)
    const favoriteResult = getFavoriteIdsResult()
    const targetResult = getTargetRecordsResult()
    const targetRecord = school
      ? targetResult.records.find((record) => record.schoolId === school.id)
      : null
    const targetLevelIndex = targetRecord
      ? APP_CONFIG.targetScore.levels.findIndex((item) => item.value === targetRecord.level)
      : APP_CONFIG.targetScore.levels.findIndex((item) => item.value === 'target')
    notifyStorageReadResult(this, !favoriteResult.ok ? favoriteResult : targetResult)
    this.setData({
      school: school ? presentSchool(school, favoriteResult.ids) : null,
      isFavorite: school ? favoriteResult.ids.includes(school.id) : false,
      isTargetSchool: Boolean(targetRecord),
      targetLevelIndex: Math.max(0, targetLevelIndex),
      scoreGroups: school ? groupScoresByYear(school.id) : [],
      mapKeyword: school ? mapSearchKeyword(school.name) : ''
    })
  },

  toggleFavorite() {
    if (!this.data.school) return
    const nextValue = !this.data.isFavorite
    const result = setFavorite(this.data.school.id, nextValue)
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    this.setData({ isFavorite: nextValue })
    wx.showToast({ title: nextValue ? '已收藏' : '已取消收藏', icon: 'success' })
  },

  onTargetLevelChange(event) {
    this.setData({ targetLevelIndex: Number(event.detail.value) })
  },

  saveSchoolTarget() {
    if (!this.data.school) return
    const level = this.data.targetLevels[this.data.targetLevelIndex]
    if (!level) {
      wx.showToast({ title: '目标等级无效，请重新选择。', icon: 'none' })
      return
    }
    const wasTargetSchool = this.data.isTargetSchool
    const result = saveTargetRecord({
      id: `target_${this.data.school.id}`,
      schoolId: this.data.school.id,
      schoolName: this.data.school.name,
      level: level.value,
      createdAt: new Date().toISOString()
    })
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    this.setData({ isTargetSchool: true })
    wx.showToast({
      title: wasTargetSchool ? '目标等级已更新' : '已加入目标',
      icon: 'success'
    })
  },

  copySchoolName() {
    copyText(this.data.school && this.data.school.name, '学校名称已复制')
  },

  copyAddress() {
    copyText(this.data.school && this.data.school.address, '地址已复制')
  },

  copyMapKeyword() {
    copyText(this.data.mapKeyword, '地图搜索词已复制')
  },

  copySourceLink() {
    copyText(this.data.school && this.data.school.sourceUrl, '来源链接已复制')
  },

  openSourceLink() {
    openExternalLink(this.data.school && this.data.school.sourceUrl)
  },

  copyOfficialWebsite() {
    copyText(this.data.school && this.data.school.officialWebsite, '官网链接已复制')
  },

  openOfficialWebsite() {
    openExternalLink(this.data.school && this.data.school.officialWebsite)
  },

  copyScoreSource(event) {
    copyText(event.currentTarget.dataset.url, '分数线来源链接已复制')
  },

  openScoreSource(event) {
    openExternalLink(event.currentTarget.dataset.url)
  },

  openSchools() {
    wx.switchTab({ url: '/pages/schools/schools' })
  }
})
