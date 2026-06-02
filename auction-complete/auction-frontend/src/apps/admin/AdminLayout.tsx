import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'

const NAV_ITEMS = [
  { path: '/admin',         label: '监控看板', icon: '📊', end: true },
  { path: '/admin/auctions',label: '竞拍管理', icon: '🔨' },
  { path: '/admin/orders',  label: '订单管理', icon: '📋' },
]

export default function AdminLayout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f8fafc' }}>
      {/* Sidebar */}
      <div style={{ width: 220, background: 'linear-gradient(180deg,#0f172a,#1e293b)',
        display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '28px 20px 20px' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', marginBottom: 4 }}>🔨 竞拍大师</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>管理后台</div>
        </div>

        <nav style={{ flex: 1, padding: '8px 12px' }}>
          {NAV_ITEMS.map(item => (
            <NavLink key={item.path} to={item.path} end={item.end}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', borderRadius: 10, marginBottom: 4,
                textDecoration: 'none', fontSize: 14, fontWeight: 500,
                background: isActive ? 'rgba(239,68,68,.2)' : 'transparent',
                color: isActive ? '#fca5a5' : '#94a3b8',
                transition: 'all .2s',
              })}>
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div style={{ padding: '20px', borderTop: '1px solid rgba(255,255,255,.08)' }}>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 10 }}>
            {user?.nickname}
          </div>
          <button onClick={handleLogout} style={{ width: '100%', padding: '8px 0', border: 'none',
            borderRadius: 8, background: 'rgba(255,255,255,.08)', color: '#94a3b8',
            fontSize: 13, cursor: 'pointer' }}>
            退出登录
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <Outlet />
      </div>
    </div>
  )
}
