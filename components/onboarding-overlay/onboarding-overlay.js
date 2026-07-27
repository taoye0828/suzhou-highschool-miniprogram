Component({
  properties: {
    visible: { type: Boolean, value: false },
    step: { type: Object, value: null }
  },

  data: {
    highlightStyle: 'left: 32rpx; top: 220rpx; width: 686rpx; height: 140rpx;',
    bubbleStyle: 'left: 32rpx; top: 390rpx; width: 686rpx;'
  },

  observers: {
    'visible,step': function syncTarget(visible, step) {
      if (!visible || !step) return
      this._measureAttempts = 0
      this.measureTarget()
    }
  },

  lifetimes: {
    detached() {
      if (this._measureTimer) clearTimeout(this._measureTimer)
    }
  },

  methods: {
    noop() {},
    measureTarget() {
      if (!this.properties.visible || !this.properties.step) return
      const query = wx.createSelectorQuery()
      query.select(this.properties.step.selector).boundingClientRect()
      query.exec((results) => {
        const rect = results && results[0]
        if (!rect && this._measureAttempts < 3) {
          this._measureAttempts += 1
          this._measureTimer = setTimeout(() => this.measureTarget(), 120)
          return
        }
        if (!rect) return
        const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
        const windowHeight = info.windowHeight || info.screenHeight || 700
        const padding = 8
        const left = Math.max(8, rect.left - padding)
        const top = Math.max(8, rect.top - padding)
        const width = Math.max(40, rect.width + padding * 2)
        const height = Math.max(40, rect.height + padding * 2)
        const bubbleTop = top + height + 12 + 180 < windowHeight
          ? top + height + 12
          : Math.max(12, top - 172)
        this.setData({
          highlightStyle: `left:${left}px;top:${top}px;width:${width}px;height:${height}px;`,
          bubbleStyle: `left:16px;top:${bubbleTop}px;width:calc(100% - 32px);`
        })
      })
    },
    previous() { this.triggerEvent('action', { action: 'previous' }) },
    next() {
      const isLast = this.properties.step &&
        this.properties.step.index === this.properties.step.total - 1
      this.triggerEvent('action', { action: isLast ? 'complete' : 'next' })
    },
    skip() { this.triggerEvent('action', { action: 'skip' }) }
  }
})
