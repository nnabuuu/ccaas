# Solution MCP Server 迁移指南：stdio → REST API

## 背景

CCAAS 后端的 MCP Pool 只支持 `rest-adapter` 类型的 MCP Server。如果你的 solution 使用 stdio 类型的 MCP Server（基于 `@modelcontextprotocol/sdk`），AI 将无法调用这些工具。

本指南说明如何将 stdio MCP Server 迁移到 REST API。

## 迁移步骤

### Step 1: 修改 mcp-server/src/index.ts

**改动前** (stdio):
```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server({...});

// Request handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {...});
server.setRequestHandler(CallToolRequestSchema, async (request) => {...});

// Start
const transport = new StdioServerTransport();
await server.connect(transport);
```

**改动后** (REST API):
```typescript
import express, { Request, Response } from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.MCP_PORT || 3004;

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', service: 'your-mcp-server' });
});

// 每个工具一个 POST 端点
app.post('/tools/your_tool_name', (req: Request, res: Response) => {
  const input = req.body;

  // 工具逻辑...

  res.json({
    status: 'success',
    data: { /* 结果 */ }
  });
});

app.listen(PORT, () => {
  console.log(`MCP REST Server running on http://localhost:${PORT}`);
});
```

### Step 2: 更新 mcp-server/package.json

添加 Express 依赖：

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/node": "^20.3.1",
    "typescript": "^5.1.3"
  }
}
```

移除 `@modelcontextprotocol/sdk` 依赖（如果不再需要）。

### Step 3: 更新 inject-skills.sh

添加 MCP Server 注册步骤：

```bash
# Step 3: Register MCP Server
echo "Step 3: Registering MCP Server..."

MCP_SERVER_URL="${MCP_SERVER_URL:-http://localhost:3004}"

MCP_SERVER_PAYLOAD=$(cat <<'EOF'
{
  "name": "Your Solution Tools",
  "slug": "your-solution-tools",
  "description": "工具描述",
  "type": "rest-adapter",
  "config": {
    "restAdapter": {
      "baseUrl": "MCP_URL_PLACEHOLDER",
      "auth": { "type": "none" },
      "timeout": 30000,
      "endpoints": [
        {
          "name": "your_tool_name",
          "description": "工具说明",
          "method": "POST",
          "path": "/tools/your_tool_name",
          "body": {
            "type": "json",
            "schema": {
              "param1": {
                "type": "string",
                "description": "参数说明",
                "required": true
              }
            }
          }
        }
      ]
    }
  }
}
EOF
)

# 替换 URL
MCP_SERVER_PAYLOAD=$(echo "$MCP_SERVER_PAYLOAD" | sed "s|MCP_URL_PLACEHOLDER|$MCP_SERVER_URL|g")

# 创建或更新
curl -s -X POST "$CCAAS_URL/api/v1/mcp-servers" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: $TENANT_ID" \
  -d "$MCP_SERVER_PAYLOAD"
```

### Step 4: 更新 setup.sh

在 `start_services()` 中添加 MCP Server 启动：

```bash
start_services() {
    # Start MCP REST Server
    echo "Starting MCP REST Server on port 3004..."
    (cd "$SCRIPT_DIR/mcp-server" && npm run start) &
    MCP_PID=$!

    # Wait for it to be ready
    sleep 2

    # ... 其他服务启动
}
```

### Step 5: 更新 solution.json

将 mcpServers 配置改为 rest-adapter 类型：

```json
{
  "mcpServers": {
    "your-solution-tools": {
      "type": "rest-adapter",
      "baseUrl": "http://localhost:3004",
      "description": "Your Solution MCP REST API"
    }
  },
  "mcpServer": {
    "port": 3004
  }
}
```

## REST Adapter Endpoint 定义格式

每个端点需要定义以下字段：

```typescript
interface RestEndpoint {
  name: string;           // 工具名称（AI 调用时使用）
  description: string;    // 工具描述（让 AI 理解用途）
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;           // REST 端点路径
  pathParams?: Record<string, ParamSchema>;   // 路径参数
  queryParams?: Record<string, ParamSchema>;  // 查询参数
  body?: {
    type: 'json' | 'form' | 'multipart';
    schema: Record<string, ParamSchema>;
  };
}

interface ParamSchema {
  type: 'string' | 'integer' | 'number' | 'boolean';
  description?: string;
  required?: boolean;
  default?: unknown;
  enum?: unknown[];
}
```

## 验证步骤

1. **编译 MCP Server**:
   ```bash
   cd mcp-server && npm run build
   ```

2. **启动并测试**:
   ```bash
   npm run start
   curl http://localhost:3004/health
   ```

3. **注入到 CCAAS**:
   ```bash
   ./inject-skills.sh
   ```

4. **验证注册**:
   ```bash
   curl http://localhost:3001/api/v1/mcp-servers -H 'X-Tenant-Id: your-tenant'
   ```

## 端口分配建议

| Solution | MCP Server Port |
|----------|-----------------|
| ccaas-demo | (内置) |
| problem-explainer | 3004 |
| lesson-plan-designer | 3005 |
| 新 solution | 3006+ |

## 常见问题

### Q: 工具不显示在 AI 可用工具列表中

检查：
1. MCP Server 是否正在运行：`curl http://localhost:3004/health`
2. MCP Server 是否已注册到 CCAAS：`curl .../api/v1/mcp-servers`
3. 端点定义的 `name` 是否与 skill 的 `allowedTools` 匹配

### Q: AI 调用工具时返回错误

检查：
1. REST 端点路径是否正确
2. 请求/响应 JSON 格式是否正确
3. MCP Server 日志中是否有错误

### Q: write_output 内容不显示在前端

检查：
1. 前端是否正确处理 `output_update` WebSocket 事件
2. `useExplanationSync` hook 是否正确配置
3. SYNC_FIELDS 定义是否一致

## 参考实现

完整示例参见：`solutions/problem-explainer/mcp-server/src/index.ts`
