package config

import (
	"fmt"
	"net/url"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

// Config 全局配置结构体
type Config struct {
	App   AppConfig
	DB    DBConfig
	Redis RedisConfig
	JWT   JWTConfig
	WS    WSConfig
}

type AppConfig struct {
	Env    string
	Port   string
	Secret string
}

type DBConfig struct {
	Host         string
	Port         string
	User         string
	Password     string
	Name         string
	MaxIdleConns int
	MaxOpenConns int
}

type RedisConfig struct {
	Host     string
	Port     string
	Password string
	DB       int
}

type JWTConfig struct {
	Secret      string
	ExpireHours int
}

type WSConfig struct {
	HeartbeatInterval int // 秒
	HeartbeatTimeout  int // 秒
}

var Global *Config

// Load 加载配置，优先读取 .env 文件，再读取环境变量
func Load() (*Config, error) {
	// 尝试加载 .env（不存在时忽略，生产环境直接用系统环境变量）
	_ = godotenv.Load()

	cfg := &Config{
		App: AppConfig{
			Env:    getEnv("APP_ENV", "development"),
			Port:   getEnv("APP_PORT", "8080"),
			Secret: mustGetEnv("APP_SECRET"),
		},
		DB: DBConfig{
			Host:         getEnv("DB_HOST", "localhost"),
			Port:         getEnv("DB_PORT", "3306"),
			User:         getEnv("DB_USER", "root"),
			Password:     mustGetEnv("DB_PASSWORD"),
			Name:         getEnv("DB_NAME", "auction_db"),
			MaxIdleConns: getEnvInt("DB_MAX_IDLE_CONNS", 10),
			MaxOpenConns: getEnvInt("DB_MAX_OPEN_CONNS", 100),
		},
		Redis: RedisConfig{
			Host:     getEnv("REDIS_HOST", "localhost"),
			Port:     getEnv("REDIS_PORT", "6379"),
			Password: getEnv("REDIS_PASSWORD", ""),
			DB:       getEnvInt("REDIS_DB", 0),
		},
		JWT: JWTConfig{
			Secret:      mustGetEnv("JWT_SECRET"),
			ExpireHours: getEnvInt("JWT_EXPIRE_HOURS", 72),
		},
		WS: WSConfig{
			HeartbeatInterval: getEnvInt("WS_HEARTBEAT_INTERVAL", 15),
			HeartbeatTimeout:  getEnvInt("WS_HEARTBEAT_TIMEOUT", 30),
		},
	}

	Global = cfg
	return cfg, nil
}

// DSN 生成 MySQL 连接字符串（密码经过 URL 编码，防止特殊字符破坏 DSN）
func (c *DBConfig) DSN() string {
	return fmt.Sprintf(
		"%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		c.User, url.QueryEscape(c.Password), c.Host, c.Port, c.Name,
	)
}

// Addr 生成 Redis 地址
func (c *RedisConfig) Addr() string {
	return fmt.Sprintf("%s:%s", c.Host, c.Port)
}

func getEnv(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}

// mustGetEnv 读取必填环境变量，缺失时 panic（启动阶段快速失败）
func mustGetEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		panic(fmt.Sprintf("必填环境变量 %s 未设置", key))
	}
	return v
}

func getEnvInt(key string, defaultVal int) int {
	v := os.Getenv(key)
	if v == "" {
		return defaultVal
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return defaultVal
	}
	return n
}
