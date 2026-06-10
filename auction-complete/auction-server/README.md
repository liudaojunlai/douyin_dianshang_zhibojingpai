# 🎯 实时竞拍大师 — 后端服务

抖音电商直播竞拍全栈系统后端，基于 Go + Gin + GORM + Redis 构建。

## 技术栈

- **语言**：Go 1.22
- **Web 框架**：Gin + CORS
- **ORM**：GORM + MySQL 8.0（自动迁移建表）
- **缓存**：Redis 7（分布式锁、排行榜、在线人数、昵称缓存）
- **实时通信**：Gorilla WebSocket（Hub-Client 模型，心跳保活）
- **认证**：JWT（支持 Header 和 Query Param）
- **日志**：Uber Zap（结构化日志）

## 快速启动

### 方式一：Docker Compose（推荐）

```bash
cp .env.example .env
# 编辑 .env，填写密码等配置
docker compose up -d --build
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
├── cmd/server/              # 程序入口（路由注册、优雅关闭）
├── internal/
│   ├── config/              # 配置加载（环境变量 + .env）
│   ├── middleware/          # JWT 鉴权、请求日志、Recovery
│   ├── model/               # GORM 数据模型（User/Product/Auction/Bid/Order）
│   ├── repository/          # 数据访问层（DB 事务、Redis 操作）
│   ├── service/             # 业务逻辑层（竞拍引擎、出价、订单）
│   ├── handler/             # HTTP Handler（RESTful API）
│   ├── websocket/           # WebSocket Hub（广播、房间管理、评论）
│   └── scheduler/           # 定时调度（三重守护线程自动成交）
├── pkg/
│   ├── logger/              # Zap 日志封装
│   ├── response/            # 统一 JSON 响应格式
│   └── utils/               # 工具函数
├── scripts/                 # 压测脚本（1000 人并发）
├── AI_LOG.md                # AI 辅助开发追溯
├── Dockerfile               # 多阶段构建（golang → alpine）
└── .env.example             # 环境变量模板
```

## API 概览

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | `/api/auth/register` | 注册 | 无 |
| POST | `/api/auth/login` | 登录 | 无 |
| GET | `/api/auctions` | 竞拍列表 | 无 |
| GET | `/api/auctions/:id` | 竞拍详情 | 无 |
| POST | `/api/auctions` | 创建竞拍 | Seller |
| PATCH | `/api/auctions/:id` | 修改规则 | Seller |
| POST | `/api/auctions/:id/cancel` | 取消竞拍 | Seller |
| POST | `/api/auctions/:id/bids` | 出价 | 登录 |
| GET | `/api/auctions/:id/leaderboard` | 排行榜 | 无 |
| GET | `/api/orders` | 订单列表 | 登录 |
| POST | `/api/orders/:id/pay` | 支付 | 登录 |
| GET | `/ws/auction/:id` | WebSocket 实时连接 | JWT |
| GET | `/health` | 健康检查 | 无 |

## 核心设计决策

| 决策 | 原因 |
|------|------|
| 金额用 `int64` 存「分」 | 避免浮点精度问题 |
| 出价记录只增不改（无 UpdatedAt） | 保证竞拍数据不可篡改 |
| 双锁保障（Redis 锁 + MySQL 乐观锁） | 高并发出价的数据一致性 |
| 价格更新 + 出价记录在同一事务 | 防止数据不一致 |
| 出价金额增量校验 | `(amount - start_price) % increment == 0`，兼容非整数倍起拍价 |
| JWT 支持 Query Param | WebSocket 握手无法设置 Header |
| 内存竞拍列表 + 心跳广播 | 避免高频 DB 轮询 |
| 分布式锁 Lua 脚本原子释放 | 防止误删他人锁 |
| 三重守护线程 | 1s 主扫描 + 3s 兜底 + 定时器同步，保证自动成交可靠性 |
