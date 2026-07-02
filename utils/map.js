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

function showExternalMapGuide(schoolName) {
  const keyword = mapSearchKeyword(schoolName)
  wx.showModal({
    title: '外部地图搜索说明',
    content: `搜索词：${keyword}\n\n为避免收集定位或使用未经核验的坐标，本版本不直接调用地图。请复制搜索词后，自行打开常用地图应用搜索。`,
    confirmText: '复制搜索词',
    cancelText: '知道了',
    success: (result) => {
      if (result.confirm) copyText(keyword, '搜索词已复制')
    },
    fail: () => wx.showToast({ title: '说明窗口打开失败，请重试。', icon: 'none' })
  })
}

module.exports = { mapSearchKeyword, copyText, showExternalMapGuide }
