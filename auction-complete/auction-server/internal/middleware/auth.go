package middleware

import (
	"strings"
	"auction-server/internal/config"
	"auction-server/internal/model"
	"auction-server/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

const CtxUserKey = "currentUser"

type Claims struct {
	UserID uint           `json:"user_id"`
	Role   model.UserRole `json:"role"`
	jwt.RegisteredClaims
}

// Auth 验证 JWT，将用户信息注入 ctx
func Auth() gin.HandlerFunc {
	return func(c *gin.Context) {
		token := extractToken(c)
		if token == "" {
			response.Unauthorized(c)
			c.Abort()
			return
		}

		claims, err := parseToken(token)
		if err != nil {
			response.Unauthorized(c)
			c.Abort()
			return
		}

		c.Set(CtxUserKey, claims)
		c.Next()
	}
}

// SellerOnly 仅商家/主播可访问
func SellerOnly() gin.HandlerFunc {
	return func(c *gin.Context) {
		claims := GetClaims(c)
		if claims == nil || claims.Role != model.RoleSeller {
			response.Forbidden(c)
			c.Abort()
			return
		}
		c.Next()
	}
}

// GetClaims 从 ctx 取当前用户信息（nil 表示未登录）
func GetClaims(c *gin.Context) *Claims {
	v, exists := c.Get(CtxUserKey)
	if !exists {
		return nil
	}
	claims, _ := v.(*Claims)
	return claims
}

func extractToken(c *gin.Context) string {
	// 优先从 Authorization: Bearer <token>
	auth := c.GetHeader("Authorization")
	if strings.HasPrefix(auth, "Bearer ") {
		return strings.TrimPrefix(auth, "Bearer ")
	}
	// 降级从 query param（WebSocket 握手用）
	return c.Query("token")
}

func parseToken(tokenStr string) (*Claims, error) {
	claims := &Claims{}
	_, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (any, error) {
		return []byte(config.Global.JWT.Secret), nil
	})
	return claims, err
}
