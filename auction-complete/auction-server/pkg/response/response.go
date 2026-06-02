package response

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// Response 统一响应结构
type Response struct {
	Code    int    `json:"code"`           // 业务码：0=成功，非0=失败
	Message string `json:"message"`
	Data    any    `json:"data,omitempty"` // 成功时的数据
}

// PageData 分页数据结构
type PageData struct {
	List  any   `json:"list"`
	Total int64 `json:"total"`
	Page  int   `json:"page"`
	Size  int   `json:"size"`
}

// 业务错误码
const (
	CodeOK              = 0
	CodeBadRequest      = 40000 // 参数错误
	CodeUnauthorized    = 40100 // 未登录 / Token 失效
	CodeForbidden       = 40300 // 无权限
	CodeNotFound        = 40400 // 资源不存在
	CodeConflict        = 40900 // 数据冲突（如出价被抢先）
	CodeTooManyRequests = 42900 // 请求过频（出价限流）
	CodeServerError     = 50000 // 服务器内部错误
)

func OK(c *gin.Context, data any) {
	c.JSON(http.StatusOK, Response{Code: CodeOK, Message: "success", Data: data})
}

func OKPage(c *gin.Context, list any, total int64, page, size int) {
	c.JSON(http.StatusOK, Response{
		Code:    CodeOK,
		Message: "success",
		Data:    PageData{List: list, Total: total, Page: page, Size: size},
	})
}

func Fail(c *gin.Context, httpStatus, code int, message string) {
	c.JSON(httpStatus, Response{Code: code, Message: message})
}

func BadRequest(c *gin.Context, message string) {
	Fail(c, http.StatusBadRequest, CodeBadRequest, message)
}

func Unauthorized(c *gin.Context) {
	Fail(c, http.StatusUnauthorized, CodeUnauthorized, "请先登录")
}

func Forbidden(c *gin.Context) {
	Fail(c, http.StatusForbidden, CodeForbidden, "无操作权限")
}

func NotFound(c *gin.Context, message string) {
	Fail(c, http.StatusNotFound, CodeNotFound, message)
}

// Conflict 出价冲突（乐观锁失败时使用）
func Conflict(c *gin.Context, message string) {
	Fail(c, http.StatusConflict, CodeConflict, message)
}

// TooManyRequests 出价频率限制
func TooManyRequests(c *gin.Context) {
	Fail(c, http.StatusTooManyRequests, CodeTooManyRequests, "出价太频繁，请稍后再试")
}

func ServerError(c *gin.Context) {
	Fail(c, http.StatusInternalServerError, CodeServerError, "服务器内部错误")
}
