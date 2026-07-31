const assert = require('assert')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const inventory = JSON.parse(fs.readFileSync(
  path.join(root, 'docs/rc11_1_feature_inventory.json'),
  'utf8'
))
const statuses = new Set([
  'implemented',
  'partial',
  'unreachable',
  'duplicated',
  'test-only',
  'obsolete',
  'migration-only'
])
const decisions = new Set(['keep', 'fix', 'redirect', 'migrate-only', 'remove'])
const ids = new Set()

assert.ok(Array.isArray(inventory))
assert.ok(inventory.length >= 40, `feature inventory only has ${inventory.length} items`)
for (const item of inventory) {
  assert.ok(item.featureId && !ids.has(item.featureId), `duplicate featureId ${item.featureId}`)
  ids.add(item.featureId)
  assert.ok(statuses.has(item.status), `${item.featureId} has invalid status`)
  assert.ok(decisions.has(item.decision), `${item.featureId} has invalid decision`)
  if (item.status === 'implemented') {
    assert.ok(item.formalEntry, `${item.featureId} is implemented without formalEntry`)
    assert.ok(item.tests.length, `${item.featureId} is implemented without tests`)
  }
  if (item.status === 'obsolete') assert.deepStrictEqual(item.routes, [])
  if (item.status === 'migration-only') assert.deepStrictEqual(item.pages, [])
  if (item.status === 'duplicated') assert.notStrictEqual(item.decision, 'keep')
  for (const field of [
    'routes', 'pages', 'controllers', 'services', 'repositories',
    'storageAdapters', 'storageKeys', 'models', 'migrationFunctions',
    'backupFields', 'clearHandlers', 'refreshConsumers', 'tests', 'issues'
  ]) {
    assert.ok(Array.isArray(item[field]), `${item.featureId}.${field} must be an array`)
    assert.ok(item[field].every((value) => typeof value === 'string' && value.trim()))
  }
  for (const file of [...item.pages, ...item.services, ...item.storageAdapters, ...item.models, ...item.tests]) {
    assert.ok(fs.existsSync(path.join(root, file)), `${item.featureId} references missing ${file}`)
  }
}

console.log(`RC11-1 FEATURE INVENTORY PASSED (${inventory.length} features)`)
