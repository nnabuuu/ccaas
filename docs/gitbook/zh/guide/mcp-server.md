# MCP Server 开发

## 什么是 MCP Server

MCP（Model Context Protocol）Server 是为 AI Agent 提供外部工具的服务。AI Agent 在执行任务时，可以调用 MCP Server 提供的工具来完成特定操作，如搜索数据、调用外部 API、生成文件等。

## 两种实现方式

| 方式 | 说明 | 适用场景 |
|------|------|----------|
| **stdio** | 使用 `@modelcontextprotocol/sdk`，标准输入/输出通信 | 推荐方式，MCP 原生协议 |
| **REST API** | HTTP 端点，即见Agentic REST 适配器调用 | 已有外部 HTTP 服务时使用 |

{% hint style="info" %}
即见Agentic 平台推荐使用 stdio 方式（`@modelcontextprotocol/sdk`），这是 MCP 原生协议，平台直接管理进程生命周期，无需额外部署。
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

如果你已有独立部署的 HTTP 服务，可以使用 REST 适配器将其接入即见Agentic 平台。

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

## 使用 MCP Inspector 测试

**MCP Inspector** 是官方提供的交互式调试工具，提供可视化界面测试 MCP Server。

### 安装 MCP Inspector

```bash
npm install -g @modelcontextprotocol/inspector
```

### 启动 Inspector

```bash
# 方式 1: 直接启动（会自动检测 package.json）
npx @modelcontextprotocol/inspector node dist/index.js

# 方式 2: 使用 tsx 运行 TypeScript（开发时）
npx @modelcontextprotocol/inspector tsx src/index.ts
```

**成功启动后会看到**:
```
MCP Inspector
Connect URL: http://localhost:6274
```

### Inspector 界面说明

在浏览器打开 `http://localhost:6274`，你会看到：

**1. 连接状态** (顶部)
- 🟢 **Connected** - MCP Server 正常运行
- 🔴 **Disconnected** - Server 未启动或已崩溃

**2. Tools 面板** (左侧)
- 列出所有可用工具
- 显示工具描述和参数 schema
- 点击工具名称展开详情

**3. 调用面板** (右侧)
- **Input Arguments** - 填写工具参数（JSON 格式）
- **Execute** 按钮 - 执行工具调用
- **Response** - 显示工具返回结果

### 测试示例

**场景**: 测试 `parse_quiz_content` 工具

1. **选择工具**: 在左侧点击 `parse_quiz_content`
2. **填写参数**:
   ```json
   {
     "content": "1. 三角形的面积公式是？\nA. 底×高\nB. 底×高÷2\nC. 边长²",
     "subject": "math"
   }
   ```
3. **点击 Execute**: 执行工具调用
4. **查看结果**:
   ```json
   {
     "content": [
       {
         "type": "text",
         "text": "{\"questions\":[{\"id\":1,\"content\":\"三角形的面积公式是？\",\"options\":[{\"label\":\"A\",\"content\":\"底×高\"},{\"label\":\"B\",\"content\":\"底×高÷2\"},{\"label\":\"C\",\"content\":\"边长²\"}],\"type\":\"single_choice\"}]}"
       }
     ]
   }
   ```

### Inspector 常见用途

| 用途 | 说明 |
|------|------|
| **快速验证** | 确认工具能正确解析参数 |
| **调试输出** | 检查返回数据格式是否正确 |
| **边界测试** | 测试空值、特殊字符、大数据量 |
| **Schema 验证** | 确认 inputSchema 定义准确 |
| **错误处理** | 测试异常输入的错误信息 |

{% hint style="success" %}
**最佳实践**: 在将 MCP Server 注册到 CCAAS 前，先用 Inspector 测试所有工具，确保功能正常。
{% endhint %}

---

## 注册 MCP Server 到 CCAAS

完成开发和测试后，需要将 MCP Server 注册到 CCAAS Backend，使 AI Agent 可以使用这些工具。

### 注册流程

#### Step 1: 准备配置

创建 MCP Server 配置文件 `solutions/your-solution/mcp-config.json`:

```json
{
  "name": "quiz-analyzer-tools",
  "description": "试卷分析工具集",
  "command": "node",
  "args": ["dist/index.js"],
  "cwd": "${SOLUTION_DIR}/mcp-server",
  "env": {
    "NODE_ENV": "production"
  },
  "tenantId": "quiz-analyzer"
}
```

**字段说明**:

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | string | MCP Server 唯一标识 |
| `description` | string | 功能描述 |
| `command` | string | 启动命令 (node, tsx, python等) |
| `args` | string[] | 命令参数 |
| `cwd` | string | 工作目录 (支持 `${SOLUTION_DIR}` 变量) |
| `env` | object | 环境变量 |
| `tenantId` | string | 所属租户 ID |

#### Step 2: 注册到数据库

**方式 1: REST API** (推荐)

```bash
curl -X POST http://localhost:3001/api/v1/mcp-servers \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${CCAAS_API_KEY}" \
  -d @mcp-config.json
```

**方式 2: 注册脚本**

创建 `solutions/your-solution/register-mcp.sh`:

```bash
#!/bin/bash
set -e

CCAAS_URL="http://localhost:3001"
TENANT_ID="quiz-analyzer"
MCP_CONFIG="mcp-server/mcp-config.json"

echo "Registering MCP Server for ${TENANT_ID}..."

curl -X POST "${CCAAS_URL}/api/v1/mcp-servers" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ${CCAAS_API_KEY}" \
  -d @"${MCP_CONFIG}"

echo "✅ MCP Server registered successfully"

# 验证注册
echo "Verifying registration..."
curl -s "${CCAAS_URL}/api/v1/mcp-servers?tenantId=${TENANT_ID}" | jq '.items[] | {name, status}'
```

```bash
chmod +x register-mcp.sh
./register-mcp.sh
```

#### Step 3: 验证注册

```bash
# 查看所有 MCP Servers
curl -s http://localhost:3001/api/v1/mcp-servers | jq '.items[] | {name, status, tenantId}'

# 查看特定租户的 MCP Servers
curl -s http://localhost:3001/api/v1/mcp-servers?tenantId=quiz-analyzer | jq '.'

# 测试 MCP Server 健康检查
curl http://localhost:3001/api/v1/mcp-servers/{id}/health
```

**预期输出**:
```json
{
  "name": "quiz-analyzer-tools",
  "status": "running",
  "tenantId": "quiz-analyzer",
  "tools": [
    "parse_quiz_content",
    "search_knowledge_points",
    "write_output"
  ]
}
```

### 注册后工作流

```
用户发送消息
    ↓
CCAAS Backend 加载 Skills (tenantId: quiz-analyzer)
    ↓
AI Agent 分析消息，选择 Skill
    ↓
Skill 定义 allowedTools: ["parse_quiz_content", ...]
    ↓
CCAAS 自动启动对应的 MCP Server
    ↓
AI Agent 调用 MCP 工具
    ↓
MCP Server 执行业务逻辑，返回结果
    ↓
AI Agent 处理结果，生成响应
    ↓
Frontend 接收 output_update 事件
```

---

## 故障排查

### 常见问题

#### 1. MCP Server 无法启动

**症状**:
```
Error: Cannot find module './dist/index.js'
```

**原因**: TypeScript 未编译或路径错误

**解决**:
```bash
# 检查 dist 目录是否存在
ls -la dist/

# 重新编译
npm run build

# 验证入口文件
node dist/index.js  # 应该启动 Server 并等待 stdin
```

#### 2. 工具调用返回空结果

**症状**: AI 调用工具后没有输出

**原因**:
- 工具返回格式错误
- 缺少 `content` 字段
- 返回了 `undefined`

**解决**:
```typescript
// ❌ 错误
return results;

// ✅ 正确
return {
  content: [
    {
      type: 'text',
      text: JSON.stringify(results, null, 2),
    },
  ],
};
```

#### 3. console.log 导致协议错误

**症状**:
```
Error: Unexpected token in JSON at position 0
```

**原因**: stdio 模式下，`console.log` 输出到 stdout 污染了 MCP 协议通信

**解决**:
```typescript
// ❌ 错误 - 污染 stdout
console.log('Debug info');

// ✅ 正确 - 使用 stderr
console.error('Debug info');

// ✅ 更好 - 使用日志库
import { logger } from './logger';
logger.info('Debug info');  // 配置输出到文件
```

#### 4. 参数验证失败

**症状**:
```
Error: Invalid arguments for tool 'search_database'
```

**原因**: Zod schema 与 AI 调用不匹配

**解决**:
```typescript
// 检查 schema 定义
const SearchSchema = z.object({
  query: z.string(),  // 必需参数
  limit: z.number().optional(),  // 可选参数
});

// 调试：打印接收到的参数
console.error('Received args:', JSON.stringify(args, null, 2));

// 验证前先检查类型
if (typeof args.query !== 'string') {
  throw new Error('query must be a string');
}
```

#### 5. MCP Server 注册后无法调用

**症状**: Skill 已配置 `allowedTools`，但 AI 没有调用

**原因**:
- MCP Server 状态为 `stopped`
- tenantId 不匹配
- 工具名称拼写错误

**排查步骤**:

1. **检查 MCP Server 状态**:
   ```bash
   curl http://localhost:3001/api/v1/mcp-servers?tenantId=quiz-analyzer | jq '.items[] | {name, status}'
   ```

   应该显示 `"status": "running"`

2. **检查工具列表**:
   ```bash
   curl http://localhost:3001/api/v1/mcp-servers/{id}/tools | jq '.tools[] | .name'
   ```

   确认工具名称与 Skill 中 `allowedTools` 一致

3. **检查 Skill 配置**:
   ```bash
   # 查看 Skill 的 allowedTools
   sqlite3 packages/backend/.agent-workspace/data.db \
     "SELECT slug, allowedTools FROM skills WHERE tenantId='quiz-analyzer';"
   ```

4. **查看日志**:
   ```bash
   # CCAAS Backend 日志
   tail -f /tmp/ccaas-backend.log | grep MCP
   ```

#### 6. 权限错误

**症状**:
```
Error: EACCES: permission denied, open '/path/to/file'
```

**解决**:
```bash
# 检查文件权限
ls -la /path/to/file

# 修改权限
chmod 644 /path/to/file

# 或修改目录权限
chmod 755 /path/to/directory
```

---

## 最佳实践

### 工具设计原则

#### 1. 明确的工具命名

```typescript
// ❌ 不清晰
{ name: 'process', description: '处理数据' }

// ✅ 清晰
{ name: 'parse_quiz_content', description: '解析试卷内容为结构化数据' }
```

#### 2. 完整的参数 Schema

```typescript
// ❌ 过于宽松
const ToolSchema = z.object({
  data: z.any(),  // 任意类型
});

// ✅ 严格验证
const ToolSchema = z.object({
  content: z.string().min(1).describe('试卷内容（必需）'),
  subject: z.enum(['math', 'physics', 'chemistry']).describe('学科类型'),
  gradeLevel: z.number().int().min(1).max(12).optional().describe('年级（1-12）'),
});
```

#### 3. 结构化返回值

```typescript
// ❌ 返回字符串
return {
  content: [
    { type: 'text', text: 'Found 3 results' }
  ]
};

// ✅ 返回 JSON（便于后续处理）
return {
  content: [
    {
      type: 'text',
      text: JSON.stringify({
        count: 3,
        results: [...],
        metadata: { ... }
      }, null, 2),
    },
  ],
};
```

#### 4. 错误处理

```typescript
try {
  const results = await searchDatabase(query);

  if (results.length === 0) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: false,
            message: 'No results found',
            count: 0,
          }),
        },
      ],
    };
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(results),
      },
    ],
  };
} catch (error) {
  console.error('[search_database] Error:', error);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          error: true,
          message: error.message,
          code: 'DATABASE_ERROR',
        }),
      },
    ],
  };
}
```

#### 5. 日志记录

```typescript
// 推荐：使用 stderr 记录日志
console.error(`[${new Date().toISOString()}] Tool called: ${toolName}`);
console.error(`[${toolName}] Args:`, JSON.stringify(args, null, 2));
console.error(`[${toolName}] Result:`, JSON.stringify(result, null, 2));
```

#### 6. 性能优化

```typescript
// ❌ 每次调用都建立连接
async function searchDatabase(query: string) {
  const db = await connectToDatabase();  // 慢！
  const results = await db.query(query);
  await db.close();
  return results;
}

// ✅ 复用连接
let dbConnection: Database | null = null;

async function getConnection() {
  if (!dbConnection) {
    dbConnection = await connectToDatabase();
  }
  return dbConnection;
}

async function searchDatabase(query: string) {
  const db = await getConnection();  // 快速复用
  return await db.query(query);
}
```

### 测试检查清单

部署前确认：

- [ ] 所有工具在 MCP Inspector 中测试通过
- [ ] 参数验证正确处理无效输入
- [ ] 错误情况返回清晰的错误信息
- [ ] 无 `console.log` 输出到 stdout (仅 stderr)
- [ ] 返回值为标准 MCP 格式 (`{ content: [...] }`)
- [ ] 工具名称与 Skill 的 `allowedTools` 一致
- [ ] tenantId 配置正确
- [ ] 性能测试：大数据量、高并发场景
- [ ] 日志记录完整（请求、响应、错误）
- [ ] package.json scripts 包含 `build` 和 `start`

---

## 参考资源

- **MCP 官方文档**: [https://modelcontextprotocol.io](https://modelcontextprotocol.io)
- **MCP SDK**: [https://github.com/modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/sdk)
- **MCP Inspector**: [https://github.com/modelcontextprotocol/inspector](https://github.com/modelcontextprotocol/inspector)
- **CCAAS Backend API**: `packages/backend/docs/API.md`
- **Skill 编写指南**: [skill-writing.md](skill-writing.md)
- **write_output 最佳实践**: [write-output.md](write-output.md)
