package model

import (
	"time"

	"gorm.io/gorm"
)

// ===========================
// 用户表
// ===========================

type UserRole string

const (
	RoleUser   UserRole = "user"   // 普通用户（竞拍者）
	RoleSeller UserRole = "seller" // 商家/主播
)

type User struct {
	ID        uint           `gorm:"primaryKey;autoIncrement" json:"id"`
	Nickname  string         `gorm:"size:50;not null" json:"nickname"`
	Phone     string         `gorm:"size:20;uniqueIndex;not null" json:"phone"`
	Password  string         `gorm:"size:255;not null" json:"-"` // 不序列化到 JSON
	Role      UserRole       `gorm:"type:varchar(10);default:'user'" json:"role"`
	Avatar    string         `gorm:"size:500" json:"avatar"`
	Balance   int64          `gorm:"default:0" json:"balance"` // 单位：分
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// ===========================
// 商品表
// ===========================

type Product struct {
	ID          uint           `gorm:"primaryKey;autoIncrement" json:"id"`
	SellerID    uint           `gorm:"not null;index" json:"seller_id"`
	Seller      *User          `gorm:"foreignKey:SellerID" json:"seller,omitempty"`
	Name        string         `gorm:"size:200;not null" json:"name"`
	Description string         `gorm:"type:text" json:"description"`
	Images      string         `gorm:"type:text" json:"images"` // JSON 数组字符串，存多张图片 URL
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

// ===========================
// 竞拍表（核心）
// ===========================

type AuctionStatus string

const (
	AuctionDraft     AuctionStatus = "draft"     // 草稿
	AuctionPending   AuctionStatus = "pending"   // 待开始
	AuctionActive    AuctionStatus = "active"    // 进行中
	AuctionSold      AuctionStatus = "sold"      // 已成交
	AuctionCancelled AuctionStatus = "cancelled" // 已取消
)

type Auction struct {
	ID           uint          `gorm:"primaryKey;autoIncrement" json:"id"`
	ProductID    uint          `gorm:"not null;index" json:"product_id"`
	Product      *Product      `gorm:"foreignKey:ProductID" json:"product,omitempty"`
	SellerID     uint          `gorm:"not null;index" json:"seller_id"`

	// 竞拍规则（创建后仅 pending 状态可修改）
	StartPrice   int64         `gorm:"not null" json:"start_price"`   // 起拍价（分）
	Increment    int64         `gorm:"not null" json:"increment"`     // 加价幅度（分）
	CapPrice     int64         `gorm:"default:0" json:"cap_price"`    // 封顶价（分），0=不设封顶
	Duration     int           `gorm:"not null" json:"duration"`      // 竞拍时长（秒）
	DelaySeconds int           `gorm:"default:10" json:"delay_seconds"` // 延时秒数（10-30）

	// 竞拍状态（运行时数据）
	Status       AuctionStatus `gorm:"type:varchar(20);default:'draft';index" json:"status"`
	CurrentPrice int64         `gorm:"default:0" json:"current_price"` // 当前最高出价
	Version      int           `gorm:"default:0" json:"-"`             // 乐观锁版本号
	StartTime    *time.Time    `json:"start_time"`
	EndTime      *time.Time    `json:"end_time"`
	ExtendCount  int           `gorm:"default:0" json:"extend_count"` // 延时触发次数（监控用）

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

// ===========================
// 出价记录表（只增不改）
// ===========================

type Bid struct {
	ID        uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	AuctionID uint      `gorm:"not null;index" json:"auction_id"`
	UserID    uint      `gorm:"not null;index" json:"user_id"`
	User      *User     `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Amount    int64     `gorm:"not null" json:"amount"` // 出价金额（分）
	CreatedAt time.Time `json:"created_at"`
}

// ===========================
// 订单表
// ===========================

type PayStatus string

const (
	PayPending PayStatus = "pending" // 待支付
	PayPaid    PayStatus = "paid"    // 已支付
	PayExpired PayStatus = "expired" // 支付超时
)

type Order struct {
	ID         uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	AuctionID  uint      `gorm:"not null;uniqueIndex" json:"auction_id"` // 一场竞拍最多一个订单
	Auction    *Auction  `gorm:"foreignKey:AuctionID" json:"auction,omitempty"`
	WinnerID   uint      `gorm:"not null;index" json:"winner_id"`
	Winner     *User     `gorm:"foreignKey:WinnerID" json:"winner,omitempty"`
	FinalPrice int64     `gorm:"not null" json:"final_price"` // 成交价（分）
	PayStatus  PayStatus `gorm:"type:varchar(20);default:'pending'" json:"pay_status"`
	PaidAt     *time.Time `json:"paid_at"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

// ===========================
// 监控快照表
// ===========================

type MonitorSnapshot struct {
	ID            uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	SnapshotTime  time.Time `gorm:"index" json:"snapshot_time"`
	ActiveCount   int       `json:"active_count"`   // 进行中竞拍数
	OnlineUsers   int       `json:"online_users"`   // 全站在线人数
	BidCount      int       `json:"bid_count"`      // 该小时出价次数
	BidFailCount  int       `json:"bid_fail_count"` // 出价失败次数
	DailyGMV      int64     `json:"daily_gmv"`      // 当日 GMV（分）
}
