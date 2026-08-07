const assert = require('assert')
const { installWxStorage, loadStorageFresh, makeExam } = require('./rc9_test_helpers')
const { schools } = require('../data/schools')
const { admissionScores } = require('../data/admission-scores')
const { EXAM_TOTAL_SCORE } = require('../config/app-config')
const { calculateExamCountdown } = require('../utils/countdown')
const { selectLatestReference, referenceScoreValue } = require('../utils/planning')

installWxStorage()
const storage = loadStorageFresh()
assert.strictEqual(storage.ensureStorageMigrated().ok, true)

assert.strictEqual(schools.length, 55)
assert.strictEqual(admissionScores.length, 146)
assert.strictEqual(admissionScores.filter((item) => item.year === 2025).length, 103)
assert.strictEqual(admissionScores.filter((item) => item.year === 2026).length, 43)
assert.ok(admissionScores.every((item) => Number.isInteger(item.minScore) && item.minScore <= EXAM_TOTAL_SCORE))

assert.strictEqual(storage.saveScoreRecord(makeExam('smoke-score', 650)).ok, true)
assert.strictEqual(storage.getScoreRecords()[0].totalScore, 650)
assert.strictEqual(storage.saveScoreRecord(makeExam('smoke-invalid', 741)).ok, false)

const school = schools[0]
const reference = selectLatestReference(admissionScores, { schoolId: school.id })
assert.strictEqual(storage.saveTargetRecord({
  id: `target_${school.id}`,
  schoolId: school.id,
  schoolName: school.name,
  referenceScore: reference ? referenceScoreValue(reference) : null,
  referenceYear: reference ? reference.year : null,
  createdAt: '2026-08-07T00:00:00.000Z'
}).ok, true)
assert.strictEqual(storage.getTargetRecords().length, 1)
assert.strictEqual(storage.deleteTargetRecord(`target_${school.id}`).ok, true)
assert.strictEqual(storage.getTargetRecords().length, 0)

const countdown = calculateExamCountdown(2027, new Date(2026, 7, 7))
assert.strictEqual(countdown.targetDate, '2027-06-17')
assert.ok(countdown.daysRemaining > 0)

const backup = require('../utils/backup-restore')
const envelope = backup.createBackupEnvelope({ exportedAt: '2026-08-07T00:00:00.000Z' })
assert.strictEqual(envelope.ok, true)
assert.strictEqual(backup.validateBackupEnvelope(envelope.backup).ok, true)

console.log('SMOKE LOCAL LOGIC PASSED')
