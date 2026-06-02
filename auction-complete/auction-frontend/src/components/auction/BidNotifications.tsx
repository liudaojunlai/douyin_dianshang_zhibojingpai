import type { Notification } from '@/hooks/useAuction'

const COLORS: Record<Notification['type'], { bg: string; border: string; icon: string }> = {
  overtaken:   { bg: '#fff5f5', border: '#fca5a5', icon: '⚡' },
  extended:    { bg: '#f0fdf4', border: '#86efac', icon: '⏱' },
  sold:        { bg: '#fefce8', border: '#fde047', icon: '🎉' },
  cancelled:   { bg: '#f8fafc', border: '#cbd5e1', icon: '❌' },
  bid_success: { bg: '#f0fdf4', border: '#4ade80', icon: '✅' },
}

interface Props {
  notifications: Notification[]
}

export default function BidNotifications({ notifications }: Props) {
  return (
    <div style={{
      position: 'fixed',
      top: 16,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      width: 'min(90vw, 360px)',
      pointerEvents: 'none',
    }}>
      {notifications.map(n => {
        const style = COLORS[n.type]
        return (
          <div
            key={n.id}
            style={{
              background: style.bg,
              border: `1.5px solid ${style.border}`,
              borderRadius: 12,
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              boxShadow: '0 4px 20px rgba(0,0,0,.1)',
              animation: 'slideDown .3s ease',
            }}
          >
            <style>{`@keyframes slideDown{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:none}}`}</style>
            <span style={{ fontSize: 20 }}>{style.icon}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#1e293b', flex: 1 }}>
              {n.message}
            </span>
          </div>
        )
      })}
    </div>
  )
}
