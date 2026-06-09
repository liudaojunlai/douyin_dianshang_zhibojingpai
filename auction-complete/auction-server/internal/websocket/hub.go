package websocket

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"auction-server/internal/repository"
	"auction-server/internal/service"
	"auction-server/pkg/logger"

	"github.com/gorilla/websocket"
	"go.uber.org/zap"
)

const (
	EventBidNew            = "bid:new"
	EventRankUpdate        = "rank:update"
	EventTimerSync         = "timer:sync"
	EventTimerExtend       = "timer:extend"
	EventAuctionSold       = "auction:sold"
	EventAuctionCancelled  = "auction:cancelled"
	EventBidOvertaken      = "bid:overtaken"
	EventPing              = "ping"
	EventPong              = "pong"
	EventOnlineCount       = "online:count"
	EventCommentNew        = "comment:new"
	EventCommentHistory    = "comment:history"

	workerPoolSize      = 64
	taskBufferSize      = 4096
	maxCommentHistory   = 50
)

type CommentItem struct {
	UserID    uint   `json:"user_id"`
	Nickname  string `json:"nickname"`
	Text      string `json:"text"`
	Timestamp int64  `json:"timestamp"`
}

type Message struct {
	Event string `json:"event"`
	Data  any    `json:"data"`
}

type BroadcastTask struct {
	clients []*Client
	msg     []byte
	pool    *[]*Client // 归还池，减少 GC
}

type Client struct {
	hub       *Hub
	conn      *websocket.Conn
	send      chan []byte
	userID    uint
	auctionID uint
	mu        sync.Mutex
	closed    bool
}

// AuctionCacheItem 缓存的竞拍快照，避免注册时查 DB
type AuctionCacheItem struct {
	ID           uint
	CurrentPrice int64
	EndTime      *time.Time
}

type Hub struct {
	rooms           map[uint]map[*Client]bool
	mu              sync.RWMutex
	register        chan *Client
	unregister      chan *Client
	broadcastCh     chan BroadcastTask
	workerWg        sync.WaitGroup
	quitChan        chan struct{}
	QuitChan        chan struct{} // 公开导出，供外部优雅关闭调用
	nicknameCache   sync.Map           // 预加载用户昵称缓存 userID -> nickname
	commentHistory  map[uint][]CommentItem // 各拍卖房间的历史评论缓存
	auctionCache    sync.Map           // auctionID -> *AuctionCacheItem，避免注册时查库

	clientPool sync.Pool // 广播时复用 client slice
}

var GlobalHub = newHub()

func newHub() *Hub {
	quit := make(chan struct{})
	h := &Hub{
		rooms:          make(map[uint]map[*Client]bool),
		register:       make(chan *Client, 4096),
		unregister:     make(chan *Client, 4096),
		broadcastCh:    make(chan BroadcastTask, taskBufferSize),
		quitChan:       quit,
		QuitChan:       quit,
		commentHistory: make(map[uint][]CommentItem),
		clientPool: sync.Pool{
			New: func() any {
				s := make([]*Client, 0, 512)
				return &s
			},
		},
	}

	for i := 0; i < workerPoolSize; i++ {
		h.workerWg.Add(1)
		go h.broadcastWorker()
	}

	return h
}

func (h *Hub) broadcastWorker() {
	defer h.workerWg.Done()
	for {
		select {
		case task, ok := <-h.broadcastCh:
			if !ok {
				return
			}
			for _, client := range task.clients {
				client.safeSend(task.msg)
			}
			// 归还 client slice 到池
			if task.pool != nil {
				*task.pool = (*task.pool)[:0]
				h.clientPool.Put(task.pool)
			}
		case <-h.quitChan:
			return
		}
	}
}

func (c *Client) safeSend(msg []byte) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.closed {
		return
	}
	select {
	case c.send <- msg:
	default:
	}
}

func (h *Hub) Run() {
	for {
		select {
		case <-h.quitChan:
			// 优雅关闭：通知所有客户端连接即将断开，等待任务完成
			logger.Info("Hub 收到关闭信号，停止接收新连接...")
			h.mu.RLock()
			// 给所有客户端发送关闭消息后再断开
			for _, roomClients := range h.rooms {
				for client := range roomClients {
					closeMsg := encode(Message{
						Event: "server_shutdown",
						Data:  map[string]string{"message": "服务器即将重启，请稍后重新连接"},
					})
					client.safeSend(closeMsg)
				}
			}
			h.mu.RUnlock()
			// 等待所有后台广播 worker 处理完当前任务
			h.workerWg.Wait()
			logger.Info("Hub 优雅关闭完成")
			return

		case client := <-h.register:
			h.mu.Lock()
			if h.rooms[client.auctionID] == nil {
				h.rooms[client.auctionID] = make(map[*Client]bool)
			}
			h.rooms[client.auctionID][client] = true
			countAfterAdd := len(h.rooms[client.auctionID])
			h.mu.Unlock()

			ctx := context.Background()
			repository.RDB.HSet(ctx, repository.AuctionOnlineKey(client.auctionID),
				fmt.Sprintf("%d", client.userID), 1)
			repository.RDB.Incr(ctx, repository.GlobalOnlineKey())

			logger.Info("客户端加入房间",
				zap.Uint("auction_id", client.auctionID),
				zap.Uint("user_id", client.userID),
				zap.Int("room_size", countAfterAdd))

			h.broadcastToRoom(client.auctionID, EventOnlineCount, map[string]interface{}{"count": countAfterAdd})

			clientCopy := client
			go func(c *Client, currentCount int) {
				defer func() {
					if r := recover(); r != nil {
						logger.Error("注册客户端 goroutine panic", zap.Any("recover", r))
					}
				}()

				// 从缓存读取竞拍数据，避免注册洪峰时打爆 DB
				var currentPrice int64
				var endTime *time.Time
				if v, ok := h.auctionCache.Load(c.auctionID); ok {
					if cache, ok := v.(*AuctionCacheItem); ok {
						currentPrice = cache.CurrentPrice
						endTime = cache.EndTime
					}
				} else {
					// 缓存未命中才查库
					auctionRepo := repository.NewAuctionRepo()
					auction, err := auctionRepo.FindByID(c.auctionID)
					if err == nil && auction != nil {
						currentPrice = auction.CurrentPrice
						endTime = auction.EndTime
						h.auctionCache.Store(c.auctionID, &AuctionCacheItem{
							ID:           auction.ID,
							CurrentPrice: auction.CurrentPrice,
							EndTime:      auction.EndTime,
						})
					}
				}

				if currentPrice > 0 {
					currentPriceMsg := encode(Message{
						Event: EventBidNew,
						Data: map[string]interface{}{
							"auction_id":    c.auctionID,
							"current_price": currentPrice,
							"extended":      false,
							"extend_secs":   0,
						},
					})
					c.safeSend(currentPriceMsg)
				}

				bidSvc := service.NewBidService()
				leaderboard, err := bidSvc.GetLeaderboard(c.auctionID, 20)
				if err == nil {
					leaderboardMsg := encode(Message{
						Event: EventRankUpdate,
						Data: leaderboard,
					})
					c.safeSend(leaderboardMsg)
				}

				now := time.Now().UnixMilli()
				var remainMs int64
				if endTime != nil {
					endTimeMs := endTime.UnixMilli()
					if endTimeMs > now {
						remainMs = endTimeMs - now
					}
				}
				timerMsg := encode(Message{
					Event: EventTimerSync,
					Data: map[string]interface{}{
						"remain_ms": remainMs,
						"server_ts": now,
					},
				})
				c.safeSend(timerMsg)

				onlineCountMsg := encode(Message{
					Event: EventOnlineCount,
					Data: map[string]interface{}{"count": currentCount},
				})
				c.safeSend(onlineCountMsg)

				// 向新客户端返回该房间历史评论
				h.mu.RLock()
				history := make([]CommentItem, len(h.commentHistory[c.auctionID]))
				copy(history, h.commentHistory[c.auctionID])
				h.mu.RUnlock()
				historyMsg := encode(Message{
					Event: EventCommentHistory,
					Data:  history,
				})
				c.safeSend(historyMsg)
			}(clientCopy, countAfterAdd)

		case client := <-h.unregister:
			h.mu.Lock()
			prevCount := 0
			if clients, ok := h.rooms[client.auctionID]; ok {
				prevCount = len(clients)
				if _, ok := clients[client]; ok {
					delete(clients, client)
					client.mu.Lock()
					if !client.closed {
						close(client.send)
						client.closed = true
					}
					client.mu.Unlock()
				}
				if len(clients) == 0 {
					delete(h.rooms, client.auctionID)
				}
			}
			newCount := prevCount - 1
			h.mu.Unlock()

			ctx := context.Background()
			repository.RDB.HDel(ctx, repository.AuctionOnlineKey(client.auctionID),
				fmt.Sprintf("%d", client.userID))
			repository.RDB.Decr(ctx, repository.GlobalOnlineKey())

			logger.Info("客户端离开房间",
				zap.Uint("auction_id", client.auctionID),
				zap.Uint("user_id", client.userID),
				zap.Int("old_count", prevCount),
				zap.Int("new_count", newCount))

			h.broadcastToRoom(client.auctionID, EventOnlineCount, map[string]interface{}{"count": newCount})

			minute := time.Now().Format("200601021504")
			repository.RDB.Incr(ctx, repository.WSDisconnectKey(minute))
			repository.RDB.Expire(ctx, repository.WSDisconnectKey(minute), 10*time.Minute)
		}
	}
}

func (h *Hub) BroadcastBid(event *service.BidEvent) {
	logger.Info("广播出价事件", zap.Uint("auction_id", event.AuctionID), zap.Int64("current_price", event.Amount))

	// 更新竞拍缓存
	h.auctionCache.Store(event.AuctionID, &AuctionCacheItem{
		ID:           event.AuctionID,
		CurrentPrice: event.Amount,
		EndTime:      event.NewEndTime,
	})

	h.broadcastToRoom(event.AuctionID, EventBidNew, event)

	bidSvc := service.NewBidService()
	leaderboard, _ := bidSvc.GetLeaderboard(event.AuctionID, 20)
	logger.Info("广播排行榜更新", zap.Uint("auction_id", event.AuctionID), zap.Int("board_count", len(leaderboard)))
	h.broadcastToRoom(event.AuctionID, EventRankUpdate, leaderboard)

	h.notifyOvertaken(event)

	if event.Extended {
		h.broadcastToRoom(event.AuctionID, EventTimerExtend, map[string]any{
			"new_end_time": event.NewEndTime,
			"extend_secs":  event.ExtendSecs,
		})
	}
}

func (h *Hub) BroadcastSold(auctionID, winnerID uint, finalPrice int64) {
	h.broadcastToRoom(auctionID, EventAuctionSold, map[string]any{
		"auction_id":  auctionID,
		"winner_id":   winnerID,
		"final_price": finalPrice,
	})
}

func (h *Hub) BroadcastCancelled(auctionID uint, reason string) {
	h.broadcastToRoom(auctionID, EventAuctionCancelled, map[string]any{
		"auction_id": auctionID,
		"reason":     reason,
	})
}

func (h *Hub) BroadcastComment(auctionID uint, userID uint, nickname string, text string) {
	nowTs := time.Now().UnixMilli()
	newComment := CommentItem{
		UserID:    userID,
		Nickname:  nickname,
		Text:      text,
		Timestamp: nowTs,
	}

	// 缓存新评论，预存储用户昵称到缓存
	h.nicknameCache.Store(userID, nickname)
	h.mu.Lock()
	h.commentHistory[auctionID] = append(h.commentHistory[auctionID], newComment)
	// 历史评论超过最大数量时截断最旧的条目
	if len(h.commentHistory[auctionID]) > maxCommentHistory {
		h.commentHistory[auctionID] = h.commentHistory[auctionID][len(h.commentHistory[auctionID])-maxCommentHistory:]
	}
	h.mu.Unlock()

	h.broadcastToRoom(auctionID, EventCommentNew, newComment)
	logger.Info("广播新评论", zap.Uint("auction_id", auctionID), zap.String("nickname", nickname), zap.String("text", text))
}

func (h *Hub) BroadcastTimerSync(auctionID uint, remainMs int64, serverTs int64) {
	h.broadcastToRoom(auctionID, EventTimerSync, map[string]any{
		"remain_ms": remainMs,
		"server_ts": serverTs,
	})
}

func (h *Hub) broadcastToRoom(auctionID uint, event string, data any) {
	msg := encode(Message{Event: event, Data: data})

	ptr := h.clientPool.Get().(*[]*Client)
	h.mu.RLock()
	room := h.rooms[auctionID]
	roomSize := len(room)
	if cap(*ptr) < roomSize {
		*ptr = make([]*Client, 0, roomSize+256)
	}
	*ptr = (*ptr)[:0]
	for c := range room {
		*ptr = append(*ptr, c)
	}
	h.mu.RUnlock()

	logger.Debug("广播消息到房间",
		zap.Uint("auction_id", auctionID),
		zap.String("event", event),
		zap.Int("client_count", roomSize))

	task := BroadcastTask{
		clients: *ptr,
		msg:     msg,
		pool:    ptr, // 告知 worker 用完后归还
	}
	select {
	case h.broadcastCh <- task:
	default:
		// 归还池，避免泄漏
		*ptr = (*ptr)[:0]
		h.clientPool.Put(ptr)
		logger.Warn("广播通道已满，丢弃消息",
			zap.String("event", event),
			zap.Uint("auction_id", auctionID),
		)
	}
}

func (h *Hub) notifyOvertaken(event *service.BidEvent) {
	ptr := h.clientPool.Get().(*[]*Client)
	h.mu.RLock()
	room := h.rooms[event.AuctionID]
	roomSize := len(room)
	if cap(*ptr) < roomSize {
		*ptr = make([]*Client, 0, roomSize+256)
	}
	*ptr = (*ptr)[:0]
	for c := range room {
		if c.userID != event.UserID {
			*ptr = append(*ptr, c)
		}
	}
	h.mu.RUnlock()

	msg := encode(Message{Event: EventBidOvertaken, Data: map[string]any{
		"new_leader": event.Nickname,
		"amount":     event.Amount,
	}})

	task := BroadcastTask{
		clients: *ptr,
		msg:     msg,
		pool:    ptr,
	}
	select {
	case h.broadcastCh <- task:
	default:
		*ptr = (*ptr)[:0]
		h.clientPool.Put(ptr)
		logger.Warn("notice channel full, dropping message",
			zap.String("event", EventBidOvertaken),
			zap.Uint("auction_id", event.AuctionID),
		)
	}
}

func (h *Hub) roomSize(auctionID uint) int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	if h.rooms[auctionID] == nil {
		return 0
	}
	return len(h.rooms[auctionID])
}

func (h *Hub) OnlineCount(auctionID uint) int {
	return h.roomSize(auctionID)
}

func encode(msg Message) []byte {
	b, _ := json.Marshal(msg)
	return b
}
