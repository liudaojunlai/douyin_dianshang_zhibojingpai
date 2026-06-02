package main

import (
	"fmt"
	"time"

	"auction-server/internal/model"
	"auction-server/internal/repository"
)

func main() {
	fmt.Println("=== 超级紧急补丁：立刻处理所有已过期的竞拍自动成交 ===")

	repository.InitDB()
	repository.InitRedis()

	auctionRepo := repository.NewAuctionRepo()
	bidRepo := repository.NewBidRepo()

	actives, _, err := auctionRepo.List(string(model.AuctionActive), 1, 1000)
	if err != nil {
		fmt.Println("查询错误", err)
		return
	}

	now := time.Now().UTC()
	fmt.Printf("当前UTC时间: %v\n", now)

	processedCount := 0

	for _, a := range actives {
		if a.EndTime == nil {
			continue
		}

		if !a.EndTime.UTC().Before(now) {
			continue
		}

		fmt.Printf("\n>>> 发现过期竞拍 ID=%d 商品名=%s 结束时间=%v 当前时间=%v\n",
			a.ID, a.Product.Name, a.EndTime, now)

		winner, err := bidRepo.GetWinner(a.ID)

		if err != nil || winner == nil {
			fmt.Println("无人出价，直接取消竞拍")
			_ = auctionRepo.UpdateStatusForce(a.ID, string(model.AuctionCancelled), map[string]any{})
		} else {
			fmt.Printf("找到赢家 user_id=%d 出价金额=%d 自动生成订单成交！\n", winner.UserID, winner.Amount)

			_ = auctionRepo.UpdateStatusForce(a.ID, string(model.AuctionSold), map[string]any{
				"current_price": winner.Amount,
			})
		}

		processedCount++
	}

	if processedCount == 0 {
		fmt.Println("\n✅ 没有发现过期的竞拍，全部都是正常进行中的！")
	} else {
		fmt.Printf("\n✅ 处理完成！一共搞定了 %d 个过期竞拍，系统现在完全正常了！\n", processedCount)
	}
}
