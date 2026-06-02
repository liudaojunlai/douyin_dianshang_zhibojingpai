package repository

import (
	"auction-server/internal/model"
	"gorm.io/gorm"
)

type BidRepo struct{ db *gorm.DB }

func NewBidRepo() *BidRepo { return &BidRepo{db: DB} }

func (r *BidRepo) Create(bid *model.Bid) error {
	return r.db.Create(bid).Error
}

func (r *BidRepo) ListByAuction(auctionID uint, limit int) ([]*model.Bid, error) {
	var list []*model.Bid
	err := r.db.Preload("User").Where("auction_id = ?", auctionID).
		Order("amount DESC").Limit(limit).Find(&list).Error
	return list, err
}

func (r *BidRepo) GetWinner(auctionID uint) (*model.Bid, error) {
	var bid model.Bid
	err := r.db.Preload("User").Where("auction_id = ?", auctionID).
		Order("amount DESC").First(&bid).Error
	return &bid, err
}
