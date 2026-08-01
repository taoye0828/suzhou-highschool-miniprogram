let sequence = 0

function safePart(value, fallback) {
  const normalized = String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .slice(0, 80)
  return normalized || fallback
}

function createOperationId(operationType, entityId = '', now = Date.now()) {
  sequence = (sequence + 1) % 1000000
  return [
    safePart(operationType, 'operation'),
    safePart(entityId, 'global'),
    String(now),
    String(sequence).padStart(6, '0')
  ].join('_')
}

function createOperationContext({
  operationId,
  operationType,
  profileId = '',
  entityId = '',
  expectedVersion = 0,
  startedAt = new Date().toISOString()
} = {}) {
  const type = safePart(operationType, 'operation')
  return {
    operationId: safePart(operationId, '') || createOperationId(type, entityId),
    operationType: type,
    profileId: String(profileId || '').slice(0, 120),
    entityId: String(entityId || '').slice(0, 120),
    expectedVersion: Number.isInteger(Number(expectedVersion)) ? Number(expectedVersion) : 0,
    startedAt
  }
}

function operationOptions(operationType, entityId = '', extra = {}) {
  return {
    ...extra,
    operationContext: createOperationContext({
      ...extra,
      operationType,
      entityId,
      operationId: extra.operationId
    })
  }
}

module.exports = {
  createOperationId,
  createOperationContext,
  operationOptions
}
