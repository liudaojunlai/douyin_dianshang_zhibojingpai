import { Component } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'

import LoginPage       from '@/apps/mobile/pages/Login'
import MobileLayout    from '@/apps/mobile/MobileLayout'
import AuctionListPage from '@/apps/mobile/pages/AuctionList'
import LiveRoomPage    from '@/apps/mobile/pages/LiveRoom'
import OrdersPage      from '@/apps/mobile/pages/Orders'
import MePage          from '@/apps/mobile/pages/Me'

import AdminLayout  from '@/apps/admin/AdminLayout'
import AdminDashboard from '@/apps/admin/pages/Dashboard'
import AdminAuctions  from '@/apps/admin/pages/Auctions'
import AdminOrders    from '@/apps/admin/pages/Orders'

import { logger } from '@/utils/logger'

const qc = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } }
})

/** 错误边界，防止单个组件崩溃导致整个页面白屏 */
class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(error: Error) { logger.error('应用崩溃', error) }
  render() {
    if (this.state.hasError) {
      return <div style={{ padding: 40, textAlign: 'center' }}>
        <h2>页面出错了</h2>
        <button onClick={() => { this.setState({ hasError: false }); window.location.href = '/login' }}>
          重新加载
        </button>
      </div>
    }
    return this.props.children
  }
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = useAuthStore(s => s.token)
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RequireSeller({ children }: { children: React.ReactNode }) {
  const user = useAuthStore(s => s.user)
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'seller') return <Navigate to="/mobile" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <ErrorBoundary>
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          {/* 用户端 H5 */}
          <Route path="/mobile" element={<RequireAuth><MobileLayout /></RequireAuth>}>
            <Route index element={<AuctionListPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="me" element={<MePage />} />
          </Route>
          <Route path="/live/:id" element={<RequireAuth><LiveRoomPage /></RequireAuth>} />

          {/* 商家后台 */}
          <Route path="/admin" element={<RequireSeller><AdminLayout /></RequireSeller>}>
            <Route index element={<AdminDashboard />} />
            <Route path="auctions" element={<AdminAuctions />} />
            <Route path="orders" element={<AdminOrders />} />
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
    </ErrorBoundary>
  )
}
