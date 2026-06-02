package service

import (
	"errors"
	"time"

	"auction-server/internal/model"
	"auction-server/internal/repository"
)

type OrderService struct {
	auctionRepo *repository.AuctionRepo
	bidRepo     *repository.BidRepo
}

func NewOrderService() *OrderService {
	return &OrderService{
		auctionRepo: repository.NewAuctionRepo(),
		bidRepo:     repository.NewBidRepo(),
	}
}

// CreateOrder 竞拍成交，生成订单
// 由定时器（超时成交）或出价服务（封顶成交）调用
func (s *OrderService) CreateOrder(auctionID, winnerID uint, finalPrice int64) (*model.Order, error) {
	// 幂等检查：同一竞拍只能生成一个订单
	var existing model.Order
	if err := repository.DB.Where("auction_id = ?", auctionID).First(&existing).Error; err == nil {
		return &existing, nil // 已存在，直接返回
	}

	order := &model.Order{
		AuctionID:  auctionID,
		WinnerID:   winnerID,
		FinalPrice: int64(finalPrice),
		PayStatus:  model.PayPending,
	}

	// 事务：更新竞拍状态 + 创建订单
	err := repository.DB.Transaction(func(tx *repository.TxDB) error {
		if err := tx.Model(&model.Auction{}).
			Where("id = ? AND status = ?", auctionID, model.AuctionActive).
			Updates(map[string]any{"status": model.AuctionSold}).Error; err != nil {
			return err
		}
		return tx.Create(order).Error
	})

	return order, err
}

// SimulatePay 模拟支付
func (s *OrderService) SimulatePay(orderID, userID uint) error {
	var order model.Order
	if err := repository.DB.First(&order, orderID).Error; err != nil {
		return errors.New("订单不存在")
	}
	if order.WinnerID != userID {
		return errors.New("无权操作此订单")
	}
	if order.PayStatus == model.PayPaid {
		return errors.New("订单已支付")
	}

	now := time.Now()
	return repository.DB.Model(&order).Updates(map[string]any{
		"pay_status": model.PayPaid,
		"paid_at":    now,
	}).Error
}

func (s *OrderService) ListOrders(userID uint, role model.UserRole, page, size int) ([]*model.Order, int64, error) {
	if page <= 0 { page = 1 }
	if size <= 0 || size > 50 { size = 20 }

	var list []*model.Order
	var total int64
	q := repository.DB.Model(&model.Order{}).Preload("Auction").Preload("Auction.Product").Preload("Winner")

	if role == model.RoleUser {
		q = q.Where("winner_id = ?", userID)
	}
	// 商家查询所有订单（自己商品的）
	if role == model.RoleSeller {
		q = q.Joins("JOIN auctions ON auctions.id = orders.auction_id").
			Where("auctions.seller_id = ?", userID)
	}

	q.Count(&total)
	err := q.Offset((page - 1) * size).Limit(size).Order("orders.created_at DESC").Find(&list).Error
	return list, total, err
}
