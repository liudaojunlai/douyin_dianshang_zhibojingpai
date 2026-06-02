import { useState, useCallback, useRef } from 'react'
import { bidApi } from '@/services/api'
import type { Auction } from '@/types'

interface Props {
  auction: Auction
  currentPrice: number
  onBidSuccess?: (amount: number) => void
  onBidFail?: (msg: string) => void
  disabled?: boolean
}

export default function BidPanel({ auction, currentPrice, onBidSuccess, onBidFail, disabled }: Props) {
  const minBid = currentPrice + auction.increment
  const [amount, setAmount] = useState(minBid)
  const [loading, setLoading] = useState(false)
  const [lastError, setLastError] = useState('')
  const lastBidTime = useRef(0)

  const adjustedMin = Math.max(amount, minBid)

  const handleBid = useCallback(async () => {
    const now = Date.now()
    if (now - lastBidTime.current < 100) return
    lastBidTime.current = now

    const bidAmount = Math.max(amount, minBid)
    if ((bidAmount - auction.start_price) % auction.increment !== 0) {
      setLastError(`出价需为加价幅度 ¥${(auction.increment / 100).toFixed(0)} 的整数倍`)
      return
    }

    setLoading(true)
    setLastError('')
    try {
      await bidApi.placeBid(auction.id, bidAmount)
      onBidSuccess?.(bidAmount)
      setAmount(bidAmount + auction.increment)
    } catch (err: any) {
      const msg = err.response?.data?.message || '出价失败，请重试'
      setLastError(msg)
      onBidFail?.(msg)
    } finally {
      setLoading(false)
    }
  }, [amount, minBid, auction, onBidSuccess, onBidFail])

  const quickBids = [1, 2, 3, 5].map(n => minBid + auction.increment * (n - 1))

  return (
    <div style={{
      background: 'linear-gradient(180deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.85) 100%)',
      borderRadius: '32px 32px 0 0', padding: '24px 24px 32px',
      backdropFilter: 'blur(16px)',
      position: 'relative',
      borderTop: '1px solid rgba(255,255,255,0.06)'
    }}>
      <style>{`
        @keyframes bidPanelGlow {
          0%, 100% { box-shadow: 0 8px 32px rgba(255,36,66,0.25); }
          50% { box-shadow: 0 12px 48px rgba(255,36,66,0.45); }
        }
        @keyframes quickBtnPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.04); }
        }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 20 }}>
        <div style={{ width: 48, height: 5, background: 'rgba(255,255,255,0.25)', borderRadius: 3 }} />
      </div>

      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 20, color: '#fff', fontWeight: 700, marginBottom: 12, letterSpacing: 1 }}>
          距竞拍结束仅剩 <span style={{ color: '#fbbf24', fontSize: 24, fontWeight: 900 }}>09:20</span>
        </div>
        <div style={{ fontSize: 80, fontWeight: 900, color: '#0a0a0a', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', lineHeight: 1 }}>
          ¥{(amount / 100).toFixed(0)}
        </div>
        <div style={{ fontSize: 22, color: '#999', marginTop: 10 }}>
          加价幅度 ¥{(auction.increment / 100).toFixed(0)}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 48, justifyContent: 'center', marginBottom: 28 }}>
        <button
          onClick={() => setAmount(Math.max(minBid, amount - auction.increment))}
          disabled={disabled}
          style={{
            width: 96, height: 96, borderRadius: 16,
            border: '2px solid #e8e8e8', background: '#f8f8f8',
            color: '#333', fontWeight: 300, fontSize: 44, cursor: disabled ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
          −
        </button>
        <button
          onClick={() => setAmount(amount + auction.increment)}
          disabled={disabled}
          style={{
            width: 96, height: 96, borderRadius: 16,
            border: '2px solid #e8e8e8', background: '#f8f8f8',
            color: '#333', fontWeight: 300, fontSize: 44, cursor: disabled ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
          +
        </button>
      </div>

      {lastError && (
        <div style={{
          color: '#ff2442', fontSize: 16, marginBottom: 16, textAlign: 'center', fontWeight: 700,
          padding: '12px 16px', background: 'rgba(255,36,66,0.12)', borderRadius: 12
        }}>
          {lastError}
        </div>
      )}

      <button
        onClick={handleBid}
        disabled={loading || disabled}
        style={{
          width: '100%',
          padding: '22px 0',
          borderRadius: 999,
          border: 'none',
          background: loading || disabled ? 'rgba(255,150,150,0.35)' : 'linear-gradient(135deg, #ff2442 0%, #ff5577 100%)',
          color: '#fff',
          fontWeight: 800,
          fontSize: 26,
          cursor: loading || disabled ? 'not-allowed' : 'pointer',
          boxShadow: loading || disabled ? 'none' : '0 8px 32px rgba(255,36,66,0.45)',
          transition: 'all 0.25s'
        }}
      >
        {loading ? '出价中...' : `立即出价`}
      </button>
    </div>
  )
}
