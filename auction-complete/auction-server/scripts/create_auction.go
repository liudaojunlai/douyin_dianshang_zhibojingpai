package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
)

func getEnv(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}

type RegisterReq struct {
	Phone    string `json:"phone"`
	Password string `json:"password"`
	Nickname string `json:"nickname"`
}

type LoginReq struct {
	Phone    string `json:"phone"`
	Password string `json:"password"`
}

type CreateAuctionReq struct {
	Name         string `json:"name"`
	ImageURL     string `json:"image_url"`
	Desc         string `json:"desc"`
	StartPrice   int64  `json:"start_price"`
	Increment    int64  `json:"increment"`
	CapPrice     int64  `json:"cap_price"`
	DurationSec  int    `json:"duration_sec"`
	DelaySeconds int    `json:"delay_seconds"`
}

type APIResp struct {
	Code int `json:"code"`
	Data struct {
		Token   string `json:"token"`
		Auction struct {
			ID uint `json:"id"`
		} `json:"auction"`
	} `json:"data"`
}

func main() {
	phone := "13800000001"
	password := getEnv("TEST_PASSWORD", "123456")
	nickname := "系统管理员"

	registerBody, _ := json.Marshal(RegisterReq{
		Phone:    phone,
		Password: password,
		Nickname: nickname,
	})
	http.Post("http://localhost:8082/api/auth/register", "application/json", bytes.NewBuffer(registerBody))

	loginBody, _ := json.Marshal(LoginReq{
		Phone:    phone,
		Password: password,
	})
	resp, _ := http.Post("http://localhost:8082/api/auth/login", "application/json", bytes.NewBuffer(loginBody))
	body, _ := io.ReadAll(resp.Body)
	resp.Body.Close()

	var loginResp APIResp
	json.Unmarshal(body, &loginResp)
	token := loginResp.Data.Token

	createReq := CreateAuctionReq{
		Name:         "超级测试商品",
		ImageURL:     "https://picsum.photos/800/400",
		Desc:         "千人同时在线实时竞拍测试专用商品",
		StartPrice:   100000,
		Increment:    10000,
		CapPrice:     99999999,
		DurationSec:  3600,
		DelaySeconds: 30,
	}
	createBody, _ := json.Marshal(createReq)

	req, _ := http.NewRequest("POST", "http://localhost:8082/api/auctions", bytes.NewBuffer(createBody))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp2, _ := client.Do(req)
	body2, _ := io.ReadAll(resp2.Body)
	resp2.Body.Close()

	var createResp APIResp
	json.Unmarshal(body2, &createResp)

	fmt.Printf("✅ 创建成功！竞拍ID = %d\n", createResp.Data.Auction.ID)
	fmt.Println("现在你刷新首页，直接点进去就有进行中的竞拍了！")
}
