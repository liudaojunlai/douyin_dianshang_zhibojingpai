package main

import (
	"fmt"
	"os"
	"time"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

func getEnv(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}

type Auction struct {
	ID          uint
	Name        string
	ImageURL    string
	Description string
	StartPrice  int64
	CurrentPrice int64
	Increment   int64
	CapPrice    int64
	Status      string
	StartTime   *time.Time
	EndTime     *time.Time
	DelaySeconds int
	ExtendCount int
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

func main() {
	password := getEnv("DB_PASSWORD", "root123456")
	dsn := fmt.Sprintf("root:%s@tcp(127.0.0.1:3307)/auction?charset=utf8mb4&parseTime=True&loc=Local", password)
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		panic(err)
	}

	db.Exec("UPDATE auctions SET status='cancelled' WHERE 1=1")

	now := time.Now()
	end := now.Add(60 * time.Minute)

	auction := Auction{
		Name:         "超级测试手机",
		ImageURL:     "https://picsum.photos/800/400",
		Description:  "千人实时在线竞拍测试专用商品",
		StartPrice:   100000,
		CurrentPrice: 100000,
		Increment:    10000,
		CapPrice:     99999999,
		Status:       "active",
		StartTime:    &now,
		EndTime:      &end,
		DelaySeconds: 30,
		ExtendCount:  0,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	if err := db.Create(&auction).Error; err != nil {
		panic(err)
	}

	fmt.Printf("✅ 成功创建竞拍！ID = %d\n", auction.ID)
	fmt.Println("现在你刷新 http://localhost:3001 首页，直接点进去就能看到进行中的竞拍房间了！")
}
