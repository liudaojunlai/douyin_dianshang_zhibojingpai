import type { LeaderboardEntry } from '@/hooks/useAuction'

interface Props {
  entries: LeaderboardEntry[]
  onClose: () => void
}

const MEDALS = ['🥇', '🥈', '🥉']

export default function Leaderboard({ entries, onClose }: Props) {
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, top: 0,
      zIndex: 1000, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end'
    }}>
      <div style={{
        position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)'
      }} onClick={onClose} />

      <div style={{
        position: 'relative',
        background: 'linear-gradient(180deg, #1a1a2e 0%, #0a0a0f 100%)',
        borderRadius: '24px 24px 0 0',
        maxHeight: '70vh',
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
      }}>
        <style>{`
          @keyframes slideUp {
            from { transform: translateY(100%); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
        `}</style>

        <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0' }}>
          <div style={{ width: 44, height: 5, background: 'rgba(255,255,255,0.25)', borderRadius: 3 }} />
        </div>

        <div style={{ padding: '0 20px 20px' }}>
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#fbbf24' }}>🏆 实时排行榜</div>
          </div>
        </div>

        <div style={{ overflowY: 'auto', padding: '0 20px 32px', flex: 1 }}>
          {entries.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#64748b', padding: '60px 0', fontSize: 15, fontWeight: 600 }}>
              暂无出价记录，等待第一位勇士出价...
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {entries.slice(0, 3).map((entry, i) => {
                const medalColors = [
                  'linear-gradient(135deg, rgba(251,191,36,0.3) 0%, rgba(245,158,11,0.15) 100%)',
                  'linear-gradient(135deg, rgba(156,163,175,0.3) 0%, rgba(107,114,128,0.15) 100%)',
                  'linear-gradient(135deg, rgba(180,83,9,0.3) 0%, rgba(120,53,15,0.15) 100%)'
                ]
                const borderColors = [
                  'rgba(251,191,36,0.4)',
                  'rgba(156,163,175,0.4)',
                  'rgba(180,83,9,0.4)'
                ]
                return (
                  <div
                    key={entry.userId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '16px 18px',
                      borderRadius: 18,
                      background: medalColors[i],
                      border: `2px solid ${borderColors[i]}`,
                      backdropFilter: 'blur(10px)',
                      boxShadow: i === 0 ? '0 4px 20px rgba(251,191,36,0.2)' : 'none'
                    }}
                  >
                    <span style={{ fontSize: 28, width: 40, textAlign: 'center' }}>
                      {MEDALS[i]}
                    </span>
                    <span style={{ flex: 1, fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>
                      {entry.nickname || `用户${entry.userId.slice(-4)}`}
                    </span>
                    <span style={{ fontWeight: 900, color: i === 0 ? '#fbbf24' : '#cbd5e1', fontSize: 18 }}>
                      ¥{(entry.amount / 100).toFixed(0)}
                    </span>
                  </div>
                )
              })}

              {entries.slice(3).map((entry, i) => {
                return (
                  <div
                    key={entry.userId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 16px',
                      borderRadius: 14,
                      background: 'rgba(30,41,59,0.6)',
                      border: '1px solid rgba(51,65,85,0.4)',
                      backdropFilter: 'blur(8px)',
                    }}
                  >
                    <span style={{ fontSize: 15, width: 30, textAlign: 'center', fontWeight: 700, color: '#64748b' }}>
                      {i + 4}
                    </span>
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#cbd5e1' }}>
                      {entry.nickname || `用户${entry.userId.slice(-4)}`}
                    </span>
                    <span style={{ fontWeight: 700, color: '#94a3b8', fontSize: 15 }}>
                      ¥{(entry.amount / 100).toFixed(0)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
