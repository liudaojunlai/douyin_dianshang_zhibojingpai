import { useEffect, useState } from 'react'
import { auctionApi } from '@/services/api'
import type { Auction } from '@/types'

interface Props {
  currentAuctionId: number
  sellerId?: number
  onSelectAuction: (auction: Auction) => void
  onClose: () => void
}

const STATUS_MAP: Record<string, { label: string; btnText: string; btnBg: string; btnColor?: string; priceLabel: string; tagBg?: string; desc?: string }> = {
  active:    { label: '竞拍中', btnText: '立即出价', btnBg: '#ff2442', priceLabel: '当前最高价', tagBg: '#ff2442' },
  pending:   { label: '即将开拍', btnText: '去看看', btnBg: '#ff2442', priceLabel: '起拍价', tagBg: '#ff9500' },
  sold:      { label: '已结束', btnText: '已结束', btnBg: '#ffb6c1', btnColor: '#fff', priceLabel: '落槌价', tagBg: '#999' },
  cancelled: { label: '竞拍未成交', btnText: '已结束', btnBg: '#d3d3d3', btnColor: '#999', priceLabel: '起拍价', tagBg: '#999' },
}

export default function ProductListPanel({ currentAuctionId, sellerId, onSelectAuction, onClose }: Props) {
  const [auctions, setAuctions] = useState<Auction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    auctionApi.list({ size: 50 }).then(r => {
      const all = (r.data.data?.list ?? []) as Auction[]
      const filtered = sellerId
        ? all.filter((a: Auction) => a.seller_id === sellerId)
        : all
      setAuctions(filtered)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [sellerId])

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
        background: '#fff',
        borderRadius: '24px 24px 0 0',
        maxHeight: '80vh',
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
          <div style={{ width: 44, height: 5, background: '#e0e0e0', borderRadius: 3 }} />
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 20px 16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#333', fontSize: 17, fontWeight: 600 }}>
            进主播橱窗
            <span style={{ color: '#999', fontSize: 18, fontWeight: 400 }}>›</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <span style={{ fontWeight: 700, color: '#ff2442' }}>带货口碑</span>
              <span style={{ background: 'linear-gradient(135deg, #ff2442 0%, #ff6b6b 100%)', color: '#fff', padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>5.0高</span>
              <span style={{ color: '#ff2442', background: '#fff3f3', padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600 }}>安心购</span>
              <span style={{ color: '#ff2442', background: '#fff3f3', padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600 }}>真实宝</span>
            </div>
            <div style={{ display: 'flex', gap: 20, fontSize: 15, color: '#666' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#333' }}>
                🎧 客服
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#333' }}>
                🛒 购物车
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#333' }}>
                ⋯ 更多
              </span>
            </div>
          </div>
        </div>

        <div style={{ overflowY: 'auto', padding: '0 20px 32px', flex: 1, background: 'linear-gradient(180deg, #fff9fb 0%, #fff 20%)' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#999', fontSize: 16 }}>加载中...</div>
          ) : auctions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#999', fontSize: 16 }}>暂无商品</div>
          ) : (
            auctions.map((a, idx) => {
              const cfg = STATUS_MAP[a.status] || STATUS_MAP.pending
              const images = (() => { try { return JSON.parse(a.product?.images || '[]') } catch { return [] } })()
              const isCurrent = a.id === currentAuctionId
              const isEnded = a.status === 'sold' || a.status === 'cancelled'
              const isPending = a.status === 'pending'
              const noBidsYet = a.status === 'active' && a.current_price <= a.start_price

              return (
                <div key={a.id} style={{
                  display: 'flex', gap: 14, padding: '16px 0',
                  borderBottom: idx < auctions.length - 1 ? '1px solid #f5f5f5' : 'none',
                  background: isCurrent ? 'rgba(255,36,66,0.03)' : 'transparent',
                  borderRadius: 12,
                  paddingLeft: 8,
                  paddingRight: 8,
                  marginLeft: -8,
                  marginRight: -8,
                  marginBottom: 4
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: idx < 3 ? (isCurrent ? '#ff2442' : '#1a1a1a') : '#444',
                    color: '#fff',
                    fontSize: 13, fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, marginTop: 4,
                    boxShadow: idx < 3 ? '0 2px 10px rgba(0,0,0,0.15)' : 'none'
                  }}>
                    {idx + 1}
                  </div>

                  <div style={{
                    width: 110, height: 110, borderRadius: 12, background: '#f8f8f8',
                    flexShrink: 0, overflow: 'hidden', position: 'relative'
                  }}>
                    {images[0] ? (
                      <img src={images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ddd', fontSize: 32 }}>📦</div>
                    )}
                    {isCurrent && (
                      <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        background: 'linear-gradient(135deg, #ff2442 0%, #ff6b6b 100%)', 
                        color: '#fff', fontSize: 12,
                        textAlign: 'center', padding: '4px 0',
                        fontWeight: 700
                      }}>讲解中</div>
                    )}
                    {a.status === 'active' && !isCurrent && (
                      <div style={{
                        position: 'absolute', top: 6, left: 6,
                        background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: 11,
                        padding: '3px 8px', borderRadius: 6,
                        fontWeight: 700
                      }}>出价¥{(a.current_price / 100).toFixed(0)}</div>
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        marginBottom: 10
                      }}>
                        <span style={{
                          fontSize: 13, color: '#fff',
                          background: cfg.tagBg || '#999',
                          padding: '3px 10px', borderRadius: 4,
                          fontWeight: 700
                        }}>
                          {cfg.label}
                        </span>
                        {a.status === 'active' && (
                          <span style={{ fontSize: 12, color: '#999' }}>
                            距截拍还剩 <RemainTime endTime={a.end_time} />
                          </span>
                        )}
                      </div>
                      <div style={{
                        fontSize: 16, color: '#1a1a1a', fontWeight: 700,
                        overflow: 'hidden', textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        lineHeight: 1.4
                      }}>
                        {a.product?.name}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <span style={{ fontSize: 13, color: '#999', marginRight: 6 }}>
                          {a.status === 'sold' ? '落槌价' : noBidsYet ? '起拍价' : cfg.priceLabel}
                        </span>
                        <span style={{ fontSize: 22, color: '#ff2442', fontWeight: 800 }}>
                          ¥{((a.status === 'sold' ? a.current_price : a.status === 'active' ? a.current_price : a.start_price) / 100).toFixed(0)}
                        </span>
                      </div>
                      <button
                        onClick={() => !isEnded && onSelectAuction(a)}
                        disabled={isEnded}
                        style={{
                          padding: '10px 26px', borderRadius: 28, border: 'none',
                          background: cfg.btnBg, color: cfg.btnColor || '#fff',
                          fontSize: 15, fontWeight: 700, cursor: isEnded ? 'not-allowed' : 'pointer',
                          opacity: isEnded ? 0.6 : 1,
                          boxShadow: !isEnded && a.status === 'active' ? '0 4px 14px rgba(255,36,66,0.35)' : 'none'
                        }}>
                        {cfg.btnText}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

/** 实时倒计时组件：根据 end_time 每秒更新剩余时间 */
function RemainTime({ endTime }: { endTime?: string | null }) {
  const [remain, setRemain] = useState(0)

  useEffect(() => {
    if (!endTime) return
    const update = () => {
      const ms = new Date(endTime).getTime() - Date.now()
      setRemain(Math.max(0, Math.floor(ms / 1000)))
    }
    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [endTime])

  const m = Math.floor(remain / 60)
  const s = remain % 60
  return <>{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}</>
}
