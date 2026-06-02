package handler

import (
	"strconv"

	"auction-server/internal/middleware"
	"auction-server/internal/service"
	"auction-server/pkg/response"

	"github.com/gin-gonic/gin"
)

type AuctionHandler struct {
	svc *service.AuctionService
}

func NewAuctionHandler() *AuctionHandler {
	return &AuctionHandler{svc: service.NewAuctionService()}
}

func (h *AuctionHandler) Create(c *gin.Context) {
	claims := middleware.GetClaims(c)
	var input service.CreateAuctionInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	auction, err := h.svc.Create(claims.UserID, &input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.OK(c, auction)
}

func (h *AuctionHandler) List(c *gin.Context) {
	status := c.Query("status")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "20"))
	list, total, err := h.svc.List(status, page, size)
	if err != nil {
		response.ServerError(c)
		return
	}
	response.OKPage(c, list, total, page, size)
}

func (h *AuctionHandler) ListMine(c *gin.Context) {
	claims := middleware.GetClaims(c)
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "20"))
	list, total, err := h.svc.ListBySeller(claims.UserID, page, size)
	if err != nil {
		response.ServerError(c)
		return
	}
	response.OKPage(c, list, total, page, size)
}

func (h *AuctionHandler) GetByID(c *gin.Context) {
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	auction, err := h.svc.GetByID(uint(id))
	if err != nil {
		response.NotFound(c, "竞拍不存在")
		return
	}
	response.OK(c, auction)
}

func (h *AuctionHandler) UpdateRules(c *gin.Context) {
	claims := middleware.GetClaims(c)
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	var input service.UpdateRulesInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	if err := h.svc.UpdateRules(uint(id), claims.UserID, &input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.OK(c, nil)
}

func (h *AuctionHandler) Cancel(c *gin.Context) {
	claims := middleware.GetClaims(c)
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	if err := h.svc.Cancel(uint(id), claims.UserID); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.OK(c, nil)
}
