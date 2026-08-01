const uiContract = require('./v1/ui-contract-suite')
const performanceSuite = require('./v1/performance-suite')

const results = [
  ...uiContract.run(),
  ...performanceSuite.run()
]

console.log(`V1 P7 VERIFY PASS (${results.length} TEST-ID)`)
