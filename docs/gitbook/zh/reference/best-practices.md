# 最佳实践汇总

## Transport 配置

### 使用 SSE（默认，推荐）

自 v1.1.0 起，**SSE 是默认 transport**，无需额外配置：

```typescript
// ✅ SSE 是默认值 - 这是推荐模式
const connection = useAgentConnection({
  serverUrl: 'http://localhost:3001', // 始终使用绝对 URL 指向后端
  tenantId: 'my-solution',
})
const chat = useAgentChat({ connection, tenantId: 'my-solution' })
```

Chat 消息通过 `POST /api/v1/sessions/:id/messages` 以 `text/event-stream` 流式传输。

### Socket.IO Transport 已弃用

```typescript
// ❌ 已弃用 - 后端返回 410 Gone
const chat = useAgentChat({
  connection,
  tenantId: 'my-solution',
  transport: 'socket', // 会打印 deprecation warning
})
```

后端端点 `POST /api/v1/sessions/:id/completion` 返回 **410 Gone**。

> **已知限制：** 后台任务（`subagent_completed`）事件目前仍仅通过 Socket.IO 推送。在 SSE 模式下，后台任务完成通知不会收到。将在后续版本中解决。

### 始终使用绝对 serverUrl

```typescript
// ❌ 错误 - 请求会发往前端端口！
const connection = useAgentConnection({ serverUrl: '' })

// ✅ 正确 - 绝对 URL 指向后端
const connection = useAgentConnection({ serverUrl: 'http://localhost:3001' })
```

## 类型与契约管理

### 使用共享类型

始终从 `@kedge-agentic/common` 导入共享类型，保持前后端类型一致：

```typescript
import { Session, Skill, TokenUsage } from '@kedge-agentic/common'
```

### 运行时验证

使用 DTO + class-validator 进行运行时请求验证：

```typescript
class CreateCompletionDto {
  @IsString()
  clientId: string

  @IsString()
  message: string

  @IsOptional()
  @IsString()
  tenantId?: string
}
```

### 向后兼容

添加新参数时使用可选字段，确保向后兼容：

```typescript
// 新参数设为可选，有默认值
interface Options {
  existingField: string
  newField?: string  // 新增，可选
}
```

## TDD 强制规则

这是从实际教训中总结的强制性规则。

### 修改代码前

```
□ 运行 npm test 确认当前所有测试通过
□ 如果要改变 API/接口，先检查前端类型定义和现有测试
```

### 修改代码后

```
□ 立即运行相关测试，不要等到最后
□ 测试失败 = 停下来分析，不要继续前进
```

### 核心原则

> **测试是代码的契约，计划只是意图的表达。当计划与测试冲突时，应该质疑计划，而不是忽略测试。**

## 端到端数据流

### 完整调用链追踪

在修改任何环节前，先追踪完整的数据流：

```
UI 组件 → Hook → SSE/REST → Solution 后端 → CCAAS API → Agent → MCP → 响应
```

确保每个环节的数据格式都正确。

### 优先复用 CCAAS 能力

- 使用 CCAAS 的会话管理，不要自己实现
- 代理通用 API 调用
- 先确认后端是否已提供能力，再决定是否需要新增

## output\_update 处理

### 正确解析嵌套结构

```typescript
// ✅ 正确
const { field, value } = event.payload.data

// ❌ 错误
const { field, value } = event
```

### 使用 parseOutputUpdateEvent

```typescript
import { parseOutputUpdateEvent } from '../utils/outputUpdateParser'

socket.on('output_update', (raw) => {
  const parsed = parseOutputUpdateEvent(raw)
  if (parsed) {
    updateField(parsed.field, parsed.value, parsed.operation)
  }
})
```

### Zod Schema 验证

在 MCP Server 中对 write\_output 输出进行 Schema 验证：

```typescript
const fieldSchema = OutputSchema.shape[field]
if (fieldSchema) {
  const result = fieldSchema.safeParse(value)
  if (!result.success) {
    return res.status(400).json({ error: result.error.issues })
  }
}
```

## Solution 开发规则

### 复用原则

- 复用 CCAAS 后端的会话管理、Skill 路由、消息持久化
- 不要在 Solution 中重复实现这些能力
- 通过代理 API 调用使用通用功能

### 正确的 solution.json 配置

- 所有 MCP Server 必须在 `mcpServers` 中声明
- Skill 的 `allowedTools` 只包含实际需要的工具
- 触发器优先级需合理设置

### 完整的 Skill 集成

1. 使用 `useSkills` Hook 获取 Skill 列表
2. 实现 Skill ID → Slug 转换
3. 在会话 Hook 中传递启用的 Skill
4. 在 UI 中提供 Skill 开关

## 代码组织

### Hook 调用顺序

数据提供者 Hook 先于依赖者 Hook：

```typescript
// ✅ 正确顺序
const { skills } = useSkills()          // 数据提供者
const { session } = useSession(skills)   // 依赖 skills
```

### 最小变更原则

- 优先使用已有的后端能力
- 不要过度设计
- 修改范围尽可能小

## 常见错误与教训

### API 格式不兼容（2025-01 事件）

**问题**：修改代码前没有运行测试，修改后也没有验证，导致 API 格式不兼容，前端功能完全失效。

**教训**：
- 修改前运行测试
- 修改后立即验证
- 测试失败 = 停下来分析

### Skill 切换无效（2025-01 事件）

**问题**：前端 Skill 切换后 AI 行为不变，因为没有完整追踪数据流。

**教训**：
- 追踪完整的数据流
- 确认每个环节的数据格式
- 从 UI 到 Agent 的每一步都要验证

## 检查清单

### 新功能开发

```
□ 运行现有测试确认通过
□ 追踪完整数据流
□ 确认后端是否已有能力
□ 编写测试
□ 实现功能
□ 运行测试验证
□ 端到端测试
```

### API/接口修改

```
□ 检查所有消费方（前端、测试、其他包）
□ 确保向后兼容
□ 更新类型定义
□ 更新测试
□ 运行全部测试
```
