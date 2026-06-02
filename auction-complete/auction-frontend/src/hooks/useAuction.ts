import { useState, useEffect, useCallback, useRef } from 'react'
import { auctionSocket } from '@/socket/auctionSocket'
import { useAuthStore } from '@/stores/authStore'
import type { Auction, BidNewData, TimerSyncData, TimerExtendData, AuctionSoldData } from '@/types'

export interface LeaderboardEntry {
  userId: string
  amount: number
  rank: number
}

export interface CommentEntry {
  user_id: number
  nickname: string
  text: string
  timestamp: number
}

export interface AuctionState {
  auction: Auction | null
  currentPrice: number
  remainMs: number
  endTime: Date | null
  leaderboard: LeaderboardEntry[]
  connected: boolean
  sold: boolean
  soldData: AuctionSoldData | null
  cancelled: boolean
  notifications: Notification[]
  extendCount: number
  onlineCount: number
  gotFirstTimerSync: boolean
  comments: CommentEntry[]
}

export interface Notification {
  id: number
  type: 'overtaken' | 'extended' | 'sold' | 'cancelled' | 'bid_success'
  message: string
}

let notifId = 0

export function useAuction(auctionId: number, initialAuction: Auction | null) {
  const token = useAuthStore(s => s.token)
  const user  = useAuthStore(s => s.user)
  const prevInitialAuctionRef = useRef<Auction | null>(null)

  const absoluteEndTsRef = useRef(0)

  const [state, setState] = useState<AuctionState>({
    auction: initialAuction,
    currentPrice: initialAuction?.current_price ?? 0,
    remainMs: 0,
    endTime: initialAuction?.end_time ? new Date(initialAuction.end_time) : null,
    leaderboard: [],
    connected: false,
    sold: initialAuction?.status === 'sold',
    soldData: null,
    cancelled: initialAuction?.status === 'cancelled',
    notifications: [],
    extendCount: initialAuction?.extend_count ?? 0,
    onlineCount: 0,
    gotFirstTimerSync: false,
    comments: []
  })

  useEffect(() => {
    if (initialAuction && !prevInitialAuctionRef.current) {
      setState(s => ({
        ...s,
        auction: initialAuction,
        currentPrice: initialAuction.current_price,
        endTime: initialAuction.end_time ? new Date(initialAuction.end_time) : null,
        sold: initialAuction.status === 'sold',
        cancelled: initialAuction.status === 'cancelled',
        extendCount: initialAuction.extend_count ?? 0,
      }))
      if (initialAuction.end_time) {
        absoluteEndTsRef.current = new Date(initialAuction.end_time).getTime()
      }
    }
    prevInitialAuctionRef.current = initialAuction
  }, [initialAuction])

  const addNotif = useCallback((type: Notification['type'], message: string) => {
    const id = ++notifId
    setState(s => ({ ...s, notifications: [...s.notifications, { id, type, message }] }))
    setTimeout(() => {
      setState(s => ({ ...s, notifications: s.notifications.filter(n => n.id !== id) }))
    }, 4000)
  }, [])

  useEffect(() => {
    if (!token || !auctionId) return

    auctionSocket.connect(auctionId, token)

    auctionSocket.on('connected', () =>
      setState(s => ({ ...s, connected: true })))

    auctionSocket.on('disconnected', () =>
      setState(s => ({ ...s, connected: false })))

    auctionSocket.on('bid:new', (data: BidNewData) => {
      setState(s => ({
        ...s,
        currentPrice: data.current_price,
        extendCount: data.extended ? s.extendCount + 1 : s.extendCount,
        endTime: data.new_end_time ? new Date(data.new_end_time) : s.endTime,
      }))
      if (data.extended) {
        addNotif('extended', `⏱ 延时 ${data.extend_secs}秒！最后关头有人出价`)
      }
    })

    auctionSocket.on('rank:update', (data: any[]) => {
      const board = data.map((e: any, i: number) => ({
        userId: String(e.Member ?? e.userId),
        amount: e.Score ?? e.amount,
        rank: i + 1,
      }))
      const topPrice = board.length > 0 ? board[0].amount : 0
      setState(s => ({
        ...s,
        leaderboard: board,
        currentPrice: topPrice > s.currentPrice ? topPrice : s.currentPrice
      }))
    })

    auctionSocket.on('timer:sync', (data: TimerSyncData) => {
      const serverNow = data.server_ts
      const newAbsoluteEnd = serverNow + data.remain_ms
      
      setState(s => ({
        ...s,
        remainMs: data.remain_ms,
        gotFirstTimerSync: true
      }))
      
      if (newAbsoluteEnd > absoluteEndTsRef.current) {
        absoluteEndTsRef.current = newAbsoluteEnd
      } else if (absoluteEndTsRef.current === 0) {
        absoluteEndTsRef.current = newAbsoluteEnd
      }
    })

    auctionSocket.on('timer:extend', (data: TimerExtendData) => {
      setState(s => ({ ...s, endTime: new Date(data.new_end_time) }))
    })

    auctionSocket.on('bid:overtaken', (data: any) => {
      addNotif('overtaken', `⚡ 你被 ${data.new_leader} 超越了！当前价 ¥${(data.amount / 100).toFixed(2)}`)
    })

    auctionSocket.on('auction:sold', (data: AuctionSoldData) => {
      setState(s => ({ ...s, sold: true, soldData: data }))
      if (user && data.winner_id === user.id) {
        addNotif('sold', `🎉 恭喜！你以 ¥${(data.final_price / 100).toFixed(2)} 竞拍成功！`)
      } else {
        addNotif('sold', `竞拍结束，成交价 ¥${(data.final_price / 100).toFixed(2)}`)
      }
    })

    auctionSocket.on('auction:cancelled', () => {
      setState(s => ({ ...s, cancelled: true }))
      addNotif('cancelled', '竞拍已被取消')
    })

    auctionSocket.on('online:count', (data: { count: number }) => {
      setState(s => ({ ...s, onlineCount: data.count }))
    })

    auctionSocket.on('comment:new', (data: CommentEntry) => {
      setState(s => ({
        ...s,
        comments: [...s.comments.slice(-49), data]
      }))
    })

    auctionSocket.on('comment:history', (data: CommentEntry[]) => {
      setState(s => ({
        ...s,
        comments: data.slice(-50)
      }))
    })

    return () => {
      auctionSocket.disconnect()
    }
  }, [auctionId, token])

  const sendComment = useCallback((text: string) => {
    auctionSocket.send('comment:new', { text })
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setState(s => {
        if (s.sold || s.cancelled) return s
        if (!s.gotFirstTimerSync) return s
        if (absoluteEndTsRef.current === 0) return s
        const now = Date.now()
        const remainMs = Math.max(0, absoluteEndTsRef.current - now)
        return { ...s, remainMs }
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  return { state, addNotif, sendComment }
}
