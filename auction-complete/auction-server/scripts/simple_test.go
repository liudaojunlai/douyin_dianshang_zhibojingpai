
package main

import (
	"fmt"
	"log"
	"net/url"
	"time"

	"github.com/gorilla/websocket"
)

func main() {
	fmt.Println("🔍 简单的WebSocket测试")
	log.Println("日志输出开始...")

	// 1. 获取一个token（我们先手动写一个，或者用之前测试成功的用户ID 1）
	// 先试试不带token连接，看看后端会不会有日志
	wsURL := "ws://localhost:8080/ws/auction/10?token=invalid"

	log.Printf("🔗 尝试连接: %s", wsURL)

	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		log.Printf("❌ 连接失败: %v", err)
	} else {
		log.Printf("✅ 连接成功！")
		conn.Close()
	}

	fmt.Println("等待3秒钟，让后端处理一下...")
	time.Sleep(3 * time.Second)
	fmt.Println("测试结束！")
}
