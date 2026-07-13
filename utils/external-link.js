const MAX_EXTERNAL_URL_LENGTH = 2048

function normalizeExternalUrl(value) {
  const url = typeof value === 'string' ? value.trim() : ''
  if (!url || url.length > MAX_EXTERNAL_URL_LENGTH) return ''
  if (!/^https:\/\/[^\s/]+(?:[/?#:]|$)/i.test(url)) return ''
  if (/^https:\/\/[^/]*@/i.test(url)) return ''
  return url
}

function externalLinkRoute(value) {
  const url = normalizeExternalUrl(value)
  return url ? `/pages/web-view/web-view?url=${encodeURIComponent(url)}` : ''
}

function openExternalLink(value) {
  const route = externalLinkRoute(value)
  if (!route) {
    wx.showToast({ title: '来源链接无效，无法打开。', icon: 'none' })
    return false
  }
  wx.navigateTo({
    url: route,
    fail: () => wx.showModal({
      title: '官方页面打开失败',
      content: '请检查网络或微信业务域名配置，也可复制链接后使用系统浏览器打开。',
      showCancel: false
    })
  })
  return true
}

module.exports = { normalizeExternalUrl, externalLinkRoute, openExternalLink }
