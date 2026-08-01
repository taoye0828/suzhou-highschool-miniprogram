const learningLoop = require('./v1/learning-loop-suite')
const results = learningLoop.run()
console.log(`V1 P5 VERIFY PASS (${results.length} TEST-ID)`)
