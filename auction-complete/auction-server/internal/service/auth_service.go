package service

import (
	"errors"
	"time"

	"auction-server/internal/config"
	"auction-server/internal/middleware"
	"auction-server/internal/model"
	"auction-server/internal/repository"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type AuthService struct {
	userRepo *repository.UserRepo
}

func NewAuthService() *AuthService {
	return &AuthService{userRepo: repository.NewUserRepo()}
}

type RegisterInput struct {
	Phone    string          `json:"phone" binding:"required,len=11"`
	Password string          `json:"password" binding:"required,min=6"`
	Nickname string          `json:"nickname" binding:"required,min=2,max=20"`
	Role     model.UserRole  `json:"role"` // "user" 或 "seller"
}

type LoginInput struct {
	Phone    string `json:"phone" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type AuthResult struct {
	Token string      `json:"token"`
	User  *model.User `json:"user"`
}

func (s *AuthService) Register(input *RegisterInput) (*AuthResult, error) {
	// 手机号唯一性检查
	_, err := s.userRepo.FindByPhone(input.Phone)
	if err == nil {
		return nil, errors.New("手机号已注册")
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	// 密码 bcrypt 哈希
	hash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	role := input.Role
	if role == "" {
		role = model.RoleUser
	}

	user := &model.User{
		Phone:    input.Phone,
		Password: string(hash),
		Nickname: input.Nickname,
		Role:     role,
	}

	if err := s.userRepo.Create(user); err != nil {
		return nil, err
	}

	token, err := s.generateToken(user)
	if err != nil {
		return nil, err
	}

	return &AuthResult{Token: token, User: user}, nil
}

func (s *AuthService) Login(input *LoginInput) (*AuthResult, error) {
	user, err := s.userRepo.FindByPhone(input.Phone)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("手机号或密码错误")
		}
		return nil, err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(input.Password)); err != nil {
		return nil, errors.New("手机号或密码错误")
	}

	token, err := s.generateToken(user)
	if err != nil {
		return nil, err
	}

	return &AuthResult{Token: token, User: user}, nil
}

func (s *AuthService) generateToken(user *model.User) (string, error) {
	cfg := config.Global.JWT
	claims := middleware.Claims{
		UserID: user.ID,
		Role:   user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Duration(cfg.ExpireHours) * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(cfg.Secret))
}

func (s *AuthService) GetUserByID(id uint) (*model.User, error) {
	return s.userRepo.FindByID(id)
}
