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

const (
	targetAuctionID = 16
	serverHost      = "auction-backend"
	serverPort      = "8082"
	numUsers        = 10000
	batchSize       = 100
	batchDelay      = 500 * time.Millisecond
	tokenConcurrency = 100
)

var (
	serverURL   = fmt.Sprintf("ws://%s:%s/ws/auction/%d", serverHost, serverPort, targetAuctionID)
	loginURL    = fmt.Sprintf("http://%s:%s/api/auth/login", serverHost, serverPort)
	registerURL = fmt.Sprintf("http://%s:%s/api/auth/register", serverHost, serverPort)
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

var httpClient = &http.Client{
	Timeout: 30 * time.Second,
	Transport: &http.Transport{
		MaxIdleConnsPerHost: 200,
		MaxConnsPerHost:     200,
	},
}

func main() {
	fmt.Println("🚀 压力测试 10,000 并发")
	fmt.Println("----------------------------------------")
	fmt.Printf("目标: %s:%s, 竞拍ID: %d, 用户: %d\n", serverHost, serverPort, targetAuctionID, numUsers)
	fmt.Printf("分批: %d/批, 间隔: %v\n\n", batchSize, batchDelay)

	startTime := time.Now()
	var mu sync.Mutex
	var tokens []string
	sem := make(chan struct{}, tokenConcurrency)
	var wg sync.WaitGroup

	// 阶段1: 获取 tokens
	fmt.Println("📝 阶段1: 获取 tokens...")
	for i := 1; i <= numUsers; i++ {
		wg.Add(1)
		sem <- struct{}{}
		go func(idx int) {
			defer wg.Done()
			defer func() { <-sem }()
			phone := fmt.Sprintf("299%08d", idx)
			nick := fmt.Sprintf("万人在线%04d", idx)
			token, err := getToken(phone, "123456", nick)
			if err == nil {
				mu.Lock()
				tokens = append(tokens, token)
				mu.Unlock()
			}
			if idx%1000 == 0 {
				log.Printf("tokens: %d/%d", len(tokens), idx)
			}
		}(i)
	}
	wg.Wait()
	tokenTime := time.Since(startTime)
	fmt.Printf("✅ tokens: %d/%d (耗时: %v)\n\n", len(tokens), numUsers, tokenTime)

	if len(tokens) == 0 {
		log.Fatal("❌ 没有 token，无法继续")
	}

	// 阶段2: 分批建立 WebSocket 连接
	fmt.Println("🔗 阶段2: 分批建立 WebSocket 连接...")
	wsStart := time.Now()
	var conns []*websocket.Conn
	success, failed := 0, 0

	for i := 0; i < len(tokens); i += batchSize {
		end := i + batchSize
		if end > len(tokens) {
			end = len(tokens)
		}
		now := time.Now()
		var bw sync.WaitGroup
		for j := i; j < end; j++ {
			bw.Add(1)
			go func(idx int, t string) {
				defer bw.Done()
				u, _ := url.Parse(serverURL)
				q := u.Query()
				q.Set("token", t)
				u.RawQuery = q.Encode()
				conn, _, err := websocket.DefaultDialer.Dial(u.String(), nil)
				if err != nil {
					mu.Lock()
					failed++
					mu.Unlock()
					return
				}
				mu.Lock()
				conns = append(conns, conn)
				success++
				mu.Unlock()
				go func(uid int, c *websocket.Conn) {
					defer c.Close()
					for {
						_, msg, err := c.ReadMessage()
						if err != nil {
							return
						}
						var m struct{ Event string `json:"event"` }
						if json.Unmarshal(msg, &m) == nil && m.Event == "ping" {
							p, _ := json.Marshal(map[string]any{"event": "pong", "data": time.Now().UnixMilli()})
							c.WriteMessage(websocket.TextMessage, p)
						}
					}
				}(idx+1, conn)
			}(j, tokens[j])
		}
		bw.Wait()
		batchDuration := time.Since(now)
		fmt.Printf("  批次 %d-%d: 成功=%d 失败=%d 累计=%.1f%% (耗时: %v)\n",
			i+1, end, success, failed, float64(success)/float64(numUsers)*100, batchDuration.Truncate(time.Millisecond))
		time.Sleep(batchDelay)
	}

	wsTime := time.Since(wsStart)
	fmt.Printf("\n📊 连接结果: 成功=%d/%d (%.1f%%) 失败=%d (耗时: %v)\n",
		success, len(tokens), float64(success)/float64(len(tokens))*100, failed, wsTime.Truncate(time.Second))

	// 阶段3: 出价（取前 500 个连接的用户出价）
	if success > 0 {
		fmt.Println("\n💰 阶段3: 出价竞拍...")
		bidCount := min(500, success)
		var bwg sync.WaitGroup
		for idx := 0; idx < bidCount; idx++ {
			bwg.Add(1)
			go func(i int, t string) {
				defer bwg.Done()
				time.Sleep(time.Duration(i%200) * 20 * time.Millisecond)
				body, _ := json.Marshal(PlaceBidRequest{Amount: 300000 + int64(i+1)*100})
				req, _ := http.NewRequest("POST",
					fmt.Sprintf("http://%s:%s/api/auctions/%d/bids", serverHost, serverPort, targetAuctionID),
					bytes.NewBuffer(body))
				req.Header.Set("Authorization", "Bearer "+t)
				req.Header.Set("Content-Type", "application/json")
				resp, err := httpClient.Do(req)
				if err == nil {
					resp.Body.Close()
				}
			}(idx, tokens[idx])
		}
		bwg.Wait()
		fmt.Println("✅ 出价完成")
	}

	totalTime := time.Since(startTime)
	fmt.Printf("\n========================================\n")
	fmt.Printf("✅ 全部完成！总耗时: %v\n", totalTime.Truncate(time.Second))
	fmt.Printf("📡 当前 %d 个连接保持在线中\n", success)
	fmt.Println("按 Ctrl+C 关闭所有连接退出")
	fmt.Println("========================================")

	interrupt := make(chan os.Signal, 1)
	signal.Notify(interrupt, os.Interrupt, syscall.SIGTERM)
	<-interrupt

	fmt.Println("\n🔌 正在关闭所有连接...")
	closeStart := time.Now()
	var closeWg sync.WaitGroup
	for _, c := range conns {
		closeWg.Add(1)
		go func(conn *websocket.Conn) {
			defer closeWg.Done()
			conn.Close()
		}(c)
	}
	closeWg.Wait()
	fmt.Printf("✅ %d 个连接已关闭 (耗时: %v)\n", len(conns), time.Since(closeStart).Truncate(time.Second))
}

func getToken(phone, pwd, nick string) (string, error) {
	t, e := register(phone, pwd, nick)
	if e == nil {
		return t, nil
	}
	return login(phone, pwd)
}

func register(phone, pwd, nick string) (string, error) {
	b, _ := json.Marshal(RegisterRequest{Phone: phone, Password: pwd, Nickname: nick})
	r, e := httpClient.Post(registerURL, "application/json", bytes.NewBuffer(b))
	if e != nil {
		return "", e
	}
	defer r.Body.Close()
	body, _ := io.ReadAll(r.Body)
	var res APIResponse
	json.Unmarshal(body, &res)
	if res.Code != 0 {
		return "", fmt.Errorf("register fail code=%d", res.Code)
	}
	return res.Data.Token, nil
}

func login(phone, pwd string) (string, error) {
	b, _ := json.Marshal(LoginRequest{Phone: phone, Password: pwd})
	r, e := httpClient.Post(loginURL, "application/json", bytes.NewBuffer(b))
	if e != nil {
		return "", e
	}
	defer r.Body.Close()
	body, _ := io.ReadAll(r.Body)
	var res APIResponse
	json.Unmarshal(body, &res)
	if res.Code != 0 {
		return "", fmt.Errorf("login fail code=%d", res.Code)
	}
	return res.Data.Token, nil
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
