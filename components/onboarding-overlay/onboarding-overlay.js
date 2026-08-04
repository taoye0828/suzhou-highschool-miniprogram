Component({
  properties: {
    visible: { type: Boolean, value: false },
    step: { type: Object, value: null }
  },

  data: {
    highlightVisible: false,
    highlightStyle: '',
    bubbleStyle: 'left:16px;bottom:calc(24px + env(safe-area-inset-bottom));width:calc(100% - 32px);'
  },

  observers: {
    'visible,step': function syncTarget(visible, step) {
      this._measureGeneration = (this._measureGeneration || 0) + 1
      if (!visible || !step) {
        if (this._measureTimer) clearTimeout(this._measureTimer)
        this.setData({ highlightVisible: false, highlightStyle: '' })
        return
      }
      if (this._measureTimer) clearTimeout(this._measureTimer)
      this._measureAttempts = 0
      this.setData({
        highlightVisible: false,
        highlightStyle: '',
        bubbleStyle: 'left:16px;bottom:calc(24px + env(safe-area-inset-bottom));width:calc(100% - 32px);'
      }, () => {
        const schedule = () => this.measureTarget()
        if (typeof wx.nextTick === 'function') wx.nextTick(schedule)
        else this._measureTimer = setTimeout(schedule, 0)
      })
    }
  },

  lifetimes: {
    detached() {
      this._measureGeneration = (this._measureGeneration || 0) + 1
      if (this._measureTimer) clearTimeout(this._measureTimer)
    }
  },

  methods: {
    noop() {},
    measureTarget() {
      if (!this.properties.visible || !this.properties.step) return
      if (typeof wx.createSelectorQuery !== 'function') return
      const generation = this._measureGeneration
      let query
      try {
        query = wx.createSelectorQuery()
        query.select(this.properties.step.selector).boundingClientRect()
      } catch (error) {
        return
      }
      query.exec((results) => {
        if (generation !== this._measureGeneration || !this.properties.visible) return
        const rect = results && results[0]
        const hasRect = rect &&
          Number.isFinite(Number(rect.left)) &&
          Number.isFinite(Number(rect.top)) &&
          Number.isFinite(Number(rect.width)) && Number(rect.width) > 0 &&
          Number.isFinite(Number(rect.height)) && Number(rect.height) > 0
        if (!hasRect && this._measureAttempts < 3) {
          this._measureAttempts += 1
          this._measureTimer = setTimeout(() => this.measureTarget(), 120)
          return
        }
        if (!hasRect) return
        const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
        const windowWidth = Number(info.windowWidth || info.screenWidth || 375)
        const windowHeight = Number(info.windowHeight || info.screenHeight || 700)
        const safeTop = Number(info.safeArea && info.safeArea.top || 0)
        const safeBottom = Number(
          info.safeArea && (windowHeight - info.safeArea.bottom) || 0
        )
        const padding = 8
        const rectBottom = Number(rect.bottom || (Number(rect.top) + Number(rect.height)))
        const rectRight = Number(rect.right || (Number(rect.left) + Number(rect.width)))
        const viewportTop = safeTop + padding
        const viewportBottom = windowHeight - safeBottom - padding
        const targetIsVisible = rectBottom > viewportTop && Number(rect.top) < viewportBottom &&
          rectRight > padding && Number(rect.left) < windowWidth - padding
        if (!targetIsVisible) return
        const left = Math.max(padding, Number(rect.left) - padding)
        const top = Math.max(viewportTop, Number(rect.top) - padding)
        const width = Math.max(40, Math.min(
          Number(rect.width) + padding * 2,
          windowWidth - left - padding
        ))
        const height = Math.max(40, Math.min(
          Number(rect.height) + padding * 2,
          viewportBottom - top
        ))
        const bubbleHeight = 180
        const belowTop = top + height + 12
        const aboveTop = top - bubbleHeight - 12
        const bubbleTop = belowTop + bubbleHeight <= viewportBottom
          ? belowTop
          : Math.max(viewportTop + 4, aboveTop)
        this.setData({
          highlightVisible: true,
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
