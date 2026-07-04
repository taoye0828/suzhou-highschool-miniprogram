function mapSearchKeyword(schoolName) {
  return `${schoolName.trim()} 苏州`
}

function copyText(text, successMessage) {
  wx.setClipboardData({
    data: text,
    success: () => wx.showToast({ title: successMessage, icon: 'success' }),
    fail: () => wx.showToast({ title: '复制失败，请稍后重试。', icon: 'none' })
  })
}

module.exports = { mapSearchKeyword, copyText }
