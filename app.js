const { APP_CONFIG } = require('./config/app-config')
const { ensureStorageMigrated, recoverStartupState } = require('./utils/storage')

App({
  onLaunch() {
    const migration = ensureStorageMigrated()
    if (migration.ok) recoverStartupState()
  },

  globalData: {
    appName: APP_CONFIG.name
  }
})
