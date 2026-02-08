# 创建 Solution - 完整指南

本指南将引导你从头开始在 CCAAS 平台上创建一个新的 solution。

---

## 目录

1. [什么是 Solution？](#什么是-solution)
2. [前提条件](#前提条件)
3. [Solution 结构](#solution-结构)
4. [分步教程](#分步教程)
5. [配置文件](#配置文件)
6. [租户设置](#租户设置)
7. [MCP Server 集成](#mcp-server-集成)
8. [Skill 集成](#skill-集成)
9. [前端开发](#前端开发)
10. [测试你的 Solution](#测试你的-solution)
11. [部署清单](#部署清单)
12. [示例](#示例)

---

## 什么是 Solution？

**Solution** 是构建在 CCAAS 平台上的完整应用程序，它：

- 拥有自己的 **租户**（带有 API 配额的隔离工作空间）
- 可以包含 **自定义后端**（NestJS、Express 或任何 Node.js 服务器）
- 可以包含 **自定义前端**（React、Vue 或任何 Web 框架）
- 可以注册 **MCP 服务器**（Model Context Protocol 工具）以提供 AI 能力
- 可以注册 **技能**（专门的提示和工作流）
- 连接到 **CCAAS 后端**（端口 3001）进行 AI 智能体编排

**平台上下文**：用户通过平台界面与 solutions 交互。他们不需要自己安装或配置 AgentEngine - CCAAS 管理所有 AgentEngine 基础设施。

---

## 前提条件

### 所需知识

- JavaScript/TypeScript
- Node.js 和 npm
- REST APIs 基础知识
- Git 版本控制

### 所需软件

- **Node.js** 18+（带 npm）
- **SQLite**（用于开发数据库）
- **Git**
- 代码编辑器（推荐 VS Code）

### CCAAS 平台设置

在创建 solution 之前，确保 CCAAS 后端正在运行：

```bash
cd packages/backend
npm install
npm run start:dev  # 运行在端口 3001
```

验证它正在运行：
```bash
curl http://localhost:3001/api/v1/chat/health
# 应该返回：{"status":"ok"}
```

---

## Solution 结构

### 推荐的目录布局

```
solutions/
└── my-solution/
    ├── solution.json          # Solution 配置（必需）
    ├── setup.sh               # 一次性设置脚本
    ├── start-dev.sh           # 开发启动脚本
    ├── README.md              # Solution 文档
    │
    ├── backend/               # 自定义后端（可选）
    │   ├── package.json
    │   ├── src/
    │   └── data/             # SQLite 数据库
    │
    ├── frontend/              # 自定义前端（可选）
    │   ├── package.json
    │   ├── src/
    │   └── vite.config.ts    # 或 webpack、next.config.js
    │
    ├── mcp-server/            # MCP 工具（可选）
    │   ├── package.json
    │   └── src/
    │       ├── index.ts      # MCP 服务器入口点
    │       └── tools/        # 工具实现
    │
    └── skills/                # Skill 定义（可选）
        ├── analyze.skill.json
        └── summarize.skill.json
```

### 最少必需文件

对于最小的 solution，你只需要：

1. **`solution.json`** - Solution 元数据和配置
2. **`setup.sh`** - 创建租户的设置脚本
3. **前端或后端** - 至少一个用户界面

---

## 分步教程

### 步骤 1：创建 Solution 目录

```bash
cd solutions
mkdir my-solution
cd my-solution
```

### 步骤 2：创建 solution.json

这是**最重要的文件**。它将你的 solution 注册到 CCAAS。

```json
{
  "id": "my-solution",
  "name": "My Solution",
  "version": "1.0.0",
  "description": "这个 solution 功能的简短描述",
  "author": "Your Name",
  "license": "MIT",

  "tenant": {
    "slug": "my-solution",
    "name": "My Solution",
    "description": "[用例] 的 AI 驱动解决方案",
    "maxSessions": 100,
    "maxSkills": 50,
    "maxMcpServers": 10
  },

  "ports": {
    "backend": 3010,
    "frontend": 5280
  },

  "mcpServers": {},
  "skills": [],
  "dependencies": []
}
```

**关键字段：**

- **`id`**：唯一标识符（kebab-case，无空格）
- **`tenant.slug`**：必须与你将创建的租户 slug 匹配（通常与 `id` 相同）
- **`ports`**：选择唯一端口（避免 3001 = CCAAS，3005 = quiz-analyzer 等）

### 步骤 3：创建 setup.sh

此脚本处理**一次性设置**，包括租户创建。

```bash
#!/bin/bash

set -e  # 遇到错误退出

echo "=========================================="
echo "My Solution Setup"
echo "=========================================="

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# 步骤 1：在 CCAAS 后端创建租户
echo ""
echo "步骤 1：设置 CCAAS 租户..."
CCAAS_DB="$SCRIPT_DIR/../../packages/backend/.agent-workspace/data.db"

if [ ! -f "$CCAAS_DB" ]; then
    echo -e "${RED}✗ 未找到 CCAAS 数据库${NC}"
    echo "请先运行 CCAAS 后端："
    echo "  cd packages/backend && npm run start:dev"
    exit 1
fi

# 检查租户是否存在
TENANT_EXISTS=$(sqlite3 "$CCAAS_DB" "SELECT COUNT(*) FROM tenants WHERE slug = 'my-solution';" 2>/dev/null || echo "0")

if [ "$TENANT_EXISTS" = "0" ]; then
    echo "正在创建 my-solution 租户..."
    sqlite3 "$CCAAS_DB" "
    INSERT INTO tenants (id, name, slug, description, config, maxSessions, maxSkills, maxMcpServers, plan, apiKey, status, createdAt, updatedAt)
    VALUES (
        lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(6))),
        'My Solution',
        'my-solution',
        '[用例] 的 AI 驱动解决方案',
        '{}',
        100,
        50,
        10,
        'free',
        'sk_' || lower(hex(randomblob(24))),
        'active',
        datetime('now'),
        datetime('now')
    );
    "
    echo -e "${GREEN}✓ 租户已创建（slug: my-solution）${NC}"
else
    echo -e "${GREEN}✓ 租户已存在${NC}"
fi

# 步骤 2：安装依赖
echo ""
echo "步骤 2：正在安装依赖..."

if [ -d "backend" ]; then
    cd backend
    npm install
    cd ..
    echo -e "${GREEN}✓ 后端依赖已安装${NC}"
fi

if [ -d "frontend" ]; then
    cd frontend
    npm install
    cd ..
    echo -e "${GREEN}✓ 前端依赖已安装${NC}"
fi

echo ""
echo -e "${GREEN}=========================================="
echo "✅ 设置完成！"
echo "==========================================${NC}"
echo ""
echo "下一步："
echo "  1. 运行：bash start-dev.sh"
echo "  2. 打开：http://localhost:5280"
```

**使其可执行：**
```bash
chmod +x setup.sh
```

### 步骤 4：创建 start-dev.sh

此脚本在开发模式下启动你的服务。

```bash
#!/bin/bash

set -e

echo "🚀 正在启动 My Solution..."

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# 清理函数
cleanup() {
    echo ""
    echo "🛑 正在停止服务..."
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    lsof -ti:3010 | xargs kill -9 2>/dev/null || true
    lsof -ti:5280 | xargs kill -9 2>/dev/null || true
    echo "✅ 服务已停止"
    exit 0
}

trap cleanup SIGINT SIGTERM

# 如果端口被占用则清除
lsof -ti:3010 | xargs kill -9 2>/dev/null || true
lsof -ti:5280 | xargs kill -9 2>/dev/null || true

mkdir -p logs

# 启动后端
if [ -d "backend" ]; then
    echo "🔧 正在启动后端（端口 3010）..."
    cd backend
    npm run start:dev > ../logs/backend.log 2>&1 &
    BACKEND_PID=$!
    cd ..

    # 等待后端
    for i in {1..10}; do
        if lsof -Pi :3010 -sTCP:LISTEN -t >/dev/null 2>&1; then
            echo "✅ 后端已启动"
            break
        fi
        sleep 1
    done
fi

# 启动前端
if [ -d "frontend" ]; then
    echo "🎨 正在启动前端（端口 5280）..."
    cd frontend
    npm run dev > ../logs/frontend.log 2>&1 &
    FRONTEND_PID=$!
    cd ..

    # 等待前端
    for i in {1..10}; do
        if lsof -Pi :5280 -sTCP:LISTEN -t >/dev/null 2>&1; then
            echo "✅ 前端已启动"
            break
        fi
        sleep 1
    done
fi

echo ""
echo "✅ 所有服务正在运行！"
echo ""
echo "📍 URLs:"
echo "   前端：http://localhost:5280"
echo "   后端：http://localhost:3010"
echo ""
echo "按 Ctrl+C 停止"

wait
```

**使其可执行：**
```bash
chmod +x start-dev.sh
```

### 步骤 5：创建前端（React + Vite 示例）

```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install @ccaas/react-sdk
```

**更新 `src/App.tsx`：**

```typescript
import { useAgentConnection, useAgentChat, ChatPanel } from '@ccaas/react-sdk'

const BACKEND_URL = 'http://localhost:3001'  // CCAAS 后端
const TENANT_ID = 'my-solution'              // 必须与 solution.json 匹配

function App() {
  const connection = useAgentConnection({
    serverUrl: BACKEND_URL,
    sessionPrefix: 'my',
  })

  const chat = useAgentChat({
    connection,
    tenantId: TENANT_ID,
  })

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <h1>My Solution</h1>
      <ChatPanel
        messages={chat.messages}
        isProcessing={chat.isProcessing}
        onSendMessage={chat.sendMessage}
        connected={connection.connected}
      />
    </div>
  )
}

export default App
```

**更新 `vite.config.ts`：**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5280,  // 必须与 solution.json 匹配
  },
})
```

### 步骤 6：运行设置

```bash
# 从 solution 根目录
bash setup.sh
```

**预期输出：**
```
==========================================
My Solution Setup
==========================================

步骤 1：设置 CCAAS 租户...
正在创建 my-solution 租户...
✓ 租户已创建（slug: my-solution）

步骤 2：正在安装依赖...
✓ 前端依赖已安装

==========================================
✅ 设置完成！
==========================================
```

### 步骤 7：启动开发环境

```bash
bash start-dev.sh
```

打开 http://localhost:5280 并测试！

---

## 配置文件

### solution.json 参考

```json
{
  "id": "my-solution",
  "name": "My Solution",
  "version": "1.0.0",
  "description": "Solution 描述",
  "author": "Your Name",
  "license": "MIT",

  "tenant": {
    "slug": "my-solution",           // 唯一租户标识符
    "name": "My Solution",
    "description": "描述",
    "maxSessions": 100,               // 最大并发会话数
    "maxSkills": 50,                  // 允许的最大技能数
    "maxMcpServers": 10               // 最大 MCP 服务器数
  },

  "ports": {
    "backend": 3010,                  // 自定义后端端口（可选）
    "frontend": 5280,                 // 前端开发服务器端口
    "mcp": 3011                       // MCP 服务器端口（可选）
  },

  "mcpServers": {
    "my-tools": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"],
      "env": {
        "DATABASE_PATH": "backend/data/my-solution.db"
      },
      "description": "我的 solution 的自定义 MCP 工具"
    }
  },

  "skills": [
    {
      "path": "skills/analyze.skill.json",
      "enabled": true
    }
  ],

  "dependencies": [
    "@ccaas/react-sdk",              // 前端 SDK
    "@ccaas/common"                   // 共享类型
  ]
}
```

---

## 租户设置

### 什么是租户？

**租户**是 CCAAS 中的隔离工作空间，提供：

- **配额管理**：最大会话数、技能数、MCP 服务器数
- **API Key 认证**：每个租户都有唯一的 API key
- **使用追踪**：监控 token 使用、延迟、错误
- **计费**（未来）：与付费计划关联

### 租户数据库架构

```sql
CREATE TABLE tenants (
  id           VARCHAR PRIMARY KEY,     -- UUID
  name         VARCHAR NOT NULL,        -- 显示名称
  slug         VARCHAR UNIQUE NOT NULL, -- URL 安全标识符（kebab-case）
  description  TEXT,
  config       TEXT DEFAULT '{}',       -- JSON 配置
  maxSessions  INTEGER DEFAULT 100,
  maxSkills    INTEGER DEFAULT 50,
  maxMcpServers INTEGER DEFAULT 10,
  plan         VARCHAR DEFAULT 'free',  -- free、pro、enterprise
  billingEmail VARCHAR,
  apiKey       VARCHAR,                  -- 自动生成（sk_...）
  status       VARCHAR DEFAULT 'active', -- active、suspended、deleted
  createdAt    DATETIME,
  updatedAt    DATETIME
);
```

### 编程方式创建租户

**在 setup.sh 中：**

```bash
CCAAS_DB="../../packages/backend/.agent-workspace/data.db"

sqlite3 "$CCAAS_DB" "
INSERT INTO tenants (id, name, slug, description, config, maxSessions, maxSkills, maxMcpServers, plan, apiKey, status, createdAt, updatedAt)
VALUES (
    lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(6))),
    'My Solution',
    'my-solution',
    '这里是描述',
    '{}',
    100,
    50,
    10,
    'free',
    'sk_' || lower(hex(randomblob(24))),
    'active',
    datetime('now'),
    datetime('now')
);
"
```

**通过 REST API**（未来）：

```bash
curl -X POST http://localhost:3001/api/v1/admin/tenants \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Solution",
    "slug": "my-solution",
    "description": "描述",
    "maxSessions": 100
  }'
```

### 检查租户是否存在

```bash
TENANT_EXISTS=$(sqlite3 "$CCAAS_DB" \
  "SELECT COUNT(*) FROM tenants WHERE slug = 'my-solution';" \
  2>/dev/null || echo "0")

if [ "$TENANT_EXISTS" = "0" ]; then
    echo "租户不存在，正在创建..."
else
    echo "租户已存在"
fi
```

---

## MCP Server 集成

### 什么是 MCP？

**Model Context Protocol (MCP)** 允许你创建 Claude 可以使用的自定义工具。这些工具可以：

- 读写数据库
- 调用外部 API
- 执行计算
- 访问文件

### 创建 MCP Server

**1. 创建 MCP server 目录：**

```bash
mkdir -p mcp-server/src
cd mcp-server
npm init -y
npm install @anthropic-ai/sdk zod
```

**2. 创建 `src/index.ts`：**

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const server = new Server({
  name: 'my-solution-tools',
  version: '1.0.0',
})

// 定义工具：get_weather
server.setRequestHandler('tools/list', async () => {
  return {
    tools: [
      {
        name: 'get_weather',
        description: '获取某个位置的当前天气',
        inputSchema: {
          type: 'object',
          properties: {
            location: {
              type: 'string',
              description: '城市名称',
            },
          },
          required: ['location'],
        },
      },
    ],
  }
})

// 实现工具
server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params

  if (name === 'get_weather') {
    const location = args.location as string
    // TODO: 调用天气 API
    return {
      content: [
        {
          type: 'text',
          text: `${location} 的天气：晴天，25°C`,
        },
      ],
    }
  }

  throw new Error(`未知工具：${name}`)
})

// 启动服务器
const transport = new StdioServerTransport()
server.connect(transport)
```

**3. 构建和测试：**

```bash
npm run build
node dist/index.js
```

**4. 在 solution.json 中注册：**

```json
{
  "mcpServers": {
    "my-tools": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"],
      "description": "天气工具"
    }
  }
}
```

---

## Skill 集成

### 什么是 Skill？

**Skill** 是专门的提示或工作流，指导 AI 智能体执行特定任务。

### 创建 Skill

**1. 创建 `skills/analyze.skill.json`：**

```json
{
  "id": "analyze-data",
  "name": "Data Analyzer",
  "description": "分析结构化数据并生成见解",
  "version": "1.0.0",
  "type": "prompt",

  "triggers": [
    {
      "type": "keyword",
      "value": "analyze this data",
      "priority": 10
    },
    {
      "type": "keyword",
      "value": "数据分析",
      "priority": 10
    }
  ],

  "prompt": "你是一名数据分析专家。当给定结构化数据（CSV、JSON、表格）时，你：\n\n1. 识别关键模式和趋势\n2. 计算相关统计数据\n3. 生成可操作的见解\n4. 使用图表可视化发现\n5. 提供建议\n\n使用可用的 MCP 工具来处理和可视化数据。",

  "tools": [
    "get_weather",
    "analyze_csv"
  ],

  "config": {
    "temperature": 0.7,
    "max_tokens": 2000
  }
}
```

**2. 在 solution.json 中注册：**

```json
{
  "skills": [
    {
      "path": "skills/analyze.skill.json",
      "enabled": true
    }
  ]
}
```

**3. 将技能同步到 CCAAS：**

```bash
# 在 setup.sh 中添加技能同步逻辑
# 或使用 CCAAS API：
curl -X POST http://localhost:3001/api/v1/skills \
  -H "Content-Type: application/json" \
  -d @skills/analyze.skill.json
```

---

## 前端开发

### 使用 @ccaas/react-sdk

**安装：**

```bash
npm install @ccaas/react-sdk
```

**基本设置：**

```typescript
import {
  useAgentConnection,
  useAgentChat,
  useAgentStatus,
  ChatPanel,
} from '@ccaas/react-sdk'

function App() {
  // 1. 建立 WebSocket 连接
  const connection = useAgentConnection({
    serverUrl: 'http://localhost:3001',
    sessionPrefix: 'my',
  })

  // 2. 初始化聊天
  const chat = useAgentChat({
    connection,
    tenantId: 'my-solution',  // 重要：必须与你的租户 slug 匹配
  })

  // 3. 跟踪智能体状态（thinking、tools、tokens）
  const status = useAgentStatus({ connection })

  return (
    <div>
      <h1>My Solution</h1>

      {/* 预构建的聊天 UI */}
      <ChatPanel
        messages={chat.messages}
        isProcessing={chat.isProcessing}
        onSendMessage={chat.sendMessage}
        connected={connection.connected}
        activeTools={status.activeTools}
        isThinking={status.isThinking}
        thinkingContent={status.thinkingContent}
      />

      {/* Token 使用显示 */}
      <div>
        Tokens: {status.tokenUsage.totalTokens} |
        成本：${status.tokenUsage.totalCost.toFixed(4)}
      </div>
    </div>
  )
}
```

### 自定义聊天 UI

```typescript
function CustomChat() {
  const connection = useAgentConnection({ ... })
  const chat = useAgentChat({ connection, tenantId: 'my-solution' })

  return (
    <div className="chat-container">
      <div className="messages">
        {chat.messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.role}`}>
            <strong>{msg.role}:</strong>
            <p>{msg.content}</p>
          </div>
        ))}
      </div>

      <form onSubmit={(e) => {
        e.preventDefault()
        const input = e.target.message.value
        chat.sendMessage(input)
        e.target.reset()
      }}>
        <input name="message" placeholder="输入消息..." />
        <button type="submit" disabled={chat.isProcessing}>
          发送
        </button>
      </form>
    </div>
  )
}
```

### 使用 @ccaas/common 类型

```typescript
import type { Session, Message, TokenUsage } from '@ccaas/common'

interface MyComponentProps {
  session: Session
  messages: Message[]
  usage: TokenUsage
}
```

---

## 测试你的 Solution

### 手动测试清单

- [ ] **租户创建**：验证租户存在于数据库中
- [ ] **WebSocket 连接**：检查浏览器控制台的连接成功信息
- [ ] **发送消息**：测试基本聊天功能
- [ ] **工具执行**：如果使用 MCP，验证工具被调用
- [ ] **Skill 激活**：测试技能触发器
- [ ] **错误处理**：使用无效输入测试
- [ ] **Token 追踪**：验证 token 使用更新

### 自动化测试

**前端（Vitest + React Testing Library）：**

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import App from './App'

describe('App', () => {
  it('渲染聊天界面', () => {
    render(<App />)
    expect(screen.getByPlaceholderText(/输入消息/i)).toBeInTheDocument()
  })

  it('发送消息', async () => {
    render(<App />)
    const input = screen.getByPlaceholderText(/输入消息/i)
    const button = screen.getByText(/发送/i)

    fireEvent.change(input, { target: { value: 'Hello' } })
    fireEvent.click(button)

    // 断言消息出现
    expect(await screen.findByText('Hello')).toBeInTheDocument()
  })
})
```

**后端（Jest）：**

```typescript
import request from 'supertest'
import { app } from './app'

describe('GET /health', () => {
  it('返回状态 ok', async () => {
    const response = await request(app).get('/health')
    expect(response.status).toBe(200)
    expect(response.body).toEqual({ status: 'ok' })
  })
})
```

### 集成测试

**测试 WebSocket 连接：**

```typescript
import { io } from 'socket.io-client'

const socket = io('http://localhost:3001')

socket.on('connect', () => {
  console.log('✅ 已连接到 CCAAS')
  socket.emit('chat', { message: 'Hello', tenantId: 'my-solution' })
})

socket.on('text_delta', (data) => {
  console.log('收到：', data.content)
})
```

---

## 部署清单

### 部署前

- [ ] 更新 `solution.json` 版本
- [ ] 编写部署文档
- [ ] 在干净环境中测试（推荐 Docker）
- [ ] 检查环境变量要求
- [ ] 验证所有依赖都在 `package.json` 中

### 数据库

- [ ] 创建数据库迁移脚本
- [ ] 在生产数据副本上测试迁移
- [ ] 记录回滚程序
- [ ] 设置自动备份

### 环境变量

**创建 `.env.example`：**

```bash
# CCAAS 连接
CCAAS_BACKEND_URL=http://localhost:3001
TENANT_ID=my-solution

# Solution 端口
BACKEND_PORT=3010
FRONTEND_PORT=5280

# 数据库
DATABASE_PATH=./data/my-solution.db

# API Keys（如果需要）
EXTERNAL_API_KEY=your-key-here
```

### 生产设置

**1. 使用特定于环境的配置：**

```typescript
const BACKEND_URL = process.env.VITE_CCAAS_BACKEND_URL || 'http://localhost:3001'
const TENANT_ID = process.env.VITE_TENANT_ID || 'my-solution'
```

**2. 为生产构建：**

```bash
# 前端
cd frontend
npm run build  # 创建 dist/

# 后端（如果使用 TypeScript）
cd backend
npm run build  # 创建 dist/
```

**3. 提供生产构建：**

```bash
# 前端（使用 nginx 或 serve）
npx serve -s frontend/dist -p 5280

# 后端
cd backend
NODE_ENV=production node dist/index.js
```

### Docker 部署（推荐）

**创建 `Dockerfile`：**

```dockerfile
FROM node:18-alpine

WORKDIR /app

# 复制 package 文件
COPY package*.json ./
COPY frontend/package*.json ./frontend/
COPY backend/package*.json ./backend/

# 安装依赖
RUN npm install
RUN cd frontend && npm install
RUN cd backend && npm install

# 复制源代码
COPY . .

# 构建
RUN cd frontend && npm run build
RUN cd backend && npm run build

# 暴露端口
EXPOSE 3010 5280

# 启动服务
CMD ["bash", "start-dev.sh"]
```

**创建 `docker-compose.yml`：**

```yaml
version: '3.8'

services:
  my-solution:
    build: .
    ports:
      - "3010:3010"
      - "5280:5280"
    environment:
      - CCAAS_BACKEND_URL=http://ccaas-backend:3001
      - TENANT_ID=my-solution
    depends_on:
      - ccaas-backend
    volumes:
      - ./data:/app/data

  ccaas-backend:
    image: ccaas/backend:latest
    ports:
      - "3001:3001"
    volumes:
      - ccaas-data:/app/.agent-workspace

volumes:
  ccaas-data:
```

---

## 示例

### 示例 1：简单聊天应用

**仅前端 + CCAAS 的最小 solution：**

```
my-chat/
├── solution.json
├── setup.sh
├── start-dev.sh
└── frontend/
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── App.tsx
        └── main.tsx
```

### 示例 2：数据分析工具

**带自定义后端、MCP 服务器和技能：**

```
data-analyzer/
├── solution.json
├── setup.sh
├── start-dev.sh
├── backend/          # 用于数据存储的 Express 服务器
├── frontend/         # React UI
├── mcp-server/       # 自定义分析工具
└── skills/
    ├── analyze.skill.json
    └── visualize.skill.json
```

### 示例 3：Quiz Analyzer（真实示例）

查看 `solutions/quiz-analyzer/` 获取完整的生产示例，包括：

- 自定义 NestJS 后端（端口 3005）
- React + Vite 前端（端口 5282）
- 带 5 个自定义工具的 MCP 服务器
- 包含 8 个表的 SQLite 数据库
- Excel 导入脚本
- 全面的设置和启动脚本

---

## 常见问题

### 问题："Tenant not found"（租户未找到）

**原因**：租户未在 CCAAS 数据库中创建

**修复**：在 `setup.sh` 中添加租户创建：

```bash
sqlite3 "$CCAAS_DB" "INSERT INTO tenants ..."
```

### 问题："WebSocket connection failed"（WebSocket 连接失败）

**原因**：CCAAS 后端未运行或 URL 错误

**修复**：验证 CCAAS 在端口 3001 上运行：

```bash
lsof -i :3001
curl http://localhost:3001/api/v1/chat/health
```

### 问题："Port already in use"（端口已被使用）

**原因**：之前的实例仍在运行

**修复**：在 `start-dev.sh` 中清除端口：

```bash
lsof -ti:YOUR_PORT | xargs kill -9 2>/dev/null || true
```

### 问题："MCP server not registered"（MCP 服务器未注册）

**原因**：`solution.json` 未同步到 CCAAS

**修复**：重启 CCAAS 后端或手动注册 MCP 服务器

---

## 下一步

1. **使用本指南创建你的第一个 solution**
2. **学习 `solutions/` 目录中的现有 solutions**
3. **阅读 CCAAS 架构文档**了解高级模式
4. **加入社区**分享你的 solution

## 资源

- [CCAAS 后端文档](../packages/backend/CLAUDE.md)
- [@ccaas/react-sdk 文档](../packages/react-sdk/README.md)
- [MCP 协议规范](https://modelcontextprotocol.io)
- [示例 Solutions](../../solutions/)

---

**有问题？**提交 issue 或联系 CCAAS 团队！
