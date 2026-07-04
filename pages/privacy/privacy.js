const { APP_CONFIG } = require('../../config/app-config')

Page({
  data: { items: APP_CONFIG.policy.privacyItems }
})
