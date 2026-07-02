const { APP_CONFIG } = require('../../config/app-config')

Page({
  data: { boundaries: APP_CONFIG.policy.dataInfoBoundaries }
})
