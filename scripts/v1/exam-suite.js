const fs = require('fs')
const path = require('path')
const { assert, setup, runTest } = require('./test-helpers')
const {
  scoreSchemeSnapshot,
  resolveExamScoreSchemeSnapshot,
  scoreRateBasisPoints,
  recommendationEligibility,
  isRecommendationEligibleExam
} = require('../../utils/v1-domain')
const {
  getVisibleTrendRecords,
  calculateChartPoints
} = require('../../utils/score-trend')
const { analyzeSubject } = require('../../utils/subject-analysis')
const { selectCurrentScore, selectGapTrajectory } = require('../../utils/planning')
const { PRODUCT_RULES } = require('../../utils/generated/product-rules')

function now(index = 0) {
  return `2026-08-0${index + 1}T08:00:00.000Z`
}

function exam(id, score, scheme, overrides = {}) {
  const snapshot = scoreSchemeSnapshot(scheme)
  return {
    id,
    examName: overrides.examName || id,
    examDate: overrides.examDate || '2026-08-01',
    totalScore: score,
    totalMaxScore: scheme.totalMaxScore,
    examType: overrides.examType || 'custom',
    examTemplateId: overrides.examTemplateId || '',
    scoreSchemeId: scheme.id,
    scoreSchemeName: scheme.name,
    scoreSchemeSnapshot: snapshot,
    metricType: scheme.metricType,
    admissionScaleMax: scheme.admissionScaleMax,
    eligibilityRuleId: scheme.eligibilityRuleId,
    scoreRateBasisPoints: scoreRateBasisPoints(score, scheme.totalMaxScore),
    subjectScores: overrides.subjectScores || [],
    createdAt: overrides.createdAt || now(),
    updatedAt: overrides.updatedAt || now()
  }
}

function customScheme(id, totalMaxScore, metricType = 'full_total', admissionScaleMax = null) {
  return {
    id,
    name: id,
    metricType,
    subjectRules: [{ subjectId: 'subject', subjectName: '学科', maxScore: totalMaxScore }],
    totalMaxScore,
    admissionScaleMax,
    eligibilityRuleId: metricType === 'full_total' && totalMaxScore === 740 && admissionScaleMax === 740
      ? 'suzhou_admission_740_v1'
      : '',
    isBuiltIn: false,
    version: 1
  }
}

function testBuiltInsAreRuleBackedAndImmutable() {
  const { storage } = setup()
  assert.strictEqual(storage.getExamTemplates().filter((item) => item.isBuiltIn).length, PRODUCT_RULES.builtInExamTemplates.length)
  assert.strictEqual(storage.getScoreSchemes().filter((item) => item.isBuiltIn).length, PRODUCT_RULES.builtInScoreSchemes.length)
  assert.strictEqual(storage.deleteExamTemplate('builtin_monthly_exam_v1', { operationId: 'delete-builtin-template' }).code, 'BUILT_IN_IMMUTABLE')
  assert.strictEqual(storage.deleteScoreScheme('suzhou_admission_740_v1', { operationId: 'delete-builtin-scheme' }).code, 'BUILT_IN_IMMUTABLE')
}

function testCustomTemplateCrudVersionAndReferences() {
  const { storage } = setup()
  const created = storage.saveExamTemplate({
    id: 'template-a', name: '自定义月考', examType: 'monthly_exam', defaultExamName: '月考',
    scoreSchemeId: 'suzhou_admission_740_v1', createdAt: now(), updatedAt: now()
  }, { operationId: 'save-template-a' })
  assert.strictEqual(created.ok, true)
  assert.strictEqual(storage.getCustomExamTemplates().length, 1)
  const conflict = storage.saveExamTemplate({ ...created.record, name: '冲突', expectedVersion: 99 }, { operationId: 'save-template-conflict' })
  assert.strictEqual(conflict.code, 'VERSION_CONFLICT')
  const builtIn = storage.getScoreSchemes().find((item) => item.id === 'suzhou_admission_740_v1')
  assert.strictEqual(storage.saveScoreRecord(exam('template-exam', 650, builtIn, { examTemplateId: 'template-a' }), { operationId: 'template-exam' }).ok, true)
  assert.strictEqual(storage.examTemplateReferenceCount('template-a'), 1)
  assert.strictEqual(storage.deleteExamTemplate('template-a', { operationId: 'delete-template-a' }).ok, true)
  assert.strictEqual(storage.getScoreRecords()[0].examTemplateId, 'template-a')
}

function testCustomSchemeSnapshotIsImmutable() {
  const { storage } = setup()
  const scheme = customScheme('scheme-100', 100, 'partial_total', null)
  const created = storage.saveScoreScheme({ ...scheme, createdAt: now(), updatedAt: now() }, { operationId: 'save-scheme-100' })
  assert.strictEqual(created.ok, true)
  assert.strictEqual(storage.saveScoreRecord(exam('exam-80', 80, created.record), { operationId: 'save-exam-80' }).ok, true)
  const updated = storage.saveScoreScheme({
    ...created.record,
    name: '改名后的 100 分方案',
    expectedVersion: created.record.version
  }, { operationId: 'update-scheme-100' })
  assert.strictEqual(updated.ok, true)
  const historical = storage.getScoreRecords()[0]
  assert.strictEqual(historical.scoreSchemeSnapshot.name, 'scheme-100')
  assert.strictEqual(historical.totalMaxScore, 100)
  assert.strictEqual(historical.scoreRateBasisPoints, 8000)
  assert.strictEqual(storage.deleteScoreScheme('scheme-100', { operationId: 'delete-scheme-100' }).ok, true)
  assert.strictEqual(storage.getScoreRecords()[0].scoreSchemeSnapshot.totalMaxScore, 100)
}

function testUnrelatedExamEditKeepsHistoricalSchemeSnapshot() {
  const originalScheme = customScheme('scheme-history', 100, 'partial_total', null)
  const original = exam('exam-history', 80, originalScheme)
  const changedScheme = { ...originalScheme, name: '后来改名', totalMaxScore: 120 }
  const unchangedSelection = resolveExamScoreSchemeSnapshot({
    originalRecord: original,
    selectedScheme: changedScheme,
    selectionChanged: false
  })
  assert.deepStrictEqual(unchangedSelection, original.scoreSchemeSnapshot)
  const explicitSelection = resolveExamScoreSchemeSnapshot({
    originalRecord: original,
    selectedScheme: changedScheme,
    selectionChanged: true
  })
  assert.strictEqual(explicitSelection.name, '后来改名')
  assert.strictEqual(explicitSelection.totalMaxScore, 120)
}

function testDifferentMaxScoresAndEligibility() {
  const builtIn = PRODUCT_RULES.builtInScoreSchemes[0]
  const cases = [
    [exam('weekly-80', 80, customScheme('weekly-100', 100), { examType: 'weekly_test' }), false],
    [exam('monthly-650', 650, builtIn, { examType: 'monthly_exam' }), true],
    [exam('midterm-665', 665, builtIn, { examType: 'midterm_exam' }), true],
    [exam('math-92', 92, customScheme('math-100', 100, 'single_subject')), false],
    [exam('partial-450', 450, customScheme('partial-500', 500, 'partial_total')), false]
  ]
  assert.deepStrictEqual(cases.map(([record]) => record.scoreRateBasisPoints), [8000, 8784, 8986, 9200, 9000])
  for (const [record, expected] of cases) {
    assert.strictEqual(isRecommendationEligibleExam(record), expected, recommendationEligibility(record).code)
  }
}

function testIncompleteSnapshotIsIneligible() {
  const record = exam('incomplete', 650, PRODUCT_RULES.builtInScoreSchemes[0], { examType: 'monthly_exam' })
  record.scoreSchemeSnapshot = { ...record.scoreSchemeSnapshot, subjectRules: [] }
  assert.strictEqual(recommendationEligibility(record).code, 'SCHEME_SNAPSHOT_INCOMPLETE')
}

function testRawAndRateTrendShareX() {
  const records = [
    exam('trend-1', 80, customScheme('weekly-100', 100), { examDate: '2026-08-01' }),
    exam('trend-2', 650, PRODUCT_RULES.builtInScoreSchemes[0], { examDate: '2026-08-02' })
  ]
  const raw = getVisibleTrendRecords(records, 10, 'raw')
  const rate = getVisibleTrendRecords(records, 10, 'rate')
  assert.deepStrictEqual(raw.map((item) => item.score), [80, 650])
  assert.deepStrictEqual(rate.map((item) => item.score), [80, 87.84])
  const rawPoints = calculateChartPoints(raw, 390, 280, 38)
  const ratePoints = calculateChartPoints(rate, 390, 280, 38)
  assert.deepStrictEqual(rawPoints.map((item) => item.x), ratePoints.map((item) => item.x))
  assert.deepStrictEqual(rawPoints.map((item) => item.x), [38, 352])
}

function testOnePointTrendIsCentered() {
  const record = exam('one', 650, PRODUCT_RULES.builtInScoreSchemes[0])
  const points = calculateChartPoints(getVisibleTrendRecords([record], 10, 'rate'), 390, 280, 38)
  assert.strictEqual(points[0].x, 195)
}

function testSubjectRateUsesHistoricalMax() {
  const records = [
    exam('subject-1', 50, customScheme('s-100', 100), {
      examDate: '2026-08-01', subjectScores: [{ subjectId: 'math', subjectName: '数学', score: 50, maxScore: 100 }]
    }),
    exam('subject-2', 90, customScheme('s-120', 120), {
      examDate: '2026-08-02', subjectScores: [{ subjectId: 'math', subjectName: '数学', score: 90, maxScore: 120 }]
    })
  ]
  const analysis = analyzeSubject(records, 'math', [{ subjectId: 'math', subjectName: '数学', maxScore: 100 }], { metric: 'rate' })
  assert.deepStrictEqual(analysis.statistics.recentPoints.map((item) => item.score), [50, 75])
  assert.strictEqual(analysis.statistics.average, 62.5)
}

function testFormalPageEntryAndNoDirectStorage() {
  const app = JSON.parse(fs.readFileSync(path.join(__dirname, '../../app.json'), 'utf8'))
  const profile = fs.readFileSync(path.join(__dirname, '../../pages/profile/profile.wxml'), 'utf8')
  const score = fs.readFileSync(path.join(__dirname, '../../pages/score-trend/score-trend.wxml'), 'utf8')
  const page = fs.readFileSync(path.join(__dirname, '../../pages/exam-settings/exam-settings.js'), 'utf8')
  assert.ok(app.pages.includes('pages/exam-settings/exam-settings'))
  assert.match(profile, /考试模板与分值方案/)
  assert.match(score, /总分得分率/)
  assert.doesNotMatch(page, /wx\.(?:setStorage|setStorageSync|removeStorage|removeStorageSync)/)
}

function testTemplateAndSchemeProfileIsolation() {
  const { storage } = setup()
  assert.strictEqual(storage.saveScoreScheme({
    ...customScheme('profile-one-scheme', 100, 'partial_total'), createdAt: now(), updatedAt: now()
  }, { operationId: 'profile-one-scheme' }).ok, true)
  assert.strictEqual(storage.saveExamTemplate({
    id: 'profile-one-template', name: '档案一模板', examType: 'custom', scoreSchemeId: 'profile-one-scheme',
    createdAt: now(), updatedAt: now()
  }, { operationId: 'profile-one-template' }).ok, true)
  assert.strictEqual(storage.createStudentProfile({ id: 'profile-two', nickname: '档案二' }).ok, true)
  assert.strictEqual(storage.switchStudentProfile('profile-two').ok, true)
  assert.strictEqual(storage.getCustomScoreSchemes().length, 0)
  assert.strictEqual(storage.getCustomExamTemplates().length, 0)
  assert.strictEqual(storage.getScoreSchemes().some((item) => item.id === 'suzhou_admission_740_v1'), true)
}

function testRecommendationUsesLatestEligibleExam() {
  const eligible = exam('eligible', 650, PRODUCT_RULES.builtInScoreSchemes[0], {
    examType: 'monthly_exam', examDate: '2026-08-01'
  })
  const laterIneligible = exam('later-weekly', 90, customScheme('weekly-100', 100), {
    examType: 'weekly_test', examDate: '2026-08-02'
  })
  const current = selectCurrentScore([eligible, laterIneligible], {}, {
    requireRecommendationEligible: true,
    allowDraftFallback: false
  })
  assert.strictEqual(current.record.id, 'eligible')
  const trajectory = selectGapTrajectory([eligible, laterIneligible], { year: 2026, minScore: 655 })
  assert.deepStrictEqual(trajectory.map((item) => item.recordId), ['eligible'])
}

function testHistoricalGapBoundaryCopy() {
  const required = '分组仅根据用户选择的历史成绩与学校历史公开分数线计算分差，不考虑招生计划、排名、指标生、批次变化、政策变化和当年试卷难度，不构成录取判断或志愿建议。'
  for (const relative of [
    '../../pages/targets/targets.wxml',
    '../../pages/schools/schools.wxml',
    '../../pages/school-detail/school-detail.wxml',
    '../../pages/school-compare/school-compare.wxml'
  ]) {
    const source = fs.readFileSync(path.join(__dirname, relative), 'utf8')
    assert.ok(source.includes(required), relative)
    assert.ok(source.includes('历史公开数据整理，仅供目标规划参考。'), relative)
  }
}

function run() {
  return [
    runTest('V1-EXAM-001', testBuiltInsAreRuleBackedAndImmutable),
    runTest('V1-EXAM-002', testCustomTemplateCrudVersionAndReferences),
    runTest('V1-EXAM-003', testCustomSchemeSnapshotIsImmutable),
    runTest('V1-EXAM-010', testUnrelatedExamEditKeepsHistoricalSchemeSnapshot),
    runTest('V1-EXAM-004', testDifferentMaxScoresAndEligibility),
    runTest('V1-EXAM-005', testIncompleteSnapshotIsIneligible),
    runTest('V1-TREND-001', testRawAndRateTrendShareX),
    runTest('V1-TREND-002', testOnePointTrendIsCentered),
    runTest('V1-TREND-003', testSubjectRateUsesHistoricalMax),
    runTest('V1-EXAM-006', testFormalPageEntryAndNoDirectStorage),
    runTest('V1-EXAM-007', testTemplateAndSchemeProfileIsolation),
    runTest('V1-EXAM-008', testRecommendationUsesLatestEligibleExam),
    runTest('V1-EXAM-009', testHistoricalGapBoundaryCopy)
  ]
}

module.exports = { run }
