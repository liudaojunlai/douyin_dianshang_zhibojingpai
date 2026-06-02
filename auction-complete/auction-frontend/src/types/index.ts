// ============ 用户 ============
export type UserRole = 'user' | 'seller'

export interface User {
  id: number
  nickname: string
  phone: string
  role: UserRole
  avatar?: string
  balance: number
  created_at: string
}

// ============ 商品 ============
export interface Product {
  id: number
  seller_id: number
  seller?: User
  name: string
  description: string
  images: string // JSON 数组字符串
  created_at: string
}

// ============ 竞拍 ============
export type AuctionStatus = 'draft' | 'pending' | 'active' | 'sold' | 'cancelled'

export interface Auction {
  id: number
  product_id: number
  product?: Product
  seller_id: number
  start_price: number
  increment: number
  cap_price: number
  duration: number
  delay_seconds: number
  status: AuctionStatus
  current_price: number
  extend_count: number
  start_time?: string
  end_time?: string
  created_at: string
}

// ============ 出价 ============
export interface Bid {
  id: number
  auction_id: number
  user_id: number
  user?: User
  amount: number
  created_at: string
}

// ============ 订单 ============
export type PayStatus = 'pending' | 'paid' | 'expired'

export interface Order {
  id: number
  auction_id: number
  auction?: Auction
  winner_id: number
  winner?: User
  final_price: number
  pay_status: PayStatus
  paid_at?: string
  created_at: string
}

// ============ API 通用响应 ============
export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data?: T
}

export interface PageData<T> {
  list: T[]
  total: number
  page: number
  size: number
}

// ============ WebSocket 事件 ============
export interface WsMessage<T = unknown> {
  event: string
  data: T
}

export interface BidNewData {
  auction_id: number
  user_id: number
  nickname: string
  amount: number
  current_price: number
  timestamp: string
  extended: boolean
  new_end_time?: string
  extend_secs?: number
  cap_reached: boolean
}

export interface TimerSyncData {
  remain_ms: number
  server_ts: number
}

export interface TimerExtendData {
  new_end_time: string
  extend_secs: number
}

export interface AuctionSoldData {
  auction_id: number
  winner_id: number
  final_price: number
}

export interface LeaderboardEntry {
  Score: number
  Member: string
}

// ============ 监控 ============
export interface MonitorStats {
  active_auctions: number
  pending_auctions: number
  today_sold: number
  online_users: number
  daily_gmv: number
  today_bid_count: number
}

export interface AlertItem {
  level: 'red' | 'orange' | 'yellow'
  type: string
  message: string
  time: string
}
