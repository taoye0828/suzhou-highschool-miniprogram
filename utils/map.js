function mapSearchKeyword(schoolName) {
  return `${schoolName.trim()} 苏州`
}

function copyText(text, successMessage) {
  const safeText = typeof text === 'string' ? text.trim() : ''
  if (!safeText) {
    wx.showToast({ title: '暂无可复制内容', icon: 'none' })
    return
  }
  wx.setClipboardData({
    data: safeText,
    success: () => wx.showToast({ title: successMessage, icon: 'success' }),
    fail: () => wx.showToast({ title: '复制失败，请稍后重试。', icon: 'none' })
  })
}

module.exports = { mapSearchKeyword, copyText }
