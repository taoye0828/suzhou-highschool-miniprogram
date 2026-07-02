const { APP_CONFIG } = require('./config/app-config')

App({
  globalData: {
    appName: '苏州高中目标查询助手',
    version: APP_CONFIG.version
  }
})
