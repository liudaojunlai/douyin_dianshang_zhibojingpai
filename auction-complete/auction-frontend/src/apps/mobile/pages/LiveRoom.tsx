import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { auctionApi } from '@/services/api'
import { useAuction } from '@/hooks/useAuction'
import { useAuthStore } from '@/stores/authStore'
import ProductListPanel from '@/components/auction/ProductListPanel'
import BidModal from '@/components/auction/BidModal'
import AuctionResultModal from '@/components/auction/AuctionResultModal'
import BidPanel from '@/components/auction/BidPanel'
import Leaderboard from '@/components/auction/Leaderboard'
import LiveVideoPlayer from '@/components/auction/LiveVideoPlayer'
import type { Auction } from '@/types'

export default function LiveRoomPage() {
  const { id } = useParams<{ id: string }>()
  const auctionId = Number(id) || 1
  const user = useAuthStore(s => s.user)
  const prevPriceRef = useRef(0)
  const [priceAnimation, setPriceAnimation] = useState(false)

  const [showProductList, setShowProductList] = useState(false)
  const [showBidModal, setShowBidModal] = useState(false)
  const [showResultModal, setShowResultModal] = useState(false)
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [selectedAuction, setSelectedAuction] = useState<Auction | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['auction', auctionId],
    queryFn: () => auctionApi.getById(auctionId).then(r => r.data.data as Auction),
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 5,
    retryDelay: 1000,
  })

  const FALLBACK_AUCTION: Auction = {
    id: auctionId,
    seller_id: 1,
    product_id: 1,
    product: {
      id: 1,
      name: '手机',
      images: '[]',
      seller_id: 1,
      description: '',
      created_at: new Date().toISOString(),
    },
    start_price: 10000,
    current_price: 410000,
    increment: 5000,
    cap_price: 0,
    duration: 600,
    delay_seconds: 10,
    status: 'active',
    end_time: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    extend_count: 0,
    created_at: new Date().toISOString(),
  }

  const safeAuction: Auction = data || FALLBACK_AUCTION
  const { state, addNotif, sendComment } = useAuction(auctionId, safeAuction)
  const [inputText, setInputText] = useState('')
  const commentsEndRef = useRef<HTMLDivElement>(null)
  const commentsContainerRef = useRef<HTMLDivElement>(null)
  const isNearBottomRef = useRef(true)
  // 优先使用 API 返回的数据（含完整 seller 信息），WebSocket 状态仅更新价格/倒计时等
  const auction = safeAuction

  useEffect(() => {
    if (state.currentPrice > prevPriceRef.current && prevPriceRef.current > 0) {
      setPriceAnimation(true)
      setTimeout(() => setPriceAnimation(false), 800)
    }
    prevPriceRef.current = state.currentPrice
  }, [state.currentPrice])

  useEffect(() => {
    if (state.sold && state.soldData) {
      setShowResultModal(true)
    }
  }, [state.sold, state.soldData])

  const isActive = auction.status === 'active'

  const handleSelectAuction = (a: Auction) => {
    setSelectedAuction(a)
    setShowProductList(false)
    setTimeout(() => setShowBidModal(true), 250)
  }

  const handleBidSuccess = (actualAmount: number) => {
    addNotif('bid_success', '出价成功！')
  }

  const handleSendComment = () => {
    const text = inputText.trim()
    if (text && text.length > 0 && text.length <= 200) {
      sendComment(text)
      setInputText('')
    }
  }

  // 检测用户是否在评论区底部附近
  const handleScroll = useCallback(() => {
    const el = commentsContainerRef.current
    if (!el) return
    const threshold = 60
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold
  }, [])

  useEffect(() => {
    const el = commentsContainerRef.current
    if (!el) return
    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  useEffect(() => {
    if (isNearBottomRef.current && commentsEndRef.current) {
      commentsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [state.comments])

  const currentPriceYuan = state.currentPrice / 100
  // 当前领先者昵称（从排行榜取第1名）
  const leaderNickname = state.leaderboard.length > 0
    ? state.leaderboard[0].userId === String(user?.id) ? '你' : (state.leaderboard[0].nickname || `用户${state.leaderboard[0].userId}`)
    : undefined
  // 我的出价金额（从排行榜实时获取，刷新后依然保留）
  const myLastBid = state.leaderboard.find(e => e.userId === String(user?.id))?.amount || 0

  if (isLoading && !data) {
    return (
      <div style={{
        maxWidth: 480, margin: '0 auto', background: '#000',
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff'
      }}>加载中...</div>
    )
  }

  const formatRemainTime = (ms: number) => {
    const total = Math.max(0, Math.floor(ms / 1000))
    const m = Math.floor(total / 60)
    const s = total % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  return (
    <div style={{
      maxWidth: 480, margin: '0 auto', background: '#000',
      minHeight: '100vh', position: 'relative', overflow: 'hidden',
      display: 'flex', flexDirection: 'column'
    }}>
      <style>{`
        @keyframes priceBounce {
          0% { transform: scale(1); }
          30% { transform: scale(1.15); color: #ff2442; }
          100% { transform: scale(1); }
        }
        @keyframes livePulse {
          0%,100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.4); }
        }
        @keyframes floatUp {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .price-animate {
          animation: priceBounce 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }
        .live-dot {
          animation: livePulse 1.5s ease-in-out infinite;
        }
        .float-in {
          animation: floatUp 0.5s ease;
        }
        .fade-in {
          animation: fadeIn 0.3s ease;
        }
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      <div style={{
        position: 'relative', height: '50vh', minHeight: 320,
        overflow: 'hidden', background: '#000'
      }}>
        <LiveVideoPlayer
          anchorName={auction.product?.seller?.nickname || '主播'}
          onlineCount={state.onlineCount}
        />

        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 180,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)',
          pointerEvents: 'none'
        }} />

        <div style={{
          position: 'absolute', top: 16, left: 12, right: 12,
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 10
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'rgba(0,0,0,0.5)', borderRadius: 24,
            padding: '6px 14px 6px 6px', backdropFilter: 'blur(10px)'
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: 'linear-gradient(135deg, #ff6b8a 0%, #ff2442 100%)',
              overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 20, fontWeight: 700
            }}>
              {auction.product?.seller?.nickname?.[0] || '主'}
            </div>
            <div>
              <div style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>
                {auction.product?.seller?.nickname || '主播'}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>
                {state.onlineCount || 6.8}万本场点赞
              </div>
            </div>
            <div style={{
              background: '#ff2442', color: '#fff', fontSize: 15,
              padding: '6px 14px', borderRadius: 18, fontWeight: 700,
              marginLeft: 8
            }}>
              关注
            </div>
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(0,0,0,0.5)', borderRadius: 24,
            padding: '6px 12px', backdropFilter: 'blur(10px)'
          }}>
            {[1,2,3].map(i => (
              <div key={i} style={{
                width: 40, height: 40, borderRadius: '50%',
                background: '#333', border: '1.5px solid rgba(255,255,255,0.3)',
                overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 16, fontWeight: 600
              }}>
                {['A', 'B', 'C'][i-1]}
              </div>
            ))}
            <span style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>
              {state.onlineCount || 2333}
            </span>
          </div>
        </div>

        <div style={{
          position: 'absolute', top: 72, left: 12, zIndex: 10,
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(0,0,0,0.5)', borderRadius: 16,
          padding: '7px 14px'
        }}>
          <div style={{
            width: 14, height: 14, borderRadius: '50%',
            background: '#ff2442'
          }} className="live-dot" />
          <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>
            直播中
          </span>
        </div>

        <div style={{
          position: 'absolute', top: 72, left: 130, zIndex: 10,
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(0,0,0,0.5)', borderRadius: 16,
          padding: '7px 14px'
        }}>
          <span style={{ color: '#fbbf24', fontSize: 14, fontWeight: 700 }}>🔥热点</span>
          <span style={{ color: '#fff', fontSize: 14 }}>明星大侦探</span>
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>小时榜第8名</span>
        </div>

        <div style={{
          position: 'absolute', top: 72, right: 12, zIndex: 10,
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(0,0,0,0.5)', borderRadius: 16,
          padding: '7px 14px'
        }}>
          <span style={{ color: '#fbbf24', fontSize: 18 }}>●</span>
          <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>更多直播</span>
          <span style={{ color: '#fff', fontSize: 16 }}>›</span>
        </div>
      </div>

      <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', background: '#000' }}>
        <div style={{
          margin: '-32px 16px 16px', position: 'relative', zIndex: 20
        }}>
          <div style={{
            background: '#fff', borderRadius: 32,
            padding: '24px 28px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 16, color: '#999', marginBottom: 6 }}>
                  {state.sold ? '落槌价' : isActive ? '当前最高价' : '起拍价'}
                </div>
                <div style={{
                  fontSize: 56, fontWeight: 900, color: '#ff2442',
                  fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif'
                }} className={priceAnimation ? 'price-animate' : ''}>
                  ¥{currentPriceYuan.toFixed(0)}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 16, color: '#999', marginBottom: 6 }}>
                  {state.sold ? '竞拍结束' : '剩余时间'}
                </div>
                {state.sold ? (
                  <div style={{ fontSize: 40, fontWeight: 900, color: '#ff2442' }}>
                    已成交
                  </div>
                ) : state.cancelled ? (
                  <div style={{ fontSize: 40, fontWeight: 900, color: '#999' }}>已取消</div>
                ) : (
                  <div style={{ 
                    fontSize: 52, fontWeight: 900, color: '#fbbf24', 
                    fontFamily: 'monospace', textShadow: '0 0 20px rgba(251,191,36,0.4)' 
                  }}>
                    {formatRemainTime(state.remainMs)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {isActive && !state.sold && (
          <div style={{ padding: '0 16px 12px' }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => {
                  setSelectedAuction(auction)
                  setShowBidModal(true)
                }}
                style={{
                  flex: 1, padding: '18px 0', borderRadius: 999,
                  border: 'none', 
                  background: 'linear-gradient(90deg, #ff3344 0%, #ff5566 100%)',
                  color: '#fff', fontSize: 20, fontWeight: 800, cursor: 'pointer',
                  boxShadow: '0 6px 24px rgba(255,51,68,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                }}>
                🔥 出价
              </button>
              <button
                onClick={() => setShowLeaderboard(true)}
                style={{
                  flex: 1, padding: '18px 0', borderRadius: 999,
                  border: 'none', 
                  background: 'rgba(30,40,60,0.8)',
                  color: '#fbbf24', fontSize: 20, fontWeight: 800, cursor: 'pointer',
                  backdropFilter: 'blur(8px)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                }}>
                  🏆 排行榜
              </button>
            </div>
          </div>
        )}

        {/* 商品图片 */}
        {(() => {
          try {
            const imgs: string[] = JSON.parse(auction.product?.images || '[]')
            if (imgs.length > 0) {
              return (
                <div style={{
                  margin: '0 16px 12px', borderRadius: 16,
                  overflow: 'hidden', height: 200,
                  background: 'rgba(255,255,255,0.05)',
                  position: 'relative'
                }}>
                  <img src={imgs[0]} alt={auction.product?.name || ''}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{
                    position: 'absolute', top: '50%', right: 0,
                    transform: 'translateY(-50%)',
                    padding: '12px 18px',
                    background: 'rgba(0,0,0,0.92)',
                    borderRadius: '20px 0 0 20px',
                    maxWidth: '65%',
                    border: '1px solid rgba(255,255,255,0.15)'
                  }}>
                    <span style={{ color: '#fff', fontSize: 16, fontWeight: 700, textAlign: 'right', display: 'block' }}>
                      {auction.product?.name || ''}
                    </span>
                  </div>
                </div>
              )
            }
          } catch {}
          return null
        })()}

        {state.extendCount > 0 && (
          <div style={{
            margin: '0 16px 12px', padding: '12px 16px',
            background: 'rgba(34,197,94,0.12)', borderRadius: 16,
            color: '#22c55e', fontSize: 14, fontWeight: 600,
            textAlign: 'center', border: '1px solid rgba(34,197,94,0.2)'
          }}>
            已延时 {state.extendCount} 次，最后关头有人出价！
          </div>
        )}

        {/* 评论区 — 底部浮层，可滚动查看历史 */}
        <div style={{
          position: 'absolute', left: 0, right: 0,
          bottom: 76, maxHeight: '40%', zIndex: 30,
          padding: '24px 12px 0',
          overflowY: 'scroll',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          display: 'flex', flexDirection: 'column',
          WebkitOverflowScrolling: 'touch',
          background: 'linear-gradient(transparent, rgba(0,0,0,0.15) 30%)'
        }} ref={commentsContainerRef}
        className="hide-scrollbar">
          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 4 }}>
            {state.comments.map((comment, i) => (
              <div key={`${comment.timestamp}-${i}`} className="float-in" style={{
                display: 'inline-flex', alignItems: 'center', gap: 10,
                background: 'rgba(0,0,0,0.5)', borderRadius: 22,
                padding: '6px 14px 6px 6px', alignSelf: 'flex-start',
                backdropFilter: 'blur(8px)',
                maxWidth: '85%'
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: `linear-gradient(135deg, hsl(${(comment.user_id * 137) % 360}, 80%, 60%), hsl(${(comment.user_id * 137 + 40) % 360}, 80%, 50%))`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 14, fontWeight: 700, flexShrink: 0
                }}>
                  {comment.nickname?.[0] || 'U'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ color: '#fbbf24', fontSize: 15, fontWeight: 700, lineHeight: 1.2 }}>
                    {comment.nickname}
                  </span>
                  <span style={{ color: '#fff', fontSize: 16, lineHeight: 1.3 }}>
                    {comment.text}
                  </span>
                </div>
              </div>
            ))}
            <div ref={commentsEndRef} />
          </div>
        </div>

        <div style={{
          padding: '8px 12px 24px',
          display: 'flex', alignItems: 'center', gap: 12
        }}>
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendComment()}
            placeholder="说点什么..."
            maxLength={200}
            style={{
              flex: 1, background: 'rgba(255,255,255,0.12)', borderRadius: 28,
              padding: '12px 20px', color: '#fff',
              fontSize: 16, border: 'none', outline: 'none'
            }}
          />

          <div style={{
              display: 'flex', alignItems: 'center', gap: 12
            }}>
              <button
                onClick={handleSendComment}
                style={{
                  width: 52, height: 52, borderRadius: '50%',
                  border: 'none', background: 'linear-gradient(135deg, #ff2442 0%, #ff6b8a 100%)',
                  color: '#fff', fontSize: 22, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 16px rgba(255,36,66,0.5)'
                }}>
                ✉️
              </button>
              <button
                onClick={() => setShowProductList(true)}
                style={{
                  width: 52, height: 52, borderRadius: '50%',
                  border: 'none', background: 'rgba(255,255,255,0.12)',
                  color: '#fff', fontSize: 24, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                🛒
              </button>
            <button style={{
              width: 52, height: 52, borderRadius: '50%',
              border: 'none', background: 'rgba(255,255,255,0.12)',
              color: '#fff', fontSize: 24, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              😊
            </button>
            <button style={{
              width: 52, height: 52, borderRadius: '50%',
              border: 'none', background: 'rgba(255,255,255,0.12)',
              color: '#fff', fontSize: 24, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              ❤️
            </button>
            <button style={{
              width: 52, height: 52, borderRadius: '50%',
              border: 'none', background: 'rgba(255,255,255,0.12)',
              color: '#fff', fontSize: 24, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              🎁
            </button>
          </div>
        </div>
      </div>

      {showProductList && (
        <ProductListPanel
          currentAuctionId={auctionId}
          sellerId={auction.seller_id}
          onSelectAuction={handleSelectAuction}
          onClose={() => setShowProductList(false)}
        />
      )}

      {showLeaderboard && (
        <Leaderboard entries={state.leaderboard} onClose={() => setShowLeaderboard(false)} />
      )}

      {showBidModal && selectedAuction && (
        <BidModal
          auction={selectedAuction}
          currentPrice={selectedAuction.id === auctionId ? state.currentPrice : selectedAuction.current_price}
          remainMs={selectedAuction.id === auctionId ? state.remainMs : 600000}
          sold={selectedAuction.id === auctionId ? state.sold : selectedAuction.status === 'sold'}
          myLastBid={myLastBid}
          winnerId={state.soldData?.winner_id}
          userId={user?.id}
          leaderNickname={leaderNickname}
          onBidSuccess={handleBidSuccess}
          onBidFail={(msg) => addNotif('overtaken', msg)}
          onClose={() => setShowBidModal(false)}
        />
      )}

      {showResultModal && state.soldData && (
        <AuctionResultModal
          auction={auction}
          soldData={state.soldData}
          isWinner={user?.id === state.soldData.winner_id}
          onClose={() => setShowResultModal(false)}
        />
      )}
    </div>
  )
}
