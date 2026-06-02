package websocket

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"auction-server/internal/config"
	"auction-server/internal/repository"
	"auction-server/pkg/logger"

	"github.com/gorilla/websocket"
	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

const (
	writeWait  = 10 * time.Second
	maxMsgSize = 512
)

// writePump 从 send 通道取消息写入 WebSocket
func (c *Client) writePump() {
	heartbeatInterval := time.Duration(config.Global.WS.HeartbeatInterval) * time.Second
	ticker := time.NewTicker(heartbeatInterval)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case msg, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}

		case <-ticker.C:
			// 服务端主动发心跳 ping
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.TextMessage,
				encode(Message{Event: EventPing, Data: time.Now().UnixMilli()})); err != nil {
				return
			}
		}
	}
}

// readPump 读取客户端消息，更新心跳超时
func (c *Client) readPump() {
	heartbeatTimeout := time.Duration(config.Global.WS.HeartbeatTimeout) * time.Second
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(maxMsgSize)
	c.conn.SetReadDeadline(time.Now().Add(heartbeatTimeout))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(heartbeatTimeout))
		return nil
	})

	userRepo := repository.NewUserRepo()
	
	// 预加载用户昵称到 Hub 缓存
	var nickname string
	if cachedNick, ok := c.hub.nicknameCache.Load(c.userID); ok {
		nickname = cachedNick.(string)
	} else {
		user, err := userRepo.FindByID(c.userID)
		if err == nil && user != nil && user.Nickname != "" {
			nickname = user.Nickname
		} else {
			nickname = "匿名用户"
		}
		c.hub.nicknameCache.Store(c.userID, nickname)
	}

	for {
		_, raw, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err,
				websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				logger.Warn("WS 连接异常关闭",
					zap.Uint("user_id", c.userID),
					zap.Error(err))
			}
			return
		}

		// 客户端心跳 pong 回包 → 重置超时
		var msg Message
		if err := json.Unmarshal(raw, &msg); err == nil {
			if msg.Event == EventPong {
				c.conn.SetReadDeadline(time.Now().Add(heartbeatTimeout))
			}

			// 处理评论消息
			if msg.Event == EventCommentNew {
				// 解析评论内容
				commentData, ok := msg.Data.(map[string]interface{})
				if !ok {
					continue
				}
				text, _ := commentData["text"].(string)
				
				// 清理和验证评论内容
				text = strings.TrimSpace(text)
				if len(text) == 0 || len(text) > 200 {
					continue
				}

				// 评论频率限制：60秒内最多5条
				ctx := context.Background()
				rateKey := repository.UserCommentRateKey(c.userID)
				count, err := repository.RDB.Incr(ctx, rateKey).Result()
				if err != nil {
					if err != redis.Nil {
						logger.Warn("评论频率检查失败", zap.Error(err))
					}
				} else {
					if count == 1 {
						repository.RDB.Expire(ctx, rateKey, 60*time.Second)
					}
					if count > 5 {
						logger.Warn("用户评论频率超限", zap.Uint("user_id", c.userID))
						continue
					}
				}

				// 广播评论到房间
				c.hub.BroadcastComment(c.auctionID, c.userID, nickname, text)
			}
		}
	}
}
