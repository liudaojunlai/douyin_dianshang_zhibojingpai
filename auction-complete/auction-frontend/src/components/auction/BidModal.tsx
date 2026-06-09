import { useState, useCallback, useRef, useEffect } from 'react'
import { bidApi } from '@/services/api'
import type { Auction } from '@/types'

interface Props {
  auction: Auction
  currentPrice: number
  remainMs: number
  sold: boolean
  myLastBid?: number
  winnerId?: number
  userId?: number
  leaderNickname?: string   // 当前领先者昵称
  onBidSuccess?: (amount: number) => void
  onBidFail?: (msg: string) => void
  onClose?: () => void
}

function fmtMoney(v: number) {
  return '¥' + (v / 100).toFixed(0)
}

function fmtTime(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}`
}

export default function BidModal({
  auction, currentPrice, remainMs, sold, myLastBid = 0,
  winnerId, userId, leaderNickname, onBidSuccess, onBidFail, onClose
}: Props) {
  const minBid = currentPrice + auction.increment
  const [amount, setAmount] = useState(minBid)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const lastBidTime = useRef(0)
  const [autoCloseTip, setAutoCloseTip] = useState('')
  const [showHighBidTip, setShowHighBidTip] = useState(false)
  const [showHighestTip, setShowHighestTip] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)
  const [myBidAmount, setMyBidAmount] = useState(myLastBid)

  useEffect(() => {
    setAmount(prev => Math.max(prev, minBid))
  }, [minBid])

  useEffect(() => {
    if (sold) {
      setAutoCloseTip('当前品拍卖已结束，5s后自动返回直播间')
      const t = setTimeout(() => {
        onClose?.()
      }, 5000)
      return () => clearTimeout(t)
    }
  }, [sold, onClose])

  useEffect(() => {
    const diff = amount - currentPrice
    if (!sold && diff > 0 && diff !== auction.increment) {
      setShowHighBidTip(true)
      setShowHighestTip(false)
    } else if (!sold && winnerId === userId && myLastBid > 0) {
      setShowHighestTip(true)
      setShowHighBidTip(false)
    } else {
      setShowHighBidTip(false)
      setShowHighestTip(false)
    }
  }, [amount, currentPrice, auction.increment, sold, winnerId, userId, myLastBid])

  useEffect(() => {
    if (myLastBid > 0 && myLastBid !== myBidAmount) {
      setMyBidAmount(myLastBid)
    }
  }, [myLastBid])

  const handleBid = useCallback(async () => {
    if (sold) return
    const now = Date.now()
    if (now - lastBidTime.current < 100) return
    lastBidTime.current = now

    const bidAmount = Math.max(amount, minBid)
    if ((bidAmount - auction.start_price) % auction.increment !== 0) {
      setError(`出价需为加价幅度 ¥${(auction.increment / 100).toFixed(0)} 的整数倍`)
      return
    }

    setLoading(true)
    setError('')
    try {
      await bidApi.placeBid(auction.id, bidAmount)
      setMyBidAmount(bidAmount)
      onBidSuccess?.(bidAmount)
      setAmount(bidAmount + auction.increment)
    } catch (err: any) {
      const msg = err.response?.data?.message || '出价失败，请重试'
      setError(msg)
      onBidFail?.(msg)
    } finally {
      setLoading(false)
    }
  }, [amount, minBid, auction, sold, onBidSuccess, onBidFail])

  const isHighest = winnerId === userId
  const diff = amount - currentPrice
  const leaderName = leaderNickname || (isHighest && myLastBid > 0 ? '你' : '领先者')

  const images = (() => { try { return JSON.parse(auction.product?.images || '[]') } catch { return [] } })()

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose?.()
    }
  }, [onClose])

  const stopPropagation = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  return (
    <div 
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'radial-gradient(circle at top, rgba(255,36,66,0.15) 0%, rgba(0,0,0,0.85) 60%, #000 100%)',
        backdropFilter: 'blur(12px)',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end'
      }}
      onClick={handleOverlayClick}
    >
      <style>{`
        @keyframes slideUp { 
          from { transform: translateY(100%); opacity: 0; } 
          to { transform: translateY(0); opacity: 1; } 
        }
        @keyframes neonPulseOrange {
          0%,100% { 
            box-shadow: 0 0 20px rgba(255,140,0,0.5), 0 0 40px rgba(255,140,0,0.2), inset 0 0 20px rgba(255,255,255,0.05);
            transform: scale(1);
          }
          50% { 
            box-shadow: 0 0 35px rgba(255,140,0,0.8), 0 0 70px rgba(255,140,0,0.35), inset 0 0 30px rgba(255,255,255,0.1);
            transform: scale(1.02);
          }
        }
        @keyframes priceGlow {
          0%,100% { 
            text-shadow: 0 0 20px rgba(255,36,66,0.4), 0 0 40px rgba(255,36,66,0.2);
          }
          50% { 
            text-shadow: 0 0 40px rgba(255,36,66,0.7), 0 0 80px rgba(255,36,66,0.35);
          }
        }
        @keyframes btnNeonGlow {
          0%,100% { 
            box-shadow: 0 8px 32px rgba(255,36,66,0.45), 0 0 60px rgba(255,36,66,0.2);
          }
          50% { 
            box-shadow: 0 12px 48px rgba(255,36,66,0.6), 0 0 100px rgba(255,36,66,0.35);
          }
        }
        @keyframes neonBorder {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes floatParticle {
          0% { opacity: 0; transform: translateY(0) scale(0); }
          20% { opacity: 1; transform: translateY(-10px) scale(1); }
          100% { opacity: 0; transform: translateY(-40px) scale(0.5); }
        }
        .neon-time-box {
          animation: neonPulseOrange 1.5s ease-in-out infinite;
        }
        .price-text-glow {
          animation: priceGlow 1.8s ease-in-out infinite;
        }
        .bid-btn-glow {
          animation: btnNeonGlow 1.4s ease-in-out infinite;
        }
      `}</style>

      <div 
        ref={modalRef}
        style={{
          position: 'relative', 
          background: 'linear-gradient(180deg, rgba(255,245,250,0.98) 0%, rgba(255,250,255,0.96) 50%, rgba(255,248,252,0.98) 100%)',
          borderRadius: '44px 44px 0 0',
          animation: 'slideUp 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
          paddingBottom: 44,
          overflow: 'hidden',
          backdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(255,255,255,0.5)'
        }} 
        onClick={stopPropagation}
      >
        <div style={{
          position: 'absolute', top: -80, right: -60, width: 280, height: 280,
          background: 'radial-gradient(circle, rgba(255,107,53,0.12) 0%, transparent 70%)',
          borderRadius: '50%',
          filter: 'blur(40px)'
        }} />
        <div style={{
          position: 'absolute', bottom: -60, left: -40, width: 220, height: 220,
          background: 'radial-gradient(circle, rgba(168,85,247,0.1) 0%, transparent 70%)',
          borderRadius: '50%',
          filter: 'blur(35px)'
        }} />

        <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0 12px' }}>
          <div style={{ width: 60, height: 7, background: 'linear-gradient(90deg, rgba(255,36,66,0.6), rgba(255,140,0,0.6), rgba(168,85,247,0.6))', borderRadius: 999 }} />
        </div>

        {!sold && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 14, marginBottom: 24,
            fontSize: 30, fontWeight: 900,
            color: '#1a1a2e',
            position: 'relative', zIndex: 1
          }}>
            <div style={{ width: 40, height: 4, background: 'linear-gradient(90deg, #ff6b35, #ff2442)', borderRadius: 3 }} />
            <span style={{ letterSpacing: 2 }}>距竞拍结束仅剩</span>
            <div style={{ display: 'flex', gap: 10 }}>
              {fmtTime(remainMs).split(':').map((part, i) => (
                <span key={i} 
                  className="neon-time-box"
                  style={{
                    background: 'linear-gradient(135deg, #ff8c00 0%, #ffa500 50%, #ffb700 100%)', 
                    color: '#fff', fontSize: 36,
                    fontWeight: 900, padding: '12px 22px', borderRadius: 16,
                    fontFamily: 'monospace'
                  }}>
                  {part}
                </span>
              ))}
            </div>
            <div style={{ width: 40, height: 4, background: 'linear-gradient(90deg, #ff2442, #ff6b35)', borderRadius: 3 }} />
          </div>
        )}

        {sold && (
          <div style={{
            textAlign: 'center', marginBottom: 24,
            fontSize: 28, color: '#1a1a2e', fontWeight: 900,
            position: 'relative', zIndex: 1
          }}>
            当前商品竞拍已结束
          </div>
        )}

        <div style={{ display: 'flex', gap: 18, alignItems: 'center', position: 'relative', zIndex: 1, padding: '0 32px' }}>
          <div style={{
            width: 140, height: 140, borderRadius: 20, background: 'linear-gradient(135deg, #f8f8f8 0%, #fff0f5 100%)',
            flexShrink: 0, overflow: 'hidden', position: 'relative',
            boxShadow: '0 8px 24px rgba(0,0,0,0.08)'
          }}>
            <div style={{
              position: 'absolute', top: 0, left: 0,
              width: 50, height: 50, borderRadius: '0 0 20px 0',
              background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: 20,
              fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 2
            }}>
              1
            </div>
            {images[0] ? (
              <img src={images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ddd', fontSize: 60 }}>📦</div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 22, color: '#999' }}>当前价</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: '50%',
                      background: 'linear-gradient(135deg, #ff2442 0%, #ff6b8a 100%)',
                      color: '#fff', fontSize: 18,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700,
                      boxShadow: '0 2px 10px rgba(255,36,66,0.35)'
                    }}>
                      {leaderName[0] || '?'}
                    </div>
                    <span style={{ fontSize: 26, color: '#ff2442', fontWeight: 900, background: 'rgba(255,36,66,0.12)', padding: '6px 14px', borderRadius: 24 }}>{leaderName} 领先</span>
                  </div>
                </div>
                <div style={{ fontSize: 68, fontWeight: 900, color: '#0a0a0a', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', marginTop: 8 }} className="price-text-glow">
                  {fmtMoney(currentPrice)}
                </div>
              </div>
              <div style={{ textAlign: 'right', maxWidth: '45%' }}>
                <div style={{ fontSize: 28, color: '#1a1a2e', fontWeight: 900, lineHeight: 1.2, marginBottom: 10 }}>
                  {auction.product?.name || '金镶玉平安扣和田玉吊坠项链首饰'}
                </div>
                <div style={{ fontSize: 22, color: '#999', marginBottom: 6 }}>我的出价</div>
                <div style={{ fontSize: 48, color: '#c0c0c0', fontWeight: 800 }}>
                  {myBidAmount > 0 ? fmtMoney(myBidAmount) : '暂无出价'}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: '0 40px' }}>
          {showHighBidTip && !sold && diff > 0 && diff !== auction.increment && (
            <div style={{
              textAlign: 'center', fontSize: 22, color: '#ff2442',
              marginBottom: 28, padding: '18px 36px',
              background: 'linear-gradient(135deg, rgba(255,36,66,0.12) 0%, rgba(255,36,66,0.2) 100%)',
              borderRadius: '0 0 32px 32px', fontWeight: 800, display: 'inline-block', marginLeft: 'auto', marginRight: 'auto',
              position: 'relative', marginTop: -12, zIndex: 2,
              border: '1px solid rgba(255,36,66,0.15)'
            }}>
              高于当前价¥{(diff / 100).toFixed(0)}元
              <div style={{
                position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)',
                width: 0, height: 0, borderLeft: '16px solid transparent',
                borderRight: '16px solid transparent',
                borderBottom: '16px solid rgba(255,36,66,0.2)'
              }} />
            </div>
          )}
          {showHighestTip && !sold && isHighest && myLastBid > 0 && (
            <div style={{
              textAlign: 'center', fontSize: 22, color: '#ff2442',
              marginBottom: 28, padding: '18px 36px',
              background: 'linear-gradient(135deg, rgba(255,36,66,0.12) 0%, rgba(255,36,66,0.2) 100%)',
              borderRadius: '0 0 32px 32px', fontWeight: 800, display: 'inline-block', marginLeft: 'auto', marginRight: 'auto',
              position: 'relative', marginTop: -12, zIndex: 2,
              border: '1px solid rgba(255,36,66,0.15)'
            }}>
              当前您已是最高价
              <div style={{
                position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)',
                width: 0, height: 0, borderLeft: '16px solid transparent',
                borderRight: '16px solid transparent',
                borderBottom: '16px solid rgba(255,36,66,0.2)'
              }} />
            </div>
          )}

          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 72, marginBottom: 32
          }}>
            <button
              disabled={sold || loading}
              onClick={() => setAmount(Math.max(minBid, amount - auction.increment))}
              style={{
                width: 110, height: 110, borderRadius: 20, fontSize: 52,
                border: '2px solid rgba(0,0,0,0.08)', background: '#fff',
                color: '#222', fontWeight: 300, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
                transition: 'all 0.15s'
              }}
            >
              −
            </button>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 110, fontWeight: 900, color: '#0a0a0a', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', lineHeight: 1 }} className="price-text-glow">
                {fmtMoney(amount)}
              </div>
              <div style={{ fontSize: 24, color: '#999', marginTop: 10, fontWeight: 600 }}>
                加价幅度 ¥{(auction.increment / 100).toFixed(0)}
              </div>
            </div>
            <button
              disabled={sold || loading}
              onClick={() => setAmount(amount + auction.increment)}
              style={{
                width: 110, height: 110, borderRadius: 20, fontSize: 52,
                border: '2px solid rgba(0,0,0,0.08)', background: '#fff',
                color: '#222', fontWeight: 300, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
                transition: 'all 0.15s'
              }}
            >
              +
            </button>
          </div>

          {error && (
            <div style={{ color: '#ff2442', fontSize: 19, marginBottom: 24, textAlign: 'center', fontWeight: 700, padding: '14px', background: 'rgba(255,36,66,0.1)', borderRadius: 16 }}>
              {error}
            </div>
          )}

          {autoCloseTip && (
            <div style={{
              textAlign: 'center', color: '#fff', fontSize: 21, fontWeight: 800,
              background: 'linear-gradient(90deg, rgba(255, 36, 66, 0.4) 0%, rgba(255, 36, 66, 0.55) 100%)', borderRadius: 999, padding: '16px 32px', marginBottom: 24
            }}>{autoCloseTip}</div>
          )}

          <button
            disabled={sold || loading}
            onClick={handleBid}
            className={!sold && !loading ? 'bid-btn-glow' : ''}
            style={{
              width: '100%', height: 94, borderRadius: 999,
              background: sold ? '#ffcccc' : 'linear-gradient(90deg, #ff2442 0%, #ff3344 25%, #ff6b8a 50%, #ff3344 75%, #ff2442 100%)',
              backgroundSize: '200% 100%',
              color: '#fff', fontSize: 28, fontWeight: 900,
              border: 'none', cursor: 'pointer',
              animation: 'neonBorder 3s ease infinite',
              position: 'relative', overflow: 'hidden'
            }}
          >
            {loading ? '⚡ 出价中...' : sold ? '拍卖已结束' : '立即出价'}
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 24 }}>
          <div style={{ width: 140, height: 10, background: 'linear-gradient(90deg, #1a1a1a 0%, #333 50%, #1a1a1a 100%)', borderRadius: 999 }} />
        </div>
      </div>
    </div>
  )
}
