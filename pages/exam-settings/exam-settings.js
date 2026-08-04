const {
  getExamTemplates,
  getScoreSchemes,
  saveExamTemplate,
  deleteExamTemplate,
  examTemplateReferenceCount,
  saveScoreScheme,
  deleteScoreScheme,
  scoreSchemeReferenceStats,
  getActiveProfile
} = require('../../utils/storage')
const { EXAM_TYPE_LABELS, METRIC_TYPE_LABELS } = require('../../utils/v1-domain')
const { PRODUCT_RULES } = require('../../utils/generated/product-rules')
const { operationOptions } = require('../../utils/operation-context')

const EXAM_TYPE_OPTIONS = PRODUCT_RULES.examTypes.map((value) => ({
  value,
  label: EXAM_TYPE_LABELS[value] || value
}))
const METRIC_OPTIONS = PRODUCT_RULES.statusEnums.metricType
  .filter((value) => value !== 'single_subject')
  .map((value) => ({
    value,
    label: value === 'partial_total'
      ? '自定义总分'
      : METRIC_TYPE_LABELS[value] || value
  }))

function createId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function emptyTemplateForm(defaultSchemeId = 'suzhou_admission_740_v1') {
  return {
    editingTemplateId: '',
    editingTemplateVersion: null,
    templateNameInput: '',
    templateExamNameInput: '',
    templateExamTypeIndex: Math.max(0, EXAM_TYPE_OPTIONS.findIndex((item) => item.value === 'custom')),
    templateSchemeIndex: 0,
    templateScoreSchemeId: defaultSchemeId,
    templateEnableSubjectScores: false,
    templateEnableRank: true,
    templateEnableReview: true,
    templateError: '',
    templateSaveText: '新建自定义模板'
  }
}

function subjectRulesText(rules) {
  return (Array.isArray(rules) ? rules : [])
    .map((item) => `${item.subjectName || item.name || item.subjectId}=${item.maxScore}`)
    .join('\n')
}

function emptySchemeForm() {
  return {
    editingSchemeId: '',
    editingSchemeVersion: null,
    schemeNameInput: '',
    schemeMetricIndex: 0,
    schemeTotalMaxInput: '',
    schemeAdmissionMaxInput: '',
    schemeSubjectRulesInput: '',
    schemeError: '',
    schemeSaveText: '新建自定义方案'
  }
}

function parseSubjectRules(text) {
  const lines = String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const rules = []
  const names = new Set()
  for (const [index, line] of lines.entries()) {
    const match = line.match(/^(.+?)\s*[=:：]\s*(\d+)$/)
    if (!match) return { ok: false, message: `第 ${index + 1} 行请使用“学科名=满分”格式。` }
    const name = match[1].trim()
    const maxScore = Number(match[2])
    const key = name.toLowerCase()
    if (!name || names.has(key) || !Number.isInteger(maxScore) || maxScore < 1 || maxScore > 740) {
      return { ok: false, message: `第 ${index + 1} 行学科名重复或满分无效。` }
    }
    names.add(key)
    rules.push({
      subjectId: `scheme_subject_${index + 1}_${name.replace(/\s+/g, '_').slice(0, 24)}`,
      subjectName: name,
      maxScore,
      includedInTotal: true,
      displayOrder: index,
      configVersion: 1,
      version: 1
    })
  }
  return { ok: true, rules }
}

Page({
  data: {
    activeSection: 'templates',
    activeProfileName: '默认档案',
    examTypeOptions: EXAM_TYPE_OPTIONS,
    metricOptions: METRIC_OPTIONS,
    templates: [],
    scoreSchemes: [],
    scoreSchemeOptions: [],
    loading: true,
    saving: false,
    pageError: '',
    ...emptyTemplateForm(),
    ...emptySchemeForm()
  },

  onShow() {
    this.setData({ loading: true })
    this.refresh()
  },

  refresh() {
    const scoreSchemes = getScoreSchemes()
    const legacySchemeIds = new Set(scoreSchemes
      .filter((item) => item.metricType === 'single_subject')
      .map((item) => item.id))
    const selectableSchemes = scoreSchemes.filter((item) => item.metricType !== 'single_subject')
    const templates = getExamTemplates().map((item) => ({
      ...item,
      name: legacySchemeIds.has(item.scoreSchemeId) ? '旧版模板（已保留）' : item.name,
      examTypeLabel: EXAM_TYPE_LABELS[item.examType] || item.examType,
      referenceCount: examTemplateReferenceCount(item.id),
      isLegacyScheme: legacySchemeIds.has(item.scoreSchemeId)
    }))
    const presentedSchemes = scoreSchemes.map((item) => ({
      ...item,
      name: item.metricType === 'single_subject' ? '旧版方案（已保留）' : item.name,
      metricLabel: METRIC_TYPE_LABELS[item.metricType] || item.metricType,
      references: scoreSchemeReferenceStats(item.id)
    }))
    const currentSchemeId = this.data.templateScoreSchemeId || 'suzhou_admission_740_v1'
    const templateSchemeIndex = Math.max(0, selectableSchemes.findIndex((item) => item.id === currentSchemeId))
    this.setData({
      activeProfileName: (getActiveProfile() || {}).nickname || '默认档案',
      templates,
      scoreSchemes: presentedSchemes,
      scoreSchemeOptions: selectableSchemes.map((item) => ({
        id: item.id,
        label: `${item.name} · ${item.totalMaxScore} 分${item.isBuiltIn ? ' · 内置' : ''}`
      })),
      templateSchemeIndex,
      templateScoreSchemeId: selectableSchemes[templateSchemeIndex] && selectableSchemes[templateSchemeIndex].id || '',
      loading: false,
      pageError: ''
    })
  },

  beginSaving() {
    if (this.data.saving) return false
    this.setData({ saving: true, pageError: '' })
    return true
  },

  finishSaving() {
    this.setData({ saving: false })
  },

  showMutationError(result, field) {
    const conflict = result && result.code === 'VERSION_CONFLICT'
    if (conflict) this.refresh()
    const message = conflict
      ? '数据已在其他页面更新，请确认最新内容后重新保存。'
      : result && result.message || '保存失败，原数据未修改。'
    this.setData({ saving: false, pageError: message, [field]: message })
  },

  selectSection(event) {
    const section = event.currentTarget.dataset.section
    if (['templates', 'schemes'].includes(section)) this.setData({ activeSection: section })
  },

  onTemplateInput(event) {
    const field = event.currentTarget.dataset.field
    if (!['templateNameInput', 'templateExamNameInput'].includes(field)) return
    this.setData({ [field]: event.detail.value, templateError: '' })
  },

  onTemplateExamTypeChange(event) {
    this.setData({ templateExamTypeIndex: Number(event.detail.value), templateError: '' })
  },

  onTemplateSchemeChange(event) {
    const index = Number(event.detail.value)
    const option = this.data.scoreSchemeOptions[index]
    if (option) this.setData({ templateSchemeIndex: index, templateScoreSchemeId: option.id, templateError: '' })
  },

  onTemplateSwitch(event) {
    const field = event.currentTarget.dataset.field
    if (!['templateEnableSubjectScores', 'templateEnableRank', 'templateEnableReview'].includes(field)) return
    this.setData({ [field]: Boolean(event.detail.value) })
  },

  saveTemplate() {
    const editing = Boolean(this.data.editingTemplateId)
    const name = String(this.data.templateNameInput || '').trim()
    const defaultExamName = String(this.data.templateExamNameInput || '').trim()
    const examType = EXAM_TYPE_OPTIONS[this.data.templateExamTypeIndex]
    if (!name || name.length > 80 || defaultExamName.length > 80 || !examType || !this.data.templateScoreSchemeId) {
      this.setData({ templateError: '请填写有效模板名称、考试类型和分值方案。' })
      return
    }
    if (!this.beginSaving()) return
    const now = new Date().toISOString()
    const id = this.data.editingTemplateId || createId('exam_template')
    const result = saveExamTemplate({
      id,
      name,
      defaultExamName,
      examType: examType.value,
      scoreSchemeId: this.data.templateScoreSchemeId,
      enableSubjectScores: this.data.editingTemplateId
        ? this.data.templateEnableSubjectScores
        : false,
      enableRank: this.data.templateEnableRank,
      enableReview: this.data.templateEnableReview,
      displayOrder: this.data.templates.length * 10 + 100,
      createdAt: now,
      updatedAt: now,
      expectedVersion: this.data.editingTemplateVersion
    }, operationOptions('save_exam_template', id))
    if (!result.ok) {
      this.showMutationError(result, 'templateError')
      return
    }
    this.finishSaving()
    this.setData(emptyTemplateForm(this.data.scoreSchemes[0] && this.data.scoreSchemes[0].id))
    this.refresh()
    wx.showToast({ title: editing ? '模板已更新' : '模板已保存', icon: 'success' })
  },

  editTemplate(event) {
    const item = this.data.templates.find((template) => template.id === event.currentTarget.dataset.id)
    if (!item || item.isBuiltIn) return
    if (item.isLegacyScheme) {
      wx.showToast({ title: '旧版模板已保留，V1 暂不支持编辑', icon: 'none' })
      return
    }
    this.setData({
      activeSection: 'templates',
      editingTemplateId: item.id,
      editingTemplateVersion: item.version,
      templateNameInput: item.name,
      templateExamNameInput: item.defaultExamName,
      templateExamTypeIndex: Math.max(0, EXAM_TYPE_OPTIONS.findIndex((option) => option.value === item.examType)),
      templateSchemeIndex: Math.max(0, this.data.scoreSchemeOptions.findIndex((option) => option.id === item.scoreSchemeId)),
      templateScoreSchemeId: item.scoreSchemeId,
      templateEnableSubjectScores: item.enableSubjectScores,
      templateEnableRank: item.enableRank,
      templateEnableReview: item.enableReview,
      templateError: '',
      templateSaveText: '保存模板修改'
    })
  },

  copyTemplate(event) {
    const item = this.data.templates.find((template) => template.id === event.currentTarget.dataset.id)
    if (!item) return
    if (item.isLegacyScheme) {
      wx.showToast({ title: '旧版模板已保留，V1 暂不支持复制', icon: 'none' })
      return
    }
    this.setData({
      activeSection: 'templates',
      editingTemplateId: '',
      editingTemplateVersion: null,
      templateNameInput: `${item.name}副本`.slice(0, 80),
      templateExamNameInput: item.defaultExamName,
      templateExamTypeIndex: Math.max(0, EXAM_TYPE_OPTIONS.findIndex((option) => option.value === item.examType)),
      templateSchemeIndex: Math.max(0, this.data.scoreSchemeOptions.findIndex((option) => option.id === item.scoreSchemeId)),
      templateScoreSchemeId: item.scoreSchemeId,
      templateEnableSubjectScores: false,
      templateEnableRank: item.enableRank,
      templateEnableReview: item.enableReview,
      templateError: '',
      templateSaveText: '保存模板副本'
    })
  },

  cancelTemplateEdit() {
    this.setData(emptyTemplateForm(this.data.scoreSchemes[0] && this.data.scoreSchemes[0].id))
    this.refresh()
  },

  deleteTemplate(event) {
    const id = event.currentTarget.dataset.id
    const item = this.data.templates.find((template) => template.id === id)
    if (!item || item.isBuiltIn) return
    wx.showModal({
      title: '删除自定义模板',
      content: `历史考试不会被删除；当前有 ${item.referenceCount} 条考试记录标记为使用过该模板。`,
      confirmText: '确认删除',
      confirmColor: '#b42318',
      success: (modal) => {
        if (!modal.confirm) return
        if (!this.beginSaving()) return
        const result = deleteExamTemplate(id, operationOptions('delete_exam_template', id))
        if (!result.ok) {
          this.showMutationError(result, 'templateError')
          return wx.showToast({ title: result.message, icon: 'none' })
        }
        this.finishSaving()
        this.cancelTemplateEdit()
        wx.showToast({ title: '模板已删除', icon: 'success' })
      }
    })
  },

  onSchemeInput(event) {
    const field = event.currentTarget.dataset.field
    if (!['schemeNameInput', 'schemeTotalMaxInput', 'schemeAdmissionMaxInput', 'schemeSubjectRulesInput'].includes(field)) return
    this.setData({ [field]: event.detail.value, schemeError: '' })
  },

  onSchemeMetricChange(event) {
    this.setData({ schemeMetricIndex: Number(event.detail.value), schemeError: '' })
  },

  saveScheme() {
    const name = String(this.data.schemeNameInput || '').trim()
    const totalMaxScore = Number(String(this.data.schemeTotalMaxInput || '').trim())
    const admissionRaw = String(this.data.schemeAdmissionMaxInput || '').trim()
    const admissionScaleMax = admissionRaw ? Number(admissionRaw) : null
    const metric = METRIC_OPTIONS[this.data.schemeMetricIndex]
    const parsed = parseSubjectRules(this.data.schemeSubjectRulesInput)
    if (!name || name.length > 80 || !metric || !Number.isInteger(totalMaxScore) || totalMaxScore < 1 || totalMaxScore > 740 ||
        admissionScaleMax !== null && (!Number.isInteger(admissionScaleMax) || admissionScaleMax < 1 || admissionScaleMax > 740)) {
      this.setData({ schemeError: '请填写有效方案名称、指标类型和 1—740 分满分。' })
      return
    }
    if (!parsed.ok) {
      this.setData({ schemeError: parsed.message })
      return
    }
    const subjectTotal = parsed.rules.reduce((sum, item) => sum + item.maxScore, 0)
    if (parsed.rules.length && subjectTotal !== totalMaxScore) {
      this.setData({ schemeError: `学科满分合计 ${subjectTotal}，需与方案总满分 ${totalMaxScore} 一致。` })
      return
    }
    if (!this.beginSaving()) return
    const now = new Date().toISOString()
    const id = this.data.editingSchemeId || createId('score_scheme')
    const eligibilityRuleId = metric.value === 'full_total' && totalMaxScore === 740 && admissionScaleMax === 740
      ? 'suzhou_admission_740_v1'
      : ''
    const result = saveScoreScheme({
      id,
      name,
      metricType: metric.value,
      subjectRules: this.data.editingSchemeId ? parsed.rules : [],
      totalMaxScore,
      admissionScaleMax,
      eligibilityRuleId,
      createdAt: now,
      updatedAt: now,
      expectedVersion: this.data.editingSchemeVersion
    }, operationOptions('save_score_scheme', id))
    if (!result.ok) {
      this.showMutationError(result, 'schemeError')
      return
    }
    this.finishSaving()
    const editing = Boolean(this.data.editingSchemeId)
    this.setData(emptySchemeForm())
    this.refresh()
    wx.showToast({ title: editing ? '方案已更新' : '方案已保存', icon: 'success' })
  },

  editScheme(event) {
    const item = this.data.scoreSchemes.find((scheme) => scheme.id === event.currentTarget.dataset.id)
    if (!item || item.isBuiltIn) return
    if (item.metricType === 'single_subject' || (item.subjectRules || []).length) {
      wx.showToast({ title: '旧版方案已保留，V1 暂不支持编辑', icon: 'none' })
      return
    }
    this.setData({
      activeSection: 'schemes',
      editingSchemeId: item.id,
      editingSchemeVersion: item.version,
      schemeNameInput: item.name,
      schemeMetricIndex: Math.max(0, METRIC_OPTIONS.findIndex((option) => option.value === item.metricType)),
      schemeTotalMaxInput: String(item.totalMaxScore),
      schemeAdmissionMaxInput: item.admissionScaleMax === null ? '' : String(item.admissionScaleMax),
      schemeSubjectRulesInput: subjectRulesText(item.subjectRules),
      schemeError: '',
      schemeSaveText: '保存方案修改'
    })
  },

  copyScheme(event) {
    const item = this.data.scoreSchemes.find((scheme) => scheme.id === event.currentTarget.dataset.id)
    if (!item) return
    if (item.metricType === 'single_subject') {
      wx.showToast({ title: '旧版方案已保留，V1 暂不支持复制', icon: 'none' })
      return
    }
    this.setData({
      activeSection: 'schemes',
      editingSchemeId: '',
      editingSchemeVersion: null,
      schemeNameInput: `${item.name}副本`.slice(0, 80),
      schemeMetricIndex: Math.max(0, METRIC_OPTIONS.findIndex((option) => option.value === item.metricType)),
      schemeTotalMaxInput: String(item.totalMaxScore),
      schemeAdmissionMaxInput: item.admissionScaleMax === null ? '' : String(item.admissionScaleMax),
      schemeSubjectRulesInput: '',
      schemeError: '',
      schemeSaveText: '保存方案副本'
    })
  },

  cancelSchemeEdit() { this.setData(emptySchemeForm()) },

  deleteScheme(event) {
    const id = event.currentTarget.dataset.id
    const item = this.data.scoreSchemes.find((scheme) => scheme.id === id)
    if (!item || item.isBuiltIn) return
    wx.showModal({
      title: '删除自定义分值方案',
      content: `已保存的 ${item.references.examCount} 条考试保留历史快照；使用该方案的模板需先改用其他方案。`,
      confirmText: '确认删除',
      confirmColor: '#b42318',
      success: (modal) => {
        if (!modal.confirm) return
        if (!this.beginSaving()) return
        const result = deleteScoreScheme(id, operationOptions('delete_score_scheme', id))
        if (!result.ok) {
          this.showMutationError(result, 'schemeError')
          return wx.showToast({ title: result.message, icon: 'none' })
        }
        this.finishSaving()
        this.cancelSchemeEdit()
        this.refresh()
        wx.showToast({ title: '方案已删除', icon: 'success' })
      }
    })
  }
})
