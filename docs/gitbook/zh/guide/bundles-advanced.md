# Bundle 高级配置

本页面介绍 Solution 中按模板精确控制 Bundle 能力的高级配置方式。大多数 Solution 使用默认的 [simple 模式](bundles.md)（零配置）即可满足需求。

## 何时使用高级模式

使用 `mode: "advanced"` 的场景：

- **不同角色需要不同的能力** — 例如「教师」模式需要 `structured-output` 但不需要 `file-attachments`，而「导出」模式两者都需要
- **希望减少 MCP Server 开销** — 每个会话模板只启用实际使用的 Bundle
- **构建多模板 Solution** — 每个模板有专门的行为

## 启用高级模式

在 `solution.json` 中设置 `mode: "advanced"`，并在每个会话模板中声明 `bundles`：

```json
{
  "schemaVersion": "3.0",
  "mode": "advanced",
  "solution": {
    "name": "备课方案设计器",
    "slug": "lesson-plan-designer"
  },
  "sessionTemplates": {
    "teacher": {
      "description": "教师备课模式",
      "enabledSkills": ["lesson-plan-designer"],
      "bundles": ["structured-output"]
    },
    "export": {
      "description": "导出模式（含文件附件）",
      "enabledSkills": ["lesson-plan-designer"],
      "bundles": ["structured-output", "file-attachments", "shared-context"]
    }
  },
  "mcpServers": {
    "lesson-tools": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"]
    }
  }
}
```

## 两层配置

高级模式下，Bundle 通过两层配置控制：

```
┌──────────────────────────────┐
│  Solution 级别                  │
│  config.enabledBundles       │  ← 该租户启用的 Bundle 总集
│  ["structured-output",       │
│   "file-attachments",        │
│   "shared-context"]          │
└─────────────┬────────────────┘
              │ 子集
┌─────────────▼────────────────┐
│  Session Template 级别        │
│  template.bundles            │  ← 特定模板激活的 Bundle
│  ["structured-output"]       │
└──────────────────────────────┘
```

**规则：**
- Session Template 的 `bundles` 必须是 Solution `enabledBundles` 的**子集**
- 如果 Session Template 未指定 `bundles`，则使用 Solution 的全部 `enabledBundles`
- 不在 Solution `enabledBundles` 中的 Bundle 会被静默忽略并记录警告日志

{% hint style="info" %}
**Solution `enabledBundles` 在哪里配置？** 高级模式下，`sessionTemplates.bundles` 中声明的 Bundle 会在 Solution 加载时自动同步到 Solution 配置。也可通过 Admin API 管理（见下方）。
{% endhint %}

## Simple 与 Advanced 对比

| 方面 | Simple（默认） | Advanced |
|------|---------------|----------|
| 配置 | 无需配置 | `mode: "advanced"` + 逐模板声明 `bundles` |
| Bundle 激活 | 所有内置 Bundle 自动启用 | 仅启用声明的 Bundle |
| MCP Server 去重 | 自动过滤 Bundle 已提供的 server | 不过滤——需手动管理 |
| 适用场景 | 大多数 Solution | 多模板、角色化能力控制的 Solution |

## Admin API

管理端点用于查看和管理 Bundle 配置。所有端点需要 `admin` 权限的 API Key。

### 列出所有可用 Bundle

```http
GET /api/v1/admin/bundles
Authorization: Bearer <admin-api-key>
```

**响应：**
```json
{
  "bundles": [
    {
      "id": "structured-output",
      "name": "Structured Output",
      "description": "Sync AI-generated structured data to frontend forms via write_output tool.",
      "toolEventTriggers": [
        { "toolName": "write_output", "eventType": "output_update" }
      ]
    },
    {
      "id": "file-attachments",
      "name": "File Attachments",
      "description": "Attach session-generated files as output via attach_file tool.",
      "mcpServer": { "command": "node", "args": ["..."] },
      "toolEventTriggers": [
        { "toolName": "attach_file", "eventType": "output_update" }
      ]
    },
    {
      "id": "shared-context",
      "name": "Shared Context",
      "description": "Read frontend-synced page context via read_context tool.",
      "mcpServer": { "command": "node", "args": ["..."] },
      "toolEventTriggers": []
    }
  ]
}
```

### 查看租户已启用的 Bundle

```http
GET /api/v1/admin/solutions/:solutionId/bundles
Authorization: Bearer <admin-api-key>
```

### 更新租户 Bundle 配置

```http
PATCH /api/v1/admin/solutions/:solutionId/bundles
Authorization: Bearer <admin-api-key>
Content-Type: application/json

{
  "enabledBundles": ["structured-output", "file-attachments", "shared-context"]
}
```

{% hint style="warning" %}
更新后，新创建的会话会使用新配置。已有会话不受影响。
{% endhint %}

## 最佳实践

### ✅ 应该

- **优先使用 simple 模式** — 只在确实需要按模板控制时才切换到 advanced 模式
- **按需启用** — advanced 模式下，只启用每个模板实际需要的 Bundle
- **在 Session Template 中精确控制** — 不同角色可能需要不同的 Bundle 组合

### ❌ 不应该

- **过度配置** — 如果所有模板需要相同的 Bundle，使用 simple 模式
- **在 MCP Server 中重复实现** — Bundle 已处理的事件映射无需手动配置 `toolEventTriggers`
- **忽略子集规则** — Session Template 中引用未在 Solution 级别启用的 Bundle 会被静默忽略

## 故障排查

### write_output 不触发 output_update 事件

1. 确认 Solution 已启用 `structured-output` Bundle：
   ```bash
   curl -H "Authorization: Bearer <key>" \
     http://localhost:3001/api/v1/admin/solutions/<solutionId>/bundles
   ```
2. 如果使用了 Session Template，确认模板的 `bundles` 包含 `structured-output`
3. 确认 MCP Server 中 `write_output` 工具的返回格式正确（`data` 在 `content[].text` 的 JSON 中）

### attach_file 工具不可用

1. 确认 Solution 已启用 `file-attachments` Bundle
2. 确认 `attach-file-server` 的构建产物存在：`packages/mcp/attach-file-server/dist/index.js`
3. 检查环境变量 `CORE_MCP_DIR` 是否正确指向 MCP 服务器目录

### read_context 工具不可用

1. 确认 Solution 已启用 `shared-context` Bundle
2. 确认 `shared-context-server` 的构建产物存在：`packages/mcp/shared-context-server/dist/index.js`
3. 在 simple 模式下，确保未在 `mcpServers` 中手动声明路径不同的 `shared-context-server`

### Session Template 中的 Bundle 配置被忽略

检查后端日志中是否有以下警告：
```
Bundle "xxx" referenced in template but not enabled at solution level — skipping
```
这表明该 Bundle 未在 Solution 级别启用。通过 Admin API 的 `enabledBundles` 端点启用。

### 如何查看当前会话激活了哪些 Bundle

后端在会话创建时会输出调试日志：
```
Resolved 3 active bundle(s): structured-output, file-attachments, shared-context
```
将后端日志级别设置为 `debug` 可查看详细的 Bundle 解析过程。

## 相关指南

- [Bundle 能力包](bundles.md) — 内置 Bundle 与 simple 模式
- [会话模板管理](admin-session-templates.md) — Session Template 配置
- [solution.json 配置参考](../reference/solution-json.md) — 完整配置字段说明
