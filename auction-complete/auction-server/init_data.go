//go:build initdata

package main

import (
	"encoding/json"
	"fmt"
	"time"

	"auction-server/internal/config"
	"auction-server/internal/model"
	"auction-server/internal/repository"

	"golang.org/x/crypto/bcrypt"
)

func main() {
	// 加载配置
	if _, err := config.Load(); err != nil {
		panic(err)
	}

	// 初始化数据库
	if err := repository.InitDB(&config.Global.DB); err != nil {
		panic(err)
	}

	fmt.Println("开始插入测试数据...")

	// 插入测试用户
	hashedPwd, _ := bcrypt.GenerateFromPassword([]byte("123456"), bcrypt.DefaultCost)
	seller := &model.User{
		Phone:    "13800138001",
		Nickname: "数码达人小王",
		Password: string(hashedPwd),
		Role:     model.RoleSeller,
	}
	if err := repository.DB.Create(seller).Error; err != nil {
		panic(err)
	}
	fmt.Printf("创建卖家: ID=%d, 昵称=%s\n", seller.ID, seller.Nickname)

	bidder := &model.User{
		Phone:    "13800138002",
		Nickname: "竞拍者小李",
		Password: string(hashedPwd),
		Role:     model.RoleUser,
		Balance:  10000000,
	}
	if err := repository.DB.Create(bidder).Error; err != nil {
		panic(err)
	}
	fmt.Printf("创建买家: ID=%d, 昵称=%s\n", bidder.ID, bidder.Nickname)

	// 插入测试商品
	product1 := &model.Product{
		SellerID:    seller.ID,
		Name:        "限量版 AirPods Max 星空银",
		Description: "苹果官方全新未拆封，经典配色，音质绝佳",
		Images:      toJSON([]string{"https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=400"}),
	}
	if err := repository.DB.Create(product1).Error; err != nil {
		panic(err)
	}
	fmt.Printf("创建商品1: ID=%d, 名称=%s\n", product1.ID, product1.Name)

	product2 := &model.Product{
		SellerID:    seller.ID,
		Name:        "索尼 PS5 光驱版",
		Description: "99新，带两个原装手柄，完美运行",
		Images:      toJSON([]string{"https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=400"}),
	}
	if err := repository.DB.Create(product2).Error; err != nil {
		panic(err)
	}
	fmt.Printf("创建商品2: ID=%d, 名称=%s\n", product2.ID, product2.Name)

	product3 := &model.Product{
		SellerID:    seller.ID,
		Name:        "戴森 V15 吸尘器",
		Description: "全新正品，官方保修两年，强劲吸力",
		Images:      toJSON([]string{"https://images.unsplash.com/photo-1558317374-067fb5f30001?w=400"}),
	}
	if err := repository.DB.Create(product3).Error; err != nil {
		panic(err)
	}
	fmt.Printf("创建商品3: ID=%d, 名称=%s\n", product3.ID, product3.Name)

	// 插入测试拍卖
	now := time.Now()
	end1 := now.Add(1 * time.Hour)
	end2 := now.Add(2 * time.Hour)
	end3 := now.Add(30 * time.Minute)

	auction1 := &model.Auction{
		ProductID:    product1.ID,
		SellerID:     seller.ID,
		Status:       model.AuctionActive,
		StartPrice:   399900,
		Increment:    1000,
		CapPrice:     499900,
		Duration:     3600,
		DelaySeconds: 10,
		CurrentPrice: 429900,
		StartTime:    &now,
		EndTime:      &end1,
	}
	if err := repository.DB.Create(auction1).Error; err != nil {
		panic(err)
	}
	fmt.Printf("创建拍卖1: ID=%d, 商品=%s\n", auction1.ID, product1.Name)

	auction2 := &model.Auction{
		ProductID:    product2.ID,
		SellerID:     seller.ID,
		Status:       model.AuctionActive,
		StartPrice:   299900,
		Increment:    1000,
		CapPrice:     399900,
		Duration:     7200,
		DelaySeconds: 10,
		CurrentPrice: 319900,
		StartTime:    &now,
		EndTime:      &end2,
	}
	if err := repository.DB.Create(auction2).Error; err != nil {
		panic(err)
	}
	fmt.Printf("创建拍卖2: ID=%d, 商品=%s\n", auction2.ID, product2.Name)

	auction3 := &model.Auction{
		ProductID:    product3.ID,
		SellerID:     seller.ID,
		Status:       model.AuctionActive,
		StartPrice:   349900,
		Increment:    1000,
		CapPrice:     449900,
		Duration:     1800,
		DelaySeconds: 10,
		CurrentPrice: 359900,
		StartTime:    &now,
		EndTime:      &end3,
	}
	if err := repository.DB.Create(auction3).Error; err != nil {
		panic(err)
	}
	fmt.Printf("创建拍卖3: ID=%d, 商品=%s\n", auction3.ID, product3.Name)

	// 插入出价记录
	bid := &model.Bid{
		AuctionID: auction1.ID,
		UserID:    bidder.ID,
		Amount:    429900,
	}
	if err := repository.DB.Create(bid).Error; err != nil {
		panic(err)
	}
	fmt.Printf("创建出价记录: ID=%d, 金额=%.2f\n", bid.ID, float64(bid.Amount)/100.0)

	fmt.Println("\n✅ 测试数据初始化成功！")
	fmt.Println("\n📱 测试账号：")
	fmt.Println("   商家账号: 13800138001 / 123456")
	fmt.Println("   买家账号: 13800138002 / 123456")
}

func toJSON(v interface{}) string {
	b, _ := json.Marshal(v)
	return string(b)
}
