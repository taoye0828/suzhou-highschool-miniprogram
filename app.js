const { APP_CONFIG } = require('./config/app-config')

App({
  globalData: {
    appName: APP_CONFIG.name,
    version: APP_CONFIG.version
  }
})
