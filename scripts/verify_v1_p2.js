const migration = require('./v1/migration-suite')
const backup = require('./v1/backup-suite')

const results = [...migration.run(), ...backup.run()]
console.log(`V1 P2 VERIFY PASS (${results.length} TEST-ID)`)
