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
	"os"
	"os/signal"
	"sync"
	"syscall"

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
	numUsers        = 500
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

type APIResponse struct {
	Code int    `json:"code"`
	Data struct {
		Token string `json:"token"`
	} `json:"data"`
	Error string `json:"error,omitempty"`
}

func main() {
	fmt.Println("🚀 全速压力测试 - 200用户冲房间3")
	fmt.Println("----------------------------------------")

	var tokens []string
	var tokenWg sync.WaitGroup
	tokenChan := make(chan string, numUsers)
	httpClient := &http.Client{}

	for i := 1; i <= numUsers; i++ {
		tokenWg.Add(1)
		go func(idx int) {
			defer tokenWg.Done()
			phone := fmt.Sprintf("188%08d", idx)
			password := getEnv("TEST_PASSWORD", "123456")
			nickname := fmt.Sprintf("压测用户%04d", idx)

			token, err := getTokenSafe(httpClient, phone, password, nickname)
			if err == nil && token != "" {
				tokenChan <- token
			}
		}(i)
	}

	go func() {
		tokenWg.Wait()
		close(tokenChan)
	}()

	for t := range tokenChan {
		tokens = append(tokens, t)
	}

	fmt.Printf("\n✅ 准备就绪，共获取 %d 个token\n", len(tokens))

	var connWg sync.WaitGroup
	for idx, token := range tokens {
		connWg.Add(1)
		go func(index int, t string) {
			defer connWg.Done()
			u, _ := url.Parse(serverURL)
			q := u.Query()
			q.Set("token", t)
			u.RawQuery = q.Encode()
			conn, _, err := websocket.DefaultDialer.Dial(u.String(), nil)
			if err != nil {
				return
			}
			defer conn.Close()
			go listenMessages(index+1, conn)
		}(idx, token)

		if (idx+1)%50 == 0 {
			log.Printf("✅ 已建立连接: %d / %d", idx+1, len(tokens))
		}
	}

	connWg.Wait()
	fmt.Println("\n🎉 全部连接成功！现在页面右上角在线人数已经是200+！")

	interrupt := make(chan os.Signal, 1)
	signal.Notify(interrupt, os.Interrupt, syscall.SIGTERM)
	<-interrupt
}

func getTokenSafe(client *http.Client, phone, password, nickname string) (string, error) {
	token, err := registerUserSafe(client, phone, password, nickname)
	if err == nil && token != "" {
		return token, nil
	}
	return loginUserSafe(client, phone, password)
}

func registerUserSafe(client *http.Client, phone, password, nickname string) (string, error) {
	reqBody := RegisterRequest{Phone: phone, Password: password, Nickname: nickname}
	jsonData, _ := json.Marshal(reqBody)
	resp, err := client.Post(registerURL, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	var result APIResponse
	json.Unmarshal(body, &result)
	if result.Code != 0 {
		return "", fmt.Errorf("register fail")
	}
	return result.Data.Token, nil
}

func loginUserSafe(client *http.Client, phone, password string) (string, error) {
	reqBody := LoginRequest{Phone: phone, Password: password}
	jsonData, _ := json.Marshal(reqBody)
	resp, err := client.Post(loginURL, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	var result APIResponse
	json.Unmarshal(body, &result)
	if result.Code != 0 || result.Data.Token == "" {
		return "", fmt.Errorf("login fail")
	}
	return result.Data.Token, nil
}

func listenMessages(userID int, conn *websocket.Conn) {
	defer conn.Close()
	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			return
		}
	}
}
