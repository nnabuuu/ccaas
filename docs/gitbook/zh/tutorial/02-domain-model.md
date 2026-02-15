# 2. 设计领域模型

## 本章学习目标

在本章中，你将学习如何为 LoopAI Solution 设计领域模型。在编写任何代码之前，你需要明确定义应用程序管理**哪些数据**、**实体之间如何关联**，以及**哪些字段**可以在 AI Agent 和前端表单之间同步。

完成本章后，你将能够：

- 从用户需求中识别领域实体
- 设计合适的数据库 Schema 和字段类型
- 将实体字段映射为 `write_output` 同步字段
- 区分 CCAAS 平台实体和 Solution 领域实体
- 将这些模式应用到你自己的 Solution 中

## 为什么要先设计再编码

构建 Solution 时一个常见的错误是直接跳到实现阶段。这会导致：

- MCP Server、Skill 指令和前端之间**字段名不一致**
- 集成时才发现**缺少字段**
- **数据类型错误**导致运行时异常

花时间进行领域建模可以节省大量调试时间。在 LoopAI 生态系统中，你的领域模型是三个系统之间的契约：

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Skill (AI)    │     │   MCP Server     │     │   前端           │
│                 │     │                  │     │                 │
│ "使用 write_    │────▶│ 验证字段名和类型   │────▶│ 用对应的字段名    │
│  output 更新    │     │                  │     │ 渲染表单         │
│  field: title"  │     │                  │     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    三者必须对字段名和数据类型
                        达成一致
```

## 任务管理器示例

在整个教程中，我们构建一个**任务管理器** Solution。让我们先列出任务管理器需要追踪的内容。

### 梳理需求

一个最小的任务管理器需要：

1. 创建、查看、更新和删除任务
2. 将任务组织到项目中
3. 追踪任务状态（待办、进行中、已完成）
4. 设置截止日期
5. 允许 AI Agent 通过 `write_output` 生成和更新任务

从这些需求中，我们可以识别出两个核心实体：**Project（项目）** 和 **Task（任务）**。

## 定义实体

### 实体：Project（项目）

项目是相关任务的容器，包含名称和可选的描述。

| 字段 | 类型 | 是否必填 | 描述 |
|------|------|---------|------|
| `id` | string (UUID) | 自动 | 唯一标识符 |
| `name` | string | 是 | 项目名称 |
| `description` | string | 否 | 项目简介 |
| `createdAt` | datetime | 自动 | 创建时间 |
| `updatedAt` | datetime | 自动 | 更新时间 |

### 实体：Task（任务）

任务是项目中的单个工作项。

| 字段 | 类型 | 是否必填 | 描述 |
|------|------|---------|------|
| `id` | string (UUID) | 自动 | 唯一标识符 |
| `projectId` | string (UUID) | 是 | 外键，关联 Project |
| `title` | string | 是 | 任务标题 |
| `description` | string | 否 | 任务详细描述 |
| `status` | enum | 是 | `todo`、`in_progress`、`done` |
| `dueDate` | date | 否 | 目标完成日期 |
| `tags` | string[] | 否 | 分类标签 |
| `createdAt` | datetime | 自动 | 创建时间 |
| `updatedAt` | datetime | 自动 | 更新时间 |

### 实体关系图

```
┌──────────────┐         ┌──────────────────────┐
│   Project    │         │        Task          │
├──────────────┤         ├──────────────────────┤
│ id       (PK)│────┐    │ id           (PK)    │
│ name         │    │    │ projectId    (FK)    │◀─┐
│ description  │    └───▶│                      │  │
│ createdAt    │  1 : N  │ title                │  │
│ updatedAt    │         │ description          │  │
└──────────────┘         │ status               │  │
                         │ dueDate              │  │
                         │ tags                 │  │
                         │ createdAt            │  │
                         │ updatedAt            │  │
                         └──────────────────────┘  │
                                                   │
                         一个 Project 包含多个 Task─┘
```

## TypeScript 类型定义

在共享位置定义领域类型，以便 MCP Server、后端和前端都能使用。

### 类型文件

```typescript
// types.ts

export type TaskStatus = 'todo' | 'in_progress' | 'done';

export interface Project {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  dueDate: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}
```

### 为什么用 `string | null` 而不是可选字段

注意我们对可选字段使用 `string | null` 而不是 `string | undefined`。这是有意为之的：

- **`null`** 表示"该字段存在但没有值"——它会被存储到数据库中
- **`undefined`** 表示"该字段未被提供"——它会从请求中被省略

当 AI Agent 调用 `write_output` 并传入 `field: "description"` 和 `value: null` 时，它是在显式清除描述。这个区别在部分更新场景中非常重要。

## 数据库 Schema

对于任务管理器，我们使用 SQLite（LoopAI 在开发模式下使用的数据库引擎）。

### SQL Schema

```sql
-- 创建 Projects 表
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 创建 Tasks 表
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo'
    CHECK (status IN ('todo', 'in_progress', 'done')),
  due_date TEXT,
  tags TEXT DEFAULT '[]',  -- JSON 数组以文本形式存储
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id)
);
```

### 列命名约定

注意 TypeScript（camelCase）和 SQL（snake_case）之间的区别：

| TypeScript | SQL 列名 | 说明 |
|-----------|----------|------|
| `projectId` | `project_id` | 外键 |
| `createdAt` | `created_at` | 时间戳 |
| `dueDate` | `due_date` | 日期字段 |
| `tags` | `tags` | JSON 数组存为 TEXT |

你需要一个映射层来在这两种格式之间转换。我们将在第 6 章实现这个功能。

## 将字段映射到 write_output

为 LoopAI Solution 进行领域建模时最关键的部分是决定 AI Agent 可以更新哪些字段。这些就是你的**同步字段（sync fields）**。

### 定义同步字段

```typescript
// 同步字段定义 -- 映射到 write_output 的 field 名称
export const SYNC_FIELDS = [
  'title',
  'description',
  'status',
  'dueDate',
  'tags',
] as const;

export type SyncField = typeof SYNC_FIELDS[number];
```

### 为什么不同步所有字段？

有些字段**不应该**通过 `write_output` 同步：

| 字段 | 是否同步 | 原因 |
|------|---------|------|
| `title` | 是 | AI 生成任务标题 |
| `description` | 是 | AI 生成描述 |
| `status` | 是 | AI 可以更新任务状态 |
| `dueDate` | 是 | AI 可以建议截止日期 |
| `tags` | 是 | AI 可以建议标签 |
| `id` | **否** | 系统生成，不可变 |
| `projectId` | **否** | 创建时设置，不通过表单修改 |
| `createdAt` | **否** | 系统生成的时间戳 |
| `updatedAt` | **否** | 系统生成的时间戳 |

### 同步字段契约

同步字段列表是一个需要在三个地方保持一致的契约：

**1. Skill 指令（SKILL.md）**

```markdown
## 输出格式

使用 write_output 工具逐个更新任务字段：

- field: "title" -> 任务标题（字符串）
- field: "description" -> 任务描述（字符串）
- field: "status" -> 取值："todo"、"in_progress"、"done"
- field: "dueDate" -> ISO 日期字符串，例如 "2026-03-15"
- field: "tags" -> 字符串数组，例如 ["urgent", "frontend"]
```

**2. MCP Server 校验**

```typescript
const VALID_FIELDS = ['title', 'description', 'status', 'dueDate', 'tags'];

server.tool('write_output', schema, async (params) => {
  if (!VALID_FIELDS.includes(params.field)) {
    return { error: `Invalid field: ${params.field}` };
  }
  // 处理字段更新...
});
```

**3. 前端表单处理**

```typescript
socket.on('output_update', (event) => {
  const { field, value } = event.payload.data;

  switch (field) {
    case 'title':
      setTitle(value as string);
      break;
    case 'description':
      setDescription(value as string);
      break;
    case 'status':
      setStatus(value as TaskStatus);
      break;
    case 'dueDate':
      setDueDate(value as string | null);
      break;
    case 'tags':
      setTags(value as string[]);
      break;
  }
});
```

{% hint style="warning" %}
**如果这三者不同步，错误会悄无声息地发生。** AI Agent 可能会用一个 MCP Server 不认识的字段名调用 `write_output`，或者前端可能不处理 AI 发送的某个字段。始终将同步字段列表作为单一数据源。
{% endhint %}

## CCAAS 实体 vs. Solution 实体

LoopAI 的一个关键架构原则是**平台实体**和**领域实体**的分离。

### 平台实体（由 CCAAS 管理）

这些是 CCAAS 为你管理的基础设施层实体：

| 实体 | 用途 | 你的角色 |
|------|------|---------|
| `Session` | 聊天会话生命周期 | 通过 API 使用 |
| `Skill` | AI 行为定义 | 在 `solution.json` 中定义 |
| `Message` | 聊天历史 | 只读访问 |
| `ApiKey` | 认证 | 配置一次 |
| `Tenant` | 多租户隔离 | 每个 Solution 一个 |

### 领域实体（由你的 Solution 管理）

这些是业务相关的实体，存在于你的 Solution 后端：

| 实体 | 用途 | 你的角色 |
|------|------|---------|
| `Project` | 任务组织 | 完整的 CRUD 所有权 |
| `Task` | 工作项 | 完整的 CRUD 所有权 |

### 各自的存储位置

```
CCAAS 后端 (端口 3001)              Solution 后端 (端口 3002)
┌─────────────────────┐            ┌─────────────────────┐
│ sessions             │            │ projects             │
│ skills               │            │ tasks                │
│ messages             │            │ (你的领域数据)        │
│ api_keys             │            │                     │
│ tenants              │            │                     │
└─────────────────────┘            └─────────────────────┘
     平台数据库                         Solution 数据库
```

{% hint style="danger" %}
**永远不要将领域实体放入 CCAAS 后端。** 这是平台早期版本中真实发生过的架构违规——一个 lesson-plan 模块被意外留在了核心后端中，与 Solution 中的代码重复。详见项目指南中的架构原则章节。
{% endhint %}

## 真实案例：备课方案设计器

为了了解这些模式在更大规模下如何运作，来看看平台自带的备课方案设计器 Solution。它的领域模型要复杂得多：

### LessonPlan 实体（简化版）

```typescript
interface LessonPlan {
  id: string;
  title: string;
  subject: string;
  gradeLevel: number;
  durationMinutes: number;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

  // 内容字段（全部通过 write_output 同步）
  objectives: string | null;
  content: string | null;
  teachingMethods: string | null;
  materialsNeeded: string | null;
  assessmentMethods: string | null;
  studentAnalysis: string | null;

  // 结构化数据
  curriculumRequirements: CurriculumStandard[];
  extraProperties: Record<string, string>;
  attachments: LessonPlanAttachment[];
}
```

### 要点观察

1. **15 个同步字段** —— 比任务管理器的 5 个多得多，但模式完全相同
2. **嵌套类型** —— `CurriculumStandard[]` 和 `LessonPlanAttachment[]` 说明同步字段的值可以是复杂对象，不仅仅是基本类型
3. **元数据 vs. 内容** —— `subject` 和 `gradeLevel` 这样的字段在创建时设置，而 `objectives` 这样的内容字段由 AI Agent 填写
4. **状态生命周期** —— DRAFT -> PUBLISHED -> ARCHIVED 与我们的 todo -> in_progress -> done 模式一致

## 检查点

在进入下一章之前，验证你能回答以下问题：

- [ ] 任务管理器中的两个领域实体是什么？
- [ ] 哪些字段是同步字段，哪些不是？为什么？
- [ ] Project 表存在哪里——CCAAS 数据库还是 Solution 数据库？
- [ ] 如果 Skill 指令引用了一个 MCP Server 不认识的字段名，会发生什么？
- [ ] 为什么我们使用 `string | null` 而不是可选字段来处理数据库支持的属性？

## 练习：添加优先级字段

为 Task 实体扩展一个 `priority` 字段：

1. **选择数据类型。** 优先级应该是数字 (1-5)、枚举 (`low`、`medium`、`high`) 还是其他类型？
2. **更新 TypeScript 接口**，添加新字段。
3. **更新 SQL Schema**，添加新列和约束。
4. **判断是否为同步字段。** AI Agent 应该能够设置任务优先级吗？
5. **如果是，更新三个位置：** Skill 指令、MCP Server 校验、前端处理器。

<details>
<summary>参考答案</summary>

```typescript
// 1. 选择枚举类型，可读性更好
export type TaskPriority = 'low' | 'medium' | 'high';

// 2. 更新接口
export interface Task {
  // ... 现有字段
  priority: TaskPriority;
}

// 3. SQL 列
// priority TEXT NOT NULL DEFAULT 'medium'
//   CHECK (priority IN ('low', 'medium', 'high'))

// 4. 是的，添加到同步字段
export const SYNC_FIELDS = [
  'title', 'description', 'status',
  'dueDate', 'tags', 'priority',
] as const;

// 5. 更新 Skill 指令：
// - field: "priority" -> 取值："low"、"medium"、"high"
```

</details>

## 本章小结

在本章中你学到了如何：

- 从用户需求中**识别实体**（Project、Task）
- 用合适的约束和可空性**定义字段类型**
- 设计数据库 Schema，完成 camelCase 到 snake_case 的**映射**
- 选择 AI Agent 可以通过 `write_output` 更新的**同步字段**
- 在 Skill 指令、MCP Server 和前端之间**保持一致性**
- **区分平台实体**（Session、Skill）和**领域实体**（Project、Task）

在下一章中，我们将规划**用户旅程**——用户通过 AI Agent 与任务管理器交互时所遵循的分步工作流。

---

**下一章：** [3. 用户旅程映射](03-user-journeys.md)
**上一章：** [1. 理解 Solution 架构](01-architecture.md)
