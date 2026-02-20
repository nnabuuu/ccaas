# solution.json 配置参考 (v3.0)

KedgeAgentic 平台 solution.json 配置文件完整参考。

---

## Schema 版本

**当前:** `3.0`（推荐）
**支持:** `1.0`, `2.0`, `3.0`

```json
{
  "schemaVersion": "3.0"
}
```

**迁移:** v1/v2 配置会在运行时自动迁移到 v3。手动升级请参考[迁移指南](./migration.md)。

---

## 概述

`solution.json` 文件定义了你的解决方案配置，包括:
- **租户信息** - 名称、slug、描述
- **技能** - AI 能力（通过文件夹路径或通配符）
- **MCP 服务器** - AI Agent 的工具服务

**设计理念:** v3.0 遵循**约定优于配置**原则 - 最小化配置，合理的默认值。

---

## 最简示例

最简单的有效 solution.json（推荐大多数解决方案使用）:

```json
{
  "schemaVersion": "3.0",
  "tenant": {
    "name": "我的解决方案",
    "slug": "my-solution",
    "description": "简要描述此解决方案的功能"
  },
  "mcpServers": {
    "my-tools": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"]
    }
  }
}
```

**就是这样！**
- 技能自动从 `skills/*/SKILL.md` 发现
- 所有技能元数据在 SKILL.md frontmatter 中
- 清晰、可读、易维护

---

## 核心配置

### schemaVersion

**类型:** `"3.0"`
**必需:** 是

```json
{
  "schemaVersion": "3.0"
}
```

新解决方案始终使用 `"3.0"`。

### tenant

**类型:** `Object`
**必需:** 是

在 CCAAS 平台中标识你的解决方案。

```json
{
  "tenant": {
    "name": "题目分析器",
    "slug": "quiz-analyzer",
    "description": "教育题目智能分析系统"
  }
}
```

**字段:**
- `name` (string, 必需) - 显示名称
- `slug` (string, 必需) - 唯一标识符（kebab-case）
- `description` (string, 可选) - 简要描述

### skills

**类型:** `Array<string | { folder: string }>`
**默认值:** `["skills/*"]`
**必需:** 否（省略时使用默认值）

定义要加载的技能。支持通配符模式进行自动发现。

#### 方式 1: 省略（推荐）

```json
{
  "tenant": { ... },
  "mcpServers": { ... }
  // 无 "skills" 字段 = 使用默认 ["skills/*"]
}
```

✅ **最佳实践** - 约定优于配置

#### 方式 2: 通配符模式

```json
{
  "skills": ["skills/*"]
}
```

✅ 显式表明自动发现

#### 方式 3: 具体文件夹

```json
{
  "skills": [
    "skills/analyzer",
    "skills/reporter",
    "custom-skills/special"
  ]
}
```

✅ 完全控制加载哪些技能

#### 方式 4: 混合

```json
{
  "skills": [
    "skills/*",              // 自动发现所有
    "experimental/beta"      // 加上特定技能
  ]
}
```

✅ 灵活应对边界情况

**模式匹配:**
- `skills/*` - 所有直接子目录
- `features/*/skill` - 嵌套路径
- 在每个匹配的目录中查找 `SKILL.md` 文件

### discovery

**类型:** `Object`
**默认值:** `{ "enabled": true }`
**必需:** 否

控制此解决方案是否在后端启动时自动注册。

```json
{
  "discovery": {
    "enabled": false
  }
}
```

**字段:**
- `enabled` (boolean, 默认: `true`) - 为 `true` 时，CCAAS 后端启动时自动注册所有 skills 和 MCP servers。设为 `false` 可禁用此解决方案的自动注册。

**`enabled: false` 的使用场景:**
- 尚未准备好部署的开发中解决方案
- 仅需手动注册的解决方案
- 临时禁用某个解决方案而不删除它

> **说明:** 省略 `discovery` 或设置 `enabled: true` 时，后端每次启动都会自动注册该解决方案的所有 skills 和 MCP servers。不再需要手动运行 `npm run skill:import`。

---

### mcpServers

**类型:** `Record<string, McpServerConfig>`
**默认值:** `{}`
**必需:** 通常是（除非技能不需要工具）

定义技能可用的 MCP 工具服务器。

```json
{
  "mcpServers": {
    "my-tools": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"],
      "description": "工具服务描述",
      "type": "stdio",
      "env": {
        "MCP_PORT": "3006"
      }
    }
  }
}
```

**McpServerConfig 字段:**
- `command` (string, 必需) - 可执行命令
- `args` (string[], 必需) - 命令参数
- `description` (string, 可选) - 人类可读的描述
- `type` (string, 可选) - `"stdio"`（默认）
- `env` (object, 可选) - 环境变量

---

### sessionTemplates（可选）

**类型:** `Record<string, SessionTemplateConfig>`
**必需:** 否

为不同使用场景预设 AI 行为配置。解决方案加载时自动 upsert 到 `tenant.config`。

```json
{
  "sessionTemplates": {
    "teacher": {
      "description": "教师模式",
      "appendSystemPrompt": "你正在与教师交互，重点提供教学建议。",
      "enabledSkillSlugs": ["analyze-student-answer"]
    },
    "student": {
      "description": "学生模式",
      "enabledSkillSlugs": ["three-column-analysis"]
    }
  }
}
```

**字段:**

| 字段 | 类型 | 说明 |
|------|------|------|
| `<templateName>` | object | 模板名称（如 `teacher`、`student`） |
| `description` | string | 模板说明 |
| `appendSystemPrompt` | string（可选） | 追加到系统提示的内容 |
| `enabledSkillSlugs` | string[]（可选） | 此模板启用的 skill slug 列表 |
| `mcpServers` | object（可选） | MCP 服务器配置（格式同顶层 `mcpServers`） |
| `model` | string（可选） | 模型覆盖（如 `claude-opus-4-6`） |

> 完整详情（Admin UI、API 端点、合并规则、安全配置、问题排查）请参阅 [Session Templates 管理指南](../guide/admin-session-templates.md)。

> **部署验证:** 每次 solution 完整加载后，backend 自动在 `tenant.config.solutionAppliedAt` 写入 ISO 时间戳，可用于 CI/CD 验证部署状态。

---

## 解决方案特定配置

这些字段供你的解决方案内部使用。**CCAAS 忽略它们**。

### syncFields

**类型:** `Array<string> | Array<{ name: string, type: string }>`
**必需:** 否

通过上下文在前端和后端之间同步的字段。

```json
{
  "syncFields": [
    "parsedQuiz",
    "catalog",
    "difficulty"
  ]
}
```

或带类型:

```json
{
  "syncFields": [
    { "name": "parsedQuiz", "type": "object" },
    { "name": "catalog", "type": "string" }
  ]
}
```

### setup

**类型:** `Object`
**必需:** 否

解决方案设置和生命周期钩子。

```json
{
  "setup": {
    "customScripts": {
      "preInstall": ".solution-hooks/pre-install.sh",
      "postInstall": ".solution-hooks/post-install.sh"
    }
  }
}
```

---

## 完整示例

具有所有功能的完整 solution.json:

```json
{
  "schemaVersion": "3.0",

  // ============ CCAAS 核心配置 ============
  "tenant": {
    "name": "题目分析器",
    "slug": "quiz-analyzer",
    "description": "教育题目智能分析系统"
  },

  "skills": ["skills/*"],  // 可选: 默认值就是这个

  "mcpServers": {
    "quiz-analyzer-tools": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"],
      "description": "题目分析 MCP 工具",
      "type": "stdio",
      "env": {
        "MCP_PORT": "3006",
        "LOG_LEVEL": "info"
      }
    }
  },

  // ============ 解决方案配置 ============
  "backend": {
    "port": 3005,
    "database": {
      "type": "sqlite",
      "path": "data/quiz-analyzer.db"
    },
    "cors": {
      "origin": ["http://localhost:5282"]
    }
  },

  "frontend": {
    "port": 5282,
    "theme": "light",
    "features": ["sync", "export", "history"]
  },

  "syncFields": [
    "parsedQuiz",
    "catalog",
    "difficulty",
    "quizAnalysis",
    "knowledgePointTags"
  ],

  "setup": {
    "customScripts": {
      "preInstall": ".solution-hooks/pre-install.sh",
      "customInit": ".solution-hooks/custom-init.sh",
      "postInstall": ".solution-hooks/post-install.sh"
    }
  }
}
```

---

## 配置级别

选择适合你需求的配置级别:

### 级别 1: 最简（推荐）

**比 v2.0 精简 87%**

```json
{
  "schemaVersion": "3.0",
  "tenant": {
    "name": "我的解决方案",
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

✅ 约定优于配置
✅ 自动发现所有技能
✅ 最清晰、最易维护

### 级别 2: 显式技能

```json
{
  "schemaVersion": "3.0",
  "tenant": { ... },
  "skills": [
    "skills/analyzer",
    "skills/reporter"
  ],
  "mcpServers": { ... }
}
```

✅ 控制技能加载
✅ 仍然清晰可读

### 级别 3: 包含解决方案配置

```json
{
  "schemaVersion": "3.0",
  "tenant": { ... },
  "mcpServers": { ... },
  "backend": {
    "port": 3002,
    "database": { ... }
  },
  "frontend": {
    "port": 5280
  }
}
```

✅ 完整的解决方案定义
✅ 配置的单一来源
✅ 仍比 v2.0 精简约 70%

---

## SKILL.md 要求

v3.0 要求所有 SKILL.md 文件都有**完整的 frontmatter**。这是技能元数据的单一真实来源。

**最简 SKILL.md:**

```markdown
---
name: 我的技能
slug: my-skill
description: 简要描述
scope: tenant
---

# 技能内容

给 AI Agent 的指令...
```

**包含触发器的完整 SKILL.md:**

```markdown
---
name: 题目分析器
slug: quiz-analyzer
description: 智能题目分析
scope: tenant
triggers:
  - type: keyword
    value: "分析这道题"
    priority: 10
  - type: pattern
    value: "\\d+\\.\\s+.+"
    priority: 5
allowedTools:
  - parse_quiz_content
  - write_output
---

# 题目分析器

此技能分析教育题目...
```

**必需字段:**
- ✅ `name` - 显示名称
- ✅ `slug` - 唯一标识符
- ✅ `description` - 简要描述
- ✅ `scope` - `"tenant"` 或 `"personal"`

**可选字段:**
- `triggers` - 激活触发器
- `allowedTools` - MCP 工具白名单
- `instructions` - 特殊 AI 指令

---

## 验证

CCAAS 在加载时验证 solution.json 并提供有用的错误消息:

**常见错误:**

```
✗ Schema 验证失败: "schemaVersion" 是必需的
→ 修复: 添加 "schemaVersion": "3.0"

✗ skills/my-skill/SKILL.md 中的 frontmatter 无效: slug: Required
→ 修复: 在 SKILL.md 中添加必需的 frontmatter 字段

✗ 未找到匹配模式 "skills/*" 的技能
→ 修复: 确保目录结构为 skills/*/SKILL.md

✗ MCP 服务器 "my-tools" 启动失败: command not found
→ 修复: 检查命令路径和构建输出
```

---

## 最佳实践

### ✅ 应该:
- 新解决方案使用 v3.0 schema
- 省略 `skills` 字段（使用默认自动发现）
- 仅在 SKILL.md frontmatter 中保留技能元数据
- 使用描述性的 tenant slug（kebab-case）
- 用 `description` 文档化 MCP 服务器

### ❌ 不应该:
- 在 solution.json 和 SKILL.md 之间重复元数据
- 使用深层嵌套（v3.0 设计是扁平的）
- 包含敏感数据（使用环境变量）
- 过度配置（拥抱默认值）

---

## 迁移

如果你有现有的 v1.0 或 v2.0 solution.json:

**自动:** CCAAS 在运行时自动迁移（无需操作）

**手动:** 遵循[迁移指南](./migration.md)进行清洁升级

**迁移的好处:**
- 📉 配置减少 78.7%
- 🎯 单一真实来源（SKILL.md）
- 🔧 更易维护
- 🚀 约定优于配置

---

## 相关文档

- [解决方案开发指南](../guide/solution-dev.md) - 创建解决方案
- [迁移指南](./migration.md) - 从 v2.0 升级
- [技能编写指南](../guide/skill-writing.md) - SKILL.md frontmatter
- [MCP 服务器指南](../guide/mcp-server.md) - 工具实现

---

**最后更新:** 2026-02-17
**Schema 版本:** 3.0
