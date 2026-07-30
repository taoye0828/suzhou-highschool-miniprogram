// RC10 single storage entrypoint.
//
// Legacy local keys and conversion rules are isolated in storage-migration.js.
// User-facing pages must only call this versioned, transactional service.
module.exports = require('./rc9-storage')
