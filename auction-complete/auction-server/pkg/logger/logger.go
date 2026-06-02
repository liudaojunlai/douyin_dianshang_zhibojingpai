package logger

import (
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

var Log *zap.Logger

// Init 初始化日志器
// development 模式：彩色控制台输出，DEBUG 级别
// production 模式：JSON 格式，INFO 级别
func Init(env string) {
	var cfg zap.Config

	if env == "production" {
		cfg = zap.NewProductionConfig()
		cfg.EncoderConfig.TimeKey = "time"
		cfg.EncoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder
	} else {
		cfg = zap.NewDevelopmentConfig()
		cfg.EncoderConfig.EncodeLevel = zapcore.CapitalColorLevelEncoder
	}

	var err error
	Log, err = cfg.Build()
	if err != nil {
		panic("初始化日志器失败: " + err.Error())
	}
}

// 便捷方法，直接用包级别调用
func Info(msg string, fields ...zap.Field)  { Log.Info(msg, fields...) }
func Warn(msg string, fields ...zap.Field)  { Log.Warn(msg, fields...) }
func Error(msg string, fields ...zap.Field) { Log.Error(msg, fields...) }
func Debug(msg string, fields ...zap.Field) { Log.Debug(msg, fields...) }
func Fatal(msg string, fields ...zap.Field) { Log.Fatal(msg, fields...) }
