package service

import (
	"errors"
	"time"

	"auction-server/internal/model"
	"auction-server/internal/repository"
)

type AuctionService struct {
	repo *repository.AuctionRepo
}

func NewAuctionService() *AuctionService {
	return &AuctionService{repo: repository.NewAuctionRepo()}
}

type CreateAuctionInput struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	Images      string `json:"images"` // JSON 数组字符串
	StartPrice  int64  `json:"start_price" binding:"required,min=0"`
	Increment   int64  `json:"increment" binding:"required,min=1"`
	CapPrice    int64  `json:"cap_price"`
	Duration    int    `json:"duration" binding:"required,min=30"`
	DelaySeconds int   `json:"delay_seconds" binding:"min=10,max=30"`
	StartTime   *time.Time `json:"start_time"`
}

type UpdateRulesInput struct {
	StartPrice   *int64     `json:"start_price"`
	Increment    *int64     `json:"increment"`
	CapPrice     *int64     `json:"cap_price"`
	Duration     *int       `json:"duration"`
	DelaySeconds *int       `json:"delay_seconds"`
	StartTime    *time.Time `json:"start_time"`
}

func (s *AuctionService) Create(sellerID uint, input *CreateAuctionInput) (*model.Auction, error) {
	product := &model.Product{
		SellerID:    sellerID,
		Name:        input.Name,
		Description: input.Description,
		Images:      input.Images,
	}
	if err := repository.DB.Create(product).Error; err != nil {
		return nil, err
	}

	delaySeconds := input.DelaySeconds
	if delaySeconds == 0 {
		delaySeconds = 10
	}

	now := time.Now()
	
	auction := &model.Auction{
		ProductID:    product.ID,
		SellerID:     sellerID,
		StartPrice:   input.StartPrice,
		Increment:    input.Increment,
		CapPrice:     input.CapPrice,
		Duration:     input.Duration,
		DelaySeconds: delaySeconds,
		Status:       model.AuctionActive, // 创建后立即开始
		CurrentPrice: input.StartPrice,
	}

	// 如果用户指定了开始时间，就用用户的；否则立即开始
	if input.StartTime != nil {
		auction.StartTime = input.StartTime
		endTime := input.StartTime.Add(time.Duration(input.Duration) * time.Second)
		auction.EndTime = &endTime
	} else {
		auction.StartTime = &now
		endTime := now.Add(time.Duration(input.Duration) * time.Second)
		auction.EndTime = &endTime
	}

	if err := s.repo.Create(auction); err != nil {
		return nil, err
	}
	return s.repo.FindByID(auction.ID)
}

func (s *AuctionService) GetByID(id uint) (*model.Auction, error) {
	return s.repo.FindByID(id)
}

func (s *AuctionService) List(status string, page, size int) ([]*model.Auction, int64, error) {
	if page <= 0 { page = 1 }
	if size <= 0 || size > 50 { size = 20 }
	return s.repo.List(status, page, size)
}

func (s *AuctionService) ListBySeller(sellerID uint, page, size int) ([]*model.Auction, int64, error) {
	if page <= 0 { page = 1 }
	if size <= 0 || size > 50 { size = 20 }
	return s.repo.ListBySeller(sellerID, page, size)
}

func (s *AuctionService) UpdateRules(id, sellerID uint, input *UpdateRulesInput) error {
	auction, err := s.repo.FindByID(id)
	if err != nil {
		return errors.New("竞拍不存在")
	}
	if auction.SellerID != sellerID {
		return errors.New("无权限修改")
	}
	if auction.Status != model.AuctionPending {
		return errors.New("只能修改待开始的竞拍规则")
	}

	updates := map[string]any{}
	if input.StartPrice != nil { updates["start_price"] = *input.StartPrice; updates["current_price"] = *input.StartPrice }
	if input.Increment != nil  { updates["increment"] = *input.Increment }
	if input.CapPrice != nil   { updates["cap_price"] = *input.CapPrice }
	if input.Duration != nil   { updates["duration"] = *input.Duration }
	if input.DelaySeconds != nil { updates["delay_seconds"] = *input.DelaySeconds }
	if input.StartTime != nil  {
		updates["start_time"] = *input.StartTime
		endTime := input.StartTime.Add(time.Duration(auction.Duration) * time.Second)
		updates["end_time"] = endTime
	}

	return s.repo.UpdateRules(id, updates)
}

func (s *AuctionService) Cancel(id, sellerID uint) error {
	auction, err := s.repo.FindByID(id)
	if err != nil {
		return errors.New("竞拍不存在")
	}
	if auction.SellerID != sellerID {
		return errors.New("无权限操作")
	}
	if auction.Status == model.AuctionSold || auction.Status == model.AuctionCancelled {
		return errors.New("竞拍已结束，无法取消")
	}
	return s.repo.UpdateStatus(id, auction.Status, model.AuctionCancelled, nil)
}
