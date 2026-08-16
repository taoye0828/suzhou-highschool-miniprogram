function classifyShareError(error) {
  const message = String(error && (error.errMsg || error.message) || '')
  return /cancel/iu.test(message)
    ? { status: 'cancelled', code: 'SHARE_CANCELLED', message: '已取消发送，未记录为成功。' }
    : { status: 'failed', code: 'SHARE_FAILED', message: '备份文件没有发送成功，请稍后重试。' }
}

class FileShareAdapter {
  constructor(api = typeof wx === 'undefined' ? null : wx) {
    this.api = api
  }

  shareFile({ filePath, fileName = '' }) {
    if (!filePath) return Promise.resolve({ ok: false, status: 'failed', code: 'FILE_PATH_REQUIRED' })
    if (!this.api || typeof this.api.shareFileMessage !== 'function') {
      return Promise.resolve({
        ok: false,
        status: 'unsupported',
        code: 'SHARE_UNSUPPORTED',
        message: '当前微信版本不支持发送备份文件，请更新微信后重试。'
      })
    }
    return new Promise((resolve) => {
      try {
        this.api.shareFileMessage({
          filePath,
          fileName,
          success: () => resolve({ ok: true, status: 'shared', filePath, fileName }),
          fail: (error) => resolve({ ok: false, ...classifyShareError(error), filePath, fileName })
        })
      } catch (error) {
        resolve({ ok: false, ...classifyShareError(error), filePath, fileName })
      }
    })
  }
}

module.exports = { classifyShareError, FileShareAdapter }
