# 会话模板管理

会话模板允许您预配置 AI 代理的行为，并在应用程序中重复使用配置，无需在前端代码中硬编码。

## 概述

**什么是会话模板？**

会话模板是按租户存储的可重用配置，定义了：
- **系统提示词** — AI 代理的自定义指令（在运行时追加）
- **启用的技能** — 代理可以使用的技能列表
- **MCP 服务器** — 外部工具集成配置
- **模型覆盖** — 为此模板指定特定的 AI 模型
- **描述** — 供管理员参考的可读标签

**优势：**
- ✅ 集中配置管理 — 无需代码部署即可更新代理行为
- ✅ 多租户支持 — 每个租户拥有独立的模板集合
- ✅ 基于角色的代理个性（教师、学生、管理员等）
- ✅ A/B 测试不同的提示词
- ✅ 完整的审计追踪，满足合规要求

**限制：**
- 每个租户最多 **50 个模板**
- 模板名称创建后**不可更改**

## 快速开始

### 1. 访问管理后台

```bash
npm run dev:admin
```

导航至：`http://localhost:5175/session-templates`

### 2. 创建模板

点击 **"创建模板"** 并填写：

| 字段 | 示例 | 说明 |
|------|------|------|
| 名称 | `teacher-assistant` | 小写字母、连字符/下划线。创建后不可更改。 |
| 描述 | `教师视图，包含完整分析功能` | 可选，最多 500 字符 |
| 模型覆盖 | `claude-opus-4-6` | 可选 — 留空则使用租户默认模型 |
| 系统提示词 | `你是一位教师助手...` | 运行时追加，最多 10,000 字符 |
| 技能标识符 | `knowledge-matching, analysis` | 逗号分隔 |
| MCP 服务器 | `{ "server": { "command": "node", ... } }` | JSON 格式 |

点击 **保存**。

### 3. 在前端使用模板

```typescript
import { useAgentChat } from '@ccaas/react-sdk'

export function TeacherView() {
  const chat = useAgentChat({
    serverUrl: 'http://localhost:3001',
    tenantId: 'your-tenant-id',
    sessionTemplate: 'teacher-assistant', // ← 填入模板名称
  })

  return (
    <ChatInterface
      messages={chat.messages}
      onSend={chat.sendMessage}
      isProcessing={chat.isProcessing}
    />
  )
}
```

## 管理界面功能

### 列表页面

查看所有会话模板，显示：
- 模板名称和描述
- 启用的技能（显示前 3 个，超出部分显示 "+N 更多" 标记）
- 系统提示词指示器（是/否标记）
- 编辑 / 删除操作

删除模板时会弹出确认对话框 — 点击 **删除** 确认操作。

### 创建/编辑表单

**基本信息卡片**
- 模板名称（必填；创建后不可更改）
- 描述（可选）
- 模型覆盖（可选 — 为此模板指定 AI 模型）

**标签页：系统提示词**
- 多行文本区域（最多 10,000 字符）
- 内容在运行时追加到技能系统提示词之后

**标签页：技能**
- 逗号分隔的技能标识符
- 示例：`knowledge-matching, analysis, planning`

**标签页：MCP 服务器**
- MCP 工具服务器的 JSON 配置
- 内联实时 JSON 验证，错误时显示提示信息

## 模板字段参考

| 字段 | 类型 | 最大长度 | 说明 |
|------|------|---------|------|
| `description` | string | 500 | 可读描述 |
| `appendSystemPrompt` | string | 10,000 | 追加到代理指令的提示词 |
| `enabledSkillSlugs` | string[] | — | 代理允许使用的技能列表 |
| `mcpServers` | object | — | MCP 服务器配置（见下方格式） |
| `model` | string | 128 | 模型 ID 覆盖（如 `claude-opus-4-6`） |

### MCP 服务器格式

```json
{
  "server-name": {
    "command": "node",
    "args": ["server.js"],
    "description": "可选描述"
  }
}
```

## API 端点

所有端点都需要具有 `admin` 权限的 API Key。

### 列出模板

```http
GET /api/v1/admin/tenants/:tenantId/session-templates
Authorization: Bearer <admin-api-key>
```

**响应：**
```json
{
  "templates": {
    "teacher-assistant": {
      "description": "教师视图",
      "appendSystemPrompt": "你是一位教育分析师...",
      "enabledSkillSlugs": ["knowledge-matching"],
      "model": "claude-opus-4-6"
    }
  },
  "defaultTemplate": "teacher-assistant"
}
```

### 获取单个模板

```http
GET /api/v1/admin/tenants/:tenantId/session-templates/:name
Authorization: Bearer <admin-api-key>
```

**响应：**
```json
{
  "name": "teacher-assistant",
  "template": {
    "description": "教师视图",
    "appendSystemPrompt": "你是一位教育分析师..."
  }
}
```

### 创建模板

```http
POST /api/v1/admin/tenants/:tenantId/session-templates
Authorization: Bearer <admin-api-key>
Content-Type: application/json

{
  "name": "teacher-assistant",
  "template": {
    "description": "教师视图",
    "appendSystemPrompt": "你是一位教育分析师...",
    "enabledSkillSlugs": ["knowledge-matching", "analysis"],
    "model": "claude-opus-4-6"
  }
}
```

**错误响应：**
- `409 Conflict` — 模板名称已存在
- `400 Bad Request` — 租户已达到 50 个模板的上限

### 更新模板

```http
PUT /api/v1/admin/tenants/:tenantId/session-templates/:name
Authorization: Bearer <admin-api-key>
Content-Type: application/json

{
  "template": {
    "description": "更新的描述",
    "appendSystemPrompt": "更新的提示词...",
    "enabledSkillSlugs": ["new-skill"]
  }
}
```

### 删除模板

```http
DELETE /api/v1/admin/tenants/:tenantId/session-templates/:name
Authorization: Bearer <admin-api-key>
```

> **注意：** 如果被删除的模板是租户的 `defaultSessionTemplate`，该引用会被自动清除。

### 预览模板解析结果

在部署前测试模板与前端显式参数的合并效果：

```http
POST /api/v1/admin/tenants/:tenantId/session-templates/:name/preview
Authorization: Bearer <admin-api-key>
Content-Type: application/json

{
  "explicitParams": {
    "enabledSkillSlugs": ["override-skill"],
    "appendSystemPrompt": "附加上下文"
  }
}
```

**响应：**
```json
{
  "template": { ... },
  "resolved": {
    "enabledSkillSlugs": ["override-skill"],
    "appendSystemPrompt": "模板基础提示词\n\n附加上下文",
    "mcpServers": {}
  }
}
```

## 模板解析规则

当前端同时传递 `sessionTemplate` 和显式参数时，按以下规则合并：

| 字段 | 合并策略 |
|------|---------|
| `enabledSkillSlugs` | **替换** — 显式参数完全覆盖模板值 |
| `mcpServers` | **浅合并** — 显式服务器添加/覆盖模板服务器 |
| `appendSystemPrompt` | **追加** — 显式内容追加在模板内容之后 |
| `model` | **替换** — 显式参数完全覆盖模板值 |

```typescript
// 模板配置（来自管理界面）：
{
  "appendSystemPrompt": "你是一位教师助手",
  "enabledSkillSlugs": ["knowledge-matching"],
  "mcpServers": { "server-a": { ... } }
}

// 前端显式参数：
useAgentChat({
  sessionTemplate: 'teacher-assistant',
  enabledSkillSlugs: ['custom-skill'],      // 替换模板列表
  appendSystemPrompt: '附加上下文',          // 追加在模板提示词之后
  // mcpServers 未指定 → 使用模板中的服务器
})

// 发送到后端的最终解析参数：
{
  "enabledSkillSlugs": ["custom-skill"],
  "appendSystemPrompt": "你是一位教师助手\n\n附加上下文",
  "mcpServers": { "server-a": { ... } }
}
```

## 常见用例

### 多角色应用

```typescript
const templateMap: Record<string, string> = {
  admin: 'admin-assistant',
  teacher: 'teacher-assistant',
  student: 'student-practice',
}

const chat = useAgentChat({
  tenantId: user.tenantId,
  sessionTemplate: templateMap[user.role],
})
```

### A/B 测试提示词

```typescript
const template = user.id % 2 === 0 ? 'variant-a' : 'variant-b'

const chat = useAgentChat({ sessionTemplate: template })
```

### 多租户 SaaS

```typescript
// 每个租户通过管理界面管理自己的模板。
// 前端只需引用模板名称：
const chat = useAgentChat({
  tenantId: user.tenantId,
  sessionTemplate: 'default-assistant',
})
```

## 最佳实践

### ✅ 应该

- **使用描述性名称**：`teacher-analysis` 而不是 `template1`
- **在描述中记录**：帮助其他管理员理解模板的用途
- **使用预览 API 测试**：部署前验证合并行为
- **使用基于角色的模板**：不同用户角色使用不同模板
- **保持提示词专注**：每个模板一个明确的目的

### ❌ 不应该

- **使用大写或空格**：名称必须匹配 `[a-z0-9][a-z0-9_-]*`
- **在提示词中放置密钥**：它们以明文存储在数据库中
- **创建重复项**：使用编辑功能更新现有模板
- **重命名模板**：需要删除后重新创建（名称不可变）
- **超过 50 个模板**：规划模板层级结构以保持在限制内

## 安全

### 认证

所有管理端点都需要：
- 具有 `admin` 权限的 API Key
- 请求头：`Authorization: Bearer <api-key>`

### 审计追踪

所有模板变更都会自动记录日志：

| 操作 | 记录内容 |
|------|---------|
| `sessionTemplate.create` | 模板名称 + 完整模板配置 |
| `sessionTemplate.update` | 模板名称 + 修改前后的值 |
| `sessionTemplate.delete` | 模板名称 + 被删除的模板配置 |

查看审计日志：**管理后台 → 审计日志**

## 故障排除

### 模板在前端未显示

**检查：**
1. 前端的 `tenantId` 是否与拥有该模板的租户匹配
2. 模板名称拼写是否完全正确（区分大小写）
3. 通过 API 验证模板是否存在：

```bash
curl -H "Authorization: Bearer <key>" \
  http://localhost:3001/api/v1/admin/tenants/<tenantId>/session-templates
```

### 模板创建返回 409

**错误**：`Session template already exists`（会话模板已存在）

**解决方案**：每个租户的模板名称必须唯一。使用编辑功能更新现有模板，或选择不同的名称。

### 模板创建返回 400（已达上限）

**错误**：`Tenant has reached the maximum of 50 session templates`

**解决方案**：删除不再使用的模板或合并多个配置。

### 技能未生效

**检查：**
1. 技能标识符拼写是否完全正确（需要精确匹配）
2. 技能是否已在系统中注册并处于激活状态
3. 技能是否已从解决方案后端同步

## 相关指南

- [管理员 API Key 管理](admin-api-keys.md) — 创建管理员 API 密钥
- [前端集成指南](frontend.md) — 使用 `@ccaas/react-sdk`
- [技能编写指南](skill-writing.md) — 创建自定义技能
