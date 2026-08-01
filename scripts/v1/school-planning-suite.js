const fs = require('fs')
const path = require('path')
const { assert, setup, runTest } = require('./test-helpers')
const {
  enrichSchoolUserData,
  filterByUserPlanning,
  globalSearchCurrentProfile
} = require('../../utils/school-planning')
const {
  createReportSnapshot,
  reportToText,
  reportToJson,
  writeReportFile,
  RECOMMENDATION_NOTICE
} = require('../../utils/report-export')

const NOW = '2026-08-01T08:00:00.000Z'

function state(id, schoolId, status, tags = [], note = '') {
  return { id, schoolId, candidateStatus: status, tags, note, customOrder: 0, createdAt: NOW, updatedAt: NOW }
}

function testSchoolUserStateCrudVersionAndIsolation() {
  const { storage } = setup()
  const created = storage.saveSchoolUserState(state('s1', 'school-a', 'focused', ['重点'], '离家近'), { operationId: 'state-create' })
  assert.strictEqual(created.ok, true)
  assert.strictEqual(storage.getSchoolUserState('school-a').candidateStatus, 'focused')
  assert.strictEqual(storage.saveSchoolUserState({ ...created.record, note: '冲突', expectedVersion: 99 }, { operationId: 'state-conflict' }).code, 'VERSION_CONFLICT')
  assert.strictEqual(storage.createStudentProfile({ id: 'profile-two', nickname: '档案二' }).ok, true)
  assert.strictEqual(storage.switchStudentProfile('profile-two').ok, true)
  assert.strictEqual(storage.getSchoolUserStates().length, 0)
}

function testUserPlanningFilterOrWithinAndAcross() {
  const schools = [
    enrichSchoolUserData({ id: 'a', name: 'A' }, [state('a', 'a', 'focused', ['公办'], '备注')], [{ schoolId: 'a', level: 'target' }], 'a'),
    enrichSchoolUserData({ id: 'b', name: 'B' }, [state('b', 'b', 'exploring', ['特色'], '')], [], ''),
    enrichSchoolUserData({ id: 'c', name: 'C' }, [state('c', 'c', 'not_considering', ['公办'], '备注')], [], '')
  ]
  assert.deepStrictEqual(filterByUserPlanning(schools, { candidateStatuses: ['focused', 'exploring'] }).map((item) => item.id), ['a', 'b'])
  assert.deepStrictEqual(filterByUserPlanning(schools, { candidateStatuses: ['focused', 'exploring'], tags: ['公办'], hasNoteOnly: true }).map((item) => item.id), ['a'])
  assert.deepStrictEqual(filterByUserPlanning(schools, { recentViewedOnly: true, recentViewedSchoolIds: ['b'] }).map((item) => item.id), ['b'])
  assert.deepStrictEqual(filterByUserPlanning(schools, { primaryOnly: true }).map((item) => item.id), ['a'])
}

function testCompareUserDimensionsHaveNoRankingScore() {
  const item = enrichSchoolUserData({ id: 'a', name: 'A' }, [state('a', 'a', 'focused', ['重点'], '备注')], [{ schoolId: 'a', level: 'sprint' }], 'a')
  assert.deepStrictEqual([item.candidateStatusLabel, item.targetLevel, item.isPrimaryTarget, item.userTags[0], item.userNote], ['重点关注', 'sprint', true, '重点', '备注'])
  assert.strictEqual(item.recommendationIndex, undefined)
  assert.strictEqual(item.compositeScore, undefined)
}

function testGlobalSearchOnlyUsesPassedCurrentProfileData() {
  const results = globalSearchCurrentProfile({
    keyword: '数学',
    schools: [{ id: 'school-a', name: '学校A', aliases: [] }],
    exams: [{ id: 'exam-a', examName: '数学月考', examDate: '2026-08-01' }],
    targets: [],
    tasks: [{ id: 'task-a', title: '数学订正' }],
    schoolUserStates: []
  })
  assert.deepStrictEqual(results.map((item) => item.id), ['exam-a', 'task-a'])
  assert.strictEqual(results.some((item) => item.id === 'other-profile-private'), false)
}

function testScoreAndTargetReportsAreImmutableAndScoped() {
  const profile = { id: 'p1', nickname: '当前档案' }
  const data = {
    scoreRecords: [{ id: 'e1', examName: '月考', examDate: '2026-08-01', totalScore: 650, totalMaxScore: 740, scoreRateBasisPoints: 8784 }],
    targetRecords: [{ id: 't1', schoolId: 's1', schoolName: '学校一', level: 'target' }],
    schoolUserStates: [state('s1', 's1', 'focused', ['重点'], '备注'), state('s2', 's2', 'exploring')]
  }
  const score = createReportSnapshot('score_stage', profile, data, NOW)
  const target = createReportSnapshot('target_school', profile, data, NOW)
  data.scoreRecords[0].totalScore = 700
  data.targetRecords[0].schoolName = '后来修改'
  assert.strictEqual(score.records[0].totalScore, 650)
  assert.strictEqual(target.targets[0].schoolName, '学校一')
  assert.strictEqual(target.schoolUserStates.length, 1)
  assert.strictEqual(target.recommendationNotice, RECOMMENDATION_NOTICE)
}

function testTextJsonAndFileOutput() {
  const snapshot = createReportSnapshot('score_stage', { id: 'p1', nickname: '档案' }, {
    scoreRecords: [{ id: 'e1', examName: '月考', examDate: '2026-08-01', totalScore: 650, totalMaxScore: 740, scoreRateBasisPoints: 8784 }]
  }, NOW)
  assert.match(reportToText(snapshot), /历史公开数据整理，仅供目标规划参考/)
  assert.strictEqual(JSON.parse(reportToJson(snapshot)).profile.id, 'p1')
  const writes = []
  const result = writeReportFile(snapshot, 'json', {
    env: { USER_DATA_PATH: '/tmp/user-data' },
    getFileSystemManager: () => ({ writeFileSync: (...args) => writes.push(args) })
  })
  assert.strictEqual(result.ok, true)
  assert.strictEqual(writes.length, 1)
  assert.match(result.fileName, /\.json$/)
}

function testFormalPagesFiltersAndPrivacyCopy() {
  const app = JSON.parse(fs.readFileSync(path.join(__dirname, '../../app.json'), 'utf8'))
  assert.ok(app.pages.includes('pages/global-search/global-search'))
  assert.ok(app.pages.includes('pages/reports/reports'))
  assert.strictEqual(app.tabBar.list.length, 5)
  const schools = fs.readFileSync(path.join(__dirname, '../../pages/schools/schools.wxml'), 'utf8')
  const compare = fs.readFileSync(path.join(__dirname, '../../pages/school-compare/school-compare.wxml'), 'utf8')
  const reports = fs.readFileSync(path.join(__dirname, '../../pages/reports/reports.js'), 'utf8')
  assert.match(schools, /候选状态/)
  assert.match(schools, /最近浏览/)
  assert.match(schools, /最近对比/)
  assert.match(compare, /个人标签/)
  assert.match(compare, /主要目标/)
  assert.match(reports, /请只发送给可信接收方/)
  assert.doesNotMatch(compare, /综合评分|推荐指数|最佳学校|录取概率/)
}

function testNoPageDirectStorageWrites() {
  for (const relative of [
    '../../pages/school-detail/school-detail.js', '../../pages/schools/schools.js',
    '../../pages/global-search/global-search.js', '../../pages/reports/reports.js'
  ]) {
    const source = fs.readFileSync(path.join(__dirname, relative), 'utf8')
    assert.doesNotMatch(source, /wx\.(?:setStorage|setStorageSync|removeStorage|removeStorageSync)/)
  }
}

function run() {
  return [
    runTest('V1-SCHOOL-001', testSchoolUserStateCrudVersionAndIsolation),
    runTest('V1-SCHOOL-002', testUserPlanningFilterOrWithinAndAcross),
    runTest('V1-SCHOOL-003', testCompareUserDimensionsHaveNoRankingScore),
    runTest('V1-SEARCH-001', testGlobalSearchOnlyUsesPassedCurrentProfileData),
    runTest('V1-REPORT-001', testScoreAndTargetReportsAreImmutableAndScoped),
    runTest('V1-REPORT-002', testTextJsonAndFileOutput),
    runTest('V1-SCHOOL-004', testFormalPagesFiltersAndPrivacyCopy),
    runTest('V1-SCHOOL-005', testNoPageDirectStorageWrites)
  ]
}

module.exports = { run }
