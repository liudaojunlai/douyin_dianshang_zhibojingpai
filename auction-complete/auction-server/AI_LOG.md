# AI 使用追溯日志

> 记录规范：每次使用 AI 完成关键代码后填写，随代码库提交。

---

## Module 1 — 项目初始化

**日期**：开发阶段一
**AI 工具**：Claude

### 任务：项目目录结构设计

- **AI 贡献**：生成了目录结构骨架（cmd/server, internal/{config,middleware,model,...}）
- **人工决策**：
  - 选择 Go 标准的 `internal/` 私有包约定，防止外部引用
  - 将 `response`、`logger` 放入 `pkg/` 而非 `internal/`，因为未来可能提取为公共库
- **代码文件**：整体目录结构

### 任务：数据库 Model 设计

- **AI 贡献**：生成了各表的基础字段和 GORM tag
- **人工修改点**：
  - `Auction.Version` 字段（乐观锁）是人工加入的，AI 初版没有包含
  - `Bid` 表设计为只增不改（无 UpdatedAt/DeletedAt），是人工决策——出价记录必须不可篡改
  - `Auction.ExtendCount` 字段是人工加入的，用于监控延时触发次数
  - 金额字段统一用 `int64` 存「分」而非 `float64` 存「元」，防止浮点精度问题（人工决策）
- **关键决策**：`Balance` 和所有价格字段使用整数分为单位，杜绝 0.1+0.2≠0.3 的问题
- **代码文件**：`internal/model/model.go`

### 任务：Redis Key 管理

- **AI 贡献**：生成了 Key 函数骨架
- **人工修改点**：
  - 集中管理所有 Key 到 `keys.go`，避免散落各处（AI 初版是在各 service 里直接拼字符串）
  - `AuctionLockKey` TTL 设为 5 秒（AI 建议 3 秒），因为 MySQL 写入在压测时偶尔超 3 秒
- **代码文件**：`internal/repository/keys.go`

### 任务：JWT 中间件

- **AI 贡献**：生成了基础 JWT 解析逻辑
- **人工修改点**：
  - 加入了 `query param` fallback（`?token=xxx`），用于 WebSocket 握手时无法设置 Header 的场景
  - `SellerOnly` 中间件是人工补充的，AI 初版只有 `Auth`
- **代码文件**：`internal/middleware/auth.go`

### 任务：主入口 main.go

- **AI 贡献**：生成了服务启动骨架
- **人工决策**：
  - 加入优雅关闭逻辑（`signal.Notify` + `srv.Shutdown`），确保 WebSocket 连接能正常断开
  - 路由注册用 TODO 注释占位，便于后续模块开发时定位插入点
- **代码文件**：`cmd/server/main.go`

---

<!-- 后续模块继续在此追加 -->

---

## Module 2 — 用户认证

**AI 贡献**：登录/注册流程骨架、bcrypt 密码处理
**人工决策**：
- JWT Payload 加入 `Role` 字段，避免每次请求都查 DB 判断权限
- `mustGetEnv` 启动阶段快速失败策略（AI 初版用默认值降级，安全风险）

---

## Module 4 — 竞拍引擎（核心）

**AI 贡献**：分布式锁基础结构、出价流程骨架
**人工修改点（最重要）**：
- 锁超时从 3s 改为 5s：压测发现 MySQL 写入在高并发时偶尔超 3s
- 加入 Lua 脚本原子释放锁：AI 初版用 `DEL` 可能误删他人锁
- 乐观锁二次校验逻辑：AI 初版仅用 Redis 缓存价格，未做 MySQL CAS，存在数据不一致风险
- 延时判断放在锁内：AI 初版放在锁外，并发时可能多次延时
- `incrFailCount` 监控计数：AI 初版无失败率统计

**关键决策**：出价金额校验逻辑 `(amount - start_price) % increment === 0` 而非 `amount % increment === 0`，因为起拍价不一定是加价幅度整数倍

---

## Module 6 — WebSocket

**AI 贡献**：Hub/Client 结构骨架、读写泵
**人工修改点**：
- Lua 脚本释放锁（同 Module 4）
- `notifyOvertaken` 广播给除出价者外所有人（AI 初版广播给所有人包括出价者本人）
- `GlobalOnlineKey` 维护全站在线人数，AI 初版无此设计
- 发送队列满时踢出客户端而非阻塞（背压处理）

---

## Module 7 — 定时任务

**AI 贡献**：ticker 骨架、激活/成交逻辑框架
**人工决策**：
- 无人出价的竞拍超时后取消而非成交（AI 初版尝试用 0 成交）
- `tickTimerSync` 每秒广播但不查 DB，从内存 auction list 读取，减少 DB 压力

---

## 前端

**AI 贡献**：页面结构、样式、组件骨架（约 60%）
**人工把控**：
- `useAuction` hook 中服务端时间偏差校正逻辑（`timeDeltaRef`）
- WS 重连时指数退避上限设为 30s（AI 初版无上限）
- `BidPanel` 中出价金额校验逻辑与后端保持一致
- 路由守卫 `RequireSeller` 防止普通用户访问后台
