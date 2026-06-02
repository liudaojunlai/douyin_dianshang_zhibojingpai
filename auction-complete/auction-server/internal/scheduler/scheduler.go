package scheduler

import (
	"context"
	"fmt"
	"time"

	"auction-server/internal/model"
	"auction-server/internal/repository"
	"auction-server/internal/service"
	"auction-server/internal/websocket"
	"auction-server/pkg/logger"

	"go.uber.org/zap"
)

var processedAuctionIDs = make(map[uint]bool)

func Start() {
	go tickSuperGuard()          // 主超级守护，1s全量扫描
	go tickSecondaryGuard()      // 第二重保险，3s兜底扫描
	go tickTimerSync()           // 每秒广播倒计时
	go tickMonitorSnapshot()     // 每小时归档监控
	logger.Info("=== 超级三重守护定时任务已完全启动 ===")
}

func tickSuperGuard() {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()
	auctionRepo := repository.NewAuctionRepo()
	orderSvc := service.NewOrderService()

	logger.Info("超级守护线程 开始运行，每秒全量扫描所有活跃竞拍")

	for range ticker.C {
		actives, _, err := auctionRepo.List(string(model.AuctionActive), 1, 1000)
		if err != nil {
			logger.Error("超级守护查询活跃竞拍失败", zap.Error(err))
			continue
		}

		now := time.Now().UTC()
		for _, a := range actives {
			if a.EndTime == nil {
				continue
			}
			if !a.EndTime.UTC().Before(now) {
				continue
			}

			if processedAuctionIDs[a.ID] {
				continue
			}

			logger.Info("🔥 超级守护发现过期竞拍，立即自动成交！",
				zap.Uint("auction_id", a.ID),
				zap.Time("end_time", *a.EndTime),
				zap.Time("now_utc", now),
			)

			go processExpiredAuction(a, orderSvc)
			processedAuctionIDs[a.ID] = true
		}
	}
}

func tickSecondaryGuard() {
	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()
	auctionRepo := repository.NewAuctionRepo()
	orderSvc := service.NewOrderService()

	logger.Info("第二重兜底守护线程启动")

	for range ticker.C {
		expired, err := auctionRepo.FindExpiredActive()
		if err == nil {
			for _, a := range expired {
				if processedAuctionIDs[a.ID] {
					continue
				}
				logger.Info("🛡️ 第二重兜底守护扫描到过期竞拍", zap.Uint("auction_id", a.ID))
				go processExpiredAuction(a, orderSvc)
				processedAuctionIDs[a.ID] = true
			}
		}
	}
}

func processExpiredAuction(a *model.Auction, orderSvc *service.OrderService) {
	bidRepo := repository.NewBidRepo()
	auctionRepo := repository.NewAuctionRepo()

	logger.Info("======== 开始处理竞拍过期自动成交 ========", zap.Uint("auction_id", a.ID))

	winner, err := bidRepo.GetWinner(a.ID)

	if err != nil || winner == nil {
		logger.Info("无人出价，自动取消竞拍", zap.Uint("auction_id", a.ID))
		_ = auctionRepo.UpdateStatusForce(a.ID, string(model.AuctionCancelled), map[string]any{})
		websocket.GlobalHub.BroadcastCancelled(a.ID, "竞拍超时，无人出价")
		return
	}

	order, err := orderSvc.CreateOrder(a.ID, winner.UserID, winner.Amount)
	if err != nil {
		logger.Error("生成订单失败，强制标记为已成交兜底", zap.Uint("auction_id", a.ID), zap.Error(err))
		_ = auctionRepo.UpdateStatusForce(a.ID, string(model.AuctionSold), map[string]any{
			"current_price": winner.Amount,
		})
		websocket.GlobalHub.BroadcastSold(a.ID, winner.UserID, winner.Amount)
		return
	}

	logger.Info("✅ 竞拍完全自动成交成功！",
		zap.Uint("auction_id", a.ID),
		zap.Uint("winner_id", order.WinnerID),
		zap.Int64("final_price", order.FinalPrice),
	)

	websocket.GlobalHub.BroadcastSold(a.ID, order.WinnerID, order.FinalPrice)
}

func tickTimerSync() {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()
	auctionRepo := repository.NewAuctionRepo()

	for range ticker.C {
		actives, _, err := auctionRepo.List(string(model.AuctionActive), 1, 100)
		if err != nil {
			continue
		}
		now := time.Now()
		for _, a := range actives {
			if a.EndTime == nil {
				continue
			}
			remainMs := a.EndTime.Sub(now).Milliseconds()
			if remainMs < 0 {
				remainMs = 0
			}
			websocket.GlobalHub.BroadcastTimerSync(a.ID, remainMs, now.UnixMilli())
		}
	}
}

func tickMonitorSnapshot() {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	for range ticker.C {
		saveMonitorSnapshot()
	}
}

func saveMonitorSnapshot() {
	ctx := context.Background()
	rdb := repository.RDB

	var activeCount int64
	repository.DB.Model(&model.Auction{}).Where("status = ?", model.AuctionActive).Count(&activeCount)

	onlineStr, _ := rdb.Get(ctx, repository.GlobalOnlineKey()).Result()
	onlineCount := 0
	if onlineStr != "" {
		fmt.Sscanf(onlineStr, "%d", &onlineCount)
	}

	var dailyGMV struct{ Total int64 }
	repository.DB.Model(&model.Order{}).
		Select("COALESCE(SUM(final_price), 0) as total").
		Where("DATE(created_at) = CURDATE() AND pay_status = ?", model.PayPaid).
		Scan(&dailyGMV)

	snap := &model.MonitorSnapshot{
		SnapshotTime: time.Now(),
		ActiveCount:  int(activeCount),
		OnlineUsers:  onlineCount,
		DailyGMV:     dailyGMV.Total,
	}
	repository.DB.Create(snap)
	_ = ctx
}
