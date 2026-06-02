package middleware

import (
	"time"
	"auction-server/pkg/logger"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// RequestLogger 记录每个请求的方法、路径、状态码和耗时
func RequestLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()
		latency := time.Since(start)

		logger.Info("HTTP",
			zap.String("method", c.Request.Method),
			zap.String("path", c.Request.URL.Path),
			zap.Int("status", c.Writer.Status()),
			zap.Duration("latency", latency),
			zap.String("ip", c.ClientIP()),
		)
	}
}

// Recovery 捕获 panic，返回 500 而不是崩溃
func Recovery() gin.HandlerFunc {
	return gin.CustomRecovery(func(c *gin.Context, err any) {
		logger.Error("panic recovered", zap.Any("error", err))
		c.JSON(500, gin.H{"code": 50000, "message": "服务器内部错误"})
	})
}
