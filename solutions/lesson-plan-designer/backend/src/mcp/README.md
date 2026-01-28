# MCP Integration (预留)

此目录预留用于 MCP (Model Context Protocol) 服务集成。

## 计划接口

```typescript
// mcp-service.ts (待实现)

export interface MCPService {
  // 调用AI生成备课内容
  generateLessonContent(
    prompt: string,
    context: LessonPlanContext
  ): Promise<AIResponse>

  // 解析AI输出为结构化数据
  parseOutputUpdate(response: string): OutputUpdate[]

  // 流式响应处理
  streamResponse(
    prompt: string,
    onDelta: (content: string) => void,
    onUpdate: (update: OutputUpdate) => void
  ): Promise<void>
}

export interface LessonPlanContext {
  lessonPlanId: string
  currentForm: Partial<LessonPlan>
  previousMessages?: Message[]
}

export interface AIResponse {
  text: string
  updates: OutputUpdate[]
}

export interface OutputUpdate {
  field: SyncField
  value: unknown
  preview: string
}
```

## 集成步骤

1. 安装 MCP SDK:
   ```bash
   npm install @modelcontextprotocol/sdk
   ```

2. 创建 MCP 服务实现文件 `mcp-service.ts`

3. 在 `socket/index.ts` 中替换 `simulateAIResponse` 为实际 MCP 调用

4. 配置 MCP 服务器连接参数（通过环境变量）

## 示例实现

```typescript
// 示例: 使用 MCP 调用 Claude
import { MCPClient } from '@modelcontextprotocol/sdk'

export class MCPServiceImpl implements MCPService {
  private client: MCPClient

  constructor(serverUrl: string) {
    this.client = new MCPClient(serverUrl)
  }

  async generateLessonContent(
    prompt: string,
    context: LessonPlanContext
  ): Promise<AIResponse> {
    const response = await this.client.invoke('generate', {
      prompt,
      context,
    })
    return this.parseResponse(response)
  }

  // ...其他方法实现
}
```

## 环境变量

```env
# .env
MCP_SERVER_URL=http://localhost:3001
MCP_API_KEY=your-api-key
```
