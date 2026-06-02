package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"auction-server/internal/config"
	"auction-server/internal/middleware"
	"auction-server/internal/repository"
	"auction-server/pkg/logger"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func main() {
	// 1. 加载配置
	cfg, err := config.Load()
	if err != nil {
		panic("配置加载失败: " + err.Error())
	}

	// 2. 初始化日志
	logger.Init(cfg.App.Env)
	defer logger.Log.Sync()

	// 3. 连接数据库
	if err := repository.InitDB(&cfg.DB); err != nil {
		logger.Fatal("数据库连接失败", zap.Error(err))
	}

	// 4. 连接 Redis
	if err := repository.InitRedis(&cfg.Redis); err != nil {
		logger.Fatal("Redis 连接失败", zap.Error(err))
	}

	// 5. 初始化 Gin
	if cfg.App.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	r.Use(middleware.Recovery())
	r.Use(middleware.RequestLogger())

	// CORS 配置（开发环境允许所有来源）
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: false,
		MaxAge:           12 * time.Hour,
	}))

	// 6. 注册路由
	registerRoutes(r)

	// 7. 健康检查
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok", "env": cfg.App.Env})
	})

	// 8. 启动服务（支持优雅关闭）
	srv := &http.Server{
		Addr:    ":" + cfg.App.Port,
		Handler: r,
	}

	go func() {
		logger.Info("服务启动", zap.String("port", cfg.App.Port))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("服务启动失败", zap.Error(err))
		}
	}()

	// 等待中断信号，优雅关闭（最多等 10 秒）
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("正在关闭服务...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		logger.Error("服务关闭异常", zap.Error(err))
	}
	logger.Info("服务已关闭")
}

// registerRoutes 路由注册（后续各模块开发时在此补充）
func registerRoutes(r *gin.Engine) {
	api := r.Group("/api")

	// 公开路由（无需登录）
	public := api.Group("")
	_ = public
	// TODO Module 2: public.POST("/auth/login", ...)
	// TODO Module 2: public.POST("/auth/register", ...)

	// 需要登录
	auth := api.Group("", middleware.Auth())
	_ = auth
	// TODO Module 3: auth.GET("/auctions", ...)
	// TODO Module 4: auth.POST("/auctions/:id/bids", ...)

	// 需要商家权限
	seller := api.Group("", middleware.Auth(), middleware.SellerOnly())
	_ = seller
	// TODO Module 3: seller.POST("/auctions", ...)
}
