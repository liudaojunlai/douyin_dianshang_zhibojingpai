package main

import (
	"log"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"time"

	"github.com/gorilla/websocket"
)

func getEnv(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}

func main() {
	log.Println("开始测试WebSocket连接...")

	// 先登录获取token
	loginUrl := "http://localhost:8080/api/auth/login"
	loginData := url.Values{
		"phone":    {"13800000001"},
		"password": {getEnv("TEST_PASSWORD", "123456")},
	}
	
	resp, err := http.PostForm(loginUrl, loginData)
	if err != nil {
		log.Fatal("登录失败:", err)
	}
	defer resp.Body.Close()

	log.Println("登录请求已发送，状态码:", resp.Status)

	// 先不管token，直接尝试连接WebSocket
	wsUrl := "ws://localhost:8080/ws/auction/11?token=test"
	log.Println("正在连接到:", wsUrl)

	conn, _, err := websocket.DefaultDialer.Dial(wsUrl, nil)
	if err != nil {
		log.Fatal("WebSocket连接失败:", err)
	}
	defer conn.Close()

	log.Println("WebSocket连接成功！")

	interrupt := make(chan os.Signal, 1)
	signal.Notify(interrupt, os.Interrupt)

	done := make(chan struct{})

	go func() {
		defer close(done)
		for {
			_, message, err := conn.ReadMessage()
			if err != nil {
				log.Println("读取失败:", err)
				return
			}
			log.Printf("收到消息: %s", message)
		}
	}()

	select {
	case <-done:
	case <-interrupt:
		log.Println("收到中断信号，正在关闭连接...")
		err := conn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
		if err != nil {
			log.Println("关闭失败:", err)
			return
		}
		select {
		case <-done:
		case <-time.After(time.Second):
		}
	}
}
