# 实时竞拍大师 — 后端服务

抖音电商直播竞拍全栈系统后端，基于 Go + Gin + GORM + Redis 构建。

## 技术栈

- **语言**：Go 1.22
- **Web 框架**：Gin
- **ORM**：GORM + MySQL 8.0
- **缓存**：Redis 7（分布式锁、排行榜、在线人数）
- **实时通信**：WebSocket（后续模块实现）
- **认证**：JWT

## 快速启动

### 方式一：Docker Compose（推荐）

```bash
cp .env.example .env
# 编辑 .env，填写密码等配置
docker-compose up -d
```

### 方式二：本地开发

**前置依赖**：Go 1.22+、MySQL 8.0、Redis 7

```bash
# 1. 安装依赖
go mod tidy

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env

# 3. 启动（自动建表）
go run ./cmd/server
```

## 项目结构

```
auction-server/
├── cmd/server/         # 程序入口
├── internal/
│   ├── config/         # 配置加载
│   ├── middleware/     # JWT、日志、Recovery
│   ├── model/          # GORM 数据模型
│   ├── repository/     # DB & Redis 连接、Key 管理
│   ├── service/        # 业务逻辑（后续模块）
│   ├── handler/        # HTTP Handler（后续模块）
│   ├── websocket/      # WS 服务（后续模块）
│   └── scheduler/      # 定时任务（后续模块）
├── pkg/
│   ├── logger/         # Zap 日志封装
│   ├── response/       # 统一响应格式
│   └── utils/          # 工具函数
├── AI_LOG.md           # AI 使用追溯记录
├── docker-compose.yml
├── Dockerfile
└── .env.example
```

## 核心设计决策

| 决策 | 原因 |
|------|------|
| 金额用 `int64` 存「分」 | 避免浮点精度问题 |
| 出价记录只增不改 | 保证竞拍数据不可篡改 |
| Auction 含 `Version` 乐观锁字段 | 高并发出价的数据一致性保障 |
| JWT 支持 Query Param | WebSocket 握手无法设置 Header |
| Redis Key 集中管理 | 避免拼写错误，便于维护 |
