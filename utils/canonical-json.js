const { PRODUCT_RULES } = require('./generated/product-rules')

const FORBIDDEN_KEYS = new Set(PRODUCT_RULES.forbiddenObjectKeys)

function canonicalValue(value, { depth = 0, maxDepth = PRODUCT_RULES.limits.maxJsonDepth } = {}) {
  if (depth > maxDepth) throw Object.assign(new Error('JSON depth exceeded'), { code: 'JSON_DEPTH_EXCEEDED' })
  if (value === undefined) return undefined
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('canonical JSON only accepts finite numbers')
    return Object.is(value, -0) ? 0 : value
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => canonicalValue(item, { depth: depth + 1, maxDepth }))
      .filter((item) => item !== undefined)
  }
  if (!value || typeof value !== 'object') throw new TypeError('unsupported canonical JSON value')
  return Object.keys(value).sort().reduce((result, key) => {
    if (FORBIDDEN_KEYS.has(key)) {
      throw Object.assign(new Error(`dangerous object key: ${key}`), { code: 'DANGEROUS_OBJECT_KEY' })
    }
    const normalized = canonicalValue(value[key], { depth: depth + 1, maxDepth })
    if (normalized !== undefined) result[key] = normalized
    return result
  }, {})
}

function canonicalJson(value, options) {
  return JSON.stringify(canonicalValue(value, options))
}

function assertSafeJsonValue(value, options) {
  canonicalValue(value, options)
  return true
}

module.exports = { FORBIDDEN_KEYS, canonicalValue, canonicalJson, assertSafeJsonValue }
