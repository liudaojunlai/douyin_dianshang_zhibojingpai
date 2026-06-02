type EventHandler = (data: any) => void

class AuctionSocket {
  private ws: WebSocket | null = null
  private auctionId: number | null = null
  private token: string | null = null
  private handlers: Map<string, EventHandler[]> = new Map()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectDelay = 1000
  private maxDelay = 30000
  private shouldReconnect = false
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private reconnectAttempts = 0

  connect(auctionId: number, token: string) {
    this.auctionId = auctionId
    this.token = token
    this.shouldReconnect = true
    this.reconnectAttempts = 0
    this.reconnectDelay = 1000
    this._connect()
  }

  private _connect() {
    if (this.ws) {
      this.ws.onclose = null
      this.ws.close()
      this.ws = null
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const hostname = window.location.hostname
    let wsUrl: string
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      wsUrl = `${protocol}//${hostname}:8082/ws/auction/${this.auctionId}?token=${this.token}`
      console.log('[WS] 开发模式直连后端:', wsUrl)
    } else {
      wsUrl = `${protocol}//${host}/ws/auction/${this.auctionId}?token=${this.token}`
      console.log('[WS] 生产模式通过Nginx代理:', wsUrl)
    }

    console.log('[WS] 正在连接:', wsUrl)
    this.ws = new WebSocket(wsUrl)

    this.ws.binaryType = 'blob'

    this.ws.onopen = () => {
      console.log('[WS] 连接成功 auction:', this.auctionId)
      this.reconnectAttempts = 0
      this.reconnectDelay = 1000
      this._startPing()
      this._emit('connected', {})
    }

    this.ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.event === 'ping') {
          this.send('pong', Date.now())
          return
        }
        this._emit(msg.event, msg.data)
      } catch (err) {
        console.warn('[WS] 解析消息失败:', err)
      }
    }

    this.ws.onclose = (evt) => {
      console.log('[WS] 连接断开, code:', evt.code, 'reason:', evt.reason)
      this._stopPing()
      this._emit('disconnected', { code: evt.code })
      if (this.shouldReconnect) {
        this._scheduleReconnect()
      }
    }

    this.ws.onerror = (err) => {
      console.error('[WS] 发生错误')
    }

    if ('ononline' in window) {
      window.addEventListener('online', () => {
        console.log('[WS] 网络恢复，立刻重连')
        if (this.shouldReconnect && this.ws?.readyState !== WebSocket.OPEN) {
          this._immediateReconnect()
        }
      })
    }
  }

  private _immediateReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.reconnectDelay = 1000
    this._connect()
  }

  private _scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectAttempts++

    const jitter = Math.random() * 500
    const delay = Math.min(this.reconnectDelay + jitter, this.maxDelay)
    this.reconnectDelay = Math.min(this.reconnectDelay * 1.8, this.maxDelay)

    console.log(`[WS] 第 ${this.reconnectAttempts} 次重连，等待 ${Math.round(delay)}ms`)
    this.reconnectTimer = setTimeout(() => {
      this._connect()
    }, delay)
  }

  private _startPing() {
    this._stopPing()
    this.pingTimer = setInterval(() => {
      this.send('ping', Date.now())
    }, 12000)
  }

  private _stopPing() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
  }

  send(event: string, data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ event, data }))
    }
  }

  on(event: string, handler: EventHandler) {
    if (!this.handlers.has(event)) this.handlers.set(event, [])
    this.handlers.get(event)!.push(handler)
  }

  off(event: string, handler: EventHandler) {
    const list = this.handlers.get(event) || []
    this.handlers.set(event, list.filter(h => h !== handler))
  }

  disconnect() {
    this.shouldReconnect = false
    this._stopPing()
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      this.ws.onclose = null
      this.ws.close()
      this.ws = null
    }
    this.handlers.clear()
  }

  isConnected() {
    return this.ws?.readyState === WebSocket.OPEN
  }

  private _emit(event: string, data: any) {
    const handlers = this.handlers.get(event) || []
    handlers.forEach(h => {
      try { h(data) } catch (e) { console.error('[WS] handler error:', e) }
    })
  }
}

export const auctionSocket = new AuctionSocket()
