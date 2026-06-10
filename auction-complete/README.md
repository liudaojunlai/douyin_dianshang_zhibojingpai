# 🎯 抖音电商直播竞拍系统

> 高并发实时竞拍平台 — 为抖音电商直播场景设计，支撑直播间内数百人同时竞价。

**在线 Demo**：http://39.106.177.43

| 角色 | 手机号 | 密码 |
|------|--------|------|
| 卖家（主播） | 13800138001 | 123456 |
| 买家（竞拍者） | 13800138002 | 123456 |

---

## 📦 技术栈

| 层级 | 技术选型 |
|------|---------|
| **前端** | React 18, TypeScript, Vite, Zustand, TanStack Query, WebSocket |
| **后端** | Go 1.22, Gin, GORM, MySQL 8.0, Redis 7, Gorilla WebSocket, JWT |
| **部署** | Docker Compose, Nginx（反向代理 + 安全加固） |

---

## ✨ 核心功能

- **实时竞拍引擎** — 高并发出价，Redis 分布式锁 + MySQL 乐观锁双重保障数据一致性
- **WebSocket 实时通信** — 竞拍状态毫秒级推送，心跳保活，定向广播，背压保护
- **自动成交调度** — 三重守护线程（1s 主扫描 + 3s 兜底 + 定时同步），自动生成订单
- **双端界面** — 移动端 H5（直播间/竞拍列表/订单）+ 管理后台（竞拍管理/监控仪表板）
- **排行榜** — 实时出价排行榜，昵称缓存，Redis ZSet 存储
- **评论互动** — WebSocket 实时评论，频率限制，历史记录缓存

---

## 🚀 快速启动

### 方式一：Docker Compose（推荐）

```bash
# 1. 进入项目目录
cd auction-complete

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，填入 DB_PASSWORD、JWT_SECRET 等

# 3. 一键构建并启动
docker compose up -d --build

# 4. 访问
# 前端: http://localhost
# 后端: http://localhost:8082
# 健康检查: http://localhost:8082/health
```

### 方式二：本地开发

**前置依赖**：Go 1.22+、Node 20+、MySQL 8.0、Redis 7

```bash
# 后端
cd auction-server
cp .env.example .env
go run ./cmd/server

# 前端（新开终端）
cd auction-frontend
npm install
npm run dev
```

---

## 📁 项目结构

```
auction-complete/
├── docker-compose.yml            # 主编排文件（4 个服务）
├── .env.example                  # 环境变量模板
│
├── auction-server/               # Go 后端
│   ├── cmd/server/main.go        # 入口
│   ├── internal/
│   │   ├── config/               # 配置加载
│   │   ├── handler/              # HTTP 处理器
│   │   ├── service/              # 业务逻辑层
│   │   ├── repository/           # 数据访问层（DB + Redis）
│   │   ├── middleware/           # JWT 鉴权、日志、Recovery
│   │   ├── model/                # 数据模型
│   │   ├── websocket/            # WebSocket Hub-Client 模型
│   │   └── scheduler/            # 定时调度（三重守护线程）
│   └── scripts/                  # 压测 & 工具脚本
│
└── auction-frontend/             # React 前端
    ├── src/
    │   ├── apps/                 # 移动端 H5 + 管理后台
    │   ├── components/           # 竞拍组件（竞价面板、排行榜、倒计时等）
    │   ├── hooks/                # WebSocket 状态管理 Hook
    │   ├── services/             # Axios API 客户端
    │   └── stores/               # Zustand 状态管理
    └── nginx.conf                # nginx 反向代理配置
```

---

## 🏗 系统架构

```
┌──────────────┐     HTTP/WS     ┌──────────┐     ┌──────────────┐
│  React SPA   │ ──────────────▶ │  Nginx   │ ──▶ │  Go Backend  │
│  (Mobile +   │ ◀────────────── │  (Proxy) │ ◀── │  (Gin + WS)  │
│   Admin)     │                 └──────────┘     └──────┬───────┘
└──────────────┘                      80/443            │
                                                        │
                                          ┌─────────────┼─────────────┐
                                          ▼             ▼             ▼
                                   ┌──────────┐  ┌──────────┐  ┌──────────┐
                                   │ MySQL 8  │  │ Redis 7  │  │ 缓存     │
                                   │ 持久化   │  │ 分布式锁 │  │ 排行榜   │
                                   │ 事务     │  │ 在线人数 │  │ 昵称缓存 │
                                   └──────────┘  └──────────┘  └──────────┘
```

---

## 🔧 核心设计决策

| 决策 | 原因 |
|------|------|
| 金额用 `int64` 存「分」 | 避免浮点精度问题 |
| 出价记录只增不改 | 保证竞拍数据不可篡改 |
| 双锁保障（Redis 锁 + MySQL 乐观锁） | 高并发出价的数据一致性 |
| 出价价格 + 出价记录在同一事务 | 防止价格更新成功但记录丢失 |
| WebSocket 定向广播 | 排除出价者自身，减少 1/N 消息量 |
| 内存竞拍列表 + 心跳广播 | 避免高频 DB 轮询，降低数据库压力 |
| JWT 支持 Query Param | WebSocket 握手无法设置 Header |

---

## 💪 压力测试

内置 `scripts/` 目录提供压力测试脚本，可模拟千人在线并发竞拍：

```bash
cd auction-server
# 修改 scripts/stress.go 中的 targetAuctionID 为目标竞拍 ID
go run scripts/stress.go
```

---

## 🔒 安全措施

- nginx 安全头（X-Frame-Options、X-Content-Type-Options、Referrer-Policy）
- API 速率限制（30r/s + burst 50）
- WebSocket Origin 白名单校验
- CORS 生产环境限制域名
- 容器非 root 运行
- `.env` 排除在版本控制外

---

## 📄 License

MIT
