package repository

import (
	"auction-server/internal/model"

	"gorm.io/gorm"
)

type AuctionRepo struct{ db *gorm.DB }

func NewAuctionRepo() *AuctionRepo { return &AuctionRepo{db: DB} }

func (r *AuctionRepo) Create(a *model.Auction) error {
	return r.db.Create(a).Error
}

func (r *AuctionRepo) FindByID(id uint) (*model.Auction, error) {
	var a model.Auction
	err := r.db.Preload("Product").Preload("Product.Seller").First(&a, id).Error
	return &a, err
}

func (r *AuctionRepo) List(status string, page, size int) ([]*model.Auction, int64, error) {
	var list []*model.Auction
	var total int64
	q := r.db.Model(&model.Auction{}).Preload("Product").Preload("Product.Seller")
	if status != "" {
		q = q.Where("status = ?", status)
	}
	q.Count(&total)
	err := q.Offset((page - 1) * size).Limit(size).Order("created_at DESC").Find(&list).Error
	return list, total, err
}

func (r *AuctionRepo) ListBySeller(sellerID uint, page, size int) ([]*model.Auction, int64, error) {
	var list []*model.Auction
	var total int64
	q := r.db.Model(&model.Auction{}).Preload("Product").Preload("Product.Seller").Where("seller_id = ?", sellerID)
	q.Count(&total)
	err := q.Offset((page - 1) * size).Limit(size).Order("created_at DESC").Find(&list).Error
	return list, total, err
}

// UpdateRules 仅允许 pending 状态修改规则
func (r *AuctionRepo) UpdateRules(id uint, updates map[string]any) error {
	return r.db.Model(&model.Auction{}).Where("id = ? AND status = ?", id, model.AuctionPending).
		Updates(updates).Error
}

// UpdateStatus 状态机流转（带乐观锁）
func (r *AuctionRepo) UpdateStatus(id uint, from, to model.AuctionStatus, extra map[string]any) error {
	updates := map[string]any{"status": to}
	for k, v := range extra {
		updates[k] = v
	}
	result := r.db.Model(&model.Auction{}).
		Where("id = ? AND status = ?", id, from).
		Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// UpdateCurrentPrice 乐观锁更新当前出价价格
// 只有 version 匹配时才更新，防止并发超卖
func (r *AuctionRepo) UpdateCurrentPrice(id uint, newPrice int64, version int, extraUpdates map[string]any) error {
	updates := map[string]any{
		"current_price": newPrice,
		"version":       version + 1,
	}
	for k, v := range extraUpdates {
		updates[k] = v
	}
	result := r.db.Model(&model.Auction{}).
		Where("id = ? AND version = ? AND status = ?", id, version, model.AuctionActive).
		Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrVersionConflict
	}
	return nil
}

// FindActivePending 查找所有需要激活的竞拍（定时器用）
func (r *AuctionRepo) FindActivePending() ([]*model.Auction, error) {
	var list []*model.Auction
	err := r.db.Where("status = ? AND (start_time IS NULL OR start_time <= NOW())", model.AuctionPending).Find(&list).Error
	return list, err
}

// FindExpiredActive 查找已超时的进行中竞拍
func (r *AuctionRepo) FindExpiredActive() ([]*model.Auction, error) {
	var list []*model.Auction
	err := r.db.Where("status = ? AND end_time <= NOW()", model.AuctionActive).Find(&list).Error
	return list, err
}

// UpdateStatusForce 强制更新状态（兜底自动成交用），不需要乐观锁校验
func (r *AuctionRepo) UpdateStatusForce(id uint, newStatusStr string, updates map[string]any) error {
	if newStatusStr != "" {
		if updates == nil {
			updates = make(map[string]any)
		}
		updates["status"] = newStatusStr
	}
	return r.db.Model(&model.Auction{}).Where("id = ?", id).Updates(updates).Error
}

// UpdateCurrentPriceWithBid 原子操作：乐观锁更新价格 + 创出价记录（事务保护）
func (r *AuctionRepo) UpdateCurrentPriceWithBid(id uint, newPrice int64, version int, extraUpdates map[string]any, bid *model.Bid) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		updates := map[string]any{
			"current_price": newPrice,
			"version":       version + 1,
		}
		for k, v := range extraUpdates {
			updates[k] = v
		}
		result := tx.Model(&model.Auction{}).
			Where("id = ? AND version = ? AND status = ?", id, version, model.AuctionActive).
			Updates(updates)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return ErrVersionConflict
		}
		// 写入出价记录（与价格更新在同一事务中）
		if err := tx.Create(bid).Error; err != nil {
			return err
		}
		return nil
	})
}

var ErrVersionConflict = gorm.ErrDuplicatedKey // 复用 gorm 错误，实际判断用 errors.Is
