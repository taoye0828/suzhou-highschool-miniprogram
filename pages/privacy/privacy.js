const { APP_CONFIG } = require('../../config/app-config')

Page({
  data: {
    nonCollectionItems: APP_CONFIG.policy.privacyNonCollection,
    nonIntegrationItems: APP_CONFIG.policy.privacyNonIntegration
  }
})
