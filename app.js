const { APP_CONFIG } = require('./config/app-config')
const { ensureStorageMigrated, recoverStartupState } = require('./utils/storage')

App({
  onLaunch() {
    const migration = ensureStorageMigrated()
    this.globalData.storageMigration = migration
    this.globalData.startupRecovery = migration.ok ? recoverStartupState() : null
  },

  globalData: {
    appName: APP_CONFIG.name,
    version: APP_CONFIG.version,
    storageMigration: null,
    startupRecovery: null,
    targetCenterSegment: 'recommendation',
    scoreCenterSegment: 'records'
  }
})
