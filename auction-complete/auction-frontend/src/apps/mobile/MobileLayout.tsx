import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'

const NAV = [
  { path: '/mobile',        label: '竞拍', icon: '🔥', end: true },
  { path: '/mobile/orders', label: '订单', icon: '📋' },
  { path: '/mobile/me',     label: '我的', icon: '👤' },
]

export default function MobileLayout() {
  return (
    <div style={{ maxWidth: 480, margin: '0 auto', paddingBottom: 64, background: '#f8fafc', minHeight: '100vh' }}>
      <Outlet />
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 480, background: 'rgba(10,10,15,0.95)', borderTop: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', backdropFilter: 'blur(10px)' }}>
        {NAV.map(item => (
          <NavLink key={item.path} to={item.path} end={item.end}
            style={({ isActive }) => ({
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '10px 0', textDecoration: 'none',
              color: isActive ? '#ff2442' : '#64748b', fontSize: 11, fontWeight: 500,
            })}>
            <span style={{ fontSize: 22, marginBottom: 2 }}>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </div>
    </div>
  )
}
