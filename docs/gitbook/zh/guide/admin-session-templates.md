# 会话模板管理

会话模板允许您预配置 AI 代理的行为，并在应用程序中重复使用配置，无需在前端代码中硬编码。

## 概述

**什么是会话模板？**

会话模板是可重用的配置，定义了：
- **系统提示词** - AI 代理的自定义指令
- **启用的技能** - 代理可以使用的技能
- **MCP 服务器** - 外部工具集成
- **元数据** - 描述和其他设置

**优势：**
- ✅ 集中配置管理
- ✅ 多租户支持（每个租户拥有自己的模板）
- ✅ 无需代码更改即可更新代理行为
- ✅ 基于角色的代理个性（教师、学生、管理员等）
- ✅ A/B 测试不同的提示词

## 快速开始

### 1. 访问管理后台

```bash
# 启动管理后台
npm run dev:admin
```

导航至：`http://localhost:5175/session-templates`

### 2. 创建模板

点击 **"创建模板"** 并填写：

- **名称**：`teacher-assistant`（小写，仅连字符）
- **描述**：`教师视图，包含完整分析功能`
- **系统提示词**：
  ```
  你是一位帮助教师的教育分析助手。

  你的职责：
  - 分析学生作业并提供洞察
  - 建议教学策略
  - 提供课程对齐
  ```
- **技能**：`knowledge-matching, complete-analysis`

点击 **保存**。

### 3. 在前端使用模板

```typescript
import { useAgentChat } from '@ccaas/react-sdk'

export function TeacherView() {
  const chat = useAgentChat({
    serverUrl: 'http://localhost:3001',
    tenantId: 'your-tenant-id',
    sessionTemplate: 'teacher-assistant', // ← 使用你的模板
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

查看所有会话模板，包括：
- 模板名称和描述
- 启用的技能（显示前 3 个，"+N 更多"）
- 系统提示词指示器
- 编辑/删除操作

### 创建/编辑表单

**标签 1：基本信息**
- 模板名称（创建后不可更改）
- 描述（可选）

**标签 2：系统提示词**
- 多行 Markdown 文本区域
- 在运行时附加到技能系统提示词

**标签 3：技能**
- 逗号分隔的技能标识符
- 示例：`knowledge-matching, analysis, planning`

**标签 4：MCP 服务器**
- MCP 服务器的 JSON 配置
- 实时验证

## API 端点

所有端点都需要 `admin` 权限。

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
      "appendSystemPrompt": "你是...",
      "enabledSkillSlugs": ["knowledge-matching"]
    }
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
    "enabledSkillSlugs": ["knowledge-matching", "analysis"]
  }
}
```

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

## 常见用例

### 多角色应用

为不同用户角色创建不同的模板：

```typescript
const templateMap = {
  admin: 'admin-assistant',
  teacher: 'teacher-assistant',
  student: 'student-practice',
}

const chat = useAgentChat({
  tenantId: user.tenantId,
  sessionTemplate: templateMap[user.role],
})
```

### A/B 测试

测试不同的提示词，看哪个表现更好：

```typescript
const template = user.id % 2 === 0
  ? 'variant-a'
  : 'variant-b'

const chat = useAgentChat({
  sessionTemplate: template,
})
```

### 多租户 SaaS

每个租户获得自己配置的模板：

```typescript
// 每个租户可以自定义自己的模板
const chat = useAgentChat({
  tenantId: user.tenantId,
  sessionTemplate: 'default-assistant',
})
```

## 模板解析

当您需要覆盖或扩展时，模板支持参数合并：

```typescript
// 模板配置（来自管理界面）：
{
  "appendSystemPrompt": "你是一位教师助手",
  "enabledSkillSlugs": ["knowledge-matching"]
}

// 前端显式参数：
useAgentChat({
  sessionTemplate: 'teacher-assistant',
  enabledSkillSlugs: ['custom-skill'], // 覆盖模板
  appendSystemPrompt: '附加上下文', // 附加到模板
})

// 发送到后端的最终解析参数：
{
  "enabledSkillSlugs": ["custom-skill"], // 显式参数优先
  "appendSystemPrompt": "你是一位教师助手\n\n附加上下文"
}
```

## 最佳实践

### ✅ 应该

- **使用描述性名称**：`teacher-analysis` 而不是 `template1`
- **在描述中记录**：帮助其他管理员理解模板
- **部署前测试**：先创建测试模板
- **使用基于角色的模板**：不同用户角色使用不同模板
- **保持提示词专注**：每个模板一个明确的目的

### ❌ 不应该

- **使用大写或空格**：名称必须是 `lowercase-with-hyphens`
- **在提示词中放置密钥**：它们存储在数据库中
- **创建重复项**：编辑现有模板
- **更改名称**：删除 + 创建来重命名（名称不可变）

## 安全

### 认证

所有管理端点都需要：
- **API Key**：具有 `admin` 权限
- **请求头**：`Authorization: Bearer <api-key>`

### 审计跟踪

所有模板更改都会被记录：
- `sessionTemplate.create` - 模板创建
- `sessionTemplate.update` - 模板修改（包含前后对比）
- `sessionTemplate.delete` - 模板删除（包含删除的数据）

在管理后台 → 审计日志中查看审计日志。

## 故障排除

### 模板在前端未显示

**检查：**
1. 前端的 `tenantId` 是否与模板的租户匹配
2. 模板名称拼写是否正确
3. 模板是否存在于数据库中

**调试：**
```bash
curl -H "Authorization: Bearer <key>" \
  http://localhost:3001/api/v1/admin/tenants/your-tenant/session-templates
```

### 模板创建失败

**错误**："Session template already exists"（会话模板已存在）

**解决方案**：每个租户的模板名称必须唯一。使用编辑功能或选择不同的名称。

### 技能不工作

**检查：**
1. 技能标识符拼写是否正确
2. 技能是否在系统中注册
3. 技能是否已从解决方案后端同步

## 相关指南

- [管理员 API Key 管理](admin-api-keys.md) - 创建管理员 API 密钥
- [前端集成指南](frontend.md) - 使用 react-sdk
- [技能编写指南](skill-writing.md) - 创建自定义技能

## 完整文档

有关详细的 API 参考、架构细节和高级功能，请参阅：
- **[会话模板管理文档](../../features/SESSION_TEMPLATES_ADMIN.md)**（英文）
- **[快速开始指南](../../quickstart/ADMIN_SESSION_TEMPLATES.md)**（英文）
