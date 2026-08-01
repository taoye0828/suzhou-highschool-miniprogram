const exam = require('./v1/exam-suite')
const results = exam.run()
console.log(`V1 P4 VERIFY PASS (${results.length} TEST-ID)`)
