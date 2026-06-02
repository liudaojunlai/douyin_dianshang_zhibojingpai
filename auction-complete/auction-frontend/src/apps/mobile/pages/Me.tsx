import { useAuthStore } from '@/stores/authStore'
import { useNavigate } from 'react-router-dom'

export default function MePage() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  return (
    <div style={{ padding: 24, maxWidth: 480, margin: '0 auto' }}>
      <div style={{ background: 'linear-gradient(135deg,#0f172a,#1e293b)', borderRadius: 20,
        padding: 28, marginBottom: 20, color: '#fff' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>👤</div>
        <div style={{ fontSize: 20, fontWeight: 700 }}>{user?.nickname}</div>
        <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>{user?.phone}</div>
        <div style={{ marginTop: 12, display: 'inline-block', padding: '4px 12px',
          borderRadius: 20, background: 'rgba(255,255,255,.1)', fontSize: 12 }}>
          {user?.role === 'seller' ? '🏪 商家/主播' : '👤 竞拍用户'}
        </div>
      </div>

      <button onClick={() => { logout(); navigate('/login') }}
        style={{ width: '100%', padding: '14px 0', border: '1px solid #e2e8f0',
          borderRadius: 12, background: '#fff', color: '#ef4444',
          fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
        退出登录
      </button>
    </div>
  )
}
