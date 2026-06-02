import { useQuery } from '@tanstack/react-query'
import { monitorApi } from '@/services/api'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { MonitorStats, AlertItem } from '@/types'

const STAT_CARDS = [
  { key: 'active_auctions',  label: '进行中竞拍', icon: '🔥', color: '#ef4444' },
  { key: 'pending_auctions', label: '待开始竞拍', icon: '⏳', color: '#f59e0b' },
  { key: 'today_sold',       label: '今日成交',   icon: '✅', color: '#22c55e' },
  { key: 'online_users',     label: '在线用户',   icon: '👥', color: '#3b82f6' },
  { key: 'today_bid_count',  label: '今日出价次数', icon: '💬', color: '#8b5cf6' },
  { key: 'daily_gmv',        label: '今日GMV(元)', icon: '💰', color: '#ec4899', fmt: (v: number) => (v / 100).toFixed(2) },
]

const ALERT_STYLES = {
  red:    { bg: '#fff5f5', border: '#fca5a5', dot: '#ef4444' },
  orange: { bg: '#fff7ed', border: '#fdba74', dot: '#f97316' },
  yellow: { bg: '#fefce8', border: '#fde047', dot: '#eab308' },
}

// Mock 趋势数据（实际应从监控 API 获取）
const mockTrend = Array.from({ length: 30 }, (_, i) => ({
  time: `${String(Math.floor(i / 2)).padStart(2,'0')}:${i % 2 === 0 ? '00' : '30'}`,
  bids: Math.floor(Math.random() * 80 + 10),
}))

export default function AdminDashboard() {
  const { data: stats } = useQuery<MonitorStats>({
    queryKey: ['monitor-stats'],
    queryFn: () => monitorApi.getStats().then(r => r.data.data),
    refetchInterval: 10000,
  })
  const { data: alerts } = useQuery<AlertItem[]>({
    queryKey: ['monitor-alerts'],
    queryFn: () => monitorApi.getAlerts().then(r => r.data.data),
    refetchInterval: 30000,
  })

  return (
    <div style={{ padding: 32, background: '#f8fafc', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>运营监控看板</h1>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 28 }}>
        数据每 10 秒自动刷新
      </p>

      {/* 统计卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 28 }}>
        {STAT_CARDS.map(card => {
          const raw = (stats as any)?.[card.key] ?? 0
          const display = card.fmt ? card.fmt(raw) : raw
          return (
            <div key={card.key} style={{ background: '#fff', borderRadius: 16, padding: '20px 24px',
              boxShadow: '0 2px 12px rgba(0,0,0,.06)', borderLeft: `4px solid ${card.color}` }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>{card.icon}</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: card.color }}>{display}</div>
              <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{card.label}</div>
            </div>
          )
        })}
      </div>

      {/* 出价趋势图 */}
      <div style={{ background: '#fff', borderRadius: 16, padding: 24,
        boxShadow: '0 2px 12px rgba(0,0,0,.06)', marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: 20 }}>
          📈 出价趋势（最近 30 分钟）
        </h2>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={mockTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#94a3b8' }} interval={4} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,.1)' }} />
            <Line type="monotone" dataKey="bids" stroke="#ef4444" strokeWidth={2}
              dot={false} name="出价次数" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 告警面板 */}
      <div style={{ background: '#fff', borderRadius: 16, padding: 24,
        boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: 16 }}>
          🚨 异常告警
        </h2>
        {!alerts || alerts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: '#22c55e', fontSize: 14 }}>
            ✅ 暂无告警，系统运行正常
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {alerts.map((a, i) => {
              const s = ALERT_STYLES[a.level]
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', borderRadius: 10, background: s.bg,
                  border: `1px solid ${s.border}` }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
                  <div style={{ flex: 1, fontSize: 14, fontWeight: 500, color: '#1e293b' }}>{a.message}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', flexShrink: 0 }}>{a.time}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
