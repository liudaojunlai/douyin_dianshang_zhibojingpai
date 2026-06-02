package service

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"sync"
	"time"

	"auction-server/internal/model"
	"auction-server/internal/repository"
	"auction-server/pkg/logger"

	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

var nicknameCache sync.Map

// BidEvent 出价成功后广播的事件数据
type BidEvent struct {
	AuctionID    uint      `json:"auction_id"`
	UserID       uint      `json:"user_id"`
	Nickname     string    `json:"nickname"`
	Amount       int64     `json:"amount"`
	CurrentPrice int64     `json:"current_price"`
	Timestamp    time.Time `json:"timestamp"`
	// 延时相关
	Extended    bool      `json:"extended"`
	NewEndTime  *time.Time `json:"new_end_time,omitempty"`
	ExtendSecs  int       `json:"extend_secs,omitempty"`
	// 封顶成交
	CapReached  bool      `json:"cap_reached"`
}

type LeaderboardItem struct {
	Rank     int    `json:"rank"`
	UserID   uint   `json:"user_id"`
	Nickname string `json:"nickname"`
	Amount   int64  `json:"amount"`
}

type BidService struct {
	auctionRepo *repository.AuctionRepo
	bidRepo     *repository.BidRepo
	rdb         *redis.Client
	userRepo    *repository.UserRepo
}

func NewBidService() *BidService {
	return &BidService{
		auctionRepo: repository.NewAuctionRepo(),
		bidRepo:     repository.NewBidRepo(),
		rdb:         repository.RDB,
		userRepo:    repository.NewUserRepo(),
	}
}

var (
	ErrAuctionNotActive  = errors.New("竞拍未在进行中")
	ErrBidTooLow         = errors.New("出价金额不符合加价规则")
	ErrBidRateLimit      = errors.New("出价太频繁，请稍后再试")
	ErrBidLockFailed     = errors.New("系统繁忙，请重试")
	ErrBidConflict       = errors.New("出价被抢先，请重新出价")
)

// PlaceBid 出价主流程
// 三层并发控制：前端防抖 → Redis 分布式锁 → MySQL 乐观锁
func (s *BidService) PlaceBid(auctionID, userID uint, amount int64) (*BidEvent, error) {
	ctx := context.Background()

	// ① 用户出价频率限制（每用户每分钟最多 10 次）
	if err := s.checkRateLimit(ctx, userID); err != nil {
		s.incrFailCount(ctx, auctionID)
		return nil, ErrBidRateLimit
	}

	// ② 获取 Redis 分布式锁（单个竞拍串行处理出价）
	lockKey := repository.AuctionLockKey(auctionID)
	lockVal := fmt.Sprintf("%d-%d", userID, time.Now().UnixNano())
	locked, err := s.rdb.SetNX(ctx, lockKey, lockVal, 5*time.Second).Result()
	if err != nil || !locked {
		s.incrFailCount(ctx, auctionID)
		return nil, ErrBidLockFailed
	}
	defer s.releaseLock(ctx, lockKey, lockVal)

	// ③ 从 Redis 缓存读取竞拍状态（减少 DB 压力）
	auction, err := s.auctionRepo.FindByID(auctionID)
	if err != nil {
		return nil, errors.New("竞拍不存在")
	}
	if auction.Status != model.AuctionActive {
		s.incrFailCount(ctx, auctionID)
		return nil, ErrAuctionNotActive
	}

	// ④ 校验出价金额：必须 >= 当前价 + 加价幅度，且为加价幅度的整数倍
	minBid := auction.CurrentPrice + auction.Increment
	if amount < minBid || (amount-auction.StartPrice)%auction.Increment != 0 {
		s.incrFailCount(ctx, auctionID)
		return nil, ErrBidTooLow
	}

	// ⑤ 判断是否触发延时（结束前 DelaySeconds 内有出价则延时）
	now := time.Now()
	var newEndTime *time.Time
	extended := false
	extraUpdates := map[string]any{}

	if auction.EndTime != nil {
		timeLeft := auction.EndTime.Sub(now).Seconds()
		if timeLeft <= float64(auction.DelaySeconds) {
			t := now.Add(time.Duration(auction.DelaySeconds) * time.Second)
			newEndTime = &t
			extended = true
			extraUpdates["end_time"] = t
			extraUpdates["extend_count"] = auction.ExtendCount + 1
		}
	}

	// ⑥ MySQL 乐观锁原子更新价格（version CAS）
	if err := s.auctionRepo.UpdateCurrentPrice(auctionID, amount, auction.Version, extraUpdates); err != nil {
		s.incrFailCount(ctx, auctionID)
		return nil, ErrBidConflict
	}

	// ⑦ 写入出价记录（只增不改）
	bid := &model.Bid{
		AuctionID: auctionID,
		UserID:    userID,
		Amount:    amount,
	}
	if err := s.bidRepo.Create(bid); err != nil {
		logger.Error("出价记录写入失败", zap.Error(err))
		// 不回滚价格，记录日志即可，不影响主流程
	}

	// ⑧ 更新 Redis 排行榜
	s.rdb.ZAdd(ctx, repository.AuctionLeaderboardKey(auctionID), redis.Z{
		Score:  float64(amount),
		Member: strconv.FormatUint(uint64(userID), 10),
	})

	// ⑨ 更新 Redis 热数据
	s.rdb.HSet(ctx, repository.AuctionInfoKey(auctionID),
		"current_price", amount,
		"updated_at", now.Unix(),
	)
	if newEndTime != nil {
		s.rdb.HSet(ctx, repository.AuctionInfoKey(auctionID), "end_time", newEndTime.Unix())
	}

	// ⑩ 监控：出价成功计数
	s.incrSuccessCount(ctx, auctionID)

	// ⑪ 判断是否达到封顶价，触发自动成交
	capReached := auction.CapPrice > 0 && amount >= auction.CapPrice

	event := &BidEvent{
		AuctionID:    auctionID,
		UserID:       userID,
		Amount:       amount,
		CurrentPrice: amount,
		Timestamp:    now,
		Extended:     extended,
		NewEndTime:   newEndTime,
		ExtendSecs:   auction.DelaySeconds,
		CapReached:   capReached,
	}

	// 加载用户昵称并预热到缓存
	if user, err := s.userRepo.FindByID(userID); err == nil {
		event.Nickname = user.Nickname
		nicknameCache.Store(userID, user.Nickname)
	}

	return event, nil
}

// GetLeaderboard 获取带昵称的完整排行榜，纯Redis+内存缓存，零DB压力
func (s *BidService) GetLeaderboard(auctionID uint, topN int64) ([]LeaderboardItem, error) {
	ctx := context.Background()
	zList, err := s.rdb.ZRevRangeWithScores(ctx,
		repository.AuctionLeaderboardKey(auctionID), 0, topN-1).Result()
	if err != nil {
		return nil, err
	}

	result := make([]LeaderboardItem, 0, len(zList))
	for idx, z := range zList {
		uidStr := z.Member.(string)
		uid, _ := strconv.ParseUint(uidStr, 10, 32)
		userID := uint(uid)
		amount := int64(z.Score)

		var nickname string
		if nickVal, ok := nicknameCache.Load(userID); ok {
			nickname = nickVal.(string)
		} else if u, err := s.userRepo.FindByID(userID); err == nil {
			nickname = u.Nickname
			nicknameCache.Store(userID, nickname)
		} else {
			nickname = fmt.Sprintf("用户%d", userID)
		}

		result = append(result, LeaderboardItem{
			Rank:     idx + 1,
			UserID:   userID,
			Nickname: nickname,
			Amount:   amount,
		})
	}
	return result, nil
}

// GetBidList 获取出价列表（从 DB）
func (s *BidService) GetBidList(auctionID uint) ([]*model.Bid, error) {
	return s.bidRepo.ListByAuction(auctionID, 50)
}

// checkRateLimit 用户出价频率：60s 内最多 10 次
func (s *BidService) checkRateLimit(ctx context.Context, userID uint) error {
	key := repository.UserBidRateKey(userID)
	count, err := s.rdb.Incr(ctx, key).Result()
	if err != nil {
		return nil // Redis 失败时放行，不阻断业务
	}
	if count == 1 {
		s.rdb.Expire(ctx, key, 60*time.Second)
	}
	if count > 10 {
		return ErrBidRateLimit
	}
	return nil
}

// releaseLock Lua 脚本原子释放锁（只释放自己的锁）
func (s *BidService) releaseLock(ctx context.Context, key, val string) {
	script := `
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
else
    return 0
end`
	s.rdb.Eval(ctx, script, []string{key}, val)
}

func (s *BidService) incrSuccessCount(ctx context.Context, auctionID uint) {
	minute := time.Now().Format("200601021504")
	key := repository.BidCountKey(auctionID, minute)
	s.rdb.Incr(ctx, key)
	s.rdb.Expire(ctx, key, 10*time.Minute)
}

func (s *BidService) incrFailCount(ctx context.Context, auctionID uint) {
	minute := time.Now().Format("200601021504")
	key := repository.BidFailKey(auctionID, minute)
	s.rdb.Incr(ctx, key)
	s.rdb.Expire(ctx, key, 10*time.Minute)
}
