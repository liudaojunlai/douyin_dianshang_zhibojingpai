import { useEffect, useState } from 'react'
import type { Auction, AuctionSoldData } from '@/types'

interface Props {
  auction: Auction
  soldData: AuctionSoldData
  isWinner: boolean
  onClose: () => void
}

function fmtMoney(v: number) {
  return '¥' + (v / 100).toFixed(0)
}

export default function AuctionResultModal({ auction, soldData, isWinner, onClose }: Props) {
  const images = (() => { try { return JSON.parse(auction.product?.images || '[]') } catch { return [] } })()
  const [payCountdown, setPayCountdown] = useState(20 * 60 + 23)
  const [showFireworks, setShowFireworks] = useState(true)

  useEffect(() => {
    const t = setInterval(() => {
      setPayCountdown(c => Math.max(0, c - 1))
    }, 1000)
    return () => clearInterval(t)
  }, [])

  const pad = (n: number) => String(n).padStart(2, '0')
  const payTimeStr = `${pad(Math.floor(payCountdown / 60))}:${pad(payCountdown % 60)}`

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 3000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.75)', padding: 16
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 24,
        width: '100%', maxWidth: 380,
        overflow: 'hidden',
        animation: 'popIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
        position: 'relative'
      }}>
        <style>{`
          @keyframes popIn { from { opacity:0; transform:scale(0.75) translateY(30px); } to { opacity:1; transform:scale(1) translateY(0); } }
          @keyframes floatParticle {
            0% { opacity: 1; transform: translateY(0) scale(1); }
            100% { opacity: 0; transform: translateY(-60px) scale(1.5); }
          }
          @keyframes confetti {
            0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
            100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
          }
        `}</style>

        {isWinner ? (
          <div>
            <div style={{
              background: 'linear-gradient(135deg, #fff5f0 0%, #fffaf5 50%, #fff5f5 100%)',
              padding: '40px 24px 28px',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{
                position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
                fontSize: 36, fontWeight: 900, color: '#fbbf24',
                letterSpacing: 3, textShadow: '0 4px 20px rgba(251,191,36,0.3)',
                zIndex: 2
              }}>
                恭喜竞拍成功
                <span style={{ position: 'absolute', top: -8, right: -20, fontSize: 40 }}>🎉</span>
              </div>

              <div style={{
                position: 'absolute', top: 70, left: '50%', transform: 'translateX(-50%)',
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'rgba(255,36,66,0.1)', borderRadius: 999,
                padding: '6px 20px', zIndex: 2
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #ff6b35 0%, #ff2442 100%)',
                  color: '#fff', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>豪</div>
                <span style={{ fontSize: 17, color: '#ff2442', fontWeight: 700 }}>豪气冲天</span>
              </div>

              <div style={{ display: 'flex', gap: 18, alignItems: 'center', textAlign: 'left', marginTop: 52, position: 'relative', zIndex: 2 }}>
                <div style={{
                  width: 90, height: 90, borderRadius: 14, background: '#f8f8f8',
                  overflow: 'hidden', flexShrink: 0,
                  boxShadow: '0 6px 20px rgba(0,0,0,0.1)'
                }}>
                  {images[0] ? (
                    <img src={images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc', fontSize: 36 }}>📦</div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 17, color: '#1a1a2e', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {auction.product?.name}
                  </div>
                  <div style={{ fontSize: 36, color: '#ff2442', fontWeight: 900, marginTop: 10 }}>
                    {fmtMoney(soldData.final_price)}
                  </div>
                </div>
              </div>

              {showFireworks && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', overflow: 'hidden' }}>
                  {[...Array(20)].map((_, i) => (
                    <div key={i} style={{
                      position: 'absolute',
                      left: `${Math.random() * 100}%`,
                      top: `${Math.random() * 100}%`,
                      width: 8 + Math.random() * 12,
                      height: 8 + Math.random() * 12,
                      borderRadius: '50%',
                      background: ['#ff2442', '#fbbf24', '#ff6b35', '#a855f7', '#3b82f6', '#22c55e'][i % 6],
                      animation: `floatParticle ${1 + Math.random()}s ease-out forwards`,
                      animationDelay: `${Math.random() * 0.8}s`
                    }} />
                  ))}
                </div>
              )}
            </div>

            <div style={{ padding: '24px 24px 20px' }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                fontSize: 15, color: '#666', marginBottom: 24
              }}>
                <span style={{ fontWeight: 600 }}>保证金</span>
                <span style={{ color: '#999' }}>拍品付款后退回</span>
              </div>

              <button style={{
                width: '100%', padding: '18px 0', borderRadius: 999,
                border: 'none', background: 'linear-gradient(135deg, #ff2442 0%, #ff5577 100%)',
                color: '#fff', fontSize: 19, fontWeight: 800, cursor: 'pointer',
                boxShadow: '0 8px 24px rgba(255,36,66,0.4)'
              }}>
                确认地址并支付
              </button>

              <div style={{
                textAlign: 'center', fontSize: 14, color: '#999',
                marginTop: 18
              }}>
                距购买失效还剩 <span style={{ color: '#ff2442', fontFamily: 'monospace', fontSize: 17, fontWeight: 800 }}>00:{payTimeStr}</span>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div style={{
              background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 30%, #1e1e3a 70%, #1a1a2e 100%)',
              padding: '44px 24px 32px',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{
                position: 'absolute', top: -100, right: -100,
                width: 280, height: 280,
                background: 'radial-gradient(circle, rgba(251,191,36,0.15) 0%, transparent 70%)'
              }} />
              <div style={{
                position: 'absolute', bottom: -80, left: -80,
                width: 220, height: 220,
                background: 'radial-gradient(circle, rgba(255,36,66,0.12) 0%, transparent 70%)'
              }} />

              <div style={{
                textAlign: 'center',
                position: 'relative', zIndex: 2
              }}>
                <div style={{
                  fontSize: 38, fontWeight: 900, color: '#fbbf24',
                  letterSpacing: 4,
                  textShadow: '0 4px 30px rgba(251,191,36,0.4)',
                  marginBottom: 4
                }}>
                  落槌定音
                </div>
                <div style={{
                  fontSize: 26, fontWeight: 800, color: '#fff',
                  marginTop: 4,
                  textShadow: '0 2px 15px rgba(251,191,36,0.25)'
                }}>
                  恭喜成交！！
                </div>
              </div>

              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 10, marginTop: 24, marginBottom: 12, position: 'relative', zIndex: 2
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #ff2442 0%, #ff6b6b 100%)',
                  color: '#fff', fontSize: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700,
                  boxShadow: '0 4px 16px rgba(255,36,66,0.4)'
                }}>
                  黄
                </div>
                <span style={{ color: '#fff', fontSize: 20, fontWeight: 700 }}>黄***</span>
              </div>

              <div style={{ color: '#fbbf24', fontSize: 15, textAlign: 'center', position: 'relative', zIndex: 2 }}>
                经过3轮的激烈竞拍成功拍下
              </div>

              <div style={{ textAlign: 'center', marginTop: 16, position: 'relative', zIndex: 2 }}>
                <div style={{
                  fontSize: 56, fontWeight: 900, color: '#fbbf24',
                  textShadow: '0 0 40px rgba(251,191,36,0.5)'
                }}>
                  {fmtMoney(soldData.final_price)}
                </div>
                <div style={{ fontSize: 15, color: '#94a3b8', marginTop: 6, fontWeight: 600 }}>
                  最终成交价
                </div>
              </div>
            </div>

            <div style={{ padding: '24px 24px 20px', textAlign: 'center' }}>
              <button
                onClick={onClose}
                style={{
                  padding: '14px 50px', borderRadius: 999,
                  border: 'none', background: '#f5f5f5',
                  color: '#333', fontSize: 18, cursor: 'pointer',
                  fontWeight: 700,
                  transition: 'all 0.2s'
                }}>
                我知道了
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
