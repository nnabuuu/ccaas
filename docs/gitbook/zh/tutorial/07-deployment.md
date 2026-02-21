# 第 7 章：部署上线

在前面的章节中，你设计了领域模型、映射了用户旅程、构建了数据流、使用 `output_update` 协议实现了表单，并在实现演练中将所有部分整合在一起。现在是为生产环境做准备的时候了。

本章涵盖环境配置、数据库管理、监控、性能优化和扩展策略。完成本章后，你将拥有一份生产就绪的部署检查清单。

## 前提条件

在部署之前，确认你的 Solution 在开发环境中运行正常：

```bash
# 在 monorepo 根目录
npm test                    # 所有测试通过
npm run build               # 所有包构建成功
```

你的 Solution 应具有标准结构：

```
solutions/lesson-plan-designer/
├── solution.json
├── setup.sh
├── inject-skills.sh
├── frontend/
├── backend/
├── mcp-server/
└── skills/
```

## 7.1 环境配置

### 开发环境 vs 生产环境设置

CCAAS 后端使用环境变量进行所有配置。为部署创建 `.env.production` 文件：

```bash
# 服务器
PORT=3001
NODE_ENV=production

# 数据库
DATABASE_PATH=/data/ccaas/ccaas.db

# 工作空间
WORKSPACE_DIR=/data/ccaas/agent-workspace
SESSION_TTL_MS=1800000          # 30 分钟空闲超时
MAX_SESSIONS=100
CLEANUP_INTERVAL_MS=300000      # 5 分钟

# 认证
AUTH_ALLOW_ANONYMOUS=false       # 生产环境必须要求 API Key
AUTH_ENABLE_RATE_LIMITING=true

# Skills
SKILL_REGISTRY_DIR=/data/ccaas/skill-packages
DEFAULT_TENANT_ID=default

# MCP 健康检查
MCP_HEALTH_CHECK_INTERVAL_MS=60000

# 消息队列（可选）
MESSAGE_QUEUE_ENABLED=false
MESSAGE_QUEUE_POLL_INTERVAL_MS=1000
MESSAGE_QUEUE_CONCURRENCY=5
MESSAGE_QUEUE_MAX_RETRIES=2

# 调试
DEBUG=false
```

### 与开发环境的关键差异

| 设置 | 开发环境 | 生产环境 |
|------|---------|---------|
| `NODE_ENV` | `development` | `production` |
| `AUTH_ALLOW_ANONYMOUS` | `true` | `false` |
| `AUTH_ENABLE_RATE_LIMITING` | `false` | `true` |
| `DEBUG` | `true` | `false` |
| `DATABASE_PATH` | `.agent-workspace/data.db` | 持久化卷路径 |
| `MCP_HEALTH_CHECK_INTERVAL_MS` | `30000` | `60000` |

### Solution 后端配置

你的 Solution 后端（端口 3002）需要自己的环境配置：

```bash
# Solution 后端
SOLUTION_PORT=3002
CCAAS_BACKEND_URL=http://localhost:3001
DATABASE_PATH=/data/lesson-plan-designer/lesson-plans.db
```

{% hint style="warning" %}
**安全提示**：永远不要提交包含真实凭据的 `.env` 文件。使用部署平台的环境变量注入功能（Docker secrets、Kubernetes ConfigMaps 等）。
{% endhint %}

## 7.2 数据库管理

### 生产环境中的 SQLite

CCAAS 默认使用 SQLite，适用于单节点部署。TypeORM 在启动时自动处理 schema 创建。

**需要持久化的数据目录**：

```
/data/ccaas/
├── ccaas.db                    # CCAAS 核心数据库
├── agent-workspace/            # 会话工作空间
│   └── sessions/               # 每个会话的目录
└── skill-packages/             # Skill 定义

/data/lesson-plan-designer/
└── lesson-plans.db             # Solution 领域数据库
```

### 备份策略

对于 SQLite，使用文件级备份：

```bash
#!/bin/bash
# backup.sh - SQLite 备份脚本
BACKUP_DIR="/backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# 使用 SQLite 在线备份（并发访问安全）
sqlite3 /data/ccaas/ccaas.db ".backup '$BACKUP_DIR/ccaas.db'"
sqlite3 /data/lesson-plan-designer/lesson-plans.db ".backup '$BACKUP_DIR/lesson-plans.db'"

echo "备份完成: $BACKUP_DIR"
```

{% hint style="info" %}
**SQLite `.backup` 命令** 即使在数据库正在写入时也能创建一致的快照。不要简单地复制 `.db` 文件 -- 使用 `.backup` 命令或先执行 `PRAGMA wal_checkpoint(TRUNCATE)`。
{% endhint %}

### 升级到 PostgreSQL

对于集群部署，TypeORM 支持 PostgreSQL。更新数据库配置：

```bash
# PostgreSQL 配置
DATABASE_TYPE=postgres
DATABASE_HOST=db.example.com
DATABASE_PORT=5432
DATABASE_NAME=ccaas
DATABASE_USER=ccaas_app
DATABASE_PASSWORD=<from-secret>
DATABASE_SSL=true
```

TypeORM 会处理 schema 同步。对于生产环境的 schema 变更，使用显式迁移：

```bash
# 从实体变更生成迁移
npx typeorm migration:generate -n AddLessonPlanStatus

# 运行待执行的迁移
npx typeorm migration:run
```

## 7.3 Docker 部署

### CCAAS 后端 Dockerfile

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/backend/package*.json ./packages/backend/

RUN npm ci --workspace=@kedge-agentic/backend --workspace=@kedge-agentic/common

COPY packages/shared/ ./packages/shared/
COPY packages/backend/ ./packages/backend/

RUN npm run build:common && npm run build:backend

FROM node:20-alpine
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/backend/dist ./packages/backend/dist
COPY --from=builder /app/packages/backend/package.json ./packages/backend/

EXPOSE 3001
CMD ["node", "packages/backend/dist/main.js"]
```

### Docker Compose

包含 CCAAS 后端、Solution 后端和 Solution 前端的完整部署：

```yaml
version: '3.8'

services:
  ccaas-backend:
    build:
      context: .
      dockerfile: Dockerfile.ccaas
    ports:
      - "3001:3001"
    volumes:
      - ccaas-data:/data/ccaas
    environment:
      - NODE_ENV=production
      - DATABASE_PATH=/data/ccaas/ccaas.db
      - WORKSPACE_DIR=/data/ccaas/agent-workspace
      - AUTH_ALLOW_ANONYMOUS=false
      - AUTH_ENABLE_RATE_LIMITING=true
    restart: unless-stopped

  lesson-plan-backend:
    build:
      context: ./solutions/lesson-plan-designer/backend
    ports:
      - "3002:3002"
    volumes:
      - solution-data:/data/lesson-plan-designer
    environment:
      - CCAAS_BACKEND_URL=http://ccaas-backend:3001
      - DATABASE_PATH=/data/lesson-plan-designer/lesson-plans.db
    depends_on:
      - ccaas-backend
    restart: unless-stopped

  lesson-plan-frontend:
    build:
      context: ./solutions/lesson-plan-designer/frontend
    ports:
      - "80:80"
    depends_on:
      - ccaas-backend
      - lesson-plan-backend

volumes:
  ccaas-data:
  solution-data:
```

### 启动服务栈

```bash
# 构建并启动所有服务
docker compose up -d --build

# 检查服务健康状态
docker compose ps
docker compose logs ccaas-backend

# 停止所有服务
docker compose down
```

## 7.4 监控与健康检查

### 内置健康检查端点

CCAAS 提供健康检查端点：

```bash
curl http://localhost:3001/api/v1/chat/health
```

预期响应：

```json
{
  "status": "ok",
  "timestamp": "2026-02-15T10:30:00.000Z"
}
```

### 状态端点

获取详细的会话统计信息：

```bash
curl http://localhost:3001/api/v1/chat/status
```

### Docker 健康检查

在 Docker Compose 中添加健康检查：

```yaml
services:
  ccaas-backend:
    # ...
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/api/v1/chat/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
```

### 应用日志

在生产环境中，配置结构化日志：

```bash
# 日志级别控制
NODE_ENV=production  # 减少冗长日志
DEBUG=false          # 禁用调试输出
```

监控以下日志模式以发现问题：

| 日志模式 | 含义 | 操作 |
|---------|------|------|
| `Session cleanup` | 空闲会话被回收 | 正常操作 |
| `MCP health check failed` | MCP 服务器不可达 | 检查 MCP 服务器状态 |
| `Rate limit exceeded` | 客户端触发限流 | 检查客户端行为 |
| `CLI process error` | Agent 引擎故障 | 检查 agent 引擎日志 |

### 监控检查清单

```
[] 健康端点返回 200
[] 会话数保持在 MAX_SESSIONS 以内
[] MCP 服务器通过健康检查
[] 数据库大小在预期范围内
[] Agent 工作空间磁盘使用量可控
[] 错误率低于阈值
```

## 7.5 性能优化

### 会话管理

会话是平台消耗的主要资源。根据工作负载调整以下设置：

```bash
# 最大并发会话数
MAX_SESSIONS=100

# 空闲会话超时（默认 30 分钟）
SESSION_TTL_MS=1800000

# 清理间隔（检查过期会话的频率）
CLEANUP_INTERVAL_MS=300000
```

**调优指南**：
- 如果用户交互时间短（如快速问答），降低 `SESSION_TTL_MS`
- 如果有很多并发用户，提高 `MAX_SESSIONS`
- 更短的 `CLEANUP_INTERVAL_MS` 能更快释放资源，但会增加开销

### 消息队列调优

如果你启用消息队列用于高流量场景：

```bash
MESSAGE_QUEUE_ENABLED=true
MESSAGE_QUEUE_POLL_INTERVAL_MS=500    # 更快的轮询
MESSAGE_QUEUE_CONCURRENCY=10          # 更多并发消息
MESSAGE_QUEUE_MAX_RETRIES=3           # 更多重试次数
```

### 前端构建优化

确保你的 Solution 前端使用生产构建：

```bash
# Vite 生产构建
npm run build -- --mode production

# 验证 bundle 大小
npx vite-bundle-visualizer
```

### 数据库性能

对于 SQLite，以下 pragma 可以提升写入性能：

```sql
PRAGMA journal_mode=WAL;           -- Write-Ahead Logging
PRAGMA synchronous=NORMAL;         -- 在安全性和速度之间取得平衡
PRAGMA cache_size=-64000;          -- 64MB 缓存
PRAGMA busy_timeout=5000;          -- 5 秒锁超时
```

TypeORM 会应用合理的默认值，但对于高吞吐量场景，你可能需要在数据源配置中调整这些参数。

## 7.6 扩展策略

### 单节点扩展

对于单台机器，垂直扩展：

| 资源 | 建议 |
|------|------|
| CPU | 2+ 核心（agent 进程是 CPU 密集型） |
| RAM | 最少 4GB，建议 8GB |
| 磁盘 | 必须使用 SSD 以保证 SQLite 性能 |
| 网络 | 到 AI 供应商 API 的低延迟连接 |

### 多节点架构

对于更大规模的部署，将服务分布在多个节点上：

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│   前端       │────→│   负载均衡器      │────→│   CCAAS      │
│  (CDN/Nginx) │     │  (Sticky Session) │     │   后端       │
└──────────────┘     └──────────────────┘     │   节点 1..N  │
                                               └──────┬───────┘
                                                      │
                                               ┌──────┴───────┐
                                               │  PostgreSQL  │
                                               │  (共享数据库) │
                                               └──────────────┘
```

{% hint style="warning" %}
**需要 Sticky Session**：WebSocket 连接在整个生命周期内必须路由到同一后端节点。配置负载均衡器的会话亲和性（例如基于 Socket.io 的 `sid` cookie）。
{% endhint %}

### 扩展检查清单

```
[] 数据库：单节点使用 SQLite，多节点使用 PostgreSQL
[] 负载均衡器：为 WebSocket 启用 sticky session
[] 存储：为数据库和工作空间配置持久化卷
[] 密钥：通过安全方式注入环境变量
[] MCP 服务器：配置健康检查
[] 备份：已自动化且经过测试
```

## 7.7 安全加固

### 认证

在生产环境中，始终要求 API Key 认证：

```bash
AUTH_ALLOW_ANONYMOUS=false
AUTH_ENABLE_RATE_LIMITING=true
```

### API Key 管理

- 定期轮换 API Key
- 使用具有最小必要权限的 scoped key
- 监控管理审计日志中的 key 使用情况

```bash
# 为 Solution 前端创建 scoped key
POST /api/v1/admin/api-keys
{
  "tenantId": "lesson-plan-designer",
  "name": "Lesson Plan Designer Frontend",
  "scopes": ["chat", "skills:read", "skills:execute"]
}
```

### 网络安全

- 在反向代理（Nginx、Caddy）后运行 CCAAS 后端
- 在反向代理终止 TLS
- 限制对后端端口的直接访问
- 使用内部网络进行服务间通信

### CORS 配置

配置 CORS 仅允许你的前端来源：

```bash
# 在反向代理或后端配置中
CORS_ORIGINS=https://app.example.com,https://admin.example.com
```

## 7.8 部署检查清单练习

在每次生产部署前使用此检查清单：

### 部署前

```
[] 所有测试通过：npm test
[] 生产构建成功：npm run build
[] 环境变量已配置（密钥不使用默认值）
[] 数据库备份已完成
[] 已创建具有适当权限的 API Key
```

### 基础设施

```
[] 已为数据库和工作空间挂载持久化卷
[] 健康检查已配置并通过
[] 反向代理已配置 TLS
[] 防火墙规则限制了对后端的直接访问
[] 日志聚合已配置
```

### 应用配置

```
[] AUTH_ALLOW_ANONYMOUS=false
[] AUTH_ENABLE_RATE_LIMITING=true
[] NODE_ENV=production
[] DEBUG=false
[] SESSION_TTL_MS 适合工作负载
[] MAX_SESSIONS 适合容量
```

### Solution 特定

```
[] solution.json 正确（MCP 服务器、Skills、租户 ID）
[] Skills 已注入：./inject-skills.sh
[] MCP 服务器健康检查通过
[] 前端连接到正确的后端 URL
[] 会话持久化已配置（tenantId 已设置）
```

### 部署后

```
[] 健康端点返回 200
[] 可以通过 WebSocket 创建新会话
[] 可以发送消息并收到响应
[] 消息历史在页面刷新后保持
[] 管理后台可访问
[] 监控告警已配置
```

## 生产检查点

至此，你已经涵盖了在即见Agentic 平台上构建 Solution 的完整生命周期：

1. **架构** -- 理解 CCAAS 核心、Solution 后端和前端如何交互
2. **领域模型** -- 设计驻留在 Solution 后端的实体
3. **用户旅程** -- 映射用户将遵循的流程
4. **数据流** -- 连接 WebSocket 事件、REST API 和状态管理
5. **表单** -- 使用 `output_update` 协议进行结构化数据同步
6. **实现** -- 构建后端、MCP 服务器、Skills、前端和测试
7. **部署** -- 为生产环境进行配置、优化和安全加固

### 接下来探索

- **定时任务**：使用 Scheduler 模块自动化定期 agent 任务
- **会话持久化**：启用跨会话消息历史（参阅[会话持久化指南](../guide/conversation-persistence.md)）
- **自定义 MCP Server**：构建高级工具集成
- **管理后台**：监控会话、管理 Skills 和配置 API Key

恭喜你完成了本教程。现在你已具备在即见Agentic 平台上构建、测试和部署生产级 Solution 的知识。
