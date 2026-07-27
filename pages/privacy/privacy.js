const { APP_CONFIG } = require('../../config/app-config')

Page({
  data: {
    appName: APP_CONFIG.name,
    sections: APP_CONFIG.policy.privacySections
  }
})
