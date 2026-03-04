# Bundle 能力包

Bundle 是平台级可插拔能力包，为 Solution 提供开箱即用的 MCP 工具和事件映射，无需重复实现。

## 零配置

默认情况下，**所有内置 Bundle 自动启用**。无需任何配置——直接构建你的 Solution，所有平台能力即可使用。

```json
{
  "schemaVersion": "3.0",
  "tenant": {
    "name": "我的方案",
    "slug": "my-solution"
  },
  "mcpServers": {
    "my-tools": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"]
    }
  }
}
```

就这样。你的 AI Agent 自动拥有 `write_output`、`attach_file` 和 `read_context` 工具。

{% hint style="info" %}
这是 **simple 模式**（默认）。如果需要按模板精确控制哪些 Bundle 生效，请参阅 [Bundle 高级配置](bundles-advanced.md)。
{% endhint %}

## 内置 Bundle

| Bundle | ID | 提供的能力 |
|--------|-----|-----------|
| **结构化输出** | `structured-output` | 将 `write_output` 工具结果映射为 `output_update` 事件，推送到前端表单 |
| **文件附件** | `file-attachments` | 提供 `attach_file` 工具，用于 AI 生成的文件附件 |
| **共享上下文** | `shared-context` | 提供 `read_context` 工具，读取前端同步的页面上下文 |

### structured-output

将 `write_output` 工具的返回值自动映射为 `output_update` 事件，推送到前端表单。

- **工具来源**：Solution 自己的 MCP Server（因为字段 schema 是 Solution 特有的）
- **Bundle 职责**：仅负责事件触发映射
- **适用场景**：教案设计、表单填充、任何需要结构化输出的 Solution

### file-attachments

提供 `attach_file` 工具，允许 AI Agent 将会话中生成的文件注册为附件。

- **工具来源**：平台内置 MCP Server
- **Bundle 职责**：注入 MCP Server + 事件触发映射
- **适用场景**：生成 PDF 报告、导出图片、任何需要文件附件的 Solution

### shared-context

提供 `read_context` 工具，允许 AI Agent 读取前端同步的页面上下文，支持 `full` 和 `diff` 两种模式。

- **工具来源**：平台内置 MCP Server
- **Bundle 职责**：注入 MCP Server（只读工具，不触发事件）
- **适用场景**：任何 AI Agent 需要读取用户当前在前端查看或编辑内容的 Solution

## 使用 file-attachments

### 1. 在 Skill 中指示 Agent 使用 attach_file

```markdown
# 输出指令

当用户要求导出文件时，使用 `attach_file` 工具：

- filePath: 要附加的文件绝对路径
- description: 文件描述（用于前端展示）
```

### 2. 前端处理附件事件

`attach_file` 的结果会通过 `output_update` 事件推送到前端：

```typescript
import { useAgentChat } from '@kedge-agentic/react-sdk'

const chat = useAgentChat({
  connection,
  tenantId: 'my-solution',
  onOutputUpdate: (update) => {
    if (update.field === 'attachment') {
      addAttachment(update.value)
    }
  },
})
```

## 相关指南

- [write\_output 最佳实践](write-output.md) — 结构化输出的详细用法
- [MCP Server 开发](mcp-server.md) — 工具事件触发器机制
- [Bundle 高级配置](bundles-advanced.md) — 按模板控制、Admin API、故障排查
- [solution.json 配置参考](../reference/solution-json.md) — 完整配置字段说明
