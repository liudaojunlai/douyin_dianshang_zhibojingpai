package handler

import (
	"strconv"

	"auction-server/internal/middleware"
	"auction-server/internal/service"
	"auction-server/pkg/response"

	"github.com/gin-gonic/gin"
)

type OrderHandler struct {
	svc *service.OrderService
}

func NewOrderHandler() *OrderHandler {
	return &OrderHandler{svc: service.NewOrderService()}
}

func (h *OrderHandler) ListOrders(c *gin.Context) {
	claims := middleware.GetClaims(c)
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "20"))
	list, total, err := h.svc.ListOrders(claims.UserID, claims.Role, page, size)
	if err != nil {
		response.ServerError(c)
		return
	}
	response.OKPage(c, list, total, page, size)
}

func (h *OrderHandler) Pay(c *gin.Context) {
	claims := middleware.GetClaims(c)
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	if err := h.svc.SimulatePay(uint(id), claims.UserID); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.OK(c, gin.H{"message": "支付成功"})
}
