package handler

import (
	"auction-server/internal/middleware"
	"auction-server/internal/service"
	"auction-server/pkg/response"

	"github.com/gin-gonic/gin"
)

type AuthHandler struct {
	svc *service.AuthService
}

func NewAuthHandler() *AuthHandler {
	return &AuthHandler{svc: service.NewAuthService()}
}

func (h *AuthHandler) Register(c *gin.Context) {
	var input service.RegisterInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	result, err := h.svc.Register(&input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.OK(c, result)
}

func (h *AuthHandler) Login(c *gin.Context) {
	var input service.LoginInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	result, err := h.svc.Login(&input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.OK(c, result)
}

func (h *AuthHandler) Me(c *gin.Context) {
	claims := middleware.GetClaims(c)
	repo := service.NewAuthService()
	user, err := repo.GetUserByID(claims.UserID)
	if err != nil {
		response.NotFound(c, "用户不存在")
		return
	}
	response.OK(c, user)
}
