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

## 什么时候需要用这个

### 核心问题：同一个 Agent，不同的用户

大多数真实应用都有多种用户角色——不同角色应该获得不同的 AI 能力。管理员能看到的数据，普通用户不该看到；老师能用的工具，学生不该触及；运营人员能执行的操作，访客根本不应该接触。

最直接的想法是从前端直接传入配置：

```typescript
// ❌ 朴素做法 —— 前端决定 Agent 能做什么
const chat = useAgentChat({
  enabledSkills: user.role === 'teacher' ? ['analyze', 'grade'] : ['hint'],
  appendSystemPrompt: user.role === 'teacher' ? '你是...' : '你是...',
})
```

这种做法有三个根本性的问题：

1. **安全漏洞** —— 前端控制了 Agent 能使用哪些技能和工具。有心的用户可以传入任意 skill slug，服务端没有任何强制约束。
2. **运营脆弱** —— 每次需要修改某个角色的提示词或新增技能，都必须改代码、重新部署。AI 团队无法独立迭代。
3. **配置分散** —— Agent 的行为逻辑散落在各个前端组件里，没有统一管理的地方。

### 解决思路：把角色配置移到服务端

会话模板将配置提升到**服务端**，由管理员统一管理。前端只需声明使用哪个模板：

```typescript
// ✅ 有模板 —— 前端声明意图，服务端强制能力边界
const chat = useAgentChat({
  sessionTemplate: user.role === 'teacher' ? 'teacher-mode' : 'student-mode',
})
```

核心在于**职责分离**：

| 职责 | 谁来控制 |
|------|---------|
| Agent _能做什么_（技能、MCP、提示词） | **管理员** —— 通过会话模板 |
| Agent _何时被谁调用_ | **前端** —— 通过模板名称 |

这意味着 AI 团队可以随时在管理后台更新提示词、新增技能、切换模型——**不需要动一行代码**。

### 例子：数学辅导平台

以一个具体场景说明。老师和学生同样都在和同一个 AI 代理对话，但需要完全不同的能力：

**老师**需要完整的分析能力：
- `curriculum-analyzer` 技能 —— 将题目映射到教材大纲
- `student-progress` MCP —— 查询学校成绩数据库（敏感数据）
- 语气：详尽分析型（_"这道题考查 §3.2 一元一次方程，难度等级 3"_）
- 模型：`claude-opus-4-6`，深度更强

**学生**只需要引导式练习：
- `practice-hint` 技能 —— 分步引导，绝不直接给出答案
- 无 MCP 访问权限 —— 成绩数据库对学生不可见
- 语气：鼓励型、苏格拉底式（_"思路不错！如果把 x 移到另一边会怎样？"_）
- 模型：`claude-haiku-4-5`，速度快、成本低

两个模板完整表达了这套差异：

| | `teacher-mode`（教师模式） | `student-mode`（学生模式） |
|---|---|---|
| 技能 | `curriculum-analyzer`、`practice-hint` | 仅 `practice-hint` |
| MCP 服务器 | `student-progress`（成绩数据库） | _（无）_ |
| 系统提示词 | 分析型、关联大纲 | 鼓励型、苏格拉底式 |
| 模型 | `claude-opus-4-6` | `claude-haiku-4-5` |

当教研组长说 _"每次回答都要标注对应教材页码"_，管理员在后台编辑 `teacher-mode` 模板，立即生效——**学生完全不受影响，不需要任何代码变更**。

这套模式适用于任何角色权限有差异的场景：客服坐席 vs. 普通客户、数据分析师 vs. 只读用户、系统管理员 vs. 普通员工。

---

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
import { useAgentChat } from '@kedge-agentic/react-sdk'

export function TeacherView() {
  const chat = useAgentChat({
    serverUrl: 'http://localhost:3001',
    solutionId: 'your-tenant-id',
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
| `enabledSkills` | string[] | — | 代理允许使用的技能列表 |
| `mcpServers` | object | — | MCP 服务器配置（见下方格式） |
| `model` | string | 128 | 模型 ID 覆盖（如 `claude-opus-4-6`） |
| `enabledSkills` | `Array<string \| { slug, promptMode? }>` | — | 启用的 Skill 列表，支持 per-skill promptMode 覆盖（见 [Per-Skill 提示模式](#per-skill-提示模式)）。优先于 `enabledSkills` |
| `skillPromptMode` | `"protocol"` \| `"inline"` | — | Skill 内容到达 Agent 的方式（见 [Skill 提示模式](#skill-提示模式)） |

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

## Skill 提示模式

当 Session Template 启用了 Skills 时，平台需要将 Skill 知识传递给 Agent。`skillPromptMode` 字段控制具体方式：

| 模式 | 工作原理 | 用户看到什么 |
|------|---------|------------|
| `protocol` _（默认）_ | Agent 在运行时通过 Read 工具读取 `SKILL.md` | "让我先读取一下 skill 定义..." |
| `inline` | 后端在 Agent 启动前读取 `SKILL.md` 并嵌入系统提示 | Agent 直接开始工作，无文件读取消息 |

### 如何选择

| | `protocol` | `inline` |
|---|---|---|
| **Agent 启动** | 首条消息时读取文件 | 携带完整上下文启动 |
| **用户可见消息** | 冗余——工具调用输出可见 | 干净——无"读取 skill"消息 |
| **系统提示大小** | 小 | 较大（含完整 SKILL.md 内容） |
| **每轮 Token 开销** | 低 | 较高（系统提示每轮都会发送） |
| **适用场景** | 开发调试、内容较长的 Skill | 生产环境、面向用户的应用、简短聚焦的 Skill |

**经验法则：** 当 Skill 内容简洁（< ~1500 tokens）且用户不应看到内部操作时，使用 `inline`。在开发阶段调试 Skill 内容时，或 Skill 较长需要控制 Token 开销时，使用 `protocol`。

### 配置方式

在 `solution.json` 的 Session Template 中添加 `skillPromptMode`：

```json
{
  "sessionTemplates": {
    "teaching": {
      "description": "生产教学模式",
      "enabledSkills": ["socratic-teacher"],
      "skillPromptMode": "inline",
      "appendSystemPrompt": "等待学生提问后再开始教学。"
    },
    "debug": {
      "description": "开发模式——Skill 加载过程在输出中可见",
      "enabledSkills": ["socratic-teacher"]
    }
  }
}
```

{% hint style="info" %}
**与 `appendSystemPrompt` 的合并顺序：** 内联的 SKILL.md 内容在前，`appendSystemPrompt` 拼接在后。Agent 始终先读取 Skill 定义，再执行会话级指令。
{% endhint %}

{% hint style="warning" %}
**Token 开销：** `inline` 模式下，完整的 SKILL.md 内容会在每次 API 调用时包含在系统提示中。对于超过 ~1500 tokens 的 Skill，请权衡 UX 收益与额外的每轮开销。在使用 inline 模式时，保持 Skill 定义简洁尤为重要。
{% endhint %}

### Per-Skill 提示模式

当一个模板启用多个 Skill 时，你可能希望**不同的 Skill 使用不同的提示模式**。例如：主 Skill 内容简短，适合 `inline`；辅助参考类 Skill 较长，适合 `protocol` 以节省 Token。

`enabledSkills` 字段支持这种 per-skill 级别的 `promptMode` 覆盖。

#### `enabledSkills` vs `enabledSkills`

| | `enabledSkills` | `enabledSkills` |
|---|---|---|
| **类型** | `string[]` | `Array<string \| { slug, promptMode? }>` |
| **Per-skill 模式覆盖** | 不支持 | 支持 |
| **优先级** | 低 | **高** — 两者共存时 `enabledSkills` 生效 |

两个字段可以同时存在于同一个模板中。当 `enabledSkills` 存在时，平台使用它来解析 Skill 列表和 promptMode 配置；`enabledSkills` 被忽略。

#### 配置示例

```json
{
  "sessionTemplates": {
    "production": {
      "description": "混合模式 — 主 Skill inline，辅助 Skill protocol",
      "skillPromptMode": "protocol",
      "enabledSkills": [
        { "slug": "quiz-analyze-explain", "promptMode": "inline" },
        "geometry-reference"
      ],
      "appendSystemPrompt": "等待用户上传题目后再开始分析。"
    }
  }
}
```

**解析规则：**

| 元素 | 解析方式 |
|------|---------|
| `"geometry-reference"`（字符串） | 继承全局 `skillPromptMode`（此例为 `protocol`） |
| `{ "slug": "quiz-analyze-explain", "promptMode": "inline" }` | 使用显式指定的 `inline` 模式 |
| `{ "slug": "some-skill" }`（无 `promptMode`） | 继承全局 `skillPromptMode` |

#### 使用场景

- **主 Skill inline，辅助 Skill protocol** — 主 Skill 内容精简（< 1500 tokens），用 `inline` 实现零延迟启动；辅助参考类 Skill 内容较长，用 `protocol` 控制 Token 开销
- **全部 inline 但排除某个长 Skill** — 全局 `skillPromptMode: "inline"`，仅对长内容 Skill 显式设置 `"promptMode": "protocol"`
- **渐进迁移** — 从全部 `protocol` 逐步将各 Skill 切换到 `inline`，无需一次性全切

{% hint style="info" %}
**与全局 `skillPromptMode` 的关系：** `enabledSkills` 中未指定 `promptMode` 的条目（包括纯字符串元素）会回退到模板的 `skillPromptMode`。如果 `skillPromptMode` 也未设置，则默认为 `protocol`。
{% endhint %}

## API 端点

所有端点都需要具有 `admin` 权限的 API Key。

### 列出模板

```http
GET /api/v1/admin/solutions/:solutionId/session-templates
Authorization: Bearer <admin-api-key>
```

**响应：**
```json
{
  "templates": {
    "teacher-assistant": {
      "description": "教师视图",
      "appendSystemPrompt": "你是一位教育分析师...",
      "enabledSkills": ["knowledge-matching"],
      "model": "claude-opus-4-6"
    }
  },
  "defaultTemplate": "teacher-assistant"
}
```

### 获取单个模板

```http
GET /api/v1/admin/solutions/:solutionId/session-templates/:name
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
POST /api/v1/admin/solutions/:solutionId/session-templates
Authorization: Bearer <admin-api-key>
Content-Type: application/json

{
  "name": "teacher-assistant",
  "template": {
    "description": "教师视图",
    "appendSystemPrompt": "你是一位教育分析师...",
    "enabledSkills": ["knowledge-matching", "analysis"],
    "model": "claude-opus-4-6"
  }
}
```

**错误响应：**
- `409 Conflict` — 模板名称已存在
- `400 Bad Request` — 租户已达到 50 个模板的上限

### 更新模板

```http
PUT /api/v1/admin/solutions/:solutionId/session-templates/:name
Authorization: Bearer <admin-api-key>
Content-Type: application/json

{
  "template": {
    "description": "更新的描述",
    "appendSystemPrompt": "更新的提示词...",
    "enabledSkills": ["new-skill"]
  }
}
```

### 删除模板

```http
DELETE /api/v1/admin/solutions/:solutionId/session-templates/:name
Authorization: Bearer <admin-api-key>
```

> **注意：** 如果被删除的模板是租户的 `defaultSessionTemplate`，该引用会被自动清除。

### 预览模板解析结果

在部署前测试模板与前端显式参数的合并效果：

```http
POST /api/v1/admin/solutions/:solutionId/session-templates/:name/preview
Authorization: Bearer <admin-api-key>
Content-Type: application/json

{
  "explicitParams": {
    "enabledSkills": ["override-skill"],
    "appendSystemPrompt": "附加上下文"
  }
}
```

**响应：**
```json
{
  "template": { ... },
  "resolved": {
    "enabledSkills": ["override-skill"],
    "appendSystemPrompt": "模板基础提示词\n\n附加上下文",
    "mcpServers": {}
  }
}
```

## 模板解析规则

前端通过 `sessionTemplate` 指定模板名称，服务端解析模板配置。前端**只能**传递以下显式参数覆盖模板：

| 字段 | 前端可传递？ | 合并策略 |
|------|------------|---------|
| `enabledSkills` | **是** | **替换** — 显式参数完全覆盖模板值 |
| `context` | **是** | **透传** — 直接传递给 Agent 作为页面上下文 |
| `appendSystemPrompt` | **是** | **追加** — 显式内容追加在模板内容之后 |
| `mcpServers` | **否（仅服务端）** | 由会话模板和 solution.json 配置，前端无法覆盖 |
| `skillPath` | **否（仅服务端）** | 由会话模板配置，前端无法覆盖 |
| `model` | **否（仅服务端）** | 由会话模板配置，前端无法覆盖 |

{% hint style="warning" %}
**安全设计：** `mcpServers`、`skillPath` 和 `model` 是服务端配置，前端无法传递或覆盖。这确保了 Agent 可用的工具和模型完全由管理员在会话模板中控制，防止前端篡改。
{% endhint %}

```typescript
// 模板配置（来自管理界面或 solution.json）：
{
  "appendSystemPrompt": "你是一位教师助手",
  "enabledSkills": ["knowledge-matching"],
  "mcpServers": { "server-a": { ... } }
}

// 前端只传递模板名称和允许的覆盖参数：
useAgentChat({
  sessionTemplate: 'teacher-assistant',
  enabledSkills: ['custom-skill'],      // 替换模板中的技能列表
  context,                                   // 页面上下文
})

// 服务端最终解析的参数：
{
  "enabledSkills": ["custom-skill"],
  "appendSystemPrompt": "你是一位教师助手",
  "mcpServers": { "server-a": { ... } }     // 来自模板，前端无法修改
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
  solutionId: user.solutionId,
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
  solutionId: user.solutionId,
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
1. 前端的 `solutionId` 是否与拥有该模板的租户匹配
2. 模板名称拼写是否完全正确（区分大小写）
3. 通过 API 验证模板是否存在：

```bash
curl -H "Authorization: Bearer <key>" \
  http://localhost:3001/api/v1/admin/solutions/<solutionId>/session-templates
```

### 模板创建返回 409

**错误**：`Session template already exists`（会话模板已存在）

**解决方案**：每个租户的模板名称必须唯一。使用编辑功能更新现有模板，或选择不同的名称。

### 模板创建返回 400（已达上限）

**错误**：`Solution has reached the maximum of 50 session templates`

**解决方案**：删除不再使用的模板或合并多个配置。

### 技能未生效

**检查：**
1. 技能标识符拼写是否完全正确（需要精确匹配）
2. 技能是否已在系统中注册并处于激活状态
3. 技能是否已从解决方案后端同步

## 相关指南

- [管理员 API Key 管理](admin-api-keys.md) — 创建管理员 API 密钥
- [前端集成指南](frontend.md) — 使用 `@kedge-agentic/react-sdk`
- [技能编写指南](skill-writing.md) — 创建自定义技能
