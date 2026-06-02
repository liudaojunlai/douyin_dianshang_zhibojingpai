import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { auctionApi } from '@/services/api'
import type { Auction } from '@/types'

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: '待开始', color: '#f59e0b', bg: '#fef9c3' },
  active:    { label: '进行中', color: '#ff2442', bg: '#fff0f1' },
  sold:      { label: '已成交', color: '#64748b', bg: '#f1f5f9' },
  cancelled: { label: '已取消', color: '#94a3b8', bg: '#f8fafc' },
}

export default function AuctionListPage() {
  const navigate = useNavigate()
  const { data, isLoading } = useQuery({
    queryKey: ['auctions', 'active'],
    queryFn: () => auctionApi.list({ status: 'active', size: 50 }).then(r => r.data.data),
    refetchInterval: 10000,
  })

  const auctions: Auction[] = data?.list ?? []

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', background: '#0a0a0f', minHeight: '100vh', padding: 16 }}>
      {/* 顶部标题 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingTop: 8 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4 }}>🔥 实时竞拍</h1>
          <p style={{ color: '#94a3b8', fontSize: 13 }}>点击进入直播间参与竞拍</p>
        </div>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          background: 'rgba(255,36,66,0.2)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', fontSize: 20
        }}>
          🔔
        </div>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>加载中...</div>
      ) : auctions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>暂无进行中的竞拍</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {auctions.map(a => {
            const s = STATUS_LABELS[a.status] ?? STATUS_LABELS.sold
            const images = (() => { try { return JSON.parse(a.product?.images || '[]') } catch { return [] } })()
            return (
              <div
                key={a.id}
                onClick={() => navigate(`/live/${a.id}`)}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  borderRadius: 16,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  display: 'flex',
                  gap: 0,
                  border: '1px solid rgba(255,255,255,0.08)',
                  backdropFilter: 'blur(10px)'
                }}
              >
                <div style={{
                  width: 110, background: '#1a1a2e', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative'
                }}>
                  {images[0] ? (
                    <img src={images[0]} alt="" style={{ width: '100%', height: 110, objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: 36 }}>📦</span>
                  )}
                  {a.status === 'active' && (
                    <div style={{
                      position: 'absolute', top: 6, left: 6,
                      background: '#ff2442', color: '#fff',
                      fontSize: 10, fontWeight: 700,
                      padding: '2px 6px', borderRadius: 4,
                      display: 'flex', alignItems: 'center', gap: 3
                    }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: '#fff', display: 'inline-block'
                      }} />
                      直播中
                    </div>
                  )}
                </div>
                <div style={{ padding: '14px 16px', flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, color: s.color,
                      background: s.bg, padding: '2px 8px', borderRadius: 20
                    }}>
                      {s.label}
                    </span>
                  </div>
                  <div style={{
                    fontWeight: 700, fontSize: 15, color: '#fff',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 10
                  }}>
                    {a.product?.name}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>当前价</div>
                      <div style={{ fontWeight: 800, fontSize: 20, color: '#ff2442' }}>
                        ¥{(a.current_price / 100).toFixed(0)}
                      </div>
                    </div>
                    <div style={{
                      background: '#ff2442', color: '#fff',
                      padding: '7px 18px', borderRadius: 20, fontSize: 13, fontWeight: 700
                    }}>
                      进入直播
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
