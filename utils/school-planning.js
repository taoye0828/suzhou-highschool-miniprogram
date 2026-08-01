const CANDIDATE_STATUS_LABELS = Object.freeze({
  none: '未设置',
  exploring: '了解中',
  focused: '重点关注',
  not_considering: '暂不考虑'
})

function text(value) {
  return String(value || '').trim().toLowerCase()
}

function enrichSchoolUserData(school, states, targets, primarySchoolId) {
  const state = (states || []).find((item) => item.schoolId === school.id) || {
    candidateStatus: 'none', tags: [], note: '', customOrder: 0
  }
  const target = (targets || []).find((item) => item.schoolId === school.id) || null
  return {
    ...school,
    candidateStatus: state.candidateStatus,
    candidateStatusLabel: CANDIDATE_STATUS_LABELS[state.candidateStatus] || CANDIDATE_STATUS_LABELS.none,
    userTags: state.tags || [],
    userNote: state.note || '',
    customOrder: state.customOrder || 0,
    targetLevel: target && target.level || '',
    isTargetSchool: Boolean(target),
    isPrimaryTarget: school.id === primarySchoolId
  }
}

function filterByUserPlanning(schools, filters = {}) {
  const statuses = new Set(filters.candidateStatuses || [])
  const tags = new Set(filters.tags || [])
  const recentViewed = new Set(filters.recentViewedSchoolIds || [])
  const recentCompared = new Set(filters.recentComparedSchoolIds || [])
  return (schools || []).filter((school) => {
    if (statuses.size && !statuses.has(school.candidateStatus)) return false
    if (tags.size && !(school.userTags || []).some((tag) => tags.has(tag))) return false
    if (filters.hasNoteOnly && !text(school.userNote)) return false
    if (filters.recentViewedOnly && !recentViewed.has(school.id)) return false
    if (filters.recentComparedOnly && !recentCompared.has(school.id)) return false
    if (filters.targetOnly && !school.isTargetSchool) return false
    if (filters.primaryOnly && !school.isPrimaryTarget) return false
    return true
  })
}

function globalSearchCurrentProfile({ keyword, schools, exams, targets, tasks, schoolUserStates }) {
  const query = text(keyword)
  if (!query) return []
  const results = []
  for (const school of schools || []) {
    const state = (schoolUserStates || []).find((item) => item.schoolId === school.id)
    const haystack = [school.name, ...(school.aliases || []), ...(state && state.tags || []), state && state.note]
      .map(text).join(' ')
    if (haystack.includes(query)) results.push({ type: 'school', id: school.id, title: school.name, subtitle: '学校' })
  }
  for (const exam of exams || []) {
    if ([exam.examName, exam.examDate, exam.notes].map(text).join(' ').includes(query)) {
      results.push({ type: 'exam', id: exam.id, title: exam.examName, subtitle: `${exam.examDate || exam.date || ''} · 成绩` })
    }
  }
  for (const target of targets || []) {
    if ([target.schoolName, target.level].map(text).join(' ').includes(query)) {
      results.push({ type: 'target', id: target.id, title: target.schoolName, subtitle: '目标学校' })
    }
  }
  for (const task of tasks || []) {
    if ([task.title, task.subjectName, task.notes, task.sourceTitleSnapshot].map(text).join(' ').includes(query)) {
      results.push({ type: 'task', id: task.id, title: task.title, subtitle: '学习任务' })
    }
  }
  return results.slice(0, 100)
}

module.exports = {
  CANDIDATE_STATUS_LABELS,
  enrichSchoolUserData,
  filterByUserPlanning,
  globalSearchCurrentProfile
}
