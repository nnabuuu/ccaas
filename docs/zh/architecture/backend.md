# 后端架构 - Claude Code 即服务

本文档为 AI 助手提供代码库上下文。

## 项目概述

**Claude Code 即服务** 是一个使用 NestJS 构建的生产就绪中继服务器，它将 AgentEngine 实例（Claude Code、OpenCode、自定义引擎）作为子进程启动，并通过 Socket.io 将事件流式传输到前端客户端。它提供多租户 API 密钥认证、技能管理、MCP 服务器集成和消息持久化。

## 架构图

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│   前端界面  │◄───►│  NestJS 服务器   │◄───►│  AgentEngine        │
│ (Socket.io) │     │  (ChatGateway)   │     │ (claude/opencode)   │
└─────────────┘     └──────────────────┘     └─────────────────────┘
                           │
                    ┌──────┴──────┐
                    ▼             ▼
              ┌──────────┐  ┌──────────────┐
              │MCP 池    │  │ 技能路由器   │
              └──────────┘  └──────────────┘
```

**支持的 AgentEngine 类型：**
- **Claude Code** - 默认，`npx claude-code`
- **OpenCode** - 开源，通过 `AGENT_ENGINE_PATH` 配置
- **自定义引擎** - 你自己的实现

## 目录结构

```
claude-code-as-a-service/
├── src/                          # NestJS 实现
│   ├── main.ts                   # 启动文件
│   ├── app.module.ts             # 根模块
│   │
│   ├── protocol/                 # 事件类型、错误、验证
│   │   ├── events.ts             # 前端事件类型
│   │   ├── errors.ts             # 错误代码和恢复
│   │   ├── metrics.ts            # 令牌/延迟追踪
│   │   ├── output-schema.ts      # JSON Schema 注册表
│   │   ├── output-transformer.service.ts
│   │   ├── validation.service.ts # Ajv 验证
│   │   └── protocol.module.ts
│   │
│   ├── auth/                     # 认证与授权
│   │   ├── api-key.service.ts    # API 密钥管理
│   │   ├── types.ts              # 认证类型和错误
│   │   ├── guards/               # API 密钥和作用域守卫
│   │   ├── decorators/           # @Auth, @Public, @TenantId
│   │   └── entities/             # ApiKey 实体
│   │
│   ├── mcp/                      # MCP 服务器管理
│   │   ├── mcp-pool.service.ts   # 服务器生命周期和健康检查
│   │   ├── rest-adapter.service.ts # REST→MCP 适配器
│   │   ├── types.ts              # MCP 类型
│   │   └── entities/             # McpServer 实体
│   │
│   ├── chat/                     # 核心中继模块
│   │   ├── chat.gateway.ts       # Socket.io WebSocket 网关
│   │   ├── chat.controller.ts    # REST 端点
│   │   ├── session.service.ts    # CLI 进程管理
│   │   └── event-mapper.service.ts
│   │
│   ├── skills/                   # 技能管理
│   │   ├── skills.service.ts     # CRUD 操作
│   │   ├── skill-sync.service.ts # 文件同步
│   │   ├── skill-router.service.ts # 路由逻辑
│   │   └── entities/             # Skill, SkillVersion 实体
│   │
│   ├── tenants/                  # 多租户
│   ├── messages/                 # 消息持久化
│   ├── files/                    # 文件管理
│   ├── scheduler/                # 定时任务执行
│   │   ├── scheduler.service.ts  # CRUD + cron 注册 + 执行编排
│   │   ├── scheduler.controller.ts # REST API 端点
│   │   ├── headless-execution.service.ts # 无头 CLI 执行（无 WebSocket）
│   │   ├── entities/             # ScheduledTask, ScheduledTaskExecution
│   │   └── dto/                  # Create/Update DTOs
│   │
│   ├── hooks/                    # 工具钩子
│   └── common/                   # 共享工具
│
├── .agent-workspace/             # 运行时数据（已忽略）
│   ├── sessions/                 # 每个会话的目录
│   ├── files/                    # 持久化文件存储
│   └── data.db                   # SQLite 数据库
│
├── package.json
├── tsconfig.json
├── nest-cli.json
├── MIGRATION.md                  # 迁移文档
└── CLAUDE.md                     # 本文件
```

## 核心模块

### ChatModule (chat/)

核心中继功能。管理 WebSocket 连接和 AgentEngine 进程生命周期。

**AgentEngine 生命周期：**
- `SessionService` 启动和管理 AgentEngine 实例
- 支持通过 `--resume <session-id>` 恢复
- 处理进程清理、取消（SIGTERM/SIGKILL）和超时
- 详见 [docs/advanced/AGENT_ENGINE_LIFECYCLE.md](../../docs/advanced/AGENT_ENGINE_LIFECYCLE.md)

**WebSocket 事件（ChatGateway）：**
- `chat` - 向 Claude 发送消息
- `cancel` - 取消当前操作
- `reconnect_session` - 重新连接到现有会话
- `get_stats` - 获取服务器统计信息

**REST 端点（ChatController）：**
- `GET /api/v1/chat/health` - 健康检查
- `GET /api/v1/chat/status` - 会话统计

**后台任务监控（SessionService）：**
- 自动检测带有 `run_in_background: true` 的 Task 工具调用
- 每 3 秒轮询输出文件以检测完成
- 任务完成时发送 `subagent_completed` WebSocket 事件
- 30 分钟超时保护和自动清理
- 会话清理自动停止所有监视器

### AuthModule (auth/)

基于作用域的 API 密钥认证和授权。

**9 个作用域：**
- `skills:read`, `skills:write`, `skills:execute`, `skills:delete`
- `mcp:read`, `mcp:write`
- `chat`
- `analytics:read`
- `admin`

**装饰器：**
```typescript
@Public()              // 跳过认证
@OptionalAuth()        // 认证可选
@Auth('skills:write')  // 需要特定作用域
@RequireScopes('a', 'b') // 多个作用域
@TenantId()            // 获取租户 ID
@Ctx()                 // 获取完整请求上下文
```

### McpModule (mcp/)

MCP 服务器池管理和 REST API 适配器。

**McpPoolService：**
- 服务器生命周期管理
- 健康检查（可配置间隔）
- 跨服务器工具执行

**RestAdapterService：**
- 将 REST API 转换为 MCP 工具
- 支持 OAuth2、API 密钥、Bearer、基本认证
- 速率限制和重试逻辑

### SkillsModule (skills/)

技能 CRUD、版本控制和路由。

**SkillRouterService：**
- 基于触发器的路由（关键词、模式、意图、上下文）
- 系统提示生成
- CLI 参数生成
- 性能缓存

**技能类型：**
- `prompt` - 简单提示技能
- `workflow` - 多步骤工作流
- `sub-agent` - 专门的子智能体
- `tool-config` - 工具配置

### SchedulerModule (scheduler/)

定时后台任务执行，支持 cron、间隔和一次性调度。在无头模式下运行 AgentEngine，无需 WebSocket 依赖。

**调度类型：**
- `cron` - Cron 表达式（例如 `0 4 * * *`）
- `interval` - 毫秒间隔（例如 `60000`）
- `once` - 一次性 ISO 日期执行

**核心服务：**
- `SchedulerService` - CRUD、通过 `SchedulerRegistry` 注册 cron、执行编排、重试逻辑、启动时检测错过的运行
- `HeadlessExecutionService` - 使用 `--output-format stream-json --permission-mode bypassPermissions` 启动 AgentEngine，通过 `EventMapperService` 解析输出，管理工作区生命周期

**REST 端点（SchedulerController）：**
- `POST /api/v1/scheduled-tasks` - 创建任务
- `GET /api/v1/scheduled-tasks` - 列出任务（带分页/过滤）
- `GET /api/v1/scheduled-tasks/:id` - 任务详情
- `PUT /api/v1/scheduled-tasks/:id` - 更新任务
- `DELETE /api/v1/scheduled-tasks/:id` - 软删除
- `POST /api/v1/scheduled-tasks/:id/pause` - 暂停调度
- `POST /api/v1/scheduled-tasks/:id/resume` - 恢复调度
- `POST /api/v1/scheduled-tasks/:id/trigger` - 手动触发
- `GET /api/v1/scheduled-tasks/:id/executions` - 执行历史
- `GET /api/v1/scheduled-tasks/:id/executions/:execId` - 执行详情

### ProtocolModule (protocol/)

前端-后端协议定义。

**组件：**
- **Events** - 强类型前端事件
- **Errors** - 带重试策略的错误代码
- **Metrics** - 令牌累加器、延迟追踪
- **Validation** - 基于 Ajv 的模式验证
- **Transformation** - 输出字段映射

## 开发命令

```bash
# 开发模式
npm run start:dev      # 带热重载启动

# 生产模式
npm run build          # 编译 TypeScript
npm run start:prod     # 运行编译版本

# 类型检查
npm run typecheck      # 类型检查，不输出文件
```

## 环境变量

| 变量 | 默认值 | 用途 |
|----------|---------|---------|
| `PORT` | 3001 | 服务器端口 |
| `NODE_ENV` | development | 环境 |
| `DATABASE_PATH` | .agent-workspace/data.db | SQLite 数据库路径 |
| `WORKSPACE_DIR` | .agent-workspace | 会话存储 |
| `AUTH_ALLOW_ANONYMOUS` | true | 允许未认证请求 |
| `AUTH_ENABLE_RATE_LIMITING` | true | 启用速率限制 |
| `MCP_HEALTH_CHECK_INTERVAL_MS` | 60000 | 健康检查间隔 |
| `DEBUG` | false | 调试日志 |

## 数据库架构

使用 TypeORM 和 SQLite（可配置为 PostgreSQL）：

- **tenants** - 多租户配置
- **api_keys** - API 密钥存储（SHA-256 哈希）
- **skills** - 技能定义
- **skill_versions** - 技能版本历史
- **mcp_servers** - MCP 服务器配置
- **messages** - 聊天消息持久化
- **agent_files** - 写入文件追踪
- **scheduled_tasks** - 定时任务定义（cron/interval/once）
- **scheduled_task_executions** - 任务执行历史和结果

## API 端点

### 认证
```
GET    /api/v1/tenants/:tenantId/api-keys
POST   /api/v1/tenants/:tenantId/api-keys
PUT    /api/v1/api-keys/:id
DELETE /api/v1/api-keys/:id
```

### 技能
```
GET    /api/v1/skills
POST   /api/v1/skills
GET    /api/v1/skills/:id
PUT    /api/v1/skills/:id
DELETE /api/v1/skills/:id
POST   /api/v1/skills/:id/publish
POST   /api/v1/skills/:id/unpublish
```

### MCP 服务器
```
GET    /api/v1/mcp-servers
POST   /api/v1/mcp-servers
GET    /api/v1/mcp-servers/:id
PUT    /api/v1/mcp-servers/:id
DELETE /api/v1/mcp-servers/:id
POST   /api/v1/mcp-servers/:id/health
```

### 消息和文件
```
GET    /api/v1/sessions/:id/messages
GET    /api/v1/messages/:id
GET    /api/v1/messages/:id/files
GET    /api/v1/files/:id/download
```

### 管理 - API 密钥
```
GET    /api/v1/admin/api-keys                    # 列出密钥（需要 tenantId 查询参数）
POST   /api/v1/admin/api-keys                    # 创建密钥（仅返回一次原始密钥）
GET    /api/v1/admin/api-keys/:id                # 获取单个密钥
PUT    /api/v1/admin/api-keys/:id                # 更新密钥
POST   /api/v1/admin/api-keys/:id/revoke         # 撤销密钥
DELETE /api/v1/admin/api-keys/:id                # 删除密钥
```

**列出 API 密钥：**
- 查询参数：`tenantId`（必需）、`page`（默认：1）、`limit`（默认：50，最大：100）
- 返回：`{ items: ApiKeyResponse[], total, page, limit }`
- 验证：租户存在

**创建 API 密钥：**
- 请求体：`{ tenantId, name, scopes?, rateLimitRpm?, rateLimitRpd?, expiresAt? }`
- 返回：`{ apiKey, rawKey, warning }` (⚠️ rawKey 仅显示一次)
- 创建审计日志条目

**更新 API 密钥：**
- 请求体：`{ name?, scopes?, rateLimitRpm?, rateLimitRpd?, status?, expiresAt? }`
- 在审计中记录修改前后的值

**撤销 API 密钥：**
- 将状态设置为 'revoked'
- 验证密钥尚未被撤销

**删除 API 密钥：**
- 永久删除密钥
- 删除前创建审计日志

### 定时任务
```
POST   /api/v1/scheduled-tasks
GET    /api/v1/scheduled-tasks
GET    /api/v1/scheduled-tasks/:id
PUT    /api/v1/scheduled-tasks/:id
DELETE /api/v1/scheduled-tasks/:id
POST   /api/v1/scheduled-tasks/:id/pause
POST   /api/v1/scheduled-tasks/:id/resume
POST   /api/v1/scheduled-tasks/:id/trigger
GET    /api/v1/scheduled-tasks/:id/executions
GET    /api/v1/scheduled-tasks/:id/executions/:execId
```

## 添加自定义功能

### 添加新模块

```typescript
// 1. 创建模块文件
@Module({
  imports: [TypeOrmModule.forFeature([MyEntity])],
  controllers: [MyController],
  providers: [MyService],
  exports: [MyService],
})
export class MyModule {}

// 2. 添加到 app.module.ts 的 imports
```

### 添加工具钩子

```typescript
// hooks/my-tool.hook.ts
export interface ToolHook {
  preInvoke?(toolName: string, input: unknown): Promise<unknown>;
  postInvoke?(toolName: string, result: unknown): Promise<void>;
}
```

### 添加自定义事件

```typescript
// protocol/events.ts
export interface MyCustomEvent extends FrontendEvent {
  type: 'my_custom_event';
  payload: { /* ... */ };
}

// 添加到 FrontendEventType 联合类型
export type FrontendEventType =
  | 'text_delta'
  | 'tool_activity'
  | 'my_custom_event'
  // ...
```

## 会话生命周期

```
1. 客户端连接 → WebSocket 握手
2. 认证守卫验证 API 密钥（如果提供）
3. 客户端发送聊天消息 → 创建会话
4. SkillRouter 匹配触发器（可选）
5. 使用 --output-format stream-json 启动 CLI
6. CLI 标准输出 → EventMapperService → Socket.io 发射
7. 消息持久化到数据库
8. CLI 退出 → agent_status: complete
9. 后续消息 → 使用 --resume 启动 CLI
10. 空闲超时 → 会话清理
```

## 后台任务生命周期

```
1. 使用 run_in_background: true 调用 Task 工具
2. EventMapperService 检测 isPersistent 标志
3. 工具结果包含 output_file 路径
4. EventMapperService 触发回调 → SessionService
5. SessionService 启动监视器（3秒轮询间隔）
6. 监视器读取 output_file 的最后 20 行
7. 检测完成标记：
   - "Agent completed successfully"
   - '"type":"result"'
   - "agentId:"
8. SessionService 调用 EventMapperService.markBackgroundTaskComplete()
9. Socket.io 发射 subagent_completed 事件
10. 前端移除 SubAgentCard
11. 超时：30 分钟 → 自动失败
12. 会话清理 → 所有监视器停止
```

## 无头执行生命周期（定时任务）

```
1. Cron/interval/timeout 触发 → SchedulerService.triggerExecution()
2. 并发检查（运行中数量 < maxConcurrent）
3. 创建 ScheduledTaskExecution 记录（status=running）
4. 更新 task.lastRunAt / nextRunAt
5. HeadlessExecutionService 创建工作区
6. 写入 .claude/settings.local.json（权限白名单）
7. SkillSyncService 同步已启用的技能
8. 使用 --output-format stream-json --permission-mode bypassPermissions 启动 CLI
9. stdin 接收用户消息，stdout 通过 EventMapperService 解析
10. 事件发射到 Socket.io 房间 scheduler:{tenantId}
11. 完成时：持久化消息，更新执行状态
12. 清理工作区目录
```

## 测试

```bash
# 启动服务器
npm run start:dev

# 健康检查
curl http://localhost:3001/api/v1/chat/health

# 使用测试前端
open test-frontend.html
```

## 关键设计决策

1. **NestJS 架构** - 模块化、可测试、企业级
2. **委托给 CLI** - Claude Code CLI 处理工具、流式传输、上下文
3. **TypeORM + SQLite** - 简单持久化，可升级到 PostgreSQL
4. **API 密钥认证** - SHA-256 哈希，基于作用域的权限
5. **MCP 池** - 集中式 MCP 服务器管理
6. **技能路由器** - 基于触发器的技能匹配和路由

## 迁移历史

该项目从传统的纯 TypeScript/Socket.io 实现迁移到 NestJS 架构。详见 `MIGRATION.md` 了解迁移过程的文档。
