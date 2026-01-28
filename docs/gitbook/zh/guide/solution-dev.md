# Solution 开发完整指南

## 概述

Solution 是基于 LoopAI 平台构建的垂直场景应用。每个 Solution 由前端、后端（可选）、MCP Server 和 Skill 组成，共同提供端到端的用户体验。

## 架构

```
用户 ──→ Solution 前端
            │
            ▼
      Solution 后端 ──→ CCAAS 后端 ──→ AI Agent
            │                            │
            │                            ▼
            │                      MCP Server
            │                     （工具调用）
            ▼
      业务数据存储
```

**关键原则**：Solution 后端应复用 CCAAS 后端的能力（会话管理、Skill 路由、消息持久化），而非重复实现。

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
│   │   ├── hooks/          # 自定义 Hook（Socket.io、同步等）
│   │   └── types/          # TypeScript 类型
│   └── ...
│
├── backend/                # 业务后端（可选）
│   ├── package.json
│   ├── src/
│   │   ├── sessions/       # 会话管理（代理 CCAAS）
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

## Socket.io 中继层

Solution 后端需实现 Socket.io 中继层，将前端事件转发到 CCAAS 后端：

```typescript
// 前端 → Solution 后端
socket.on('chat', async (data) => {
  const { message, sessionId } = data

  // 转发到 CCAAS
  await axios.post(`${CCAAS_URL}/api/v1/sessions/${sessionId}/completion`, {
    clientId: socket.id,
    message,
    tenantId: TENANT_ID,
    mcpServers: getMcpConfig(),
    enabledSkillSlugs: getEnabledSkills()
  })
})

// CCAAS → Solution 后端 → 前端
ccaasSocket.on('text_delta', (data) => {
  clientSocket.emit('text_delta', data)
})

ccaasSocket.on('output_update', (data) => {
  clientSocket.emit('output_update', data)
})

ccaasSocket.on('agent_status', (data) => {
  clientSocket.emit('agent_status', data)
})
```

## 数据流详解

一次完整的用户交互：

1. 用户在前端输入消息
2. 前端通过 Socket.io 发送 `chat` 事件到 Solution 后端
3. Solution 后端调用 CCAAS REST API（`/sessions/:id/completion`）
4. CCAAS 解析租户、同步 Skill、创建会话
5. CCAAS 启动 AI Agent 进程
6. AI Agent 读取 Skill 指令和上下文
7. AI Agent 调用 MCP 工具（如 write\_output）
8. CCAAS 通过 WebSocket 推送事件
9. Solution 后端转发事件到前端
10. 前端渲染实时结果
11. 用户审核并修改

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
npm install --prefix backend
npm install --prefix frontend
npm install --prefix mcp-server

# 构建 MCP Server
npm run build --prefix mcp-server

# 注入 Skill
./inject-skills.sh

# 启动服务
npm run dev --prefix backend &
npm run dev --prefix frontend &

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

### 1. 复用 CCAAS 能力

- 使用 CCAAS 的会话管理，不要自己实现
- 通过 CCAAS API 管理 Skill，不要直接操作数据库
- 代理通用 API 调用（如 Skill CRUD）

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
// output_update 使用嵌套结构
socket.on('output_update', (event) => {
  // 正确：访问 event.payload.data
  const { field, value } = event.payload.data

  // 错误：直接访问 event.field
  // const { field, value } = event  // ← 这是错的！
})
```

### 4. 完整的错误处理

```typescript
socket.on('error', (error) => {
  console.error('会话错误:', error)
  // 根据错误类型决定是否重试
  if (error.recoverable) {
    // 自动重试
  } else {
    // 通知用户
  }
})
```
