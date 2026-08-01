const transaction = require('./v1/transaction-suite')
const recovery = require('./v1/recovery-suite')

const results = [
  ...transaction.run(),
  ...recovery.run()
]

console.log(`V1 P1 VERIFY PASS (${results.length} TEST-ID)`)
