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
	targetAuctionID = 16
	serverHost      = "auction-backend"
	serverPort      = "8082"
	numUsers        = 500
	batchSize       = 50
	batchDelay      = 300 * time.Millisecond
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
	fmt.Printf("🚀 压力测试（容器内网直连，分批限流）\n")
	fmt.Printf("目标: %s, 竞拍ID: %d, 用户: %d\n", serverHost, targetAuctionID, numUsers)
	fmt.Printf("分批: %d/批, 间隔: %v\n\n", batchSize, batchDelay)

	var mu sync.Mutex
	var tokens []string
	sem := make(chan struct{}, 50)
	var wg sync.WaitGroup

	fmt.Println("📝 获取 tokens...")
	for i := 1; i <= numUsers; i++ {
		wg.Add(1)
		sem <- struct{}{}
		go func(idx int) {
			defer wg.Done()
			defer func() { <-sem }()
			phone := fmt.Sprintf("199%08d", idx)
			nick := fmt.Sprintf("内网压测%04d", idx)
			token, err := getToken(phone, "123456", nick)
			if err == nil {
				mu.Lock()
				tokens = append(tokens, token)
				mu.Unlock()
			}
			if idx%100 == 0 {
				log.Printf("tokens: %d/%d", len(tokens), idx)
			}
		}(i)
	}
	wg.Wait()
	fmt.Printf("✅ tokens: %d\n\n", len(tokens))

	fmt.Println("🔗 连接 WebSocket（分批）...")
	var conns []*websocket.Conn
	success, failed := 0, 0

	for i := 0; i < len(tokens); i += batchSize {
		end := i + batchSize
		if end > len(tokens) {
			end = len(tokens)
		}
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
		log.Printf("批次 %d-%d: 成功=%d 失败=%d 累计成功=%d", i+1, end, success, failed, success)
		time.Sleep(batchDelay)
	}

	fmt.Printf("\n📊 结果: 成功=%d 失败=%d\n\n", success, failed)

	if success > 0 {
		fmt.Println("💰 出价中...")
		var bwg sync.WaitGroup
		for idx := 0; idx < min(success, len(tokens)); idx++ {
			bwg.Add(1)
			go func(i int, t string) {
				defer bwg.Done()
				time.Sleep(time.Duration(i%200) * 50 * time.Millisecond)
				body, _ := json.Marshal(PlaceBidRequest{Amount: 200000 + int64(i+1)*1000})
				req, _ := http.NewRequest("POST",
					fmt.Sprintf("http://%s:%s/api/auctions/%d/bids", serverHost, serverPort, targetAuctionID),
					bytes.NewBuffer(body))
				req.Header.Set("Authorization", "Bearer "+t)
				req.Header.Set("Content-Type", "application/json")
				httpClient.Do(req)
			}(idx, tokens[idx])
		}
		bwg.Wait()
		fmt.Println("✅ 出价完成")
	}

	fmt.Println("\n📡 保持在线，按 Ctrl+C 停止")
	sig := make(chan os.Signal, 1)
	signal.Notify(sig, os.Interrupt, syscall.SIGTERM)
	<-sig
	for _, c := range conns {
		c.Close()
	}
	fmt.Println("✅ 完成")
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
		return "", fmt.Errorf("reg fail")
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
		return "", fmt.Errorf("login fail")
	}
	return res.Data.Token, nil
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
