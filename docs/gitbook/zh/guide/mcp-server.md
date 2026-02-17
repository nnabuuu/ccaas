# MCP Server 开发

## 什么是 MCP Server

MCP（Model Context Protocol）Server 是为 AI Agent 提供外部工具的服务。AI Agent 在执行任务时，可以调用 MCP Server 提供的工具来完成特定操作，如搜索数据、调用外部 API、生成文件等。

## 使用时机

核心问题：**你是否需要给 agent 提供它自身没有的数据访问或操作能力？**

**需要 MCP Server 的场景：**
- Agent 需要查询你的私有数据（教材内容、学生记录、产品目录）
- Solution 使用 `write_output`——这个工具必须通过 MCP Server 暴露
- Agent 需要调用外部 API（搜索服务、数据库、第三方平台）
- 需要对 agent 输出做业务层校验（Zod schema 验证）

**不需要 MCP Server 的场景：**
- Agent 只做推理和生成，不需要访问外部数据
- 只用 Claude 内置工具（文件系统、Web 搜索等）
- 完全对话式 solution，没有结构化输出

如果你在构建一个搜索课程标准并填写表单的教案设计器，你需要 MCP Server。如果你在构建一个只从训练知识回答问题的 Q&A 机器人，则不需要。

## 两种实现方式

| 方式 | 说明 | 适用场景 |
|------|------|----------|
| **REST API** | HTTP 端点，LoopAI REST 适配器调用 | 推荐方式，便于调试和部署 |
| **stdio** | 标准输入/输出通信 | 使用 `@modelcontextprotocol/sdk` |

{% hint style="info" %}
LoopAI 平台推荐使用 REST API 方式，便于独立部署、健康检查和日志记录。
{% endhint %}

## REST API 方式（推荐）

### 项目结构

```
mcp-server/
├── package.json
├── tsconfig.json
├── src/
│   └── index.ts       # 工具定义与 Express 服务
└── dist/              # 编译输出
```

### 基础模板

```typescript
import express from 'express'
import cors from 'cors'

const app = express()
app.use(cors())
app.use(express.json())

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

// write_output 工具
app.post('/tools/write_output', (req, res) => {
  const { field, value, operation = 'set' } = req.body

  res.json({
    data: { field, value, operation },
    status: 'success'
  })
})

// 自定义工具示例
app.post('/tools/search_data', (req, res) => {
  const { query } = req.body

  // 业务逻辑
  const results = performSearch(query)

  res.json({
    data: results,
    status: 'success'
  })
})

const PORT = process.env.PORT || 3004
app.listen(PORT, () => {
  console.log(`MCP Server running on port ${PORT}`)
})
```

### REST 适配器端点定义

在 CCAAS 注册 MCP Server 时，需要定义端点格式：

```typescript
interface McpEndpoint {
  name: string          // 工具名称
  description: string   // 工具描述（AI 会读取）
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string          // 端点路径
  parameters: {
    name: string
    type: string
    description: string
    required: boolean
    in: 'body' | 'query' | 'path'
  }[]
}
```

### solution.json 中的 REST 适配器配置

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
            {
              "name": "field",
              "type": "string",
              "description": "要更新的字段名",
              "required": true,
              "in": "body"
            },
            {
              "name": "value",
              "type": "string",
              "description": "字段值",
              "required": true,
              "in": "body"
            }
          ]
        }
      ]
    }
  }
}
```

## stdio 方式

如果需要使用 `@modelcontextprotocol/sdk`：

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const server = new McpServer({
  name: 'my-tools',
  version: '1.0.0'
})

// 注册工具
server.tool(
  'write_output',
  'Output structured data to frontend',
  {
    field: z.string().describe('Field name to update'),
    value: z.string().describe('Field value')
  },
  async ({ field, value }) => {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ field, value, status: 'success' })
      }]
    }
  }
)

// 启动
const transport = new StdioServerTransport()
await server.connect(transport)
```

{% hint style="warning" %}
stdio 方式的 MCP Server 需要迁移为 REST API 方式才能在 LoopAI 平台上使用。参见 [MCP REST 迁移指南](../reference/migration.md)。
{% endhint %}

## write\_output 工具

`write_output` 是最重要的 MCP 工具，用于将 AI 生成的结构化数据同步到前端表单。

### 基本用法

AI Agent 调用 write\_output 时，传入字段名和值：

```json
{
  "field": "title",
  "value": "三角形面积计算",
  "operation": "set"
}
```

### 操作类型

| 操作 | 说明 |
|------|------|
| `set` | 覆盖字段值（默认） |
| `append` | 追加到现有值 |
| `merge` | 合并对象 |

详细用法参见 [write\_output 最佳实践](write-output.md)。

## 认证配置

REST 适配器支持多种认证方式：

```json
{
  "auth": {
    "type": "api-key",
    "header": "X-API-Key",
    "value": "${MY_API_KEY}"
  }
}
```

支持的认证类型：
- **api-key** —— 自定义 Header 传递 API Key
- **bearer** —— Bearer Token 认证
- **basic** —— HTTP Basic Auth
- **oauth2** —— OAuth2 认证流程

## 调试技巧

1. **健康检查** —— 首先确认 MCP Server 的 `/health` 端点正常响应
2. **独立测试** —— 使用 curl 直接调用工具端点，验证返回格式
3. **查看日志** —— MCP Server 的日志是排查问题的第一手资料
4. **验证注册** —— 通过 CCAAS API 确认 MCP Server 已正确注册

```bash
# 健康检查
curl http://localhost:3004/health

# 测试工具调用
curl -X POST http://localhost:3004/tools/write_output \
  -H "Content-Type: application/json" \
  -d '{"field": "title", "value": "测试标题"}'

# 验证注册
curl http://localhost:3001/api/v1/mcp-servers
```
