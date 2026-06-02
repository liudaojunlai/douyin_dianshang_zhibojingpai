package handler

import (
	"context"
	"strconv"
	"time"

	"auction-server/internal/model"
	"auction-server/internal/repository"
	"auction-server/internal/websocket"
	"auction-server/pkg/response"

	"github.com/gin-gonic/gin"
)

type MonitorHandler struct{}

func NewMonitorHandler() *MonitorHandler { return &MonitorHandler{} }

type StatsResult struct {
	ActiveAuctions  int64  `json:"active_auctions"`
	PendingAuctions int64  `json:"pending_auctions"`
	TodaySold       int64  `json:"today_sold"`
	OnlineUsers     int    `json:"online_users"`
	DailyGMV        int64  `json:"daily_gmv"`
	TodayBidCount   int64  `json:"today_bid_count"`
}

type AlertItem struct {
	Level   string `json:"level"` // red / orange / yellow
	Type    string `json:"type"`
	Message string `json:"message"`
	Time    string `json:"time"`
}

func (h *MonitorHandler) GetStats(c *gin.Context) {
	ctx := context.Background()
	rdb := repository.RDB

	var active, pending, sold int64
	repository.DB.Model(&model.Auction{}).Where("status = ?", model.AuctionActive).Count(&active)
	repository.DB.Model(&model.Auction{}).Where("status = ?", model.AuctionPending).Count(&pending)
	repository.DB.Model(&model.Auction{}).Where("status = ? AND DATE(updated_at) = CURDATE()", model.AuctionSold).Count(&sold)

	onlineStr, _ := rdb.Get(ctx, repository.GlobalOnlineKey()).Result()
	online, _ := strconv.Atoi(onlineStr)

	var gmv struct{ Total int64 }
	repository.DB.Model(&model.Order{}).
		Select("COALESCE(SUM(final_price),0) as total").
		Where("DATE(created_at) = CURDATE() AND pay_status = ?", model.PayPaid).
		Scan(&gmv)

	var bidCount int64
	repository.DB.Model(&model.Bid{}).Where("DATE(created_at) = CURDATE()").Count(&bidCount)

	response.OK(c, StatsResult{
		ActiveAuctions:  active,
		PendingAuctions: pending,
		TodaySold:       sold,
		OnlineUsers:     online + websocket.GlobalHub.OnlineCount(0),
		DailyGMV:        gmv.Total,
		TodayBidCount:   bidCount,
	})
}

func (h *MonitorHandler) GetAlerts(c *gin.Context) {
	ctx := context.Background()
	rdb := repository.RDB
	now := time.Now()
	minute := now.Format("200601021504")
	alerts := []AlertItem{}

	// 检查各进行中竞拍的失败率
	var actives []model.Auction
	repository.DB.Where("status = ?", model.AuctionActive).Find(&actives)

	for _, a := range actives {
		successKey := repository.BidCountKey(a.ID, minute)
		failKey := repository.BidFailKey(a.ID, minute)
		success, _ := rdb.Get(ctx, successKey).Int64()
		fail, _ := rdb.Get(ctx, failKey).Int64()
		total := success + fail
		if total > 5 && fail*100/total > 20 {
			alerts = append(alerts, AlertItem{
				Level:   "red",
				Type:    "bid_fail_rate",
				Message: "出价失败率过高（>" + strconv.FormatInt(fail*100/total, 10) + "%）",
				Time:    now.Format("15:04:05"),
			})
		}
	}

	// 检查 WS 断连数
	disconnectKey := repository.WSDisconnectKey(minute)
	disconnects, _ := rdb.Get(ctx, disconnectKey).Int64()
	if disconnects > 50 {
		alerts = append(alerts, AlertItem{
			Level:   "orange",
			Type:    "ws_disconnect",
			Message: "1分钟内WS断连数过多：" + strconv.FormatInt(disconnects, 10),
			Time:    now.Format("15:04:05"),
		})
	}

	response.OK(c, alerts)
}

// GetRoomStats 单个房间实时数据
func (h *MonitorHandler) GetRoomStats(c *gin.Context) {
	auctionID, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	ctx := context.Background()
	rdb := repository.RDB
	minute := time.Now().Format("200601021504")

	online := websocket.GlobalHub.OnlineCount(uint(auctionID))
	bidCount, _ := rdb.Get(ctx, repository.BidCountKey(uint(auctionID), minute)).Int64()

	var auction model.Auction
	repository.DB.First(&auction, auctionID)

	response.OK(c, gin.H{
		"online_count":  online,
		"bid_count_min": bidCount,
		"current_price": auction.CurrentPrice,
		"status":        auction.Status,
		"extend_count":  auction.ExtendCount,
	})
}
