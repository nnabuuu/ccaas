# Claude Code 即服务（CCAAS）

一个生产就绪的 AgentEngine 实例中继服务（支持 Claude Code、OpenCode、自定义引擎），使用 NestJS 构建。此 monorepo 包含运行和与服务交互所需的所有包。

## 包列表

| 包 | 描述 | 端口 |
|---------|-------------|------|
| [`@kedge-agentic/backend`](./packages/backend) | NestJS API 服务器，会话管理，技能路由 | 3001 |
| [`@kedge-agentic/admin-next`](./packages/admin-next) | React 管理后台（基于 Refine + shadcn/ui） | 5175 |
| [`@kedge-agentic/vue-sdk`](./packages/vue-sdk) | Vue 组合式函数，用于智能体集成 | - |
| [`@kedge-agentic/react-sdk`](./packages/react-sdk) | React Hooks，用于智能体集成 | - |
| [`@kedge-agentic/common`](./packages/common) | 共享的 TypeScript 类型和协议 | - |

## 架构图

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│   前端界面  │◄───►│  @kedge-agentic/backend  │◄───►│  AgentEngine        │
│ (React/Vue) │     │  (NestJS)        │     │ (claude/opencode)   │
└─────────────┘     └──────────────────┘     └─────────────────────┘
      │                     │
      └──────SDK────────────┤
             │              │
             └──@kedge-agentic/common
```

**支持的 AgentEngine 类型：**
- **Claude Code** - Anthropic 官方 CLI（默认）
- **OpenCode** - 开源替代方案
- **自定义引擎** - 你自己的实现

## 快速开始

### 前置要求

- Node.js >= 18.0.0
- npm >= 9.0.0

### 安装

```bash
# 克隆并安装依赖
cd ccaas
npm install

# 首先构建共享包（其他包需要）
npm run build:shared
```

### 开发模式

```bash
# 启动后端（端口 3001）
npm run dev:backend

# 启动管理界面（端口 5175）
npm run dev:admin

# 构建所有包
npm run build
```

## 核心特性

### 后端 (`@kedge-agentic/backend`)

- **AgentEngine 生命周期管理**：启动和管理 AgentEngine 实例（Claude Code、OpenCode、自定义）
- **技能路由**：基于触发器的路由（关键词、模式、意图）
- **多租户**：租户隔离与 API 密钥认证
- **MCP 集成**：MCP 服务器池与 REST 适配器
- **消息持久化**：SQLite/PostgreSQL 存储
- **实时流式传输**：SSE（Server-Sent Events）事件流

### 管理界面 (`@kedge-agentic/admin-next`)

- **仪表板**：概览指标和活跃会话
- **会话管理**：查看、监控和终止会话
- **技能管理**：CRUD、版本控制和发布工作流
- **数据分析**：令牌使用和成本追踪

### Vue SDK (`@kedge-agentic/vue-sdk`)

- **useAgentState**：集中式智能体状态管理
- **useFormBridge**：表单与智能体同步
- **useAIEditing**：AI 辅助编辑模式
- **usePlanMode**：计划提案处理
- **useToolActivity**：工具执行追踪
- **useTokenUsage**：实时令牌指标

### React SDK (`@kedge-agentic/react-sdk`)

- **useAgentConnection**：连接管理（SSE 默认）
- **useAgentChat**：聊天消息和历史记录
- **useAgentStatus**：智能体状态和活动追踪
- **ChatPanel**：完整的聊天界面组件
- **MessageBubble**：消息气泡组件

### 共享包 (`@kedge-agentic/common`)

- **类型**：Session、Message、Skill、Tenant、ApiKey 接口
- **协议**：输出更新事件定义
- **验证器**：基于 Zod 的运行时验证

## 环境变量

### 后端

| 变量 | 默认值 | 描述 |
|----------|---------|-------------|
| `PORT` | 3001 | 服务器端口 |
| `DATABASE_PATH` | .agent-workspace/data.db | SQLite 数据库路径 |
| `AUTH_ALLOW_ANONYMOUS` | true | 允许未认证请求 |

### 管理界面

| 变量 | 默认值 | 描述 |
|----------|---------|-------------|
| `VITE_API_URL` | http://localhost:3001 | 后端 API 地址 |
| `VITE_DEMO_API_KEY` | - | 演示 API 密钥，用于快速访问 |

## API 认证

后端使用基于作用域的 API 密钥认证：

```bash
# 通过 REST 创建 API 密钥
POST /api/v1/tenants/:tenantId/api-keys
{
  "name": "我的 API 密钥",
  "scopes": ["skills:read", "skills:execute", "chat"]
}
```

**可用作用域：**
- `skills:read`, `skills:write`, `skills:execute`, `skills:delete`
- `mcp:read`, `mcp:write`
- `chat`
- `analytics:read`
- `admin`

## 文档

- [后端架构](./packages/backend/CLAUDE.md)
- [Vue SDK 架构](./packages/vue-sdk/docs/ARCHITECTURE.md)
- [共享包](./packages/common/README.md)

## 许可证

MIT
