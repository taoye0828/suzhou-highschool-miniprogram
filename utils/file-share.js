function classifyShareError(error) {
  const message = String(error && (error.errMsg || error.message) || '')
  return /cancel/iu.test(message)
    ? { status: 'cancelled', code: 'SHARE_CANCELLED', message: '已取消发送，未记录为成功。' }
    : { status: 'failed', code: 'SHARE_FAILED', message: '文件发送失败，可稍后重试。' }
}

class FileShareAdapter {
  constructor(api = typeof wx === 'undefined' ? null : wx) {
    this.api = api
  }

  shareFile({ filePath, fileName = '' }) {
    if (!filePath) return Promise.resolve({ ok: false, status: 'failed', code: 'FILE_PATH_REQUIRED' })
    if (!this.api || typeof this.api.shareFileMessage !== 'function') {
      return Promise.resolve({ ok: false, status: 'unsupported', code: 'SHARE_UNSUPPORTED', message: '当前微信环境不支持发送文件。' })
    }
    return new Promise((resolve) => {
      this.api.shareFileMessage({
        filePath,
        fileName,
        success: () => resolve({ ok: true, status: 'shared', filePath }),
        fail: (error) => resolve({ ok: false, ...classifyShareError(error), filePath })
      })
    })
  }
}

module.exports = { classifyShareError, FileShareAdapter }
