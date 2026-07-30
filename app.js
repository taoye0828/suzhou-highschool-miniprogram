const { APP_CONFIG } = require('./config/app-config')
const { ensureStorageMigrated } = require('./utils/storage')

App({
  onLaunch() {
    const migration = ensureStorageMigrated()
    this.globalData.storageMigration = migration
  },

  globalData: {
    appName: APP_CONFIG.name,
    version: APP_CONFIG.version,
    storageMigration: null,
    targetCenterSegment: 'recommendation',
    scoreCenterSegment: 'records'
  }
})
