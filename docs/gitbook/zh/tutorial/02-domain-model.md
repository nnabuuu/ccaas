# 2. 设计领域模型

## 本章学习目标

在本章中，你将学习如何为即见Agentic Solution 设计领域模型。在编写任何代码之前，你需要明确定义应用程序管理**哪些数据**、**实体之间如何关联**，以及**哪些字段**可以在 AI Agent 和前端表单之间同步。

完成本章后，你将能够：

- 从用户需求中识别领域实体
- 设计合适的数据库 Schema 和字段类型
- 将实体字段映射为 `write_output` 同步字段
- 区分即见Agentic 平台实体和 Solution 领域实体
- 将这些模式应用到你自己的 Solution 中

## 为什么要先设计再编码

构建 Solution 时一个常见的错误是直接跳到实现阶段。这会导致：

- MCP Server、Skill 指令和前端之间**字段名不一致**
- 集成时才发现**缺少字段**
- **数据类型错误**导致运行时异常

花时间进行领域建模可以节省大量调试时间。在即见Agentic 生态系统中，你的领域模型是三个系统之间的契约：

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

## 备课方案设计器

在整个教程中，我们构建**备课方案设计器** Solution —— 一个帮助教师创建、优化和管理备课方案的 AI 工具。让我们先列出备课方案设计器需要追踪的内容。

### 梳理需求

一个备课方案设计器需要：

1. 创建、查看、更新和删除备课方案
2. 将每个方案与教材关联（学科、年级、出版社、章节）
3. 追踪方案状态的生命周期（草稿、已发布、已归档）
4. 存储结构化内容：教学目标、教学方法、学情分析、教学材料、评估方法、主要内容
5. 从参考数据库链接课程标准
6. 附加生成的文件（讲稿、音频、PPT）
7. 允许 AI Agent 通过 `write_output` 生成和更新方案字段

从这些需求中，我们可以识别出一个核心实体 —— **LessonPlan（备课方案）** —— 以及两个辅助类型：**CurriculumStandard（课程标准）** 和 **LessonPlanAttachment（附件）**。

## 定义实体

### 实体：LessonPlan（备课方案）

备课方案是核心实体。它包含元数据字段（创建时设置）、内容字段（由 AI Agent 填写）和审计字段（由系统管理）。

**元数据字段** —— 创建方案时设置：

| 字段 | 类型 | 是否必填 | 描述 |
|------|------|---------|------|
| `id` | string (UUID) | 自动 | 唯一标识符 |
| `title` | string | 是 | 备课方案标题 |
| `subject` | string | 是 | 学科（如 "math"） |
| `gradeLevel` | number | 是 | 年级（1-12） |
| `durationMinutes` | number | 是 | 课时长度（分钟） |
| `lessonPlanCode` | string | 否 | 外部参考编号 |
| `status` | enum | 自动 | `DRAFT`、`PUBLISHED`、`ARCHIVED` |

**教材字段** —— 将方案关联到具体章节：

| 字段 | 类型 | 是否必填 | 描述 |
|------|------|---------|------|
| `publisher` | string | 否 | 教材出版社 |
| `volume` | string | 否 | 册别（如 "上册"） |
| `chapterId` | number | 否 | 章节标识符 |
| `chapterTitle` | string | 否 | 章节标题 |

**内容字段** —— 由 AI Agent 生成或优化：

| 字段 | 类型 | 是否必填 | 描述 |
|------|------|---------|------|
| `objectives` | string | 否 | 教学目标 |
| `studentAnalysis` | string | 否 | 学情分析 |
| `materialsNeeded` | string | 否 | 所需教学材料 |
| `content` | string | 否 | 主要教学内容 |
| `assessmentMethods` | string | 否 | 学习评估方法 |
| `teachingMethods` | string | 否 | 教学策略与方法 |

**结构化数据字段**：

| 字段 | 类型 | 是否必填 | 描述 |
|------|------|---------|------|
| `curriculumRequirements` | CurriculumStandard[] | 否 | 关联的课程标准 |
| `extraProperties` | Record<string, string> | 否 | 可扩展的键值对 |
| `attachments` | LessonPlanAttachment[] | 否 | 生成的文件附件 |

**审计字段** —— 由系统管理：

| 字段 | 类型 | 是否必填 | 描述 |
|------|------|---------|------|
| `createBy` | string | 否 | 创建者标识 |
| `createTime` | string | 自动 | 创建时间 |
| `updateBy` | string | 否 | 最后更新者标识 |
| `updateTime` | string | 自动 | 最后更新时间 |
| `remark` | string | 否 | 备注 |
| `deleted` | number | 自动 | 软删除标志（0 或 1） |

### 辅助类型：CurriculumStandard（课程标准）

课程标准通过 `get_curriculum_standards` MCP 工具从参考数据库查询，然后关联到备课方案。

| 字段 | 类型 | 描述 |
|------|------|------|
| `id` | number | 标准标识符 |
| `standardCode` | string | 官方标准编号 |
| `title` | string | 标准标题 |
| `stage` | string | 教育阶段 |
| `standardType` | string | 标准类型 |
| `contentDomain` | string | 内容领域 |

### 辅助类型：LessonPlanAttachment（附件）

附件表示在备课过程中生成的文件（讲稿、音频录制、PPT 演示文稿）。

| 字段 | 类型 | 描述 |
|------|------|------|
| `id` | string (UUID) | 附件标识符 |
| `fileId` | string (UUID) | 对 CCAAS 文件存储的引用 |
| `fileName` | string | 原始文件名 |
| `fileType` | enum | `script`、`audio`、`ppt`、`pdf`、`other` |
| `mimeType` | string | MIME 类型 |
| `size` | number | 文件大小（字节） |
| `downloadUrl` | string | CCAAS 下载 URL |
| `uploadedAt` | string | 上传时间 |
| `description` | string | 可选描述 |

### 实体关系图

```
┌─────────────────────────────┐
│         LessonPlan          │
├─────────────────────────────┤
│ id                    (PK)  │
│ title                       │
│ subject                     │
│ gradeLevel                  │
│ durationMinutes             │
│ lessonPlanCode              │
│ status                      │
│─────── 教材 ────────────────│
│ publisher                   │
│ volume                      │
│ chapterId                   │
│ chapterTitle                │
│─────── 内容 ────────────────│
│ objectives                  │
│ studentAnalysis             │
│ materialsNeeded             │
│ content                     │
│ assessmentMethods           │
│ teachingMethods             │
│─────── 结构化数据 ──────────│
│ curriculumRequirements  [ ] │──▶ CurriculumStandard[]
│ extraProperties         { } │
│ attachments             [ ] │──▶ LessonPlanAttachment[]
│─────── 审计 ────────────────│
│ createBy                    │
│ createTime                  │
│ updateBy                    │
│ updateTime                  │
│ remark                      │
│ deleted                     │
└─────────────────────────────┘

┌──────────────────────┐      ┌──────────────────────┐
│ CurriculumStandard   │      │ LessonPlanAttachment  │
├──────────────────────┤      ├──────────────────────┤
│ id                   │      │ id                   │
│ standardCode         │      │ fileId               │
│ title                │      │ fileName             │
│ stage                │      │ fileType             │
│ standardType         │      │ mimeType             │
│ contentDomain        │      │ size                 │
└──────────────────────┘      │ downloadUrl          │
                              │ uploadedAt           │
  通过 MCP 工具查询            │ description          │
  (get_curriculum_standards)  └──────────────────────┘

                               生成的文件存储在
                               CCAAS 文件存储中
```

## TypeScript 类型定义

在共享位置定义领域类型，以便 MCP Server、后端和前端都能使用。

### 类型文件

```typescript
// types.ts

export type LessonPlanStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface CurriculumStandard {
  id: number;
  standardCode: string;
  title: string;
  stage: string;
  standardType: string;
  contentDomain: string;
}

export interface LessonPlanAttachment {
  id: string;
  fileId: string;
  fileName: string;
  fileType: 'script' | 'audio' | 'ppt' | 'pdf' | 'other';
  mimeType: string;
  size: number;
  downloadUrl: string;
  uploadedAt: string;
  description?: string;
}

export interface LessonPlan {
  id: string;
  title: string;
  subject: string;
  gradeLevel: number;
  durationMinutes: number;
  lessonPlanCode: string | null;
  status: LessonPlanStatus;

  // 教材元数据
  publisher: string | null;
  volume: string | null;
  chapterId: number | null;
  chapterTitle: string | null;

  // 课程标准（从 MCP 查询的结构化数组）
  curriculumRequirements: CurriculumStandard[];

  // 6 个内容字段（全部纯文本）
  objectives: string | null;
  studentAnalysis: string | null;
  materialsNeeded: string | null;
  content: string | null;
  assessmentMethods: string | null;
  teachingMethods: string | null;

  // 扩展属性（键值对）
  extraProperties: Record<string, string>;

  // 文件附件
  attachments: LessonPlanAttachment[];

  // 审计字段
  createBy: string | null;
  createTime: string;
  updateBy: string | null;
  updateTime: string;
  remark: string | null;
  deleted: number;
}
```

### 为什么用 `string | null` 而不是可选字段

注意我们对内容字段使用 `string | null` 而不是 `string | undefined`。这是有意为之的：

- **`null`** 表示"该字段存在但没有值"——它会被存储到数据库中
- **`undefined`** 表示"该字段未被提供"——它会从请求中被省略

当 AI Agent 调用 `write_output` 并传入 `field: "objectives"` 和 `value: null` 时，它是在显式清除教学目标。这个区别在部分更新场景中非常重要。

### 字段分类

LessonPlan 实体有清晰的关注点分离：

| 分类 | 示例 | 设置者 | 何时设置 |
|------|------|--------|---------|
| 元数据 | `title`、`subject`、`gradeLevel` | 用户（通过表单） | 创建时 |
| 教材 | `publisher`、`volume`、`chapterId` | 用户（通过级联选择器） | 创建时 |
| 内容 | `objectives`、`content`、`teachingMethods` | AI Agent（通过 `write_output`） | 编辑时 |
| 结构化 | `curriculumRequirements`、`attachments` | AI Agent 或系统 | 编辑时 |
| 审计 | `createTime`、`updateTime`、`deleted` | 系统 | 自动 |

这种分离让你立即知道哪些字段是同步字段，哪些不是。

## 数据库 Schema

备课方案设计器使用 SQLite 配合 better-sqlite3（即见Agentic 推荐的开发模式方案）。

### SQL Schema

```sql
CREATE TABLE IF NOT EXISTS lesson_plans (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subject TEXT DEFAULT '',
  grade_level INTEGER DEFAULT 1,
  duration_minutes INTEGER DEFAULT 45,
  lesson_plan_code TEXT DEFAULT NULL,
  status TEXT DEFAULT 'DRAFT',

  -- 教材元数据
  publisher TEXT DEFAULT NULL,
  volume TEXT DEFAULT NULL,
  chapter_id INTEGER DEFAULT NULL,
  chapter_title TEXT DEFAULT NULL,

  -- 内容字段和结构化数据（JSON 以 TEXT 形式存储）
  curriculum_requirements TEXT DEFAULT NULL,
  objectives TEXT DEFAULT NULL,
  student_analysis TEXT DEFAULT NULL,
  materials_needed TEXT DEFAULT NULL,
  content TEXT DEFAULT NULL,
  assessment_methods TEXT DEFAULT NULL,
  teaching_methods TEXT DEFAULT NULL,

  -- 可扩展属性（JSON 以 TEXT 形式存储）
  extra_properties TEXT DEFAULT NULL,

  -- 文件附件（JSON 数组以 TEXT 形式存储）
  attachments TEXT DEFAULT NULL,

  -- 审计字段
  create_by TEXT DEFAULT NULL,
  create_time TEXT NOT NULL,
  update_by TEXT DEFAULT NULL,
  update_time TEXT NOT NULL,
  remark TEXT DEFAULT NULL,
  deleted INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_lesson_plans_status
  ON lesson_plans(status);
```

### 列命名约定

注意 TypeScript（camelCase）和 SQL（snake_case）之间的区别：

| TypeScript | SQL 列名 | 说明 |
|-----------|----------|------|
| `gradeLevel` | `grade_level` | 整数字段 |
| `durationMinutes` | `duration_minutes` | 整数字段 |
| `lessonPlanCode` | `lesson_plan_code` | 可空字符串 |
| `chapterId` | `chapter_id` | 外部引用 |
| `chapterTitle` | `chapter_title` | 字符串字段 |
| `curriculumRequirements` | `curriculum_requirements` | JSON 数组存为 TEXT |
| `studentAnalysis` | `student_analysis` | 纯文本 |
| `materialsNeeded` | `materials_needed` | 纯文本 |
| `assessmentMethods` | `assessment_methods` | 纯文本 |
| `teachingMethods` | `teaching_methods` | 纯文本 |
| `extraProperties` | `extra_properties` | JSON 对象存为 TEXT |
| `createTime` | `create_time` | 时间戳 |
| `updateTime` | `update_time` | 时间戳 |

你需要一个映射层来在这两种格式之间转换。后端使用 `rowToLessonPlan()` 函数和 `fieldToColumn` 映射来完成此任务。我们将在第 6 章实现这个功能。

### 在 SQLite 中存储复杂类型

三个字段以 TEXT 列的形式存储 JSON 数据：

| 字段 | 存储格式 | 示例值 |
|------|---------|-------|
| `curriculumRequirements` | JSON 数组 | `[{"id":1,"standardCode":"MA-3-1",...}]` |
| `extraProperties` | JSON 对象 | `{"key1":"value1","key2":"value2"}` |
| `attachments` | JSON 数组 | `[{"id":"uuid","fileName":"script.md",...}]` |

后端在读取时使用 `JSON.parse()` 解析，写入时使用 `JSON.stringify()` 序列化。错误处理确保格式错误的 JSON 默认为空数组或空对象。

## 将字段映射到 write_output

为即见Agentic Solution 进行领域建模时最关键的部分是决定 AI Agent 可以更新哪些字段。这些就是你的**同步字段（sync fields）**。

### 定义同步字段

```typescript
// 同步字段定义 -- 映射到 write_output 的 field 名称
export const SYNC_FIELDS = [
  'title',
  'subject',
  'gradeLevel',
  'durationMinutes',
  'lessonPlanCode',
  'objectives',
  'content',
  'teachingMethods',
  'materialsNeeded',
  'assessmentMethods',
  'curriculumRequirements',
  'studentAnalysis',
  'extraProperties',
  'status',
  'attachments',
] as const;

export type SyncField = typeof SYNC_FIELDS[number];
```

备课方案设计器有 **15 个同步字段** —— 比简单应用多得多，但模式完全相同。

### 为什么不同步所有字段？

有些字段**不应该**通过 `write_output` 同步：

| 字段 | 是否同步 | 原因 |
|------|---------|------|
| `title` | 是 | AI 可以生成或优化标题 |
| `objectives` | 是 | AI 生成教学目标 |
| `content` | 是 | AI 生成教学内容 |
| `teachingMethods` | 是 | AI 建议教学策略 |
| `materialsNeeded` | 是 | AI 列出所需材料 |
| `assessmentMethods` | 是 | AI 设计评估方案 |
| `studentAnalysis` | 是 | AI 分析学情 |
| `curriculumRequirements` | 是 | AI 关联相关课程标准 |
| `status` | 是 | AI 可以标记方案为完成 |
| `attachments` | 是 | 系统添加生成的文件 |
| `id` | **否** | 系统生成，不可变 |
| `publisher` | **否** | 通过表单选择器在创建时设置 |
| `volume` | **否** | 通过表单选择器在创建时设置 |
| `chapterId` | **否** | 通过表单选择器在创建时设置 |
| `chapterTitle` | **否** | 通过表单选择器在创建时设置 |
| `createBy` | **否** | 系统生成的审计字段 |
| `createTime` | **否** | 系统生成的时间戳 |
| `updateTime` | **否** | 系统生成的时间戳 |
| `deleted` | **否** | 系统管理的软删除标志 |

注意：教材字段（`publisher`、`volume`、`chapterId`、`chapterTitle`）通过"创建备课方案"对话框中的级联选择器设置，而不是通过 AI Agent。这是一个设计选择 —— 用户选择教材上下文，然后 AI 在该上下文中生成内容。

### 同步字段契约

同步字段列表是一个需要在三个地方保持一致的契约：

**1. Skill 指令（SKILL.md）**

```markdown
## 输出格式

使用 write_output 工具更新备课方案字段：

- field: "title" -> 备课方案标题（字符串）
- field: "objectives" -> 教学目标（字符串，纯文本）
- field: "content" -> 主要教学内容（字符串，纯文本）
- field: "teachingMethods" -> 教学策略（字符串，纯文本）
- field: "materialsNeeded" -> 所需材料（字符串，纯文本）
- field: "assessmentMethods" -> 评估方案（字符串，纯文本）
- field: "studentAnalysis" -> 学情分析（字符串，纯文本）
- field: "curriculumRequirements" -> CurriculumStandard 对象数组
- field: "extraProperties" -> 键值对，如 {"key": "value"}
- field: "status" -> 取值："DRAFT"、"PUBLISHED"、"ARCHIVED"
```

**2. MCP Server 校验（schemas.ts）**

```typescript
import { z } from 'zod';

export const FieldSchemas = {
  title: z.string().min(1),
  subject: z.string().min(1),
  gradeLevel: z.number().int().min(1).max(12),
  durationMinutes: z.number().int().min(1).max(600),
  lessonPlanCode: z.string(),
  objectives: z.string(),
  content: z.string(),
  teachingMethods: z.string(),
  materialsNeeded: z.string(),
  assessmentMethods: z.string(),
  curriculumRequirements: z.array(CurriculumStandardSchema),
  studentAnalysis: z.string(),
  extraProperties: z.record(z.string(), z.string()),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']),
  attachments: z.array(LessonPlanAttachmentSchema),
} as const;
```

**3. 前端表单处理**

```typescript
// 使用 SDK（推荐）
import { useAgentConnection, useAgentChat } from '@kedge-agentic/react-sdk'

const connection = useAgentConnection({
  serverUrl: 'http://localhost:3001',
  solutionId: 'lesson-plan-designer',
})

const { messages, sendMessage } = useAgentChat({
  connection,
  solutionId: 'lesson-plan-designer',
  onOutputUpdate: (update) => {
    // SDK 将原始事件标准化为 flat OutputUpdate 对象
    const { field, value } = update;

    switch (field) {
      case 'objectives':
        setObjectives(value as string);
        break;
      case 'content':
        setContent(value as string);
        break;
      case 'teachingMethods':
        setTeachingMethods(value as string);
        break;
      case 'materialsNeeded':
        setMaterialsNeeded(value as string);
        break;
      case 'assessmentMethods':
        setAssessmentMethods(value as string);
        break;
      case 'studentAnalysis':
        setStudentAnalysis(value as string);
        break;
      case 'curriculumRequirements':
        setCurriculumRequirements(value as CurriculumStandard[]);
        break;
      // ... 其余字段
    }
  }
});
```

{% hint style="warning" %}
**如果这三者不同步，错误会悄无声息地发生。** AI Agent 可能会用一个 MCP Server 不认识的字段名调用 `write_output`，或者前端可能不处理 AI 发送的某个字段。始终将同步字段列表作为单一数据源。
{% endhint %}

## CCAAS 实体 vs. Solution 实体

即见Agentic 的一个关键架构原则是**平台实体**和**领域实体**的分离。

### 平台实体（由 CCAAS 管理）

这些是 CCAAS 为你管理的基础设施层实体：

| 实体 | 用途 | 你的角色 |
|------|------|---------|
| `Session` | 聊天会话生命周期 | 通过 API 使用 |
| `Skill` | AI 行为定义 | 在 `solution.json` 中定义 |
| `Message` | 聊天历史 | 只读访问 |
| `ApiKey` | 认证 | 配置一次 |
| `Solution` | 多租户隔离 | 每个 Solution 一个 |

### 领域实体（由你的 Solution 管理）

这些是业务相关的实体，存在于你的 Solution 后端：

| 实体 | 用途 | 你的角色 |
|------|------|---------|
| `LessonPlan` | 备课方案数据 | 完整的 CRUD 所有权 |
| `CurriculumStandard` | 参考数据 | 通过 MCP 工具查询 |
| `LessonPlanAttachment` | 生成的文件 | 随备课方案管理 |

### 各自的存储位置

```
CCAAS 后端 (端口 3001)              Solution 后端 (端口 3002)
┌─────────────────────┐            ┌─────────────────────┐
│ sessions             │            │ lesson_plans         │
│ skills               │            │ agent_files          │
│ messages             │            │ chat_messages        │
│ api_keys             │            │ (你的领域数据)        │
│ solutions            │            │                     │
└─────────────────────┘            └─────────────────────┘
     平台数据库                         Solution 数据库
```

{% hint style="danger" %}
**永远不要将领域实体放入 CCAAS 后端。** 这是平台早期版本中真实发生过的架构违规——一个 lesson-plan 模块被意外留在了核心后端中，与 Solution 中的代码重复。详见项目指南中的架构原则章节。
{% endhint %}

## 字段到列的映射模式

由于 TypeScript 使用 camelCase 而 SQL 使用 snake_case，后端需要显式映射。在备课方案设计器中，服务层的 `patchField()` 方法使用以下模式：

```typescript
const fieldToColumn: Record<SyncField, string> = {
  title: 'title',
  subject: 'subject',
  gradeLevel: 'grade_level',
  durationMinutes: 'duration_minutes',
  lessonPlanCode: 'lesson_plan_code',
  objectives: 'objectives',
  content: 'content',
  teachingMethods: 'teaching_methods',
  materialsNeeded: 'materials_needed',
  assessmentMethods: 'assessment_methods',
  curriculumRequirements: 'curriculum_requirements',
  studentAnalysis: 'student_analysis',
  extraProperties: 'extra_properties',
  status: 'status',
  attachments: 'attachments',
};
```

此映射被 `patchField()` 方法使用，该方法处理来自 `write_output` 的单个字段更新。存储 JSON 数据的字段（`extraProperties`、`curriculumRequirements`、`attachments`）在写入前使用 `JSON.stringify()` 序列化。

## 检查点

在进入下一章之前，验证你能回答以下问题：

- [ ] 备课方案设计器中的核心领域实体是什么？
- [ ] 它有多少个同步字段？分别是哪些？
- [ ] 哪些字段在创建时设置，哪些由 AI Agent 填写？
- [ ] `lesson_plans` 表存在哪里——CCAAS 数据库还是 Solution 数据库？
- [ ] 如果 Skill 指令引用了一个 MCP Server 不认识的字段名，会发生什么？
- [ ] 为什么教材字段（`publisher`、`volume` 等）存在于 LessonPlan 上但不是同步字段？
- [ ] `CurriculumStandard[]` 这样的复杂类型在 SQLite 中如何存储？

## 练习：添加难度等级字段

为 LessonPlan 实体扩展一个 `difficultyLevel` 字段来表示课程难度：

1. **选择数据类型。** 难度应该是数字（1-5）、枚举（`basic`、`intermediate`、`advanced`）还是其他类型？
2. **更新 TypeScript 接口**，添加新字段。
3. **更新 SQL Schema**，添加新列和约束。
4. **判断是否为同步字段。** AI Agent 应该能够设置难度等级吗？
5. **如果是，更新三个位置：** Skill 指令、MCP Server 校验（Zod schema）、前端处理器。

<details>
<summary>参考答案</summary>

```typescript
// 1. 选择枚举类型，可读性更好
export type DifficultyLevel = 'basic' | 'intermediate' | 'advanced';

// 2. 更新接口
export interface LessonPlan {
  // ... 现有字段
  difficultyLevel: DifficultyLevel;
}

// 3. SQL 列
// difficulty_level TEXT NOT NULL DEFAULT 'intermediate'
//   CHECK (difficulty_level IN ('basic', 'intermediate', 'advanced'))

// 4. 是的，添加到同步字段 -- AI 可以根据内容复杂度
//    和年级来评估难度
export const SYNC_FIELDS = [
  'title', 'subject', 'gradeLevel', 'durationMinutes',
  'lessonPlanCode', 'objectives', 'content', 'teachingMethods',
  'materialsNeeded', 'assessmentMethods', 'curriculumRequirements',
  'studentAnalysis', 'extraProperties', 'status', 'attachments',
  'difficultyLevel',  // 新增
] as const;

// 5. Zod schema:
// difficultyLevel: z.enum(['basic', 'intermediate', 'advanced'])
//
// Skill 指令:
// - field: "difficultyLevel" -> 取值："basic"、"intermediate"、"advanced"
//
// fieldToColumn 映射:
// difficultyLevel: 'difficulty_level'
```

</details>

## 本章小结

在本章中你学到了如何：

- 从用户需求中**识别实体**（LessonPlan、CurriculumStandard、LessonPlanAttachment）
- 将字段**分类**为元数据、教材、内容、结构化和审计组
- 用合适的约束和可空性**定义字段类型**
- 设计数据库 Schema，完成 camelCase 到 snake_case 的**映射**，包括复杂类型的 JSON 存储
- 选择 AI Agent 可以通过 `write_output` 更新的**同步字段**（备课方案设计器有 15 个）
- 在 Skill 指令、MCP Server 校验（Zod schemas）和前端处理器之间**保持一致性**
- **区分平台实体**（Session、Skill）和**领域实体**（LessonPlan）
- 使用显式的 `fieldToColumn` 记录为 `patchField()` 方法进行**字段到列的映射**

在下一章中，我们将规划**用户旅程** —— 用户通过 AI Agent 与备课方案设计器交互时所遵循的分步工作流。

---

**下一章：** [3. 用户旅程映射](03-user-journeys.md)
**上一章：** [1. 理解 Solution 架构](01-architecture.md)
