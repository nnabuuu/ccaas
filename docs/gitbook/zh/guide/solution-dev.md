# Solution 开发完整指南

## 概述

Solution 是基于即见Agentic 平台构建的垂直场景应用。每个 Solution 由前端、后端（可选）、MCP Server 和 Skill 组成，共同提供端到端的用户体验。

## 架构

```
用户 ──→ Solution 前端 ──→ CCAAS 后端 ──→ AI Agent
            │                                │
            │                                ▼
            │                          MCP Server
            │                         （工具调用）
            ▼
      Solution 后端（可选）
            │
            ▼
      业务数据存储
```

**关键原则**：前端通过 React SDK 直连 CCAAS 后端处理聊天和 Agent 通信。Solution 后端仅负责业务领域数据（如课程内容、产品目录等），不参与消息中继。

## 目录结构

```
my-solution/
├── solution.json           # 解决方案配置（必须）
├── setup.sh                # 一键启动脚本
├── inject-skills.sh        # Skill 注入脚本
│
├── frontend/               # 前端应用
│   ├── package.json
│   ├── src/
│   │   ├── components/     # UI 组件
│   │   ├── hooks/          # 自定义 Hook（useAgentConnection 等）
│   │   └── types/          # TypeScript 类型
│   └── ...
│
├── backend/                # 业务后端（可选，仅处理领域数据）
│   ├── package.json
│   ├── src/
│   │   ├── domain/         # 领域实体
│   │   ├── api/            # REST 接口
│   │   └── ...             # 业务逻辑
│   └── ...
│
├── mcp-server/             # MCP 工具服务
│   ├── package.json
│   ├── src/
│   │   └── index.ts        # 工具定义与实现
│   └── ...
│
└── skills/                 # AI Skill 定义
    └── my-skill/
        └── SKILL.md        # Skill Markdown 文件
```

## solution.json 配置

```json
{
  "name": "My Solution",
  "slug": "my-solution",
  "version": "1.0.0",
  "description": "解决方案描述",
  "mcpServers": {
    "my-tools": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"],
      "description": "工具服务描述"
    }
  },
  "skills": [
    {
      "name": "Main Skill",
      "slug": "main-skill",
      "description": "主技能描述",
      "type": "prompt",
      "triggers": [
        {
          "type": "keyword",
          "value": "设计",
          "priority": 1
        }
      ],
      "allowedTools": ["write_output", "custom_tool"],
      "skillFile": "skills/main-skill/SKILL.md"
    }
  ],
  "ports": {
    "backend": 3002,
    "frontend": 5280
  }
}
```

### 触发器类型

| 类型 | 说明 | 示例 |
|------|------|------|
| `keyword` | 消息包含关键词 | `"设计"`, `"生成"` |
| `pattern` | 正则表达式匹配 | `"请(帮我)?设计.*教案"` |
| `intent` | 语义意图识别 | `"create_lesson_plan"` |
| `context` | 上下文条件匹配 | `"page:lesson-plan-editor"` |

## 前端直连 CCAAS

前端通过 `@ccaas/react-sdk` 直接连接 CCAAS 后端，无需 Solution 后端中继：

```tsx
import {
  useAgentConnection,
  useAgentChat,
  useAgentStatus,
  ChatPanel
} from '@ccaas/react-sdk'

function MySolution() {
  // 直连 CCAAS 后端
  const connection = useAgentConnection({
    serverUrl: 'http://localhost:3001',
    tenantId: 'my-solution'
  })

  const chat = useAgentChat({ connection, tenantId: 'my-solution' })
  const status = useAgentStatus({ connection })

  return (
    <ChatPanel
      messages={chat.messages}
      isProcessing={status.isProcessing}
      connected={connection.connected}
      activeTools={status.activeTools}
      onSendMessage={chat.sendMessage}
    />
  )
}
```

**为什么直连？**

- 减少延迟：消息直达 CCAAS，无中间跳转
- 简化架构：Solution 后端无需实现消息转发
- 职责清晰：Solution 后端专注于业务领域数据

## 数据流详解

一次完整的用户交互：

1. 用户在前端输入消息
2. 前端通过 React SDK（Socket.io）直接发送 `chat` 事件到 CCAAS 后端
3. CCAAS 解析租户、同步 Skill、创建会话
4. CCAAS 启动 AI Agent 进程
5. AI Agent 读取 Skill 指令和上下文
6. AI Agent 调用 MCP 工具（如 write\_output）
7. CCAAS 通过 WebSocket 直接推送事件到前端
8. 前端渲染实时结果
9. 用户审核并修改

**注意**：如果 Solution 有业务后端，前端通过独立的 REST API 调用获取领域数据，与 CCAAS 通信完全独立。

## 一键启动脚本

`setup.sh` 应包含：

```bash
#!/bin/bash

# 确保 CCAAS 后端运行
echo "检查 CCAAS 后端..."
curl -s http://localhost:3001/api/v1/chat/health > /dev/null || {
  echo "请先启动 CCAAS 后端: npm run dev:backend"
  exit 1
}

# 安装依赖
npm install --prefix frontend
npm install --prefix mcp-server

# 构建 MCP Server
npm run build --prefix mcp-server

# 注入 Skill
./inject-skills.sh

# 启动服务
npm run dev --prefix frontend &

# 如有业务后端
if [ -d "backend" ]; then
  npm install --prefix backend
  npm run dev --prefix backend &
fi

echo "Solution 启动完成！"
```

## Skill 注入

`inject-skills.sh` 负责将 Skill 注册到 CCAAS：

```bash
#!/bin/bash
CCAAS_URL="http://localhost:3001"

# 读取 solution.json 中的 Skill 配置
# 调用 CCAAS API 注册 Skill
curl -X POST "$CCAAS_URL/api/v1/skills" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Skill",
    "slug": "my-skill",
    "description": "技能描述",
    "type": "prompt",
    "content": "'"$(cat skills/my-skill/SKILL.md)"'",
    "triggers": [{"type": "keyword", "value": "关键词"}],
    "allowedTools": ["write_output"]
  }'

# 注册 MCP Server
curl -X POST "$CCAAS_URL/api/v1/mcp-servers" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-tools",
    "url": "http://localhost:3004",
    "description": "工具服务"
  }'
```

## 最佳实践

### 1. 前端直连 CCAAS，后端仅管理业务数据

```typescript
// 前端：聊天通过 React SDK 直连 CCAAS
const connection = useAgentConnection({
  serverUrl: 'http://localhost:3001',  // CCAAS 后端
  tenantId: 'my-solution'
})

// 前端：业务数据通过 REST 调用 Solution 后端
const domainData = await fetch('http://localhost:3002/api/lessons')
```

### 2. 先测试再开发

```
修改任何代码前：
□ 运行 npm test 确认当前所有测试通过
□ 如果要改变 API/接口，先检查前端类型定义和现有测试

修改代码后：
□ 立即运行相关测试，不要等到最后
□ 测试失败 = 停下来分析，不要继续前进
```

### 3. 正确处理 output\_update

```typescript
// 通过 React SDK 的 useOutputSync hook 处理
import { useOutputSync } from '@ccaas/react-sdk'

const sync = useOutputSync({
  connection,
  onUpdate: (field, value) => {
    // 处理字段更新
    setFormData(prev => ({ ...prev, [field]: value }))
  }
})
```

### 4. 完整的错误处理

```typescript
const connection = useAgentConnection({
  serverUrl: 'http://localhost:3001',
  tenantId: 'my-solution'
})

// 连接状态自动管理，包含重连逻辑
// 通过 connection.connected 判断连接状态
if (!connection.connected) {
  // 显示断线提示
}
```
