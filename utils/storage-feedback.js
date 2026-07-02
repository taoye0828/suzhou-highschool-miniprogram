function notifyStorageReadResult(page, result) {
  if (result.ok) {
    page.storageReadErrorShown = false
    return
  }
  if (page.storageReadErrorShown) return
  page.storageReadErrorShown = true
  wx.showToast({ title: result.message, icon: 'none' })
}

module.exports = { notifyStorageReadResult }
