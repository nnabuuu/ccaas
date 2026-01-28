# MCP REST 迁移指南

## 背景

LoopAI 平台使用 REST 适配器与 MCP Server 通信。如果你的 MCP Server 使用 stdio 模式（基于 `@modelcontextprotocol/sdk`），需要迁移为 REST API 模式。

## 迁移步骤

### 1. 修改 mcp-server/src/index.ts

**迁移前**（stdio 模式）：

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

const server = new McpServer({ name: 'my-tools', version: '1.0.0' })

server.tool('write_output', '...', schema, handler)

const transport = new StdioServerTransport()
await server.connect(transport)
```

**迁移后**（REST 模式）：

```typescript
import express from 'express'
import cors from 'cors'

const app = express()
app.use(cors())
app.use(express.json())

app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.post('/tools/write_output', (req, res) => {
  const { field, value, operation = 'set' } = req.body
  res.json({
    data: { field, value, operation },
    status: 'success'
  })
})

// 其他工具端点...

const PORT = process.env.PORT || 3004
app.listen(PORT, () => {
  console.log(`MCP Server running on port ${PORT}`)
})
```

### 2. 更新 package.json

```json
{
  "dependencies": {
    "express": "^4.18.0",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "@types/cors": "^2.8.0"
  }
}
```

移除不再需要的依赖：

```bash
npm uninstall @modelcontextprotocol/sdk
```

### 3. 更新 inject-skills.sh

添加 MCP Server 注册：

```bash
#!/bin/bash
CCAAS_URL="http://localhost:3001"

# 注册 MCP Server
curl -X POST "$CCAAS_URL/api/v1/mcp-servers" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-tools",
    "url": "http://localhost:3004",
    "description": "My Solution Tools"
  }'
```

### 4. 更新 setup.sh

添加 MCP Server 启动：

```bash
#!/bin/bash

# 构建 MCP Server
echo "Building MCP Server..."
npm run build --prefix mcp-server

# 启动 MCP Server
echo "Starting MCP Server..."
node mcp-server/dist/index.js &
MCP_PID=$!
echo "MCP Server PID: $MCP_PID"

# 等待 MCP Server 就绪
sleep 2
curl -s http://localhost:3004/health || {
  echo "MCP Server failed to start"
  exit 1
}
```

### 5. 更新 solution.json

```json
{
  "mcpServers": {
    "my-tools": {
      "type": "rest-adapter",
      "url": "http://localhost:3004",
      "endpoints": [
        {
          "name": "write_output",
          "description": "输出结构化数据到前端",
          "method": "POST",
          "path": "/tools/write_output",
          "parameters": [
            { "name": "field", "type": "string", "required": true, "in": "body" },
            { "name": "value", "type": "string", "required": true, "in": "body" },
            { "name": "operation", "type": "string", "required": false, "in": "body" }
          ]
        }
      ]
    }
  }
}
```

## 端口分配

| Solution | MCP Server 端口 |
|----------|----------------|
| problem-explainer | 3004 |
| lesson-plan-designer | 3005 |
| 新 Solution | 3006+ |

## 验证步骤

### 1. 构建

```bash
cd mcp-server && npm run build
```

### 2. 启动并测试

```bash
# 启动 MCP Server
node dist/index.js

# 健康检查
curl http://localhost:3004/health

# 测试工具
curl -X POST http://localhost:3004/tools/write_output \
  -H "Content-Type: application/json" \
  -d '{"field": "title", "value": "测试"}'
```

### 3. 注入并验证

```bash
# 注入到 CCAAS
./inject-skills.sh

# 确认注册成功
curl http://localhost:3001/api/v1/mcp-servers
```

### 4. 端到端测试

启动完整 Solution，发送消息触发 AI 调用 write\_output，确认前端收到 output\_update 事件。

## 常见问题

### 工具不可见

- 确认 MCP Server 已启动并通过健康检查
- 确认已在 CCAAS 注册
- 确认 solution.json 中的端点定义正确

### 工具调用失败

- 检查 MCP Server 日志
- 确认端点路径和参数格式正确
- 使用 curl 直接测试端点

### write\_output 不显示

- 确认 Skill 的 `allowedTools` 包含 `write_output`
- 确认前端监听 `output_update` 事件
- 检查嵌套结构解析（`event.payload.data`）
