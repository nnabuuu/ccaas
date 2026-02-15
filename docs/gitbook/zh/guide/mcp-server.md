# MCP Server 开发

## 什么是 MCP Server

MCP（Model Context Protocol）Server 是为 AI Agent 提供外部工具的服务。AI Agent 在执行任务时，可以调用 MCP Server 提供的工具来完成特定操作，如搜索数据、调用外部 API、生成文件等。

## 两种实现方式

| 方式 | 说明 | 适用场景 |
|------|------|----------|
| **stdio** | 使用 `@modelcontextprotocol/sdk`，标准输入/输出通信 | 推荐方式，MCP 原生协议 |
| **REST API** | HTTP 端点，LoopAI REST 适配器调用 | 已有外部 HTTP 服务时使用 |

{% hint style="info" %}
LoopAI 平台推荐使用 stdio 方式（`@modelcontextprotocol/sdk`），这是 MCP 原生协议，平台直接管理进程生命周期，无需额外部署。
{% endhint %}

## stdio 方式（推荐）

### 项目结构

```
mcp-server/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts         # Server 入口和工具定义
│   └── schemas.ts       # Zod 验证 schema
└── dist/                # 编译输出
```

### 依赖安装

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.23.0"
  }
}
```

### 基础模板

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'

// 创建 MCP Server
const server = new Server(
  { name: 'my-tools', version: '1.0.0' },
  { capabilities: { tools: {} } }
)

// 定义工具
const writeOutputTool: Tool = {
  name: 'write_output',
  description: '输出结构化数据到前端表单',
  inputSchema: {
    type: 'object',
    properties: {
      field: {
        type: 'string',
        description: '要更新的字段名',
      },
      value: {
        description: '字段值',
      },
      preview: {
        type: 'string',
        description: '同步按钮上显示的摘要',
      },
    },
    required: ['field', 'value'],
  },
}

// 注册工具列表
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: [writeOutputTool] }
})

// 处理工具调用
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  if (name === 'write_output') {
    const { field, value, preview } = args as {
      field: string
      value: unknown
      preview?: string
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          data: { field, value, preview },
          status: 'success',
        }),
      }],
    }
  }

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        data: { error: `Unknown tool: ${name}` },
        status: 'error',
      }),
    }],
    isError: true,
  }
})

// 启动服务器
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  // 使用 stderr 输出日志，stdout 保留给 MCP 协议通信
  console.error('MCP Server started')
}

main().catch((error) => {
  console.error('Failed to start MCP server:', error)
  process.exit(1)
})
```

### 实际示例：备课方案设计器

以下是 `lesson-plan-designer` MCP Server 的实际代码片段，展示如何定义多个领域工具：

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js'

const server = new Server(
  { name: 'lesson-plan-designer', version: '1.0.0' },
  { capabilities: { tools: {} } }
)

// write_output: 将结构化数据同步到前端
const writeOutputTool: Tool = {
  name: 'write_output',
  description: '将备课方案内容写入前端表单',
  inputSchema: {
    type: 'object',
    properties: {
      field: {
        type: 'string',
        enum: ['title', 'subject', 'gradeLevel', 'objectives', 'content'],
        description: '要更新的备课方案字段',
      },
      value: { description: '字段值' },
      preview: { type: 'string', description: '同步按钮上显示的摘要' },
    },
    required: ['field', 'value', 'preview'],
  },
}

// search_textbook: 搜索教材内容
const searchTextbookTool: Tool = {
  name: 'search_textbook',
  description: '搜索教材章节和知识点',
  inputSchema: {
    type: 'object',
    properties: {
      subject: { type: 'string', description: '学科（如 "数学"）' },
      grade: { type: 'number', description: '年级（1-9）' },
      keyword: { type: 'string', description: '搜索关键词' },
    },
    required: ['subject'],
  },
}

// get_curriculum_standards: 查询课程标准
const getCurriculumStandardsTool: Tool = {
  name: 'get_curriculum_standards',
  description: '查询课程标准',
  inputSchema: {
    type: 'object',
    properties: {
      subject: { type: 'string', description: '学科名称' },
      stage: { type: 'string', description: '学段' },
      keyword: { type: 'string', description: '关键词搜索' },
    },
    required: ['subject'],
  },
}

// 注册所有工具
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      writeOutputTool,
      searchTextbookTool,
      getCurriculumStandardsTool,
    ],
  }
})

// 启动
const transport = new StdioServerTransport()
await server.connect(transport)
```

### solution.json 中的 stdio 配置

```json
{
  "mcpServers": {
    "lesson-plan-tools": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"],
      "description": "备课方案设计器 MCP 工具",
      "type": "stdio",
      "env": {}
    }
  }
}
```

配置字段说明：

| 字段 | 说明 |
|------|------|
| `command` | 启动命令（`node`） |
| `args` | 命令参数（编译后 JS 文件路径） |
| `type` | 通信协议（`stdio`） |
| `env` | 传递给进程的环境变量 |

{% hint style="warning" %}
`args` 路径指向 `dist/index.js` 而非 `src/index.ts`。修改源码后需要执行 `npm run build` 重新编译。
{% endhint %}

## REST API 方式（已有外部服务时的替代方案）

如果你已有独立部署的 HTTP 服务，可以使用 REST 适配器将其接入 LoopAI 平台。

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

### stdio 方式调试

使用 MCP inspector 或直接向 stdin 输入 JSON 进行测试：

```bash
# 列出可用工具
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/index.js

# 测试 write_output 调用
echo '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"write_output","arguments":{"field":"title","value":"测试标题","preview":"设置标题"}}}' | node dist/index.js
```

{% hint style="info" %}
stdio 方式的 MCP Server 使用 stdout 进行协议通信，所有日志输出应使用 `console.error`（写入 stderr），不要使用 `console.log`。
{% endhint %}

### REST 方式调试

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
