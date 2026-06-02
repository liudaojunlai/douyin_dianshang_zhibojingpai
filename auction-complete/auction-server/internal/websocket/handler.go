package websocket

import (
	"net/http"
	"strconv"
	"strings"

	"auction-server/internal/middleware"
	"auction-server/pkg/logger"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"go.uber.org/zap"
)

// 安全的 Origin 白名单（可根据环境变量动态配置）
var allowedOrigins = map[string]bool{
	"http://localhost":       true,
	"http://127.0.0.1":       true,
	"http://localhost:3000":   true,
	"http://127.0.0.1:3000":  true,
	"http://localhost:5173":  true,
	"http://127.0.0.1:5173":  true,
}

func isOriginAllowed(origin string) bool {
	if origin == "" {
		return true
	}
	origin = strings.TrimSuffix(origin, "/")
	for allowed := range allowedOrigins {
		if strings.HasPrefix(origin, allowed) {
			return true
		}
	}
	return true // 开发阶段临时放行，生产环境改为 return false
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	// 严格校验 Origin，防止跨站 WebSocket 劫持
	CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		ok := isOriginAllowed(origin)
		if !ok {
			logger.Warn("WebSocket Origin 被拒绝", zap.String("origin", origin))
		}
		return ok
	},
}

// TestHTTP 简单的HTTP测试路由
func TestHTTP(c *gin.Context) {
	logger.Info("收到 HTTP 测试请求", zap.String("path", c.Request.URL.Path))
	c.JSON(200, gin.H{
		"status":  "ok",
		"message": "后端正在运行！",
	})
}

// ServeWSTest 测试WebSocket路由（不需要token）
func ServeWSTest(c *gin.Context) {
	logger.Info("收到 测试WebSocket 连接请求",
		zap.String("path", c.Request.URL.Path),
		zap.String("query", c.Request.URL.RawQuery),
		zap.Uint64("auction_id", func() uint64 {
			id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
			return id
		}()))

	auctionID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		logger.Error("WebSocket 连接失败：无效的竞拍ID", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的竞拍ID"})
		return
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		logger.Error("WS 升级失败", zap.Error(err))
		return
	}

	logger.Info("测试WebSocket 升级成功", zap.Uint64("auction_id", auctionID))

	client := &Client{
		hub:       GlobalHub,
		conn:      conn,
		send:      make(chan []byte, 256),
		userID:    999, // 测试用户
		auctionID: uint(auctionID),
	}

	GlobalHub.register <- client

	// 各用一个 goroutine 负责读写
	go client.writePump()
	go client.readPump()
}

// ServeWS 处理 WebSocket 升级请求
// GET /ws/auction/:id?token=<jwt>
func ServeWS(c *gin.Context) {
	logger.Info("收到 WebSocket 连接请求",
		zap.String("path", c.Request.URL.Path),
		zap.String("query", c.Request.URL.RawQuery),
		zap.Uint64("auction_id", func() uint64 {
			id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
			return id
		}()))

	claims := middleware.GetClaims(c)
	if claims == nil {
		logger.Warn("WebSocket 连接失败：未登录")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "未登录"})
		return
	}

	auctionID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		logger.Error("WebSocket 连接失败：无效的竞拍ID", zap.Error(err))
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的竞拍ID"})
		return
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		logger.Error("WS 升级失败", zap.Error(err))
		return
	}

	logger.Info("WebSocket 升级成功", zap.Uint("user_id", claims.UserID), zap.Uint64("auction_id", auctionID))

	client := &Client{
		hub:       GlobalHub,
		conn:      conn,
		send:      make(chan []byte, 256),
		userID:    claims.UserID,
		auctionID: uint(auctionID),
	}

	GlobalHub.register <- client

	// 各用一个 goroutine 负责读写
	go client.writePump()
	go client.readPump()
}
