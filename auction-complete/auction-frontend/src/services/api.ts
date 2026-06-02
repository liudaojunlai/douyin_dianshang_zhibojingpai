import axios from 'axios'
import type { ApiResponse } from '@/types'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 10000,
})

// 请求拦截：自动附加 JWT
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// 响应拦截：统一错误处理
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ── Auth ──────────────────────────────────────────
export const authApi = {
  register: (data: { phone: string; password: string; nickname: string; role: string }) =>
    api.post<ApiResponse<{ token: string; user: any }>>('/auth/register', data),
  login: (data: { phone: string; password: string }) =>
    api.post<ApiResponse<{ token: string; user: any }>>('/auth/login', data),
  me: () => api.get<ApiResponse<any>>('/me'),
}

// ── Auctions ──────────────────────────────────────
export const auctionApi = {
  list: (params?: { status?: string; page?: number; size?: number }) =>
    api.get<ApiResponse<any>>('/auctions', { params }),
  getById: (id: number) => api.get<ApiResponse<any>>(`/auctions/${id}`),
  create: (data: any) => api.post<ApiResponse<any>>('/auctions', data),
  listMine: (params?: { page?: number; size?: number }) =>
    api.get<ApiResponse<any>>('/auctions/mine', { params }),
  updateRules: (id: number, data: any) => api.patch<ApiResponse<any>>(`/auctions/${id}`, data),
  cancel: (id: number) => api.post<ApiResponse<any>>(`/auctions/${id}/cancel`),
}

// ── Bids ──────────────────────────────────────────
export const bidApi = {
  placeBid: (auctionID: number, amount: number) =>
    api.post<ApiResponse<any>>(`/auctions/${auctionID}/bids`, { amount }),
  getLeaderboard: (auctionID: number) =>
    api.get<ApiResponse<any>>(`/auctions/${auctionID}/leaderboard`),
  getBidList: (auctionID: number) =>
    api.get<ApiResponse<any>>(`/auctions/${auctionID}/bids`),
}

// ── Orders ────────────────────────────────────────
export const orderApi = {
  list: (params?: { page?: number; size?: number }) =>
    api.get<ApiResponse<any>>('/orders', { params }),
  pay: (orderID: number) => api.post<ApiResponse<any>>(`/orders/${orderID}/pay`),
}

// ── Monitor ───────────────────────────────────────
export const monitorApi = {
  getStats: () => api.get<ApiResponse<any>>('/monitor/stats'),
  getAlerts: () => api.get<ApiResponse<any>>('/monitor/alerts'),
  getRoomStats: (auctionID: number) =>
    api.get<ApiResponse<any>>(`/monitor/rooms/${auctionID}`),
}
