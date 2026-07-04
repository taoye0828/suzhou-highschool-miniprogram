const { schools } = require('../data/schools')

function uniqueValues(field) {
  return ['全部', ...new Set(schools.map((school) => school[field]).filter(Boolean))]
}

function sourceTypeLabel(dataKind) {
  const labels = {
    official_public: '公开资料',
    official_site: '学校官网',
    government_public: '政府公开',
    needs_review: '待复核',
    demo: '示例数据'
  }
  return labels[dataKind] || '待复核'
}

function isDemoSchool(school) {
  return school && school.dataKind === 'demo'
}

function filterSchools({
  keyword = '',
  district = '全部',
  schoolType = '全部',
  ownership = '全部',
  boardingType = '全部',
  dataStatus = '全部'
}) {
  const query = keyword.trim().toLowerCase()
  return schools.filter((school) => {
    const searchable = [
      school.name,
      school.district,
      school.schoolType,
      school.ownership,
      ...(Array.isArray(school.tags) ? school.tags : [])
    ].join(' ').toLowerCase()
    return (!query || searchable.includes(query)) &&
      (district === '全部' || school.district === district) &&
      (schoolType === '全部' || school.schoolType === schoolType) &&
      (ownership === '全部' || school.ownership === ownership) &&
      (boardingType === '全部' || school.boardingType === boardingType) &&
      (dataStatus === '全部' || school.dataStatus === dataStatus)
  })
}

function getSchoolById(id) {
  return schools.find((school) => school.id === id)
}

function withFavoriteState(items, favoriteIds) {
  return items.map((school) => ({
    ...school,
    isDemo: isDemoSchool(school),
    sourceTypeLabel: sourceTypeLabel(school.dataKind),
    isFavorite: favoriteIds.includes(school.id)
  }))
}

module.exports = {
  schools,
  uniqueValues,
  sourceTypeLabel,
  isDemoSchool,
  filterSchools,
  getSchoolById,
  withFavoriteState
}
