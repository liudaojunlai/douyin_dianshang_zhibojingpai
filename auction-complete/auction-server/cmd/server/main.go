package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"auction-server/internal/config"
	"auction-server/internal/handler"
	"auction-server/internal/middleware"
	"auction-server/internal/repository"
	"auction-server/internal/scheduler"
	ws "auction-server/internal/websocket"
	"auction-server/pkg/logger"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		panic("配置加载失败: " + err.Error())
	}

	logger.Init(cfg.App.Env)
	defer logger.Log.Sync()

	if err := repository.InitDB(&cfg.DB); err != nil {
		logger.Fatal("数据库连接失败", zap.Error(err))
	}
	if err := repository.InitRedis(&cfg.Redis); err != nil {
		logger.Fatal("Redis 连接失败", zap.Error(err))
	}

	go ws.GlobalHub.Run()
	scheduler.Start()

	if cfg.App.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	r.Use(middleware.Recovery())
	r.Use(middleware.RequestLogger())
	r.Use(cors.New(cors.Config{
		AllowOrigins: []string{"*"},
		AllowMethods: []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders: []string{"Origin", "Content-Type", "Authorization"},
		MaxAge:       12 * time.Hour,
	}))

	registerRoutes(r)
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok", "env": cfg.App.Env})
	})

	srv := &http.Server{Addr: ":" + cfg.App.Port, Handler: r}
	go func() {
		logger.Info("服务启动", zap.String("port", cfg.App.Port))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("服务启动失败", zap.Error(err))
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	logger.Info("正在关闭服务...")
	
	// 通知 Hub 进行优雅关闭
	close(ws.GlobalHub.QuitChan)
	
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	srv.Shutdown(ctx)
	logger.Info("服务已关闭")
}

func registerRoutes(r *gin.Engine) {
	authH    := handler.NewAuthHandler()
	auctionH := handler.NewAuctionHandler()
	bidH     := handler.NewBidHandler(ws.GlobalHub)
	orderH   := handler.NewOrderHandler()
	monitorH := handler.NewMonitorHandler()

	// 测试路由
	r.GET("/test/http", ws.TestHTTP)
	r.GET("/test/ws/:id", ws.ServeWSTest)

	api := r.Group("/api")

	public := api.Group("")
	public.POST("/auth/register", authH.Register)
	public.POST("/auth/login",    authH.Login)
	public.GET("/auctions",       auctionH.List)
	public.GET("/auctions/:id",   auctionH.GetByID)
	public.GET("/auctions/:id/bids",        bidH.GetBidList)
	public.GET("/auctions/:id/leaderboard", bidH.GetLeaderboard)

	auth := api.Group("", middleware.Auth())
	auth.GET("/me",                  authH.Me)
	auth.POST("/auctions/:id/bids",  bidH.PlaceBid)
	auth.GET("/orders",              orderH.ListOrders)
	auth.POST("/orders/:id/pay",     orderH.Pay)

	seller := api.Group("", middleware.Auth(), middleware.SellerOnly())
	seller.POST("/auctions",            auctionH.Create)
	seller.GET("/auctions/mine",        auctionH.ListMine)
	seller.PATCH("/auctions/:id",       auctionH.UpdateRules)
	seller.POST("/auctions/:id/cancel", auctionH.Cancel)

	monitor := api.Group("/monitor", middleware.Auth(), middleware.SellerOnly())
	monitor.GET("/stats",      monitorH.GetStats)
	monitor.GET("/alerts",     monitorH.GetAlerts)
	monitor.GET("/rooms/:id",  monitorH.GetRoomStats)

	r.GET("/ws/auction/:id", middleware.Auth(), ws.ServeWS)
}
