# CCAAS Solution Developer Integration Guide

CCAAS (Claude Code as a Service) 解决方案开发者对接指南

---

## 目录

1. [概述](#1-概述)
2. [快速开始](#2-快速开始)
3. [Solution 目录结构](#3-solution-目录结构)
4. [solution.json 配置详解](#4-solutionjson-配置详解)
5. [Socket.io 事件中继模式](#5-socketio-事件中继模式)
6. [MCP Server 开发](#6-mcp-server-开发)
7. [Skill 编写指南](#7-skill-编写指南)
8. [前端集成](#8-前端集成)
9. [API 参考](#9-api-参考)
10. [最佳实践](#10-最佳实践)
11. [故障排查](#11-故障排查)

---

## 1. 概述

### 1.1 什么是 CCAAS

CCAAS (Claude Code as a Service) 是一个生产级的中继服务器，它将 Claude Code CLI 作为子进程运行，并通过 Socket.io 将事件流式传输到前端客户端。它提供：

- **多租户支持**: 基于 API Key 的认证和权限管理
- **会话管理**: 持久化的对话会话，支持上下文保持
- **Skill 系统**: 基于触发器的技能路由和执行
- **MCP Server 集成**: 支持自定义工具扩展 Claude 能力
- **事件流**: 实时的文本流、工具调用、状态更新

### 1.2 架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            Solution 架构                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐     ┌─────────────────┐     ┌───────────────────────┐ │
│  │  Frontend   │◄───►│ Solution Backend│◄───►│    CCAAS Backend      │ │
│  │  (React/Vue)│     │  (中继层)        │     │   (NestJS Server)     │ │
│  └─────────────┘     └─────────────────┘     └───────────────────────┘ │
│        │                    │                         │                │
│        │                    │                         ▼                │
│        │                    │               ┌───────────────────────┐  │
│        │                    │               │   Claude Code CLI     │  │
│        │                    │               │ (npx claude-code)     │  │
│        │                    │               └───────────────────────┘  │
│        │                    │                         │                │
│        │                    │                         ▼                │
│        │                    │               ┌───────────────────────┐  │
│        │                    └──────────────►│    MCP Server         │  │
│        │                                    │  (自定义工具)          │  │
│        │                                    └───────────────────────┘  │
│        │                                              │                │
│        │◄─────────────────────────────────────────────┘                │
│        │              output_update 事件                               │
│  ┌─────▼─────┐                                                        │
│  │ 同步按钮   │  用户点击后将 AI 生成的内容同步到表单                    │
│  └───────────┘                                                        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.3 核心概念

| 概念 | 说明 |
|------|------|
| **Tenant** | 租户，用于多租户隔离。每个租户有独立的 Skill、API Key 等 |
| **Session** | 会话，代表一次对话。会话保持上下文，支持多轮对话 |
| **Skill** | 技能，定义 Claude 的行为模式和工具权限 |
| **MCP Server** | Model Context Protocol 服务器，提供自定义工具给 Claude 使用 |
| **write_output** | 特殊的 MCP 工具，用于将结构化数据发送到前端 |

### 1.4 数据流

```
1. 用户在前端输入消息
2. 前端通过 Socket.io 发送 chat 事件到 Solution Backend
3. Solution Backend 中继消息到 CCAAS Backend
4. CCAAS 启动 Claude Code CLI 子进程
5. CLI 连接 MCP Server，获取可用工具
6. Claude 处理消息，可能调用 write_output 工具
7. MCP Server 返回工具结果给 CLI
8. CLI 输出 stream-json 格式的事件
9. CCAAS 的 EventMapper 将事件转换为前端格式
10. 事件通过 Socket.io 流式传输到前端
11. 前端显示文本流和同步按钮
```

---

## 2. 快速开始

### 2.1 前置条件

- Node.js >= 18.x
- npm >= 9.x
- Claude Code CLI (`npx @anthropic-ai/claude-code`)
- 运行中的 CCAAS Backend (默认 http://localhost:3001)

### 2.2 创建 Solution 项目

```bash
# 在 solutions 目录下创建新项目
mkdir -p solutions/my-solution
cd solutions/my-solution

# 初始化目录结构
mkdir -p backend/src/{socket,config}
mkdir -p frontend/src
mkdir -p mcp-server/src
mkdir -p skills/my-skill

# 初始化 npm 项目
npm init -y
```

### 2.3 创建 solution.json

```json
{
  "name": "My Solution",
  "slug": "my-solution",
  "version": "1.0.0",
  "description": "我的 AI 助手解决方案",

  "mcpServers": {
    "my-tools": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"],
      "description": "My custom MCP tools"
    }
  },

  "skill": {
    "name": "My Skill",
    "description": "我的技能",
    "triggers": [
      { "type": "keyword", "value": "帮我", "priority": 10 }
    ],
    "allowedTools": ["write_output", "Read"],
    "skillFile": "skills/my-skill/SKILL.md"
  },

  "backend": {
    "port": 3002,
    "ccaasUrl": "http://localhost:3001"
  },

  "frontend": {
    "port": 5280
  }
}
```

### 2.4 启动服务

```bash
# 1. 确保 CCAAS 后端运行中
cd packages/backend && npm run start:dev

# 2. 构建 MCP Server
cd solutions/my-solution/mcp-server && npm run build

# 3. 启动 Solution 后端
cd solutions/my-solution/backend && npm run dev

# 4. 启动前端
cd solutions/my-solution/frontend && npm run dev
```

---

## 3. Solution 目录结构

```
my-solution/
├── solution.json           # 配置中心 (必需)
│
├── backend/                # Solution 后端
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts        # 入口文件
│       ├── config/
│       │   └── index.ts    # 配置加载
│       ├── socket/
│       │   └── index.ts    # Socket.io 中继层
│       └── types/
│           └── index.ts    # TypeScript 类型定义
│
├── frontend/               # Solution 前端
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── App.tsx
│       ├── components/
│       ├── hooks/
│       │   └── useChat.ts  # Socket.io 集成
│       └── types/
│           └── index.ts
│
├── mcp-server/             # MCP 工具服务
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts        # MCP Server 入口
│       └── types.ts        # 工具类型定义
│
└── skills/                 # Skill 定义
    └── my-skill/
        └── SKILL.md        # Skill 提示词
```

### 3.1 各目录职责

| 目录 | 职责 |
|------|------|
| `solution.json` | 配置中心，定义 MCP 服务器、Skill、端口等 |
| `backend/` | Socket.io 中继层，连接前端和 CCAAS |
| `frontend/` | 用户界面，展示聊天和同步按钮 |
| `mcp-server/` | 自定义工具，如 `write_output` |
| `skills/` | Skill 定义文件，描述 Claude 的行为 |

---

## 4. solution.json 配置详解

### 4.1 完整配置示例

```json
{
  "name": "Lesson Plan Designer",
  "slug": "lesson-plan-designer",
  "version": "1.0.0",
  "description": "AI备课助手 - 基于崔允漷教授的课程与教学论",

  "mcpServers": {
    "lesson-plan-tools": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"],
      "description": "Lesson Plan Designer MCP tools including write_output"
    }
  },

  "skill": {
    "name": "Lesson Plan Designer",
    "description": "AI备课助手",
    "triggers": [
      { "type": "keyword", "value": "备课", "priority": 10 },
      { "type": "keyword", "value": "教学目标", "priority": 8 },
      { "type": "keyword", "value": "教学活动", "priority": 8 },
      { "type": "keyword", "value": "评估", "priority": 7 },
      { "type": "keyword", "value": "设计", "priority": 5 }
    ],
    "allowedTools": ["write_output", "Read"],
    "skillFile": "skills/lesson-plan-designer/SKILL.md"
  },

  "backend": {
    "port": 3002,
    "ccaasUrl": "http://localhost:3001"
  },

  "frontend": {
    "port": 5280
  }
}
```

### 4.2 字段说明

#### 基础信息

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | string | Solution 显示名称 |
| `slug` | string | URL 友好的唯一标识符 |
| `version` | string | 版本号 (semver) |
| `description` | string | Solution 描述 |

#### mcpServers 配置

```json
{
  "mcpServers": {
    "<server-name>": {
      "command": "node",           // 启动命令
      "args": ["path/to/server.js"], // 命令参数
      "description": "Server description"
    }
  }
}
```

- `command`: 执行命令，通常是 `node`
- `args`: 命令参数数组，路径相对于 solution 目录
- CCAAS 会自动解析相对路径并传递给 Claude Code CLI

#### skill 配置

```json
{
  "skill": {
    "name": "Skill Name",
    "description": "Skill description",
    "triggers": [
      { "type": "keyword", "value": "关键词", "priority": 10 }
    ],
    "allowedTools": ["write_output", "Read"],
    "skillFile": "skills/my-skill/SKILL.md"
  }
}
```

| 字段 | 说明 |
|------|------|
| `name` | Skill 名称 |
| `description` | Skill 描述 |
| `triggers` | 触发条件数组 |
| `allowedTools` | 允许使用的工具列表 |
| `skillFile` | Skill 提示词文件路径 |

#### triggers 配置

| type | 说明 | 示例 value |
|------|------|-----------|
| `keyword` | 关键词匹配 | `"备课"` |
| `pattern` | 正则表达式匹配 | `"/设计.*教案/"` |
| `intent` | 意图匹配 (需 NLU) | `"create_lesson_plan"` |
| `context` | 上下文匹配 | `"lesson_plan_form"` |

`priority` 值越高，优先级越高。

#### backend/frontend 配置

```json
{
  "backend": {
    "port": 3002,              // Solution 后端端口
    "ccaasUrl": "http://localhost:3001"  // CCAAS 后端地址
  },
  "frontend": {
    "port": 5280               // 前端开发服务器端口
  }
}
```

---

## 5. Socket.io 事件中继模式

Solution 后端的核心职责是作为前端和 CCAAS 之间的中继层。

### 5.1 中继层架构

```
Frontend ─── Socket.io ───► Solution Backend ─── Socket.io ───► CCAAS Backend
                                   │
                                   │ 读取 solution.json
                                   │ 添加 mcpServers 配置
                                   │ 转发事件
                                   ▼
```

### 5.2 完整中继层代码

```typescript
// backend/src/socket/index.ts

import { Server as SocketIOServer, Socket } from 'socket.io'
import { Server as HTTPServer } from 'http'
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import config from '../config/index.js'
import type { ChatEvent, OutputUpdateEvent } from '../types/index.js'

// 获取 solution 目录路径
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const solutionDir = join(__dirname, '..', '..', '..')

// 加载 solution.json
interface SolutionConfig {
  name: string
  slug: string
  mcpServers: Record<string, {
    command: string
    args: string[]
    description?: string
  }>
  skill: {
    name: string
    description: string
    triggers: Array<{ type: string; value: string; priority: number }>
    allowedTools: string[]
    skillFile: string
  }
}

let solutionConfig: SolutionConfig | null = null
try {
  const configPath = join(solutionDir, 'solution.json')
  solutionConfig = JSON.parse(readFileSync(configPath, 'utf-8'))
  console.log(`📋 Loaded solution config: ${solutionConfig?.name}`)

  // 解析 MCP Server 相对路径为绝对路径
  if (solutionConfig?.mcpServers) {
    for (const [name, server] of Object.entries(solutionConfig.mcpServers)) {
      server.args = server.args.map(arg => {
        if (arg.endsWith('.js') || arg.endsWith('.ts')) {
          return join(solutionDir, arg)
        }
        return arg
      })
      console.log(`📦 MCP Server [${name}]: ${server.command} ${server.args.join(' ')}`)
    }
  }
} catch (error) {
  console.warn('⚠️ Could not load solution.json:', error)
}

// 存储活跃会话
const sessions = new Map<string, Set<string>>()

// 存储每个前端连接对应的 CCAAS 连接
const ccaasConnections = new Map<string, ClientSocket>()

export function initializeSocket(httpServer: HTTPServer, corsOrigin: string): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: corsOrigin,
      methods: ['GET', 'POST'],
    },
  })

  io.on('connection', (frontendSocket: Socket) => {
    console.log(`🔌 Frontend connected: ${frontendSocket.id}`)

    // 为每个前端连接创建一个 CCAAS 连接
    const ccaasSocket = ioClient(config.ccaasUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })

    ccaasConnections.set(frontendSocket.id, ccaasSocket)

    // CCAAS 连接事件
    ccaasSocket.on('connect', () => {
      console.log(`🔗 Connected to CCAAS: ${ccaasSocket.id}`)
    })

    ccaasSocket.on('client_id', (data: { clientId: string }) => {
      console.log(`📋 CCAAS client ID: ${data.clientId}`)
    })

    ccaasSocket.on('connect_error', (error: Error) => {
      console.error(`❌ CCAAS connection error:`, error.message)
    })

    ccaasSocket.on('disconnect', (reason: string) => {
      console.log(`🔌 CCAAS disconnected: ${reason}`)
    })

    // ===== 中继 CCAAS 事件到前端 =====

    // 文本流事件
    ccaasSocket.on('text_delta', (data: { text?: string; content?: string }) => {
      const content = data.text || data.content || ''
      console.log(`📝 text_delta received:`, content.substring(0, 50))
      frontendSocket.emit('text_delta', { content })
    })

    // 输出更新事件 (同步按钮) - 由 write_output 工具触发
    ccaasSocket.on('output_update', (data: {
      payload?: {
        data?: {
          field?: string
          value?: unknown
          preview?: string
        }
        status?: string
        progress?: number
      }
    }) => {
      console.log(`📤 Received output_update from CCAAS:`, JSON.stringify(data).substring(0, 200))

      // 提取嵌套的数据结构
      // CCAAS 将数据包装在 payload.data 中
      const payload = data.payload?.data || data.payload
      if (payload && typeof payload === 'object') {
        const outputEvent: OutputUpdateEvent = {
          field: (payload as any).field,
          value: (payload as any).value,
          preview: (payload as any).preview || '',
        }

        console.log(`📤 Forwarding output_update to frontend:`, outputEvent.field, outputEvent.preview)
        frontendSocket.emit('output_update', outputEvent)
      }
    })

    // Agent 状态更新
    ccaasSocket.on('agent_status', (data: { status: string; error?: string }) => {
      console.log(`🤖 Agent status: ${data.status}`)
      frontendSocket.emit('agent_status', {
        status: data.status as 'running' | 'complete' | 'error',
        error: data.error,
      })
    })

    // 工具活动事件 (用于调试/UI 反馈)
    ccaasSocket.on('tool_activity', (data: unknown) => {
      frontendSocket.emit('tool_activity', data)
    })

    // 错误事件
    ccaasSocket.on('error', (data: { message: string }) => {
      console.error(`❌ CCAAS error:`, data.message)
      frontendSocket.emit('agent_status', {
        status: 'error',
        error: data.message,
      })
    })

    // 调试: 记录所有 CCAAS 事件
    ccaasSocket.onAny((eventName: string, ...args: unknown[]) => {
      if (!['connect', 'disconnect', 'client_id'].includes(eventName)) {
        console.log(`📨 CCAAS event [${eventName}]:`, JSON.stringify(args).substring(0, 100))
      }
    })

    // ===== 处理前端事件 =====

    // 加入会话房间
    frontendSocket.on('join_session', (sessionId: string) => {
      frontendSocket.join(sessionId)
      if (!sessions.has(sessionId)) {
        sessions.set(sessionId, new Set())
      }
      sessions.get(sessionId)!.add(frontendSocket.id)
      console.log(`👤 Socket ${frontendSocket.id} joined session ${sessionId}`)
    })

    // 离开会话房间
    frontendSocket.on('leave_session', (sessionId: string) => {
      frontendSocket.leave(sessionId)
      sessions.get(sessionId)?.delete(frontendSocket.id)
      if (sessions.get(sessionId)?.size === 0) {
        sessions.delete(sessionId)
      }
      console.log(`👋 Socket ${frontendSocket.id} left session ${sessionId}`)
    })

    // 处理 chat 消息 - 中继到 CCAAS
    frontendSocket.on('chat', (data: ChatEvent) => {
      console.log(`💬 Chat from frontend: "${data.message.substring(0, 50)}..."`)

      // 本地加入会话房间
      frontendSocket.join(data.sessionId)

      // 从 solution.json 构建 MCP 配置
      const mcpConfig = solutionConfig?.mcpServers || {}

      // 中继到 CCAAS，使用正确的格式
      // 添加前缀以避免与其他 CCAAS 客户端冲突
      const ccaasPayload = {
        message: data.message,
        sessionId: `${solutionConfig?.slug || 'sol'}_${data.sessionId}`,
        tenantId: data.tenantId || 'default',
        skillSlug: solutionConfig?.skill?.name?.toLowerCase().replace(/\s+/g, '-'),
        context: data.context ? JSON.stringify(data.context) : undefined,
        // 传递 MCP 服务器配置到 CCAAS
        mcpServers: mcpConfig,
      }

      console.log(`📤 Sending to CCAAS:`, {
        sessionId: ccaasPayload.sessionId,
        skillSlug: ccaasPayload.skillSlug,
        messageLength: ccaasPayload.message.length,
        mcpServers: Object.keys(mcpConfig),
      })

      ccaasSocket.emit('chat', ccaasPayload)
    })

    // 处理取消请求
    frontendSocket.on('cancel', (data: { sessionId: string }) => {
      console.log(`🛑 Cancel request for session: ${data.sessionId}`)
      ccaasSocket.emit('cancel', {
        sessionId: `${solutionConfig?.slug || 'sol'}_${data.sessionId}`
      })
    })

    // 处理前端断开连接
    frontendSocket.on('disconnect', () => {
      console.log(`🔌 Frontend disconnected: ${frontendSocket.id}`)

      // 清理 CCAAS 连接
      const ccaas = ccaasConnections.get(frontendSocket.id)
      if (ccaas) {
        ccaas.disconnect()
        ccaasConnections.delete(frontendSocket.id)
      }

      // 清理会话跟踪
      for (const [sessionId, members] of sessions.entries()) {
        if (members.has(frontendSocket.id)) {
          members.delete(frontendSocket.id)
          if (members.size === 0) {
            sessions.delete(sessionId)
          }
        }
      }
    })
  })

  return io
}

export default initializeSocket
```

### 5.3 事件类型详解

#### 发送到 CCAAS 的事件

| 事件 | 说明 | Payload |
|------|------|---------|
| `chat` | 发送聊天消息 | `{ message, sessionId, tenantId, mcpServers, context }` |
| `cancel` | 取消当前操作 | `{ sessionId }` |

#### 从 CCAAS 接收的事件

| 事件 | 说明 | Payload |
|------|------|---------|
| `text_delta` | 文本流片段 | `{ text }` |
| `output_update` | 输出更新 (同步按钮) | `{ payload: { data: { field, value, preview } } }` |
| `agent_status` | Agent 状态变化 | `{ status: 'running' \| 'complete' \| 'error', error? }` |
| `tool_activity` | 工具调用活动 | `{ toolName, toolId, phase, ... }` |
| `token_usage` | Token 使用量 | `{ inputTokens, outputTokens, ... }` |
| `agent_thinking` | 思考过程 | `{ phase, content?, thinkingId }` |

---

## 6. MCP Server 开发

MCP (Model Context Protocol) 是 Claude Code 用于扩展工具能力的协议。通过创建 MCP Server，您可以让 Claude 调用自定义工具。

### 6.1 MCP 协议简介

MCP Server 通过 stdio 与 Claude Code CLI 通信：

```
Claude Code CLI ──── stdio ──── MCP Server
      │                              │
      │  ListToolsRequest            │
      │ ────────────────────────────►│
      │                              │
      │  ListToolsResponse           │
      │ ◄────────────────────────────│
      │                              │
      │  CallToolRequest             │
      │ ────────────────────────────►│
      │                              │
      │  CallToolResponse            │
      │ ◄────────────────────────────│
```

### 6.2 创建 MCP Server 项目

```bash
# 初始化项目
cd solutions/my-solution/mcp-server
npm init -y

# 安装依赖
npm install @modelcontextprotocol/sdk

# 安装开发依赖
npm install -D typescript @types/node
```

**package.json:**

```json
{
  "name": "my-solution-mcp-server",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0"
  }
}
```

**tsconfig.json:**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src/**/*"]
}
```

### 6.3 实现 write_output 工具

`write_output` 是一个特殊的 MCP 工具，它的返回值会被 CCAAS 的 EventMapper 识别，并转换为 `output_update` 事件发送到前端。

**src/types.ts:**

```typescript
/**
 * 可同步的字段列表
 */
export const SYNC_FIELDS = [
  'title',
  'subject',
  'gradeLevel',
  'duration',
  'objectives',
  'standards',
  'materials',
  'activities',
  'assessment',
  'differentiation'
] as const;

export type SyncField = typeof SYNC_FIELDS[number];

/**
 * write_output 工具输入
 */
export interface WriteOutputInput {
  field: SyncField;
  value: unknown;
  preview: string;
}

/**
 * write_output 工具结果格式
 * 这个格式必须匹配 CCAAS EventMapper 的期望
 */
export interface WriteOutputResult {
  data: {
    field?: SyncField;
    value?: unknown;
    preview?: string;
    error?: string;
  };
  status: 'success' | 'error';
}
```

**src/index.ts:**

```typescript
#!/usr/bin/env node
/**
 * My Solution MCP Server
 *
 * 提供 write_output 工具，使 Claude 能够将结构化数据发送到前端。
 * 当 Claude 使用此工具时，CCAAS 后端会发出 output_update 事件，
 * 在 UI 中显示同步按钮。
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { SYNC_FIELDS, type SyncField, type WriteOutputInput, type WriteOutputResult } from './types.js';

// 创建 MCP 服务器
const server = new Server(
  {
    name: 'my-solution-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 定义 write_output 工具
const writeOutputTool: Tool = {
  name: 'write_output',
  description: `将结构化内容写入前端表单。前端会显示一个"同步到表单"按钮，
允许用户将更改应用到表单。

有效字段: ${SYNC_FIELDS.join(', ')}

字段架构:
- title: string (标题)
- subject: string (科目)
- gradeLevel: string (年级)
- duration: string (时长)
- objectives: Array of { id, description, bloomLevel, assessmentCriteria? }
- standards: Array of { id, code, description }
- materials: Array of { id, name, type, url?, notes? }
- activities: Array of { id, title, description, duration, type, instructions, materials?, teacherNotes? }
- assessment: { formative: string[], summative: string[], rubric?: string }
- differentiation: { struggling: string[], onLevel: string[], advanced: string[], ell?: string[], accommodations?: string[] }

示例用法:
{
  "field": "objectives",
  "value": [
    { "id": "obj-1", "description": "学生能够理解核心概念", "bloomLevel": "understand" }
  ],
  "preview": "1个教学目标"
}`,
  inputSchema: {
    type: 'object',
    properties: {
      field: {
        type: 'string',
        enum: [...SYNC_FIELDS],
        description: '要更新的字段',
      },
      value: {
        description: '匹配字段架构的结构化数据',
      },
      preview: {
        type: 'string',
        description: '显示在同步按钮上的人类可读摘要 (例如 "3个教学目标")',
      },
    },
    required: ['field', 'value', 'preview'],
  },
};

// 处理 list_tools 请求
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [writeOutputTool],
  };
});

// 处理 call_tool 请求
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'write_output') {
    const input = args as unknown as WriteOutputInput;

    // 验证字段
    if (!SYNC_FIELDS.includes(input.field as SyncField)) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              data: { error: `无效字段: ${input.field}。有效字段: ${SYNC_FIELDS.join(', ')}` },
              status: 'error',
            } satisfies WriteOutputResult),
          },
        ],
        isError: true,
      };
    }

    // 返回 CCAAS EventMapper 期望的格式
    // EventMapper 查找 { data: ..., status: ... } 结构
    const result: WriteOutputResult = {
      data: {
        field: input.field,
        value: input.value,
        preview: input.preview,
      },
      status: 'success',
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result),
        },
      ],
    };
  }

  // 未知工具
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          data: { error: `未知工具: ${name}` },
          status: 'error',
        }),
      },
    ],
    isError: true,
  };
});

// 启动服务器
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // 日志输出到 stderr，因为 stdout 用于 MCP 通信
  console.error('My Solution MCP Server started');
}

main().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});
```

### 6.4 工具输出格式 (重要)

**CCAAS EventMapper 期望的格式:**

```typescript
interface WriteOutputResult {
  data: {
    field: string;      // 字段名
    value: unknown;     // 字段值
    preview: string;    // 预览文本
    error?: string;     // 错误信息 (仅错误时)
  };
  status: 'success' | 'error';
}
```

**EventMapper 如何处理:**

```typescript
// packages/backend/src/chat/event-mapper.service.ts

case 'write_output':
  events.push({
    type: 'output_update',
    sessionId,
    clientId,
    payload: {
      data: parsedResult.data || parsedResult,
      status: (parsedResult.status as string) || 'unknown',
      progress: parsedResult.progress as number | undefined,
      timestamp,
    },
  });
  break;
```

### 6.5 添加更多工具

您可以在同一个 MCP Server 中添加多个工具：

```typescript
// 定义另一个工具
const searchDocsTool: Tool = {
  name: 'search_docs',
  description: '搜索文档库',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '搜索关键词',
      },
      limit: {
        type: 'number',
        description: '返回结果数量',
        default: 10,
      },
    },
    required: ['query'],
  },
};

// 在 ListToolsRequestSchema handler 中返回所有工具
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [writeOutputTool, searchDocsTool],
  };
});

// 在 CallToolRequestSchema handler 中处理所有工具
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'write_output':
      // ... 处理 write_output
      break;
    case 'search_docs':
      // ... 处理 search_docs
      break;
    default:
      return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
  }
});
```

---

## 7. Skill 编写指南

Skill 定义了 Claude 在特定场景下的行为模式、知识和工具使用方式。

### 7.1 SKILL.md 格式

SKILL.md 使用 Markdown 格式，支持 frontmatter 元数据：

```markdown
---
name: my-skill
description: 我的技能描述
---

# 技能名称

## 何时使用

当你需要：
- 场景 1
- 场景 2
- 场景 3

## 核心知识

### 概念 1

[详细说明...]

### 概念 2

[详细说明...]

## 使用方式

1. **步骤 1**: 描述第一步
2. **步骤 2**: 描述第二步
3. **步骤 3**: 描述第三步

## 输出格式

使用 write_output 工具输出结构化数据：

\`\`\`json
{
  "field": "fieldName",
  "value": { /* 结构化数据 */ },
  "preview": "人类可读的摘要"
}
\`\`\`
```

### 7.2 Frontmatter 配置

```yaml
---
name: lesson-plan-polish        # Skill 唯一标识符
description: 教案优化专家       # Skill 描述
---
```

### 7.3 Skill 内容编写最佳实践

#### 1. 明确角色定位

```markdown
# 教案优化专家

你是一位基于崔允漷教授课程与教学论的教案优化专家。
你的职责是帮助教师优化教案，使其符合现代教学设计理论。
```

#### 2. 提供结构化知识

```markdown
## 理论框架

### 1. 逆向设计三阶段

| 阶段 | 内容 |
|------|------|
| 阶段一 | 确定预期结果 |
| 阶段二 | 确定合适的评估证据 |
| 阶段三 | 设计学习体验和教学 |

### 2. ABCD 目标表述法

- **A** - Audience: 行为主体（学生）
- **B** - Behavior: 可观察的行为动词
- **C** - Condition: 行为条件
- **D** - Degree: 达成程度
```

#### 3. 提供工作流程

```markdown
## 教案优化流程

### 第一步：诊断原教案

检查以下问题：

**目标层面：**
- [ ] 学习目标是否使用了可观察的行为动词？
- [ ] 目标表述是否符合ABCD规范？
- [ ] 目标是否指向学科核心素养？

### 第二步：重构学习目标

将原目标改写为规范表述...

### 第三步：设计评价任务

使用 GRASPS 框架设计表现性评价...
```

#### 4. 指导工具使用

```markdown
## 输出方式

使用 `write_output` 工具将结果写入表单：

**输出教学目标示例：**
\`\`\`json
{
  "field": "objectives",
  "value": [
    {
      "id": "obj-1",
      "description": "学生能够借助注释，准确说出三个重要人生阶段",
      "bloomLevel": "remember",
      "assessmentCriteria": "能够列举至少3个阶段"
    }
  ],
  "preview": "1个教学目标"
}
\`\`\`

**输出教学活动示例：**
\`\`\`json
{
  "field": "activities",
  "value": [
    {
      "id": "act-1",
      "title": "导入环节",
      "description": "通过问题导入，激发学生兴趣",
      "duration": 5,
      "type": "introduction",
      "instructions": ["提出问题", "学生思考", "分享答案"]
    }
  ],
  "preview": "1个教学活动"
}
\`\`\`
```

#### 5. 提供示例对话

```markdown
## 示例对话

\`\`\`
用户：请帮我优化这份《静夜思》的教案：[粘贴原教案]

AI：我来用崔允漷教授的理论框架帮你优化这份教案。

【诊断结果】
✓ 优点：教学环节完整，有朗读环节
✗ 问题1：学习目标使用了"了解、体会"等模糊动词
✗ 问题2：缺少明确的评价任务设计

【优化方案】
1. 目标重写：...

[使用 write_output 工具输出优化后的目标]
\`\`\`
```

### 7.4 Trigger 配置详解

在 `solution.json` 中配置触发器：

```json
{
  "skill": {
    "triggers": [
      { "type": "keyword", "value": "备课", "priority": 10 },
      { "type": "keyword", "value": "教学目标", "priority": 8 },
      { "type": "pattern", "value": "/设计.*教案/", "priority": 9 },
      { "type": "intent", "value": "create_lesson_plan", "priority": 7 },
      { "type": "context", "value": "lesson_plan_form", "priority": 5 }
    ]
  }
}
```

**触发器类型说明:**

| 类型 | 匹配方式 | 示例 |
|------|---------|------|
| `keyword` | 精确包含关键词 | 消息包含 "备课" |
| `pattern` | 正则表达式匹配 | 消息匹配 `/设计.*教案/` |
| `intent` | 意图识别 (需 NLU) | 用户意图为创建教案 |
| `context` | 上下文匹配 | 当前在教案表单页面 |

**priority 优先级:**
- 值越高，优先级越高
- 多个 Skill 匹配时，选择最高优先级的
- 建议范围：1-10

---

## 8. 前端集成

### 8.1 Socket.io 客户端配置

**安装依赖:**

```bash
npm install socket.io-client
```

**创建 Socket Hook:**

```typescript
// src/hooks/useSocket.ts

import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3002'

export interface UseSocketReturn {
  isConnected: boolean
  sendMessage: (message: string, sessionId: string, context?: unknown) => void
  cancelRequest: (sessionId: string) => void
}

export interface SocketEvents {
  onTextDelta?: (content: string) => void
  onOutputUpdate?: (data: { field: string; value: unknown; preview: string }) => void
  onAgentStatus?: (status: 'running' | 'complete' | 'error', error?: string) => void
  onToolActivity?: (data: unknown) => void
}

export function useSocket(
  tenantId: string,
  events: SocketEvents
): UseSocketReturn {
  const socketRef = useRef<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    // 创建 Socket 连接
    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })

    socketRef.current = socket

    // 连接事件
    socket.on('connect', () => {
      console.log('Socket connected:', socket.id)
      setIsConnected(true)
    })

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason)
      setIsConnected(false)
    })

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error)
    })

    // 业务事件
    socket.on('text_delta', (data: { content: string }) => {
      events.onTextDelta?.(data.content)
    })

    socket.on('output_update', (data: { field: string; value: unknown; preview: string }) => {
      events.onOutputUpdate?.(data)
    })

    socket.on('agent_status', (data: { status: string; error?: string }) => {
      events.onAgentStatus?.(
        data.status as 'running' | 'complete' | 'error',
        data.error
      )
    })

    socket.on('tool_activity', (data: unknown) => {
      events.onToolActivity?.(data)
    })

    // 清理
    return () => {
      socket.disconnect()
    }
  }, [tenantId]) // tenantId 改变时重新连接

  // 发送消息
  const sendMessage = useCallback(
    (message: string, sessionId: string, context?: unknown) => {
      if (!socketRef.current?.connected) {
        console.error('Socket not connected')
        return
      }

      socketRef.current.emit('chat', {
        message,
        sessionId,
        tenantId,
        context,
      })
    },
    [tenantId]
  )

  // 取消请求
  const cancelRequest = useCallback((sessionId: string) => {
    if (!socketRef.current?.connected) {
      return
    }

    socketRef.current.emit('cancel', { sessionId })
  }, [])

  return {
    isConnected,
    sendMessage,
    cancelRequest,
  }
}
```

### 8.2 处理 output_update (同步按钮)

```typescript
// src/hooks/useSyncManager.ts

import { useState, useCallback } from 'react'

export interface PendingUpdate {
  field: string
  value: unknown
  preview: string
  timestamp: number
}

export function useSyncManager() {
  const [pendingUpdates, setPendingUpdates] = useState<Map<string, PendingUpdate>>(new Map())

  // 添加待同步的更新
  const addPendingUpdate = useCallback((update: {
    field: string
    value: unknown
    preview: string
  }) => {
    setPendingUpdates(prev => {
      const next = new Map(prev)
      next.set(update.field, {
        ...update,
        timestamp: Date.now(),
      })
      return next
    })
  }, [])

  // 同步到表单
  const syncToForm = useCallback(<T extends Record<string, unknown>>(
    field: string,
    currentData: T,
    setData: (data: T) => void
  ) => {
    const update = pendingUpdates.get(field)
    if (!update) return

    // 更新数据
    setData({
      ...currentData,
      [field]: update.value,
    })

    // 移除待同步项
    setPendingUpdates(prev => {
      const next = new Map(prev)
      next.delete(field)
      return next
    })
  }, [pendingUpdates])

  // 丢弃更新
  const discardUpdate = useCallback((field: string) => {
    setPendingUpdates(prev => {
      const next = new Map(prev)
      next.delete(field)
      return next
    })
  }, [])

  // 清空所有待同步
  const clearAllPending = useCallback(() => {
    setPendingUpdates(new Map())
  }, [])

  return {
    pendingUpdates,
    addPendingUpdate,
    syncToForm,
    discardUpdate,
    clearAllPending,
  }
}
```

### 8.3 同步按钮组件

```tsx
// src/components/SyncButton.tsx

import React from 'react'

interface SyncButtonProps {
  field: string
  preview: string
  onSync: () => void
  onDiscard: () => void
}

export function SyncButton({ field, preview, onSync, onDiscard }: SyncButtonProps) {
  return (
    <div className="sync-button-container">
      <div className="sync-info">
        <span className="sync-field">{field}</span>
        <span className="sync-preview">{preview}</span>
      </div>
      <div className="sync-actions">
        <button
          className="sync-btn sync-btn-primary"
          onClick={onSync}
        >
          同步到表单
        </button>
        <button
          className="sync-btn sync-btn-secondary"
          onClick={onDiscard}
        >
          丢弃
        </button>
      </div>
    </div>
  )
}
```

### 8.4 处理 text_delta (流式文本)

```typescript
// src/hooks/useStreamingText.ts

import { useState, useCallback, useRef } from 'react'

export function useStreamingText() {
  const [text, setText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const textRef = useRef('')

  // 开始流式输出
  const startStream = useCallback(() => {
    setText('')
    textRef.current = ''
    setIsStreaming(true)
  }, [])

  // 添加文本片段
  const appendText = useCallback((delta: string) => {
    textRef.current += delta
    setText(textRef.current)
  }, [])

  // 结束流式输出
  const endStream = useCallback(() => {
    setIsStreaming(false)
  }, [])

  // 重置
  const reset = useCallback(() => {
    setText('')
    textRef.current = ''
    setIsStreaming(false)
  }, [])

  return {
    text,
    isStreaming,
    startStream,
    appendText,
    endStream,
    reset,
  }
}
```

### 8.5 完整聊天组件示例

```tsx
// src/components/Chat.tsx

import React, { useState, useCallback, useEffect } from 'react'
import { useSocket } from '../hooks/useSocket'
import { useSyncManager } from '../hooks/useSyncManager'
import { useStreamingText } from '../hooks/useStreamingText'
import { SyncButton } from './SyncButton'
import { v4 as uuidv4 } from 'uuid'

interface ChatProps {
  tenantId: string
  formData: Record<string, unknown>
  setFormData: (data: Record<string, unknown>) => void
}

export function Chat({ tenantId, formData, setFormData }: ChatProps) {
  const [sessionId] = useState(() => uuidv4())
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([])

  const { text, isStreaming, startStream, appendText, endStream, reset } = useStreamingText()
  const { pendingUpdates, addPendingUpdate, syncToForm, discardUpdate } = useSyncManager()

  // Socket 事件处理
  const { isConnected, sendMessage, cancelRequest } = useSocket(tenantId, {
    onTextDelta: (content) => {
      appendText(content)
    },
    onOutputUpdate: (data) => {
      addPendingUpdate(data)
    },
    onAgentStatus: (status, error) => {
      if (status === 'running') {
        setIsLoading(true)
        startStream()
      } else if (status === 'complete') {
        setIsLoading(false)
        endStream()
        // 保存助手消息
        if (text) {
          setMessages(prev => [...prev, { role: 'assistant', content: text }])
        }
        reset()
      } else if (status === 'error') {
        setIsLoading(false)
        endStream()
        console.error('Agent error:', error)
      }
    },
  })

  // 发送消息
  const handleSend = useCallback(() => {
    if (!input.trim() || !isConnected || isLoading) return

    // 添加用户消息
    setMessages(prev => [...prev, { role: 'user', content: input }])

    // 发送到后端
    sendMessage(input, sessionId, {
      currentForm: formData,
    })

    setInput('')
  }, [input, isConnected, isLoading, sendMessage, sessionId, formData])

  // 取消
  const handleCancel = useCallback(() => {
    cancelRequest(sessionId)
    setIsLoading(false)
    endStream()
  }, [cancelRequest, sessionId, endStream])

  return (
    <div className="chat-container">
      {/* 消息列表 */}
      <div className="messages">
        {messages.map((msg, i) => (
          <div key={i} className={`message message-${msg.role}`}>
            {msg.content}
          </div>
        ))}

        {/* 流式输出 */}
        {isStreaming && text && (
          <div className="message message-assistant streaming">
            {text}
          </div>
        )}
      </div>

      {/* 同步按钮列表 */}
      <div className="sync-buttons">
        {Array.from(pendingUpdates.entries()).map(([field, update]) => (
          <SyncButton
            key={field}
            field={field}
            preview={update.preview}
            onSync={() => syncToForm(field, formData, setFormData)}
            onDiscard={() => discardUpdate(field)}
          />
        ))}
      </div>

      {/* 输入框 */}
      <div className="input-area">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="输入消息..."
          disabled={!isConnected || isLoading}
        />
        {isLoading ? (
          <button onClick={handleCancel}>取消</button>
        ) : (
          <button onClick={handleSend} disabled={!isConnected}>
            发送
          </button>
        )}
      </div>

      {/* 连接状态 */}
      <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
        {isConnected ? '已连接' : '未连接'}
      </div>
    </div>
  )
}
```

### 8.6 状态管理模式

对于复杂应用，建议使用状态管理库：

**使用 Zustand:**

```typescript
// src/store/chatStore.ts

import { create } from 'zustand'

interface PendingUpdate {
  field: string
  value: unknown
  preview: string
}

interface ChatState {
  // 状态
  sessionId: string
  isConnected: boolean
  isLoading: boolean
  messages: Array<{ role: string; content: string }>
  streamingText: string
  pendingUpdates: Map<string, PendingUpdate>

  // Actions
  setConnected: (connected: boolean) => void
  setLoading: (loading: boolean) => void
  addMessage: (message: { role: string; content: string }) => void
  appendStreamingText: (text: string) => void
  resetStreamingText: () => void
  addPendingUpdate: (update: PendingUpdate) => void
  removePendingUpdate: (field: string) => void
  clearPendingUpdates: () => void
}

export const useChatStore = create<ChatState>((set) => ({
  sessionId: crypto.randomUUID(),
  isConnected: false,
  isLoading: false,
  messages: [],
  streamingText: '',
  pendingUpdates: new Map(),

  setConnected: (connected) => set({ isConnected: connected }),
  setLoading: (loading) => set({ isLoading: loading }),

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  appendStreamingText: (text) =>
    set((state) => ({ streamingText: state.streamingText + text })),

  resetStreamingText: () => set({ streamingText: '' }),

  addPendingUpdate: (update) =>
    set((state) => {
      const next = new Map(state.pendingUpdates)
      next.set(update.field, update)
      return { pendingUpdates: next }
    }),

  removePendingUpdate: (field) =>
    set((state) => {
      const next = new Map(state.pendingUpdates)
      next.delete(field)
      return { pendingUpdates: next }
    }),

  clearPendingUpdates: () => set({ pendingUpdates: new Map() }),
}))
```

---

## 9. API 参考

### 9.1 REST API 端点

#### 健康检查

```
GET /api/v1/chat/health
```

**响应:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### 会话统计

```
GET /api/v1/chat/status
```

**响应:**
```json
{
  "totalSessions": 10,
  "idleSessions": 8,
  "processingSessions": 2,
  "maxSessions": 100
}
```

#### Skills API

```
GET    /api/v1/skills                 # 列出所有技能
POST   /api/v1/skills                 # 创建技能
GET    /api/v1/skills/:id             # 获取技能详情
PUT    /api/v1/skills/:id             # 更新技能
DELETE /api/v1/skills/:id             # 删除技能
POST   /api/v1/skills/:id/publish     # 发布技能
POST   /api/v1/skills/:id/unpublish   # 取消发布
```

#### Tenants API

```
GET    /api/v1/tenants                # 列出租户
POST   /api/v1/tenants                # 创建租户
GET    /api/v1/tenants/:id            # 获取租户
PUT    /api/v1/tenants/:id            # 更新租户
```

#### API Keys

```
GET    /api/v1/tenants/:tenantId/api-keys    # 列出 API Keys
POST   /api/v1/tenants/:tenantId/api-keys    # 创建 API Key
DELETE /api/v1/api-keys/:id                   # 删除 API Key
```

### 9.2 WebSocket 事件格式

#### 客户端发送的事件

**chat - 发送消息**

```typescript
socket.emit('chat', {
  message: string,          // 用户消息
  sessionId: string,        // 会话 ID
  tenantId: string,         // 租户 ID
  skillSlug?: string,       // 指定技能 (可选)
  context?: string,         // JSON 序列化的上下文 (可选)
  mcpServers?: {            // MCP 服务器配置 (可选)
    [name: string]: {
      command: string,
      args: string[],
    }
  },
})
```

**cancel - 取消操作**

```typescript
socket.emit('cancel', {
  sessionId: string,
})
```

**reconnect_session - 重连会话**

```typescript
socket.emit('reconnect_session', {
  sessionId: string,
})
```

#### 服务端发送的事件

**client_id - 客户端标识**

```typescript
socket.on('client_id', (data: {
  clientId: string,
}) => {})
```

**text_delta - 文本流**

```typescript
socket.on('text_delta', (data: {
  text: string,           // 文本片段
  sessionId?: string,
  timestamp?: string,
}) => {})
```

**output_update - 输出更新**

```typescript
socket.on('output_update', (data: {
  payload: {
    data: {
      field: string,      // 字段名
      value: unknown,     // 字段值
      preview: string,    // 预览文本
    },
    status: string,       // 'success' | 'error'
    progress?: number,
    timestamp: string,
  },
}) => {})
```

**agent_status - Agent 状态**

```typescript
socket.on('agent_status', (data: {
  status: 'idle' | 'running' | 'complete' | 'error',
  sessionId?: string,
  error?: string,
  exitCode?: number,
}) => {})
```

**tool_activity - 工具活动**

```typescript
socket.on('tool_activity', (data: {
  payload: {
    toolName: string,
    toolId: string,
    phase: 'start' | 'end',
    description: string,
    success?: boolean,
    duration?: number,
    toolInput?: unknown,
    toolOutput?: unknown,
    toolError?: string,
    timestamp: string,
  },
}) => {})
```

**token_usage - Token 使用**

```typescript
socket.on('token_usage', (data: {
  payload: {
    inputTokens: number,
    outputTokens: number,
    cachedInputTokens?: number,
    sessionTotalTokens: number,
    model: string,
    timestamp: string,
  },
}) => {})
```

**agent_thinking - 思考过程**

```typescript
socket.on('agent_thinking', (data: {
  payload: {
    phase: 'start' | 'delta' | 'end',
    content?: string,
    thinkingId: string,
  },
}) => {})
```

### 9.3 类型定义

完整的 TypeScript 类型定义请参考 `@ccaas/shared` 包：

```typescript
import {
  // 会话相关
  Session,
  SessionStatus,
  SessionSummary,

  // 消息相关
  Message,
  MessageRole,
  ToolCall,
  ThinkingBlock,
  TokenUsage,

  // 技能相关
  Skill,
  SkillType,
  SkillStatus,
  SkillTrigger,

  // 事件相关
  TextDeltaEvent,
  OutputUpdateEvent,
  AgentStatusEvent,
  ToolActivityEvent,
  TokenUsageEvent,
  AgentThinkingEvent,
} from '@ccaas/shared'
```

---

## 10. 最佳实践

### 10.1 Session 隔离

- 每个前端连接对应独立的 CCAAS 连接
- Session ID 添加解决方案前缀避免冲突
- 断开连接时及时清理 CCAAS 连接

```typescript
// 添加前缀
const ccaasSessionId = `${solutionSlug}_${sessionId}`

// 清理连接
frontendSocket.on('disconnect', () => {
  const ccaas = ccaasConnections.get(frontendSocket.id)
  if (ccaas) {
    ccaas.disconnect()
    ccaasConnections.delete(frontendSocket.id)
  }
})
```

### 10.2 错误处理

```typescript
// 中继层错误处理
ccaasSocket.on('error', (data: { message: string }) => {
  console.error('CCAAS error:', data.message)
  frontendSocket.emit('agent_status', {
    status: 'error',
    error: data.message,
  })
})

ccaasSocket.on('connect_error', (error: Error) => {
  console.error('CCAAS connection error:', error.message)
  frontendSocket.emit('agent_status', {
    status: 'error',
    error: 'CCAAS 连接失败，请稍后重试',
  })
})
```

### 10.3 MCP Server 日志

MCP Server 的 stdout 用于协议通信，日志必须输出到 stderr：

```typescript
// 正确 - 使用 console.error
console.error('MCP Server started')
console.error('Processing request:', request)

// 错误 - 不要使用 console.log
// console.log('This will break MCP protocol!')
```

### 10.4 write_output 返回格式

确保返回格式严格匹配 EventMapper 期望：

```typescript
// 正确格式
const result = {
  data: {
    field: 'objectives',
    value: [...],
    preview: '3个教学目标',
  },
  status: 'success',
}

// 错误格式 - 缺少 data 包装
const wrong = {
  field: 'objectives',  // ❌ 应该在 data 内
  value: [...],
  status: 'success',
}
```

### 10.5 Skill 设计原则

1. **单一职责**: 每个 Skill 专注一个场景
2. **明确触发**: 使用精确的关键词和合适的优先级
3. **结构化输出**: 指导 Claude 使用 write_output 输出结构化数据
4. **提供示例**: 在 Skill 中提供输入输出示例
5. **错误处理**: 告诉 Claude 如何处理异常情况

### 10.6 性能优化

```typescript
// 1. 使用 WebSocket 而不是轮询
const socket = io(url, {
  transports: ['websocket'],  // 优先使用 WebSocket
})

// 2. 合理的重连策略
const socket = io(url, {
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
})

// 3. 使用 ref 避免不必要的重渲染
const textRef = useRef('')
const appendText = useCallback((delta: string) => {
  textRef.current += delta
  // 批量更新 UI
  requestAnimationFrame(() => {
    setText(textRef.current)
  })
}, [])
```

---

## 11. 故障排查

### 11.1 常见问题

#### MCP Server 无法启动

**症状**: Claude 无法使用自定义工具

**检查项**:
1. MCP Server 是否编译成功 (`npm run build`)
2. `solution.json` 中路径是否正确
3. 查看 CCAAS 后端日志中的 MCP 错误

```bash
# 手动测试 MCP Server
node mcp-server/dist/index.js
# 应该看到 "MCP Server started" (在 stderr)
```

#### output_update 事件未触发

**症状**: Claude 调用了 write_output 但前端没有同步按钮

**检查项**:
1. write_output 返回格式是否正确
2. Solution 后端是否正确解析 payload
3. 使用 `ccaasSocket.onAny()` 调试所有事件

```typescript
// 调试所有 CCAAS 事件
ccaasSocket.onAny((eventName, ...args) => {
  console.log('CCAAS event:', eventName, args)
})
```

#### 连接断开

**症状**: Socket 频繁断开重连

**检查项**:
1. 网络连接是否稳定
2. 服务器是否有超时配置
3. 检查 CORS 配置

```typescript
// 增加 ping 超时
const socket = io(url, {
  pingTimeout: 60000,
  pingInterval: 25000,
})
```

### 11.2 调试技巧

#### 1. 启用详细日志

```typescript
// Solution 后端
ccaasSocket.onAny((eventName, ...args) => {
  console.log(`[CCAAS] ${eventName}:`, JSON.stringify(args).substring(0, 200))
})

// 前端
socket.onAny((eventName, ...args) => {
  console.log(`[Socket] ${eventName}:`, args)
})
```

#### 2. 检查 CCAAS 后端日志

```bash
# 启动 CCAAS 后端 (开发模式)
cd packages/backend
DEBUG=true npm run start:dev
```

#### 3. 测试 MCP Server

```bash
# 使用 echo 测试 MCP 协议
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node mcp-server/dist/index.js
```

#### 4. 检查 Claude Code CLI

```bash
# 直接运行 CLI 测试
npx @anthropic-ai/claude-code \
  --output-format stream-json \
  --mcp-config '{"mcpServers":{"test":{"command":"node","args":["/path/to/mcp-server/dist/index.js"]}}}' \
  "测试消息"
```

### 11.3 日志位置

| 组件 | 日志位置 |
|------|---------|
| CCAAS Backend | 终端 stdout |
| Solution Backend | 终端 stdout |
| MCP Server | stderr (stdout 用于协议) |
| Claude Code CLI | 通过 CCAAS 的 stream-json 输出 |
| Frontend | 浏览器 Console |

---

## 附录

### A. 参考项目

- [lesson-plan-designer](../solutions/lesson-plan-designer/) - 完整示例
- [@ccaas/backend](../packages/backend/) - CCAAS 后端
- [@ccaas/shared](../packages/shared/) - 共享类型

### B. 相关文档

- [CCAAS Backend CLAUDE.md](../packages/backend/CLAUDE.md)
- [MCP Protocol](https://modelcontextprotocol.io/)
- [Claude Code CLI](https://docs.anthropic.com/claude-code)
- [Socket.io](https://socket.io/docs/v4/)

### C. 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0.0 | 2024-01-xx | 初始版本 |

---

*本文档基于 lesson-plan-designer 示例项目编写，如有疑问请参考该项目的具体实现。*
