const { schools: defaultSchools } = require('../data/schools')

function normalizeSearchText(value) {
  return String(value || '').replace(/\s+/gu, '').toLowerCase()
}

function splitKeyword(keyword) {
  return Array.from(normalizeSearchText(keyword))
}

function charactersInOrder(keywordCharacters, text) {
  if (!keywordCharacters.length) return true
  let textIndex = 0
  for (const character of keywordCharacters) {
    textIndex = text.indexOf(character, textIndex)
    if (textIndex < 0) return false
    textIndex += character.length
  }
  return true
}

function charactersPresent(keywordCharacters, text) {
  return keywordCharacters.every((character) => text.includes(character))
}

function normalizedAliases(school) {
  const aliases = Array.isArray(school && school.aliases)
    ? school.aliases
    : school && school.alias
      ? [school.alias]
      : []
  return aliases.map(normalizeSearchText).filter(Boolean)
}

function contextText(school) {
  return normalizeSearchText([
    school && school.district,
    school && school.schoolType,
    school && school.ownership,
    school && school.address,
    school && school.campus,
    ...(Array.isArray(school && school.tags) ? school.tags : [])
  ].filter(Boolean).join(''))
}

function schoolMatchRank(school, keyword) {
  const query = normalizeSearchText(keyword)
  if (!query) return 0

  const characters = splitKeyword(query)
  const name = normalizeSearchText(school && school.name)
  const aliases = normalizedAliases(school)

  if (name.includes(query)) return 0
  if (aliases.some((alias) => alias.includes(query))) return 1
  if ([name, ...aliases].some((value) => charactersInOrder(characters, value))) return 2

  const schoolNames = [name, ...aliases].join('')
  if (charactersPresent(characters, schoolNames)) return 3

  const context = contextText(school)
  if (
    context.includes(query) ||
    charactersInOrder(characters, context) ||
    charactersPresent(characters, context)
  ) {
    return 3
  }
  return null
}

function searchSchools({
  schools = defaultSchools,
  keyword = '',
  limit
} = {}) {
  const items = Array.isArray(schools) ? schools : []
  const query = normalizeSearchText(keyword)
  const matches = query
    ? items
      .map((school, index) => ({
        school,
        index,
        rank: schoolMatchRank(school, query)
      }))
      .filter((item) => item.rank !== null)
      .sort((left, right) => {
        const rankCompare = left.rank - right.rank
        if (rankCompare !== 0) return rankCompare
        const lengthCompare = normalizeSearchText(left.school.name).length -
          normalizeSearchText(right.school.name).length
        return lengthCompare !== 0 ? lengthCompare : left.index - right.index
      })
      .map((item) => item.school)
    : [...items]

  return Number.isInteger(limit) && limit >= 0 ? matches.slice(0, limit) : matches
}

module.exports = {
  normalizeSearchText,
  splitKeyword,
  charactersInOrder,
  charactersPresent,
  schoolMatchRank,
  searchSchools
}
