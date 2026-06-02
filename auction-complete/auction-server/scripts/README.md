# 压力测试脚本 - 模拟100个用户同时在线

## 📋 完整使用步骤

### 1. 确保服务已启动

确保以下服务已正常运行：
- MySQL（Docker或本地）
- Redis（Docker或本地）
- 后端服务（端口 8080）
- 前端服务（端口 3000）

### 2. 创建测试竞拍（一键脚本）

```bash
cd auction-server
go run scripts/create_test_auction.go
```

这个脚本会：
- 自动注册一个商家账号
- 创建一个测试竞拍（ID为1）

### 3. 运行压力测试

```bash
go run scripts/stress_test.go
```

### 4. 观察效果

- 打开前端 http://localhost:3000/
- 进入竞拍直播页面
- 可以看到在线人数实时更新（应该显示101人：100个测试用户+1个你）
- 在后端日志可以看到连接信息
- 按 Ctrl+C 停止测试

## 🎯 脚本功能

### create_test_auction.go
✅ 自动注册商家账号
✅ 自动创建测试竞拍

### stress_test.go
✅ 自动注册100个测试用户
✅ 自动登录获取JWT token
✅ 并发建立100个WebSocket连接
✅ 自动响应ping消息维持连接
✅ 实时显示连接状态
✅ 优雅关闭连接

## ⚙️ 修改参数

如果需要修改参数，编辑对应脚本：

### stress_test.go
```go
const (
	serverURL   = "ws://localhost:8080/ws/auction/1" // 修改竞拍ID
	numUsers    = 100                               // 修改用户数量
	// ...
)
```

### create_test_auction.go
```go
auction := AuctionRequest{
	ProductName: "测试商品 - 限量版手机",
	StartPrice: 10000, // 100元（单位分）
	DurationMinutes: 30,
	// ...
}
```

## ⚠️ 注意事项

⚠️ 确保竞拍ID存在
⚠️ 确保后端服务正常运行
⚠️ 注意观察服务器资源使用情况
⚠️ 测试完成后可以清空测试用户数据

## 🔍 观察指标

在测试过程中，可以观察：
- 前端：在线人数实时更新
- 后端：WebSocket连接日志
- 系统：CPU、内存、网络使用情况
