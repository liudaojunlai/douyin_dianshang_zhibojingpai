package main

import (
	"encoding/json"
	"time"

	"auction-server/internal/config"
	"auction-server/internal/model"
	"auction-server/internal/repository"

	"golang.org/x/crypto/bcrypt"
)

func main() {
	// 加载配置
	config.Init()

	// 初始化数据库
	repository.InitDB(&config.Global.DB)

	// 1. 创建测试用户
	hashedPwd1, _ := bcrypt.GenerateFromPassword([]byte("123456"), bcrypt.DefaultCost)
	seller := &model.User{
		Phone:    "13800138001",
		Nickname: "数码达人小王",
		Password: string(hashedPwd1),
		Role:     model.RoleSeller,
		Balance:  0,
	}
	repository.DB.Create(seller)

	hashedPwd2, _ := bcrypt.GenerateFromPassword([]byte("123456"), bcrypt.DefaultCost)
	bidder := &model.User{
		Phone:    "13800138002",
		Nickname: "竞拍者小李",
		Password: string(hashedPwd2),
		Role:     model.RoleUser,
		Balance:  10000000,
	}
	repository.DB.Create(bidder)

	// 2. 创建测试商品
	product1 := &model.Product{
		SellerID:   seller.ID,
		Name:       "限量版 AirPods Max 星空银",
		Description: "苹果官方全新未拆封，经典配色",
		Images:     toJSON([]string{"https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=400"}),
	}
	repository.DB.Create(product1)

	product2 := &model.Product{
		SellerID:   seller.ID,
		Name:       "索尼 PS5 光驱版",
		Description: "99新，带两个原装手柄",
		Images:     toJSON([]string{"https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=400"}),
	}
	repository.DB.Create(product2)

	product3 := &model.Product{
		SellerID:   seller.ID,
		Name:       "戴森 V15 吸尘器",
		Description: "全新正品，官方保修两年",
		Images:     toJSON([]string{"https://images.unsplash.com/photo-1558317374-067fb5f30001?w=400"}),
	}
	repository.DB.Create(product3)

	// 3. 创建测试拍卖（进行中）
	now := time.Now()
	endTime1 := now.Add(1 * time.Hour)
	endTime2 := now.Add(2 * time.Hour)
	endTime3 := now.Add(30 * time.Minute)

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
		Version:      0,
		StartTime:    &now,
		EndTime:      &endTime1,
		ExtendCount:  0,
	}
	repository.DB.Create(auction1)

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
		Version:      0,
		StartTime:    &now,
		EndTime:      &endTime2,
		ExtendCount:  0,
	}
	repository.DB.Create(auction2)

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
		Version:      0,
		StartTime:    &now,
		EndTime:      &endTime3,
		ExtendCount:  0,
	}
	repository.DB.Create(auction3)

	// 4. 创建一些出价记录
	bid1 := &model.Bid{
		AuctionID: auction1.ID,
		UserID:    bidder.ID,
		Amount:    429900,
	}
	repository.DB.Create(bid1)

	println("✅ 测试数据初始化成功！")
	println("📱 测试账号：")
	println("   商家账号：13800138001 / 123456")
	println("   买家账号：13800138002 / 123456")
}

func toJSON(v interface{}) string {
	b, _ := json.Marshal(v)
	return string(b)
}
