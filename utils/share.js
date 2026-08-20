'use strict'

// 统一页面分享配置：标题使用正式名称，路径必须是 app.json 中真实注册的页面。
const { APP_CONFIG } = require('../config/app-config')

function shareConfig(path, query) {
  return {
    title: APP_CONFIG.name,
    path: query ? `${path}?${query}` : path,
    query: query || ''
  }
}

module.exports = { shareConfig }
