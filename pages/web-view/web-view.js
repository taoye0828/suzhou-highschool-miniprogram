const { normalizeExternalUrl } = require('../../utils/external-link')

function decodeUrlOption(value) {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (/^https:\/\//i.test(raw)) return raw
  try {
    return decodeURIComponent(raw)
  } catch (error) {
    return ''
  }
}

Page({
  data: { url: '' },

  onLoad(options) {
    const url = normalizeExternalUrl(decodeUrlOption(options && options.url))
    this.setData({ url })
    if (!url) {
      wx.showModal({
        title: '来源链接无效',
        content: '该链接不是可安全打开的 HTTPS 官方页面，请返回详情复制链接后核对。',
        showCancel: false
      })
    }
  },

  onWebViewError() {
    wx.showModal({
      title: '官方页面打开失败',
      content: '请检查网络或微信业务域名配置，也可返回详情复制链接后使用系统浏览器打开。',
      showCancel: false
    })
  }
})
