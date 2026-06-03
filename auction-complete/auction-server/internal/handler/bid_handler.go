package handler

import (
	"errors"
	"strconv"

	"auction-server/internal/middleware"
	"auction-server/internal/service"
	"auction-server/pkg/logger"
	"auction-server/pkg/response"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

type BidHandler struct {
	svc    *service.BidService
	hub    BidEventPublisher
}

// BidEventPublisher WebSocket hub 接口，解耦 handler 与 ws 包
type BidEventPublisher interface {
	BroadcastBid(event *service.BidEvent)
	BroadcastSold(auctionID, winnerID uint, finalPrice int64)
	BroadcastCancelled(auctionID uint, reason string)
}

func NewBidHandler(hub BidEventPublisher) *BidHandler {
	return &BidHandler{svc: service.NewBidService(), hub: hub}
}

type placeBidInput struct {
	Amount int64 `json:"amount" binding:"required,min=0"`
}

func (h *BidHandler) PlaceBid(c *gin.Context) {
	claims := middleware.GetClaims(c)
	auctionID, _ := strconv.ParseUint(c.Param("id"), 10, 64)

	var input placeBidInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	event, err := h.svc.PlaceBid(uint(auctionID), claims.UserID, input.Amount)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrBidRateLimit):
			response.TooManyRequests(c)
		case errors.Is(err, service.ErrBidLockFailed):
			response.TooManyRequests(c)
		case errors.Is(err, service.ErrBidConflict):
			response.Conflict(c, err.Error())
		default:
			response.BadRequest(c, err.Error())
		}
		return
	}

	// 广播出价事件给房间所有人
	if h.hub != nil {
		go func() {
			defer func() {
				if r := recover(); r != nil {
					logger.Error("BroadcastBid panic", zap.Any("recover", r))
				}
			}()
			h.hub.BroadcastBid(event)
		}()

		// 封顶价触发自动成交
		if event.CapReached {
			go func() {
				defer func() {
					if r := recover(); r != nil {
						logger.Error("auto order goroutine panic", zap.Any("recover", r))
					}
				}()
				orderSvc := service.NewOrderService()
				order, oErr := orderSvc.CreateOrder(uint(auctionID), event.UserID, event.Amount)
				if oErr == nil {
					h.hub.BroadcastSold(uint(auctionID), order.WinnerID, order.FinalPrice)
				}
			}()
		}
	}

	response.OK(c, event)
}

func (h *BidHandler) GetLeaderboard(c *gin.Context) {
	auctionID, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	board, err := h.svc.GetLeaderboard(uint(auctionID), 20)
	if err != nil {
		response.ServerError(c)
		return
	}
	response.OK(c, board)
}

func (h *BidHandler) GetBidList(c *gin.Context) {
	auctionID, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	list, err := h.svc.GetBidList(uint(auctionID))
	if err != nil {
		response.ServerError(c)
		return
	}
	response.OK(c, list)
}
