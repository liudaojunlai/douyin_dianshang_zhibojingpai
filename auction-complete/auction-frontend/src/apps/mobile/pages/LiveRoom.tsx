import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { auctionApi } from '@/services/api'
import { useAuction } from '@/hooks/useAuction'
import { useAuthStore } from '@/stores/authStore'
import ProductListPanel from '@/components/auction/ProductListPanel'
import BidModal from '@/components/auction/BidModal'
import AuctionResultModal from '@/components/auction/AuctionResultModal'
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

  const { data, isLoading } = useQuery({
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

  const handleBidSuccess = (_actualAmount: number) => {
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

  const formatRemainTime = (ms: number) => {
    const total = Math.max(0, Math.floor(ms / 1000))
    const m = Math.floor(total / 60)
    const s = total % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const formatCount = (n: number) => n >= 10000 ? (n / 10000).toFixed(1) + '万' : String(n)

  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(Math.floor(Math.random() * 8000 + 2000))
  const handleLike = () => { setLiked(!liked); if (!liked) setLikeCount(c => c + 1) }

  const anchorName = auction.product?.seller?.nickname || '主播'

  if (isLoading && !data) {
    return (
      <div style={{
        width: '100vw', height: '100vh', background: '#000',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff'
      }}>加载中...</div>
    )
  }

  return (
    <div style={{
      width: '100vw', height: '100vh',
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      background: '#000'
    }}>
      <div style={{
        width: '100%', maxWidth: 400, height: '100vh',
        position: 'relative', overflow: 'hidden'
      }}>
      <style>{`
        @keyframes priceBounce {
          0% { transform: scale(1); }
          30% { transform: scale(1.15); color: #fe2c55; }
          100% { transform: scale(1); }
        }
        @keyframes livePulse {
          0%,100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes floatUp {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes likeAnim {
          0% { transform: scale(1); }
          25% { transform: scale(1.3); }
          50% { transform: scale(0.9); }
          100% { transform: scale(1); }
        }
        @keyframes btnPulse {
          0%,100% { box-shadow: 0 8px 32px rgba(254,44,85,0.4); }
          50% { box-shadow: 0 8px 48px rgba(254,44,85,0.7); }
        }
        .price-animate { animation: priceBounce 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55); }
        .live-dot { animation: livePulse 1.5s ease-in-out infinite; }
        .float-in { animation: floatUp 0.5s ease; }
        .like-bounce { animation: likeAnim 0.4s ease; }
        .bid-glow { animation: btnPulse 1.8s ease-in-out infinite; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>

      {/* 视频背景 — 覆盖中间内容区域（包括上下） */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <LiveVideoPlayer />
      </div>

      {/* Layer 1: 顶部栏 — 紧凑 */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
        paddingTop: 'max(env(safe-area-inset-top, 6px), 6px)'
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => window.history.back()} style={{
              width: 32, height: 32, borderRadius: '50%', border: 'none',
              background: 'rgba(0,0,0,0.35)', color: '#fff', fontSize: 18,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0
            }}>←</button>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(0,0,0,0.35)', borderRadius: 20,
              padding: '3px 10px 3px 3px'
            }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: 'linear-gradient(135deg, #fe2c55 0%, #ff6b8a 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 13, fontWeight: 700, flexShrink: 0
              }}>{anchorName[0] || '主'}</div>
              <div>
                <div style={{ color: '#fff', fontSize: 12, fontWeight: 600, lineHeight: 1.2 }}>
                  {anchorName}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, lineHeight: 1.2 }}>
                  {formatCount(state.onlineCount)}人
                </div>
              </div>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0,
              background: '#fe2c55', borderRadius: 10, padding: '3px 8px'
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} className="live-dot" />
              <span style={{ color: '#fff', fontSize: 10, fontWeight: 700 }}>直播</span>
            </div>
          </div>

          <button style={{
            width: 32, height: 32, borderRadius: '50%', border: 'none',
            background: 'rgba(0,0,0,0.35)', color: '#fff', fontSize: 16,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0
          }}>···</button>
        </div>
      </div>

      {/* Layer 2: 右侧操作按钮 — 靠上更紧凑 */}
      <div style={{
        position: 'absolute', right: 8, top: '28%',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, zIndex: 20
      }}>
        <div style={{ textAlign: 'center' }}>
          <button onClick={handleLike} style={{
            width: 40, height: 40, borderRadius: '50%', border: 'none',
            background: 'rgba(0,0,0,0.3)', color: liked ? '#fe2c55' : '#fff',
            fontSize: 20, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(4px)'
          }} className={liked ? 'like-bounce' : ''}>
            {liked ? '❤️' : '🤍'}
          </button>
          <div style={{ color: '#fff', fontSize: 10, marginTop: 2, fontWeight: 600 }}>
            {formatCount(likeCount)}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <button style={{
            width: 40, height: 40, borderRadius: '50%', border: 'none',
            background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: 18,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(4px)'
          }}>💬</button>
          <div style={{ color: '#fff', fontSize: 10, marginTop: 2, fontWeight: 600 }}>
            {state.comments.length}
          </div>
        </div>
        <button style={{
          width: 40, height: 40, borderRadius: '50%', border: 'none',
          background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: 17,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)'
        }}>↗</button>
        <button style={{
          width: 40, height: 40, borderRadius: '50%', border: 'none',
          background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: 18,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)'
        }}>🎁</button>
      </div>

      {/* 商品图 + 价格 + 倒计时 — 合并在一个框里 */}
      {(() => {
        try {
          const imgs: string[] = JSON.parse(auction.product?.images || '[]')
          const pname = auction.product?.name || ''
          const hasImg = imgs.length > 0
          return (
            <div style={{
              position: 'absolute', bottom: 138, left: 10, zIndex: 25,
              display: 'flex', gap: 10,
              background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              borderRadius: 14, padding: 10,
              border: '1px solid rgba(255,255,255,0.06)',
              maxWidth: '72%'
            }}>
              {hasImg && (
                <div style={{
                  width: 80, height: 80, borderRadius: 10, overflow: 'hidden', flexShrink: 0
                }}>
                  <img src={imgs[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              )}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
                {pname && (
                  <div style={{ color: '#fff', fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}>
                    {pname}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 9, marginBottom: 1 }}>
                      {state.sold ? '落槌价' : isActive ? '当前最高价' : '起拍价'}
                    </div>
                    <div style={{
                      fontSize: 24, fontWeight: 900, color: state.sold ? '#25f4ee' : '#fe2c55',
                      lineHeight: 1.1
                    }} className={priceAnimation ? 'price-animate' : ''}>
                      ¥{currentPriceYuan.toFixed(0)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 9, marginBottom: 1 }}>
                      {state.sold ? '已成交' : '剩余'}
                    </div>
                    {state.sold ? (
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#25f4ee' }}>✓</div>
                    ) : state.cancelled ? (
                      <div style={{ fontSize: 15, fontWeight: 800, color: 'rgba(255,255,255,0.4)' }}>—</div>
                    ) : (
                      <div style={{ fontSize: 17, fontWeight: 900, color: '#fbbf24', fontFamily: 'monospace' }}>
                        {formatRemainTime(state.remainMs)}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9 }}>
                  {leaderNickname ? (
                    <span>领先 <span style={{ color: '#fbbf24', fontWeight: 700 }}>{leaderNickname}</span></span>
                  ) : (
                    <span>暂无出价</span>
                  )}
                </div>
              </div>
            </div>
          )
        } catch {} return null
      })()}

      {/* Layer 4: 评论区 — 更多空间 */}
      <div style={{
        position: 'absolute', left: 10, right: 65,
        bottom: 75, maxHeight: '35%', zIndex: 30,
        overflowY: 'scroll', scrollbarWidth: 'none', msOverflowStyle: 'none',
        display: 'flex', flexDirection: 'column',
        WebkitOverflowScrolling: 'touch'
      }} ref={commentsContainerRef}
      className="hide-scrollbar">
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 2 }}>
          {state.comments.map((comment, i) => (
            <div key={`${comment.timestamp}-${i}`} className="float-in" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'rgba(0,0,0,0.4)', borderRadius: 18,
              padding: '5px 10px 5px 5px', alignSelf: 'flex-start',
              backdropFilter: 'blur(4px)', maxWidth: '100%'
            }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: `linear-gradient(135deg, hsl(${(comment.user_id * 137) % 360}, 70%, 55%), hsl(${(comment.user_id * 137 + 40) % 360}, 70%, 45%))`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 11, fontWeight: 700, flexShrink: 0
              }}>{comment.nickname?.[0] || 'U'}</div>
              <div>
                <span style={{ color: '#fbbf24', fontSize: 12, fontWeight: 700, marginRight: 4 }}>
                  {comment.nickname}
                </span>
                <span style={{ color: '#fff', fontSize: 13 }}>{comment.text}</span>
              </div>
            </div>
          ))}
          <div ref={commentsEndRef} />
        </div>
      </div>

      {/* Layer 5: 底部输入栏 — 更紧凑 */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 35,
        padding: '6px 10px max(env(safe-area-inset-bottom, 8px), 8px)',
        background: 'linear-gradient(transparent, rgba(0,0,0,0.4) 30%)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="text" value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendComment()}
            placeholder="说点什么..." maxLength={200}
            style={{
              flex: 1, background: 'rgba(255,255,255,0.1)', borderRadius: 20,
              padding: '8px 14px', color: '#fff', fontSize: 13,
              border: 'none', outline: 'none'
            }}
          />
          <button onClick={() => setShowProductList(true)} style={{
            width: 34, height: 34, borderRadius: '50%', border: 'none',
            background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 16,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0
          }}>🛒</button>
          <button onClick={handleSendComment} style={{
            width: 34, height: 34, borderRadius: '50%', border: 'none',
            background: '#fe2c55', color: '#fff', fontSize: 14,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0
          }}>✉</button>
        </div>
      </div>

      {/* Layer 6: 出价按钮 — 底部居中 */}
      {isActive && !state.sold && (
        <div style={{
          position: 'absolute', bottom: 56, left: '50%', transform: 'translateX(-50%)', zIndex: 40,
          display: 'flex', gap: 8, alignItems: 'center'
        }}>
          <button
            onClick={() => { setSelectedAuction(auction); setShowBidModal(true) }}
            className="bid-glow"
            style={{
              padding: '12px 36px', borderRadius: 999, border: 'none',
              background: 'linear-gradient(90deg, #fe2c55 0%, #ff6b8a 100%)',
              color: '#fff', fontSize: 17, fontWeight: 800, cursor: 'pointer',
              boxShadow: '0 6px 24px rgba(254,44,85,0.4)',
              whiteSpace: 'nowrap'
            }}>
            🔥 出价
          </button>
          <button
            onClick={() => setShowLeaderboard(true)}
            style={{
              width: 44, height: 44, borderRadius: '50%', border: 'none',
              background: 'rgba(255,255,255,0.08)', color: '#fbbf24',
              fontSize: 18, cursor: 'pointer', backdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
            🏆
          </button>
        </div>
      )}

      {/* 延时通知 */}
      {state.extendCount > 0 && (
        <div style={{
          position: 'absolute', top: 64, left: '50%', transform: 'translateX(-50%)', zIndex: 15,
          padding: '6px 14px', borderRadius: 20,
          background: 'rgba(34,197,94,0.12)', backdropFilter: 'blur(8px)',
          color: '#22c55e', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
          border: '1px solid rgba(34,197,94,0.15)'
        }}>
          ⏱ 延时 {state.extendCount} 次
        </div>
      )}

      {/* Modals (所有弹窗保持 position: fixed，不受父容器影响) */}
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
          remainMs={selectedAuction.id === auctionId ? state.remainMs : Math.max(0, new Date(selectedAuction.end_time || '').getTime() - Date.now())}
          sold={selectedAuction.id === auctionId ? state.sold : selectedAuction.status === 'sold'}
          myLastBid={selectedAuction.id === auctionId ? myLastBid : 0}
          winnerId={selectedAuction.id === auctionId ? state.soldData?.winner_id : undefined}
          userId={user?.id}
          leaderNickname={selectedAuction.id === auctionId ? leaderNickname : undefined}
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
    </div>
  )
}
