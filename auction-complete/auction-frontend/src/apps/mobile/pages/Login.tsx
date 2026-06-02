import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '@/services/api'
import { useAuthStore } from '@/stores/authStore'

export default function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore(s => s.setAuth)
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [form, setForm] = useState({ phone: '', password: '', nickname: '', role: 'user' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handle = async () => {
    setLoading(true); setError('')

    // 前端友好校验，避免后端英文错误
    if (!/^\d{11}$/.test(form.phone)) {
      setError('请输入正确的11位手机号')
      setLoading(false)
      return
    }
    if (form.password.length < 6) {
      setError('密码至少需要6位')
      setLoading(false)
      return
    }
    if (tab === 'register' && form.nickname.trim().length < 1) {
      setError('请输入昵称')
      setLoading(false)
      return
    }

    try {
      const res = tab === 'login'
        ? await authApi.login({ phone: form.phone, password: form.password })
        : await authApi.register(form)
      const data = res.data.data
      if (!data) return
      const { token, user } = data
      setAuth(token, user)
      navigate(user.role === 'seller' ? '/admin' : '/mobile')
    } catch (e: any) {
      setError(e.response?.data?.message || '操作失败')
    } finally {
      setLoading(false)
    }
  }

  const inp = (label: string, key: keyof typeof form, type = 'text') => (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
        {label}
      </label>
      <input type={type} value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        style={{ width: '100%', padding: '12px 14px', border: '1px solid #e2e8f0',
          borderRadius: 10, fontSize: 15, outline: 'none', boxSizing: 'border-box' }}
      />
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg,#0f172a 0%,#1e293b 50%,#0f172a 100%)' }}>
      <div style={{ background: '#fff', borderRadius: 24, padding: 40, width: 380,
        boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, textAlign: 'center', marginBottom: 4, color: '#0f172a' }}>
          🔨 实时竞拍大师
        </h1>
        <p style={{ textAlign: 'center', color: '#64748b', fontSize: 13, marginBottom: 28 }}>
          抖音电商直播竞拍系统
        </p>

        <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 10, padding: 3, marginBottom: 24 }}>
          {(['login', 'register'] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); setError('') }} style={{
              flex: 1, padding: '9px 0', border: 'none', borderRadius: 8, cursor: 'pointer',
              background: tab === t ? '#fff' : 'transparent',
              fontWeight: tab === t ? 700 : 500,
              color: tab === t ? '#0f172a' : '#64748b',
              fontSize: 14,
              boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,.1)' : 'none',
            }}>
              {t === 'login' ? '登录' : '注册'}
            </button>
          ))}
        </div>

        {inp('手机号', 'phone')}
        {inp('密码', 'password', 'password')}
        {tab === 'register' && (
          <>
            {inp('昵称', 'nickname')}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6, display: 'block' }}>
                身份
              </label>
              <div style={{ display: 'flex', gap: 10 }}>
                {[{ v: 'user', label: '👤 竞拍用户' }, { v: 'seller', label: '🏪 商家/主播' }].map(opt => (
                  <button key={opt.v} onClick={() => setForm(f => ({ ...f, role: opt.v }))} style={{
                    flex: 1, padding: '10px 0', border: form.role === opt.v ? '2px solid #ef4444' : '1px solid #e2e8f0',
                    borderRadius: 10, background: form.role === opt.v ? '#fff5f5' : '#f8fafc',
                    color: form.role === opt.v ? '#ef4444' : '#64748b',
                    fontWeight: 600, fontSize: 13, cursor: 'pointer',
                  }}>{opt.label}</button>
                ))}
              </div>
            </div>
          </>
        )}

        {error && (
          <div style={{ color: '#ef4444', fontSize: 15, textAlign: 'center', marginBottom: 16, fontWeight: 600 }}>{error}</div>
        )}

        <button onClick={handle} disabled={loading} style={{
          width: '100%', padding: '14px 0', border: 'none', borderRadius: 12,
          background: 'linear-gradient(135deg,#ef4444,#dc2626)', color: '#fff',
          fontWeight: 700, fontSize: 16, cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? .7 : 1,
          boxShadow: '0 4px 20px rgba(239,68,68,.35)',
        }}>
          {loading ? '处理中...' : tab === 'login' ? '登录' : '注册'}
        </button>
      </div>
    </div>
  )
}
