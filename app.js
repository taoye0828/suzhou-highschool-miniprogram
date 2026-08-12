const { APP_CONFIG } = require('./config/app-config')
const { ensureStorageMigrated, recoverStartupState } = require('./utils/storage')
const { publicDataService } = require('./utils/public-data-service')

App({
  onLaunch() {
    const migration = ensureStorageMigrated()
    if (migration.ok) recoverStartupState()
    publicDataService.loadInitial()
    publicDataService.refresh()
  },

  onShow() {
    publicDataService.refresh()
  },

  globalData: {
    appName: APP_CONFIG.name
  }
})
