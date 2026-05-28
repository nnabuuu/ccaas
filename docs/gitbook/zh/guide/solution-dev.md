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

## solution.json 配置 (v3.0)

**推荐:** 使用简化的 v3.0 schema，遵循约定优于配置原则。

**最简配置（最常用）:**

```json
{
  "schemaVersion": "3.0",
  "solution": {
    "name": "我的解决方案",
    "slug": "my-solution",
    "description": "解决方案描述"
  },
  "mcpServers": {
    "my-tools": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"],
      "description": "工具服务描述"
    }
  }
}
```

**就是这样！** 技能会自动从 `skills/*/SKILL.md` 发现。所有技能元数据都在 SKILL.md frontmatter 中。

**包含解决方案特定配置:**

```json
{
  "schemaVersion": "3.0",
  "solution": {
    "name": "我的解决方案",
    "slug": "my-solution",
    "description": "解决方案描述"
  },
  "mcpServers": {
    "my-tools": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"]
    }
  },
  "backend": {
    "port": 3002,
    "database": {
      "type": "sqlite",
      "path": "data/my-solution.db"
    }
  },
  "frontend": {
    "port": 5280
  }
}
```

**相比 v2.0 的主要变化:**
- ✅ 扁平结构（无 `ccaas`/`internal` 嵌套）
- ✅ 技能自动发现（默认: `["skills/*"]`）
- ✅ 技能元数据仅在 SKILL.md frontmatter 中
- ✅ 配置减少 70-80%

**参考:** [solution.json 配置参考](../reference/solution-json.md) 查看完整 schema 文档。

### SKILL.md Frontmatter

v3.0 要求所有 SKILL.md 文件都有完整的 frontmatter:

```markdown
---
name: 主技能
slug: main-skill
description: 主技能描述
scope: solution
triggers:
  - type: keyword
    value: "设计"
    priority: 10
allowedTools:
  - write_output
  - custom_tool
---

# 主技能

给 AI agent 的指令...
```

### 触发器类型

| 类型 | 说明 | 示例 |
|------|------|------|
| `keyword` | 消息包含关键词 | `"设计"`, `"生成"` |
| `pattern` | 正则表达式匹配 | `"请(帮我)?设计.*教案"` |
| `intent` | 语义意图识别 | `"create_lesson_plan"` |
| `context` | 上下文条件匹配 | `"page:lesson-plan-editor"` |

## 安装 SDK

SDK 包已发布到 npm public registry，可直接安装：

```bash
# React 前端
npm install @kedge-agentic/react-sdk@0.2.0

# Vue 前端
npm install @kedge-agentic/vue-sdk@0.2.0

# 仅共享类型（MCP Server / 后端使用）
npm install @kedge-agentic/common@0.2.0
```

如果在 monorepo 内开发，`packages/*` 中已有本地源码，无需单独安装。

## 前端直连 CCAAS

前端通过 `@kedge-agentic/react-sdk` 直接连接 CCAAS 后端，无需 Solution 后端中继：

```tsx
import {
  useAgentConnection,
  useAgentChat,
  useAgentStatus,
  ChatPanel
} from '@kedge-agentic/react-sdk'

function MySolution() {
  // 直连 CCAAS 后端
  const connection = useAgentConnection({
    serverUrl: 'http://localhost:3001',
    solutionId: 'my-solution'
  })

  const chat = useAgentChat({ connection, solutionId: 'my-solution' })
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
2. 前端通过 React SDK 直接发送 `chat` 事件到 CCAAS 后端
3. CCAAS 解析租户、同步 Skill、创建会话
4. CCAAS 启动 AI Agent 进程
5. AI Agent 读取 Skill 指令和上下文
6. AI Agent 调用 MCP 工具（如 write\_output）
7. CCAAS 通过 SSE 直接推送事件到前端
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

# 说明：Skill 由 CCAAS 后端在启动时自动注册，无需手动注入。

# 启动服务
npm run dev --prefix frontend &

# 如有业务后端
if [ -d "backend" ]; then
  npm install --prefix backend
  npm run dev --prefix backend &
fi

echo "Solution 启动完成！"
```

## Skill 自动注册

`solution.json` 中定义的 Skills 和 MCP servers 会在 **CCAAS 后端启动时自动注册**，无需手动操作。

**工作原理：**
1. 后端启动时扫描 `solutions/` 目录
2. 对每个 `discovery.enabled: true`（默认）的解决方案，读取 `solution.json`
3. 从匹配 `skills` 模式的每个文件夹加载 skill（默认：`skills/*/SKILL.md`）
4. 自动注册 `mcpServers` 中定义的 MCP servers
5. 已有注册会被更新（upsert 逻辑）

**启动日志示例：**
```
[SolutionLoader] Starting auto-discovery of solutions...
[SolutionLoader] Loaded "My Solution": 2 skills created, 1 MCP servers created
[SolutionLoader] Auto-discovery complete: 1 solution(s) loaded, 0 failed, 2 skill(s), 1 MCP server(s)
```

**禁用自动注册**（如解决方案尚未准备好），在 `solution.json` 中设置 `discovery.enabled: false`：

```json
{
  "schemaVersion": "3.0",
  "solution": { ... },
  "discovery": { "enabled": false }
}
```

设置 `discovery.enabled: false` 的解决方案在启动时会被完全跳过 — 不加载任何 Skill 或 MCP 服务器。适用于仍在开发中、暂不对外开放的解决方案。

**启用已禁用的解决方案：** 将 `enabled` 改为 `true`（或直接删除 `discovery` 字段），然后重启后端。下次启动时会自动注册 Skills 和 MCP 服务器。

**偏好手动管理？** 无论 `enabled` 状态如何，都可以随时按需导入指定解决方案：

```bash
# 手动导入指定解决方案（绕过 discovery.enabled 检查）
npm run skill:import -- <solution-name>
npm run skill:import -- quiz-analyzer --verbose
```

适用于需要精细控制哪些解决方案何时加载的场景，无需重启后端。


## 最佳实践

### 1. 前端直连 CCAAS，后端仅管理业务数据

```typescript
// 前端：聊天通过 React SDK 直连 CCAAS
const connection = useAgentConnection({
  serverUrl: 'http://localhost:3001',  // CCAAS 后端
  solutionId: 'my-solution'
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
import { useOutputSync } from '@kedge-agentic/react-sdk'

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
  solutionId: 'my-solution'
})

// 连接状态自动管理，包含重连逻辑
// 通过 connection.connected 判断连接状态
if (!connection.connected) {
  // 显示断线提示
}
```

## Ambient identity（端到端身份透传）

如果你的工具<em>按 user 身份返回 / 修改数据</em>（教师只能看自己班、校长只能看自己学校），把对应的 MCP server 翻 `proxyEnabled: true` 后，ccaas 会自动接收 end-user 身份。 你需要做<em>两件事</em>：

### 1. browser 永远不持有 ccaas API key

这是已经定下的安全边界 —— ccaas 信任的是 solution（持有 tenant key），不是 end user。 浏览器对 ccaas 的所有调用都走 solution backend 做<em>同源代理</em>。

```typescript
// ❌ 错：browser 直接连 ccaas
const ccaas = new CcaasClient({
  url: 'http://localhost:3001',
  apiKey: process.env.NEXT_PUBLIC_CCAAS_KEY,  // 泄露！
});

// ✅ 对：browser 走 solution backend 的 /api/* 代理
// 浏览器只调用 solution backend 的 /api/sessions/:sid/messages
// solution backend 内部加 Bearer key 转给 ccaas
```

### 2. solution backend 在每次 ccaas 调用时附带 `X-Ccaas-On-Behalf-Of`

```typescript
async function callCcaas(req: Request, path: string, body: unknown) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${process.env.CCAAS_API_KEY}`,
    'Content-Type': 'application/json',
  };

  // 关键：从 solution 自己的 session cookie 解析 user
  const userId = await resolveUserFromCookie(req.cookies);
  if (userId) {
    headers['X-Ccaas-On-Behalf-Of'] = userId;
    // optional：表明用户在当前 solution 里的角色（forward-compat,目前 ccaas 不强制）
    // headers['X-Ccaas-Acting-Role'] = await resolveRoleFromUser(userId);
  }

  return fetch(`${process.env.CCAAS_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}
```

### ccaas 这边做什么

| 阶段 | ccaas 行为 |
|---|---|
| Session 创建 | 把 `X-Ccaas-On-Behalf-Of` 的值 bind 到 `ManagedSession.actingUserId`。 **不可变** —— 后续 turn 即便携带不同 header,平台也保留首次值且 WARN 日志一条。 |
| Tool call | 通过 `ExecutionContext.actingUserId` 把身份注入 tool handler。 Agent 写不进, args 里没有, prompt injection 改不了。 |
| Audit | `tool_events` log 包含 `actingUserId`,可按用户聚合调用历史。 |
| 没 header 时 | ccaas 退化到 API key 上 bind 的 userId（如果 API key 关联了 UserSolution）;两者都没就<em>记 null</em>并打 debug log。 |

### Security note：header 是 trust assumption

`X-Ccaas-On-Behalf-Of` 本质上是 solution backend 在告诉 ccaas "<em>本次调用代表这个 user</em>"。 ccaas <em>信任</em> solution backend 不撒谎 —— 因为 solution backend 持有 tenant key，理论上已经可以替这个 tenant 的任何 user 行事。 header 只是把这个信任<em>显式化</em>到 audit log 里，让 spoof 可见。

如果你的 solution backend 不是 ccaas 完全信任的（例如第三方 deploy），未来会需要短期 exchange token 或 solution-issued JWT —— 那是<em>下一轮</em>的事。 详见 [ToolCallerProxy 设计文档](../../../design-tool-caller-proxy.md) 第 4 节。

### 验证 ambient identity 是否打通

最简单的 smoke test：用 curl 加 header 调 solution backend 的 chat 代理，观察 ccaas 日志：

```bash
curl -X POST 'http://localhost:5284/api/sessions/probe-1/messages' \
  -H 'Content-Type: application/json' \
  -H 'X-Ccaas-On-Behalf-Of: teacher-42' \
  -d '{"message":"用 emit_card 工具展示一个 todo","projectId":"xxx"}'
```

ccaas 日志应该出现：

```
[audit-fallback] tool=my-tools.emit_card actingUserId=teacher-42 outcome=ok ...
```

如果是 `actingUserId=none`,逐层排查：
1. solution backend 是否真把 header 转发上去了（看 backend 自己的请求日志）
2. ccaas chat-proxy 是否调用了 `@Headers('x-ccaas-on-behalf-of')` 装饰器
3. ccaas dist 是否是最新的（`npx nest build` 之后再启动）
