const { APP_CONFIG } = require('../../config/app-config')

Page({
  data: { sections: APP_CONFIG.policy.privacySections }
})
