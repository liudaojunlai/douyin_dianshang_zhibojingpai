package repository

import (
	"auction-server/internal/config"
	"auction-server/internal/model"
	"auction-server/pkg/logger"

	"go.uber.org/zap"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	gormLogger "gorm.io/gorm/logger"
)

var DB *gorm.DB

// InitDB 初始化数据库连接并自动迁移表结构
func InitDB(cfg *config.DBConfig) error {
	gormCfg := &gorm.Config{}

	// 开发环境打印 SQL，生产环境只打印错误
	if config.Global.App.Env == "development" {
		gormCfg.Logger = gormLogger.Default.LogMode(gormLogger.Info)
	} else {
		gormCfg.Logger = gormLogger.Default.LogMode(gormLogger.Error)
	}

	db, err := gorm.Open(mysql.Open(cfg.DSN()), gormCfg)
	if err != nil {
		return err
	}

	// 连接池配置
	sqlDB, err := db.DB()
	if err != nil {
		return err
	}
	sqlDB.SetMaxIdleConns(cfg.MaxIdleConns)
	sqlDB.SetMaxOpenConns(cfg.MaxOpenConns)

	// 自动建表/迁移（不删除字段，安全）
	err = db.AutoMigrate(
		&model.User{},
		&model.Product{},
		&model.Auction{},
		&model.Bid{},
		&model.Order{},
		&model.MonitorSnapshot{},
	)
	if err != nil {
		return err
	}

	DB = db
	logger.Info("数据库连接成功", zap.String("host", cfg.Host), zap.String("db", cfg.Name))
	return nil
}
