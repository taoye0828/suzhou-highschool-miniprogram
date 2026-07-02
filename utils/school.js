const { schools } = require('../data/schools')

function uniqueValues(field) {
  return ['全部', ...new Set(schools.map((school) => school[field]))]
}

function filterSchools({ keyword = '', district = '全部', schoolType = '全部', boardingType = '全部' }) {
  const query = keyword.trim().toLowerCase()
  return schools.filter((school) => {
    const searchable = `${school.name} ${school.district} ${school.schoolType}`.toLowerCase()
    return (!query || searchable.includes(query)) &&
      (district === '全部' || school.district === district) &&
      (schoolType === '全部' || school.schoolType === schoolType) &&
      (boardingType === '全部' || school.boardingType === boardingType)
  })
}

function getSchoolById(id) {
  return schools.find((school) => school.id === id)
}

function withFavoriteState(items, favoriteIds) {
  return items.map((school) => ({ ...school, isFavorite: favoriteIds.includes(school.id) }))
}

module.exports = { schools, uniqueValues, filterSchools, getSchoolById, withFavoriteState }
