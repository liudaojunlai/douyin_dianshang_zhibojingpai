package repository

import "fmt"

// Redis Key 统一管理
// 所有 Key 都在这里定义，避免散落各处导致拼写错误

// AuctionInfoKey 竞拍热数据（当前价、状态、结束时间）
// Hash，TTL：竞拍结束后 1 小时
func AuctionInfoKey(auctionID uint) string {
	return fmt.Sprintf("auction:%d:info", auctionID)
}

// AuctionLeaderboardKey 出价排行榜
// Sorted Set，score=出价金额，member=userID
func AuctionLeaderboardKey(auctionID uint) string {
	return fmt.Sprintf("auction:%d:leaderboard", auctionID)
}

// AuctionLockKey 分布式锁
// String，TTL：5 秒自动释放
func AuctionLockKey(auctionID uint) string {
	return fmt.Sprintf("auction:%d:lock", auctionID)
}

// AuctionOnlineKey 房间在线人数
// Hash：field=userID，value=1
func AuctionOnlineKey(auctionID uint) string {
	return fmt.Sprintf("auction:%d:online", auctionID)
}

// BidCountKey 出价次数（监控用，按分钟统计）
// String，INCR，TTL：10 分钟
func BidCountKey(auctionID uint, minute string) string {
	return fmt.Sprintf("bid_count:%d:%s", auctionID, minute)
}

// BidFailKey 出价失败次数（监控用）
func BidFailKey(auctionID uint, minute string) string {
	return fmt.Sprintf("bid_fail:%d:%s", auctionID, minute)
}

// UserBidRateKey 用户出价频率限制（防刷单）
// String，TTL：60 秒滑动窗口
func UserBidRateKey(userID uint) string {
	return fmt.Sprintf("user:%d:bid_rate", userID)
}

// WSDisconnectKey 全站 WS 断连计数（监控用）
func WSDisconnectKey(minute string) string {
	return fmt.Sprintf("ws_disconnect:%s", minute)
}

// GlobalOnlineKey 全站在线人数
func GlobalOnlineKey() string {
	return "global:online_count"
}
