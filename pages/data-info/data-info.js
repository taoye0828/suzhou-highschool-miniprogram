const { APP_CONFIG } = require('../../config/app-config')

Page({
  data: {
    sections: APP_CONFIG.policy.dataInfoSections,
    dataVersion: APP_CONFIG.schoolData.version
  }
})
