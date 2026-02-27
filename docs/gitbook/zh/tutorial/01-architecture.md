# 1. 理解 Solution 架构

在本章中，你将学习什么是 Solution、它如何融入即见Agentic 平台、以及每个 Solution 由哪些构建块组成。学完本章后，你将建立清晰的架构心智模型，并具体了解我们将要构建什么。

## Solution 解决什么问题？

假设你正在为教师构建一个备课设计器。在没有即见Agentic 的情况下，你会构建一个标准的 Web 应用：React 前端、Node.js 后端、一个数据库。教师填写表单 -- 选择教材、输入教学目标、编写教学活动 -- 应用保存数据。这可以工作，但没有 AI 辅助。

现在假设你想添加 AI 能力：

- 教师选择教材章节和年级，AI 自动生成符合课程标准的完整教案
- 教师描述教学目标，AI 建议教学目标、活动设计和评估方法
- 教师粘贴粗略笔记，AI 将其优化为结构化的教学内容，并具有合理的教学流程

从零开始构建这些功能需要集成 LLM API、管理提示词、处理流式响应、将 AI 输出同步到表单、以及添加版本控制让教师可以撤销 AI 的更改。这是大量与你的业务逻辑无关的基础设施工作。

**Solution 就是这个问题的答案。**它是一个结构化的应用框架，让你专注于你的业务领域（教案、教材、课程标准），而即见Agentic 平台处理 AI 基础设施（会话管理、事件流、工具调用、审计追踪）。

## 平台 vs. Solution 的职责

即见Agentic 平台和你的 Solution 有清晰的职责分离：

```
+-----------------------------------------------------------------+
|                    即见Agentic 平台 (CCAAS)                        |
|                                                                 |
|  +---------------+  +---------------+  +---------------------+ |
|  |   会话管理     |  |   Skill       |  |    消息持久化        | |
|  |               |  |   路由        |  |                     | |
|  +---------------+  +---------------+  +---------------------+ |
|  +---------------+  +---------------+  +---------------------+ |
|  |  AI Agent      |  |  SSE          |  |    认证与租户        | |
|  |  生命周期      |  |   事件推送    |  |                     | |
|  +---------------+  +---------------+  +---------------------+ |
+-----------------------------------------------------------------+

+-----------------------------------------------------------------+
|                       你的 Solution                              |
|                                                                 |
|  +---------------+  +---------------+  +---------------------+ |
|  |   领域模型     |  |   业务逻辑    |  |    前端 UI           | |
|  |               |  |              |  |                     | |
|  +---------------+  +---------------+  +---------------------+ |
|  +---------------+  +---------------+  +---------------------+ |
|  |   MCP 工具     |  |    Skills     |  |    数据存储          | |
|  | (write_output) |  |  (SKILL.md)   |  |                     | |
|  +---------------+  +---------------+  +---------------------+ |
+-----------------------------------------------------------------+
```

| 职责 | 谁负责 | 示例 |
|------|-------|------|
| 创建和销毁 AI Agent 会话 | 平台 | CCAAS 管理 Agent 进程 |
| 将消息路由到正确的 Skill | 平台 | 关键词/模式匹配 |
| 将事件流式推送到前端 | 平台 | SSE 事件（text\_delta、output\_update） |
| 持久化对话历史 | 平台 | 消息存储 |
| 定义 AI 的知识和行为 | Solution | SKILL.md 文件 |
| 提供 AI 可调用的工具 | Solution | 包含 write\_output 的 MCP Server |
| 存储业务数据（教案、教材） | Solution | Solution 后端 + 数据库 |
| 渲染用户界面 | Solution | React/Vue 前端 |

{% hint style="info" %}
**核心洞察**：你的前端**直接连接** CCAAS 来进行所有 AI 交互（聊天、流式传输、output\_update 事件）。Solution 后端仅负责领域数据 -- 存储教案、提供教材目录、管理课程标准。这种清晰的分离意味着你的 Solution 后端没有任何 AI 逻辑。
{% endhint %}

## 四大构建块

每个即见Agentic Solution 都由四个构建块组成。理解它们是设计任何 Solution 的关键：

### 1. 领域模型

领域模型定义你的业务实体及其关系。对于我们的备课设计器：

- **LessonPlan（教案）**：标题、学科、年级、教学目标、教学内容、教学方法、评估方法
- **Textbook（教材）**：学科、年级、出版社、册别、章节（树形结构）
- **CurriculumStandard（课程标准）**：标准编码、标题、学段、内容领域

领域模型驱动其他所有内容：数据库 schema、API 端点、表单字段和 AI 输出格式。

### 2. 用户旅程

用户旅程描述用户为完成某个目标所采取的步骤序列，以及 AI 可以在哪里提供协助。例如：

```
用户旅程："从教材章节设计教案"

1. 教师选择学科、年级、出版社、册别和章节
2. 教师创建一个与所选章节关联的新教案
3. 教师在聊天窗口输入"帮我设计这节课的教案"
4. AI 读取教材上下文和课程标准
5. AI 使用 write_output 生成教学目标、活动设计和评估方案
6. 内容出现在表单中供教师审核
7. 教师编辑教学目标、调整活动设计、修改评估方案
8. 教师点击"保存"将教案持久化
```

识别用户旅程帮助你决定要构建哪些 Skills 和 MCP 工具。

### 3. 数据流

数据流描述信息如何在前端、平台和 Solution 后端之间流动。在即见Agentic 中，前端有**两个连接**：

```
                  +-------------------+
                  |       前端        |
                  +-------------------+
                   /                \
        SSE (AI 聊天)         REST API (领域数据)
                 /                    \
    +------------+              +------------------+
    |   CCAAS    |              |  Solution 后端   |
    | (端口 3001) |              |   (端口 3002)    |
    +------------+              +------------------+
         |                            |
    AI Agent 进程               数据库 (SQLite)
         |                     (教案、教材)
    write_output
         |
    output_update 事件
         |
    前端表单更新
```

理解数据流至关重要：

- **前端到 CCAAS**（SSE）：聊天消息、流式响应、output\_update 事件。前端使用 `useAgentConnection({ serverUrl: 'http://localhost:3001' })` 直接连接。
- **前端到 Solution 后端**（REST API）：教案的 CRUD 操作、教材目录查询、课程标准检索。这些是标准的 HTTP 调用，在开发环境中由 Vite 代理。

AI Agent 不会直接写入你的数据库。相反，它调用 `write_output`（一个 MCP 工具），这会触发一个 `output_update` 事件，通过 CCAAS 到达你的前端。你的前端随后渲染数据供教师审核。只有当教师点击"保存"时，数据才会被持久化到你的 Solution 后端。

### 4. 表单协议（output\_update）

表单协议定义 AI 生成的数据如何映射到你的前端表单字段。每个可以接收 AI 数据的字段称为 **SyncField**：

```typescript
// AI 调用 write_output：
{ field: "objectives", value: "1. 理解多位数乘法...", operation: "set" }

// CCAAS 通过 SSE 将其作为 output_update 事件传递：
onOutputUpdate: (update) => {
  // update.field = "objectives"
  // update.value = "1. 理解多位数乘法..."
  addPendingUpdate({
    field: update.field,
    value: update.value,
    preview: update.preview,
  })
}
```

设计表单协议意味着决定：
- AI 可以写入哪些字段？（在我们的案例中：objectives、content、teachingMethods、assessmentMethods、materialsNeeded、studentAnalysis 等）
- 每个字段期望什么数据类型？（文本用字符串，课程标准用数组）
- 前端如何处理 `set`、`append` 和 `merge` 操作？

## 我们的备课设计器：全景图

现在你理解了四大构建块，以下是它们如何在我们的备课设计器 Solution 中组合在一起：

```
+------------------------------------------------------+
|              备课设计器 Solution                       |
|                                                      |
|  领域模型：                                           |
|    LessonPlan（标题、学科、年级、                      |
|      教学目标、内容、教学方法、                         |
|      评估方法、课程标准要求）                           |
|    Textbook（学科、年级、出版社、章节）                 |
|    CurriculumStandard（编码、标题、领域）              |
|                                                      |
|  用户旅程：                                           |
|    - 从教材章节设计教案                                |
|    - 从教案生成教学讲稿                                |
|    - 创建与课程标准对齐的评估方案                       |
|                                                      |
|  数据流：                                             |
|    Chat -> CCAAS -> AI Agent -> write_output           |
|    -> output_update -> 前端表单 -> 审核                 |
|    -> 保存 -> Solution 后端 -> 数据库                   |
|                                                      |
|  表单协议：                                           |
|    SyncFields: objectives, content,                   |
|    teachingMethods, assessmentMethods,                |
|    materialsNeeded, studentAnalysis,                  |
|    curriculumRequirements, extraProperties            |
|    操作: set（文本字段）,                              |
|    set（结构化数据如课程标准数组）                      |
+------------------------------------------------------+
```

## Solution 目录结构

每个 Solution 都遵循标准的目录布局：

```
lesson-plan-designer/
|-- solution.json           # Solution 配置
|-- setup.sh                # 一键启动脚本
|-- inject-skills.sh        # Skill 注册脚本
|
|-- frontend/               # React 应用
|   |-- package.json
|   |-- src/
|   |   |-- components/     # UI 组件（ChatPanel、FormSection 等）
|   |   |-- hooks/          # 自定义 React Hooks（useLessonPlanSession、useTextbook）
|   |   |-- types/          # TypeScript 类型定义（LessonPlan、SyncField）
|   |   +-- utils/          # 工具函数（API 客户端、output update 解析器）
|   +-- ...
|
|-- backend/                # 业务后端 (NestJS)
|   |-- package.json
|   |-- src/
|   |   |-- lesson-plans/   # LessonPlan 实体、控制器、服务
|   |   |-- textbook/       # 教材目录 API
|   |   |-- curriculum-standards/  # 课程标准数据
|   |   +-- files/          # 文件附件管理
|   +-- ...
|
|-- mcp-server/             # MCP 工具服务
|   |-- package.json
|   |-- src/
|   |   +-- index.ts        # write_output + 自定义工具
|   +-- ...
|
+-- skills/                 # AI Skill 定义
    |-- lesson-plan-designer/
    |   +-- SKILL.md         # 主备课设计技能
    |-- teaching-script-generator/
    |   +-- SKILL.md         # 教学讲稿生成
    +-- notebooklm/
        +-- SKILL.md         # 音频/文档生成
```

我们来逐一了解每个组件：

### solution.json

中央配置文件，告诉平台关于你的 Solution 的信息：

```json
{
  "name": "Lesson Plan Designer",
  "slug": "lesson-plan-designer",
  "version": "1.0.0",
  "description": "AI 辅助的备课设计工具",
  "backend": {
    "port": 3002,
    "ccaasUrl": "http://localhost:3001"
  },
  "mcpServers": {
    "lesson-plan-tools": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"],
      "type": "stdio"
    }
  },
  "skills": [
    {
      "name": "Lesson Plan Designer",
      "slug": "lesson-plan-designer",
      "skillFile": "skills/lesson-plan-designer/SKILL.md",
      "triggers": [
        { "type": "keyword", "value": "备课", "priority": 10 },
        { "type": "keyword", "value": "教学目标", "priority": 8 }
      ],
      "allowedTools": ["write_output"]
    }
  ]
}
```

### 前端

一个 React 应用，渲染表单并处理来自 AI 的 `output_update` 事件。它**直接连接 CCAAS** 通过 SSE 进行聊天和 AI 流式传输，并通过 REST API 连接 Solution 后端获取领域数据（教材、教案）。

### 后端

一个 NestJS 应用，存储业务数据（教案、教材目录、课程标准）并提供 REST API。它**没有任何 AI 逻辑** -- 所有 AI 交互通过 CCAAS 进行。

### MCP Server

一个轻量级服务，实现 AI Agent 可用的工具。最重要的工具是 `write_output`，它让 AI 将结构化数据写入你的表单。

### Skills

定义 AI Agent 行为的 Markdown 文件：它的角色、知识、工作流和输出格式。每个 Skill 针对一个特定的用户旅程。备课设计器有多个技能，包括主设计器、教学讲稿生成器和音频/文档生成器。

## 请求如何在系统中流动

为了更具体地说明，让我们追踪一个请求在整个系统中的流动：

**场景**：教师已选择"三年级数学，第二章：多位数乘法"，并在聊天中输入"帮我设计这节课的教案"。

```
步骤 1: 教师通过聊天输入发送消息
        前端 -> SSE -> CCAAS（端口 3001）

步骤 2: CCAAS 接收消息及页面上下文
        消息中包含当前教案表单的状态
        （学科、年级、章节、已有内容）

步骤 3: CCAAS 匹配 Skill
        "备课" 关键词匹配 -> 选择备课设计器 Skill

步骤 4: CCAAS 使用 Skill 指令启动 AI Agent
        AI 读取 SKILL.md 并理解其作为备课设计器的角色

步骤 5: AI Agent 多次调用 write_output
        { field: "objectives", value: "1. 理解多位数乘法..." }
        { field: "content", value: "导入环节（5分钟）：复习..." }
        { field: "teachingMethods", value: "引导式练习..." }
        { field: "assessmentMethods", value: "课堂小测..." }

步骤 6: CCAAS 将每次调用作为 output_update 事件传递
        通过 SSE 直接推送到前端

步骤 7: 前端接收 output_update 事件
        同步按钮出现在每个表单字段旁边

步骤 8: 教师审核生成的内容
        点击"同步"应用教学目标，编辑教学方法，放弃评估方案

步骤 9: 教师点击"保存"
        前端发送 PUT 请求到 Solution 后端（端口 3002）
        POST /api/lesson-plans/{id} -> 保存到数据库

步骤 10: 教案被持久化，带有完整的审计追踪
```

{% hint style="success" %}
**注意**：AI 永远不会直接写入数据库。它通过 `write_output` 提议数据，教师审核后才保存。这就是每个即见Agentic Solution 核心的"提议-审核-应用"模式。
{% endhint %}

## 与传统 Web 应用的对比

如果你构建过传统 Web 应用，这个对比将帮助你理解即见Agentic 增加了什么：

| 方面 | 传统 Web 应用 | 即见Agentic Solution |
|------|-------------|-----------------|
| 用户输入 | 表单 + 按钮 | 表单 + 按钮 + **聊天** |
| 数据录入 | 仅手动 | 手动 + **AI 辅助** |
| 后端 | REST API + 数据库 | REST API + 数据库 + **CCAAS 处理 AI** |
| AI 集成 | 自定义 LLM API 调用 | **由平台管理** |
| 输出处理 | 直接写入数据库 | **output\_update -> 审核 -> 保存** |
| 版本控制 | 手动（如果有） | **自动**审计追踪 |
| 提示词管理 | 临时字符串 | **结构化 Skills**（SKILL.md） |

## 练习

在继续之前，回答以下问题检查你的理解：

1. **Solution 的四大构建块是什么？**
   <details>
   <summary>答案</summary>
   领域模型、用户旅程、数据流和表单协议（output_update）。
   </details>

2. **AI Agent 会直接写入 Solution 数据库吗？**
   <details>
   <summary>答案</summary>
   不会。AI Agent 调用 write_output，这会触发一个 output_update 事件。数据流向前端，教师审核后点击"保存"才会持久化。
   </details>

3. **前端如何连接 CCAAS 和 Solution 后端？**
   <details>
   <summary>答案</summary>
   前端有两个独立的连接。它通过 SSE 直接连接 CCAAS（端口 3001）进行所有 AI 交互 -- 聊天消息、流式传输和 output_update 事件。它通过 REST API 连接 Solution 后端（端口 3002）获取领域数据 -- 教案 CRUD、教材目录查询和课程标准。
   </details>

4. **为什么设计阶段（第 1-3 章）在编码之前很重要？**
   <details>
   <summary>答案</summary>
   领域模型决定你的数据库 schema 和 API 端点。用户旅程决定你需要哪些 Skills 和 MCP 工具。数据流决定你的前端如何处理事件。跳过设计会导致返工。
   </details>

## 常见陷阱

{% hint style="danger" %}
**陷阱 1：在 CCAAS 中放入业务逻辑。** CCAAS 管理 AI 会话和事件传递。你的业务实体（LessonPlan、Textbook）和业务规则属于你的 Solution 后端，而不是 CCAAS。
{% endhint %}

{% hint style="danger" %}
**陷阱 2：跳过 output\_update 协议。** 一些开发者试图让 AI 通过自定义 MCP 工具直接写入数据库。这绕过了"提议-审核-应用"步骤，移除了教师在保存前编辑的能力。
{% endhint %}

{% hint style="danger" %}
**陷阱 3：在没有定义用户旅程的情况下构建 Solution。** 没有清晰的旅程，你不知道要写哪些 Skills、构建什么工具、或者 AI 应该如何表现。这会导致一个能聊天但实际上帮不了教师设计教案的聊天机器人。
{% endhint %}

## 检查点

在继续第 2 章之前，确保你能回答：

- [ ] 我理解什么是 Solution 以及它与传统 Web 应用的区别
- [ ] 我能说出四大构建块：领域模型、用户旅程、数据流、表单协议
- [ ] 我理解前端直接连接 CCAAS 处理 AI 交互，连接 Solution 后端处理领域数据
- [ ] 我理解"提议-审核-应用"模式：AI 提议、教师审核、然后保存
- [ ] 我知道 Solution 的标准目录结构

## 下一步

架构已经清晰了，是时候设计我们的领域模型了。继续前往[第 2 章：设计领域模型](02-domain-model.md)。
