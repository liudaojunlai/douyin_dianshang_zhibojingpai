
package main

import (
	"fmt"

	"auction-server/internal/config"
	"auction-server/internal/repository"
	"auction-server/pkg/logger"

	"go.uber.org/zap"
)

func main() {
	// 初始化配置
	cfg, err := config.Load()
	if err != nil {
		logger.Fatal("加载配置失败", zap.Error(err))
	}

	// 初始化数据库
	repository.InitDB(cfg.Database)

	// 获取所有竞拍
	auctions, _, err := repository.NewAuctionRepo().List("", 1, 100)
	if err != nil {
		logger.Fatal("获取竞拍列表失败", zap.Error(err))
	}

	fmt.Println("\n📋 数据库中的竞拍列表：")
	fmt.Println("------------------------------------")
	for _, auction := range auctions {
		fmt.Printf("ID: %d\n", auction.ID)
		fmt.Printf("商品名: %s\n", auction.Product.Name)
		fmt.Printf("状态: %s\n", auction.Status)
		fmt.Printf("当前价格: %d (¥%.2f)\n", auction.CurrentPrice, float64(auction.CurrentPrice)/100)
		fmt.Printf("起拍价: %d (¥%.2f)\n", auction.StartPrice, float64(auction.StartPrice)/100)
		fmt.Println("------------------------------------")
	}
}
