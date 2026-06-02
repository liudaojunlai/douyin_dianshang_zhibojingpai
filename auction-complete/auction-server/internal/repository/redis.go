package repository

import (
	"context"
	"auction-server/internal/config"
	"auction-server/pkg/logger"

	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

var RDB *redis.Client

// InitRedis 初始化 Redis 连接
func InitRedis(cfg *config.RedisConfig) error {
	rdb := redis.NewClient(&redis.Options{
		Addr:     cfg.Addr(),
		Password: cfg.Password,
		DB:       cfg.DB,
	})

	// 连通性检查
	if err := rdb.Ping(context.Background()).Err(); err != nil {
		return err
	}

	RDB = rdb
	logger.Info("Redis 连接成功", zap.String("addr", cfg.Addr()))
	return nil
}
