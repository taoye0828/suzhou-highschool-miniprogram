const { getSchoolById, presentSchool } = require('../../utils/school')
const {
  getFavoriteIdsResult,
  setFavorite,
  getTargetRecordsResult,
  getTargetDraftResult,
  getScoreRecordsResult,
  getExamYearResult,
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
const { referenceForSchool } = require('../../utils/score-analysis')

function currentScoreFrom(scoreRecords, draft) {
  const latest = Array.isArray(scoreRecords) && scoreRecords.length
    ? scoreRecords[scoreRecords.length - 1].score
    : Number(String(draft && draft.currentScore || '').trim())
  return Number.isInteger(latest) && latest >= 0 && latest <= APP_CONFIG.targetScore.max
    ? latest
    : null
}

function buildTargetAnalysis(school, targetRecord, scoreRecords, draft, targetYear) {
  if (!school) return null
  const reference = referenceForSchool(school.id, targetYear)
  const currentScore = currentScoreFrom(scoreRecords, draft)
  const gap = reference && currentScore !== null ? reference.minScore - currentScore : null
  const level = APP_CONFIG.targetScore.levels.find(
    (item) => targetRecord && item.value === targetRecord.level
  )
  return {
    currentScoreText: currentScore === null ? '尚未记录' : `${currentScore} 分`,
    referenceScoreText: reference ? `${reference.minScore} 分` : '暂未收录',
    referenceYearText: reference ? `${reference.year} 年` : '—',
    gapText: gap === null
      ? '待记录成绩后计算'
      : gap > 0
        ? `还有 ${gap} 分`
        : gap === 0
          ? '与历史参考分持平'
          : `高于历史参考分 ${Math.abs(gap)} 分`,
    targetLevelText: level ? level.label : '未设置'
  }
}

Page({
  data: {
    schoolId: '',
    school: null,
    scoreGroups: [],
    isFavorite: false,
    isTargetSchool: false,
    targetLevels: APP_CONFIG.targetScore.levels,
    targetLevelIndex: APP_CONFIG.targetScore.levels.findIndex((item) => item.value === 'target'),
    targetAnalysis: null,
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
    const scoreResult = getScoreRecordsResult()
    const draftResult = getTargetDraftResult()
    const yearResult = getExamYearResult()
    const targetRecord = school
      ? targetResult.records.find((record) => record.schoolId === school.id)
      : null
    const targetLevelIndex = targetRecord
      ? APP_CONFIG.targetScore.levels.findIndex((item) => item.value === targetRecord.level)
      : APP_CONFIG.targetScore.levels.findIndex((item) => item.value === 'target')
    const failedResult = [favoriteResult, targetResult, scoreResult, draftResult, yearResult]
      .find((result) => !result.ok)
    notifyStorageReadResult(this, failedResult || favoriteResult)
    this.setData({
      school: school ? presentSchool(school, favoriteResult.ids) : null,
      isFavorite: school ? favoriteResult.ids.includes(school.id) : false,
      isTargetSchool: Boolean(targetRecord),
      targetLevelIndex: Math.max(0, targetLevelIndex),
      targetAnalysis: buildTargetAnalysis(
        school,
        targetRecord,
        scoreResult.records,
        draftResult.draft,
        yearResult.year
      ),
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
    this.setData({ isTargetSchool: true }, () => this.refresh())
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
