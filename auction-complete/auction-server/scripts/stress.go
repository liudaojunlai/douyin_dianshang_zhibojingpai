package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/gorilla/websocket"
)

func getEnv(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}

type Message struct {
	Event string      `json:"event"`
	Data  interface{} `json:"data"`
}

const (
	targetAuctionID = 3
	serverURL       = "ws://localhost:8082/ws/auction/3"
	numUsers        = 1000
	loginURL        = "http://localhost:8082/api/auth/login"
	registerURL     = "http://localhost:8082/api/auth/register"
)

type RegisterRequest struct {
	Phone    string `json:"phone"`
	Password string `json:"password"`
	Nickname string `json:"nickname"`
}

type LoginRequest struct {
	Phone    string `json:"phone"`
	Password string `json:"password"`
}

type PlaceBidRequest struct {
	Amount int64 `json:"amount"`
}

type APIResponse struct {
	Code int    `json:"code"`
	Data struct {
		Token string `json:"token"`
	} `json:"data"`
	Error string `json:"error,omitempty"`
}

func main() {
	fmt.Println("🚀 开始压力测试 - 模拟1000个用户同时在线竞拍")
	fmt.Println("----------------------------------------")
	fmt.Printf("目标竞拍ID: %d\n", targetAuctionID)
	fmt.Printf("并发用户数: %d\n", numUsers)
	fmt.Println("----------------------------------------")

	var tokens []string
	for i := 1; i <= numUsers; i++ {
		phone := fmt.Sprintf("167%08d", i)
		password := getEnv("TEST_PASSWORD", "123456")
		nickname := fmt.Sprintf("压测用户%04d", i)

		token, err := getToken(phone, password, nickname)
		if err != nil {
			log.Printf("❌ 用户%d获取token失败: %v", i, err)
			continue
		}
		tokens = append(tokens, token)
		if i%50 == 0 {
			log.Printf("✅ 已获取 %d/%d 个token", len(tokens), numUsers)
		}
	}

	if len(tokens) == 0 {
		log.Fatal("❌ 没有可用的token")
	}

	fmt.Printf("\n✅ 成功获取 %d 个token\n", len(tokens))

	var wg sync.WaitGroup
	var connections []*websocket.Conn
	var mu sync.Mutex
	successCount := 0
	failCount := 0

	fmt.Println("\n🔗 开始建立1000个WebSocket连接...")

	for i, token := range tokens {
		wg.Add(1)
		go func(index int, t string) {
			defer wg.Done()

			u, _ := url.Parse(serverURL)
			q := u.Query()
			q.Set("token", t)
			u.RawQuery = q.Encode()

			wsURL := u.String()
			conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
			if err != nil {
				log.Printf("❌ 用户%d连接失败: %v", index+1, err)
				mu.Lock()
				failCount++
				mu.Unlock()
				return
			}

			mu.Lock()
			connections = append(connections, conn)
			successCount++
			mu.Unlock()

			if (index+1)%100 == 0 {
				log.Printf("✅ 已建立连接: %d/%d", successCount, len(tokens))
			}

			go listenMessages(index+1, conn)

		}(i, token)
	}

	wg.Wait()

	fmt.Println("\n----------------------------------------")
	fmt.Printf("✅ 连接成功: %d\n", successCount)
	fmt.Printf("❌ 连接失败: %d\n", failCount)
	fmt.Println("----------------------------------------")

	if successCount > 0 {
		fmt.Println("\n💰 所有用户开始自动出价竞拍！")
		var bidWg sync.WaitGroup
		for idx, conn := range connections {
			bidWg.Add(1)
			go func(index int, c *websocket.Conn, t string) {
				defer bidWg.Done()
				time.Sleep(time.Duration(index*10) * time.Millisecond)
				amount := int64(250000 + (int64(index+1) * 1000))
				placeBid(t, targetAuctionID, amount)
				if (index+1)%200 == 0 {
					log.Printf("💰 已出价 %d 次", index+1)
				}
			}(idx, conn, tokens[idx])
		}
		bidWg.Wait()
		fmt.Println("\n✅ 所有出价完成！")
	}

	fmt.Println("\n📡 1000 个用户全部保持在线连接中！")
	fmt.Println("观察后端日志、排行榜、实时同步性能...")
	fmt.Println("按 Ctrl+C 停止测试")

	interrupt := make(chan os.Signal, 1)
	signal.Notify(interrupt, os.Interrupt, syscall.SIGTERM)
	<-interrupt

	fmt.Println("\n🔌 正在关闭所有连接...")
	for _, conn := range connections {
		conn.Close()
	}
	fmt.Println("✅ 所有连接已关闭，压力测试完成！")
}

func getToken(phone, password, nickname string) (string, error) {
	token, err := registerUser(phone, password, nickname)
	if err == nil {
		return token, nil
	}
	return loginUser(phone, password)
}

func registerUser(phone, password, nickname string) (string, error) {
	reqBody := RegisterRequest{
		Phone:    phone,
		Password: password,
		Nickname: nickname,
	}
	jsonData, _ := json.Marshal(reqBody)

	resp, err := http.Post(registerURL, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	var result APIResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return "", err
	}

	if result.Code != 0 {
		return "", fmt.Errorf("注册失败")
	}

	return result.Data.Token, nil
}

func loginUser(phone, password string) (string, error) {
	reqBody := LoginRequest{
		Phone:    phone,
		Password: password,
	}
	jsonData, _ := json.Marshal(reqBody)

	resp, err := http.Post(loginURL, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	var result APIResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return "", err
	}

	if result.Code != 0 {
		return "", fmt.Errorf("登录失败")
	}

	return result.Data.Token, nil
}

func placeBid(token string, auctionID uint, amount int64) error {
	client := &http.Client{}
	url := fmt.Sprintf("http://localhost:8082/api/auctions/%d/bids", auctionID)

	reqBody := PlaceBidRequest{
		Amount: amount,
	}
	jsonData, _ := json.Marshal(reqBody)

	req, _ := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	return nil
}

func listenMessages(userID int, conn *websocket.Conn) {
	defer conn.Close()

	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			return
		}

		var msg Message
		if err := json.Unmarshal(message, &msg); err == nil {
			switch msg.Event {
			case "ping":
				pongMsg := Message{
					Event: "pong",
					Data:  time.Now().UnixMilli(),
				}
				pongBytes, _ := json.Marshal(pongMsg)
				conn.WriteMessage(websocket.TextMessage, pongBytes)
			}
		}
	}
}
