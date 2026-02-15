# 1. 理解 Solution 架构

在本章中，你将学习什么是 Solution、它如何融入 LoopAI 平台、以及每个 Solution 由哪些构建块组成。学完本章后，你将建立清晰的架构心智模型，并具体了解我们将要构建什么。

## Solution 解决什么问题？

假设你正在构建一个任务管理应用。在没有 LoopAI 的情况下，你会构建一个标准的 Web 应用：React 前端、Node.js 后端、一个数据库。用户填写表单、点击按钮，应用保存数据。这可以工作，但没有 AI 辅助。

现在假设你想添加 AI 能力：

- 用户粘贴会议记录，AI 自动从中创建任务
- 用户描述一个项目，AI 建议里程碑和任务分解
- 用户输入模糊的描述，AI 将其优化为清晰、可执行的任务

从零开始构建这些功能需要集成 LLM API、管理提示词、处理流式响应、将 AI 输出同步到表单、以及添加版本控制让用户可以撤销 AI 的更改。这是大量与你的业务逻辑无关的基础设施工作。

**Solution 就是这个问题的答案。**它是一个结构化的应用框架，让你专注于你的业务领域（任务、项目、用户），而 LoopAI 平台处理 AI 基础设施（会话管理、事件流、工具调用、审计追踪）。

## 平台 vs. Solution 的职责

LoopAI 平台和你的 Solution 有清晰的职责分离：

```
┌────────────────────────────────────────────────────────────────┐
│                    LoopAI 平台 (CCAAS)                         │
│                                                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │   会话管理    │  │   Skill      │  │    消息持久化         │ │
│  │              │  │   路由       │  │                      │ │
│  └──────────────┘  └──────────────┘  └──────────────────────┘ │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │  AI Agent     │  │  WebSocket   │  │    认证与租户         │ │
│  │  生命周期     │  │   中继       │  │                      │ │
│  └──────────────┘  └──────────────┘  └──────────────────────┘ │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│                       你的 Solution                            │
│                                                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │   领域模型    │  │   业务逻辑    │  │    前端 UI           │ │
│  │              │  │              │  │                      │ │
│  └──────────────┘  └──────────────┘  └──────────────────────┘ │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │   MCP 工具    │  │    Skills    │  │    数据存储           │ │
│  │(write_output) │  │  (SKILL.md)  │  │                      │ │
│  └──────────────┘  └──────────────┘  └──────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

| 职责 | 谁负责 | 示例 |
|------|-------|------|
| 创建和销毁 AI Agent 会话 | 平台 | CCAAS 管理 Agent 进程 |
| 将消息路由到正确的 Skill | 平台 | 关键词/模式匹配 |
| 将事件流式推送到前端 | 平台 | WebSocket 中继 |
| 持久化对话历史 | 平台 | 消息存储 |
| 定义 AI 的知识和行为 | Solution | SKILL.md 文件 |
| 提供 AI 可调用的工具 | Solution | 包含 write\_output 的 MCP Server |
| 存储业务数据（任务、项目） | Solution | Solution 后端 + 数据库 |
| 渲染用户界面 | Solution | React/Vue 前端 |

{% hint style="info" %}
**核心洞察**：你的 Solution 永远不会直接与 AI Agent 通信。所有通信都通过 CCAAS 平台，它充当中继角色。这种分离使得平台与 AI 引擎无关 -- 你可以在不改变 Solution 代码的情况下更换底层 AI 模型。
{% endhint %}

## 四大构建块

每个 LoopAI Solution 都由四个构建块组成。理解它们是设计任何 Solution 的关键：

### 1. 领域模型

领域模型定义你的业务实体及其关系。对于我们的 Task Manager：

- **Task（任务）**：标题、描述、状态、优先级、负责人
- **Project（项目）**：名称、描述、任务列表
- **User（用户）**：姓名、邮箱、角色

领域模型驱动其他所有内容：数据库 schema、API 端点、表单字段和 AI 输出格式。

### 2. 用户旅程

用户旅程描述用户为完成某个目标所采取的步骤序列，以及 AI 可以在哪里提供协助。例如：

```
用户旅程："从会议记录创建任务"

1. 用户将会议记录粘贴到聊天窗口
2. AI 分析记录并识别待办事项
3. AI 使用 write_output 创建任务（每个待办一个）
4. 任务出现在表单中供用户审核
5. 用户编辑标题、调整优先级、分配团队成员
6. 用户点击"全部保存"将任务持久化
```

识别用户旅程帮助你决定要构建哪些 Skills 和 MCP 工具。

### 3. 数据流

数据流描述信息如何在前端、后端和 AI Agent 之间流动。在 LoopAI 中，数据通过 WebSocket 事件流动：

```
用户输入消息
    │
    ▼
前端 ──chat 事件──► Solution 后端 ──REST API──► CCAAS
                                                   │
                                             AI Agent 进程
                                                   │
CCAAS ──output_update──► Solution 后端 ──事件──► 前端
                                                   │
                                             表单更新
                                             AI 数据
```

理解数据流至关重要。AI Agent 不会直接写入你的数据库。相反，它调用 `write_output`（一个 MCP 工具），这会触发一个 `output_update` 事件到达你的前端。你的前端随后渲染数据供用户审核。只有当用户点击"保存"时，数据才会被持久化到你的后端。

### 4. 表单协议（output\_update）

表单协议定义 AI 生成的数据如何映射到你的前端表单字段。每个可以接收 AI 数据的字段称为 **SyncField**：

```typescript
// AI 调用 write_output：
{ field: "title", value: "审查 Q3 指标", operation: "set" }

// 这触发一个 output_update 事件，你的前端处理它：
socket.on('output_update', (event) => {
  const { field, value } = event.payload.data
  // field = "title", value = "审查 Q3 指标"
  // 更新表单字段
})
```

设计表单协议意味着决定：
- AI 可以写入哪些字段？
- 每个字段期望什么数据类型？
- 前端如何处理 `set`、`append` 和 `merge` 操作？

## 我们的 Task Manager：全景图

现在你理解了四大构建块，以下是它们如何在我们的 Task Manager Solution 中组合在一起：

```
┌─────────────────────────────────────────────────────┐
│                 Task Manager Solution                │
│                                                     │
│  领域模型：                                          │
│    Task（标题、描述、状态、优先级）                    │
│    Project（名称、描述）                              │
│                                                     │
│  用户旅程：                                          │
│    - 在 AI 辅助下创建单个任务                         │
│    - 从会议记录批量创建任务                           │
│    - 获取 AI 的任务分解建议                           │
│                                                     │
│  数据流：                                            │
│    Chat → CCAAS → AI Agent → write_output            │
│    → output_update → 前端表单 → 用户审核              │
│    → 保存 → Solution 后端 → 数据库                    │
│                                                     │
│  表单协议：                                          │
│    SyncFields: title, description, status,           │
│    priority, assignee, dueDate                       │
│    操作: set（单个字段）, append（任务列表）            │
└─────────────────────────────────────────────────────┘
```

## Solution 目录结构

每个 Solution 都遵循标准的目录布局：

```
task-manager-tutorial/
├── solution.json           # Solution 配置
├── setup.sh                # 一键启动脚本
├── inject-skills.sh        # Skill 注册脚本
│
├── frontend/               # React 应用
│   ├── package.json
│   ├── src/
│   │   ├── components/     # UI 组件
│   │   ├── hooks/          # 自定义 React Hooks
│   │   └── types/          # TypeScript 类型定义
│   └── ...
│
├── backend/                # 业务后端 (NestJS)
│   ├── package.json
│   ├── src/
│   │   ├── tasks/          # Task 实体、控制器、服务
│   │   ├── projects/       # Project 实体、控制器、服务
│   │   └── ...
│   └── ...
│
├── mcp-server/             # MCP 工具服务
│   ├── package.json
│   ├── src/
│   │   └── index.ts        # write_output + 自定义工具
│   └── ...
│
└── skills/                 # AI Skill 定义
    ├── task-creator/
    │   └── SKILL.md        # 任务创建技能
    └── bulk-importer/
        └── SKILL.md        # 从笔记批量导入
```

我们来逐一了解每个组件：

### solution.json

中央配置文件，告诉平台关于你的 Solution 的信息：

```json
{
  "name": "Task Manager",
  "slug": "task-manager",
  "version": "1.0.0",
  "description": "AI 辅助的任务管理应用",
  "mcpServers": {
    "task-tools": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"]
    }
  },
  "skills": [
    {
      "name": "Task Creator",
      "slug": "task-creator",
      "type": "prompt",
      "triggers": [
        { "type": "keyword", "value": "task", "priority": 1 }
      ],
      "allowedTools": ["write_output"],
      "skillFile": "skills/task-creator/SKILL.md"
    }
  ],
  "ports": {
    "backend": 3010,
    "frontend": 5280
  }
}
```

### 前端

一个 React 应用，渲染表单并处理来自 AI 的 `output_update` 事件。它通过 Socket.io 连接到 Solution 后端。

### 后端

一个 NestJS 应用，存储业务数据（任务、项目），并在前端和 CCAAS 之间中继 WebSocket 事件。

### MCP Server

一个轻量级服务，实现 AI Agent 可用的工具。最重要的工具是 `write_output`，它让 AI 将结构化数据写入你的表单。

### Skills

定义 AI Agent 行为的 Markdown 文件：它的角色、知识、工作流和输出格式。每个 Skill 针对一个特定的用户旅程。

## 请求如何在系统中流动

为了更具体地说明，让我们追踪一个请求在整个系统中的流动：

**场景**：用户在聊天中输入"创建一个任务：周五前审查 Q3 指标"。

```
步骤 1: 用户通过聊天输入发送消息
        前端 → Socket.io → Solution 后端

步骤 2: Solution 后端转发到 CCAAS
        POST /api/v1/sessions/{id}/completion
        Body: { message: "创建一个任务：周五前审查 Q3 指标" }

步骤 3: CCAAS 匹配 Skill
        "task" 关键词匹配 → 选择 Task Creator Skill

步骤 4: CCAAS 使用 Skill 指令启动 AI Agent
        AI 读取 SKILL.md 并理解其角色

步骤 5: AI Agent 调用 write_output
        { field: "title", value: "审查 Q3 指标" }
        { field: "dueDate", value: "2026-02-21" }
        { field: "status", value: "TODO" }

步骤 6: CCAAS 将每次调用包装为 output_update 事件
        通过 WebSocket 推送 → Solution 后端 → 前端

步骤 7: 前端接收 output_update 事件
        表单字段在用户观看时实时更新

步骤 8: 用户审核表单
        编辑标题、更改优先级、点击"保存"

步骤 9: 前端发送保存请求到 Solution 后端
        POST /api/tasks → 保存到数据库

步骤 10: 任务被持久化，带有完整的审计追踪
```

{% hint style="success" %}
**注意**：AI 永远不会直接写入数据库。它通过 `write_output` 提议数据，用户审核后才保存。这就是每个 LoopAI Solution 核心的 Human-in-the-Loop 模式。
{% endhint %}

## 与传统 Web 应用的对比

如果你构建过传统 Web 应用，这个对比将帮助你理解 LoopAI 增加了什么：

| 方面 | 传统 Web 应用 | LoopAI Solution |
|------|-------------|-----------------|
| 用户输入 | 表单 + 按钮 | 表单 + 按钮 + **聊天** |
| 数据录入 | 仅手动 | 手动 + **AI 辅助** |
| 后端 | REST API + 数据库 | REST API + 数据库 + **CCAAS 中继** |
| AI 集成 | 自定义 LLM API 调用 | **由平台管理** |
| 输出处理 | 直接写入数据库 | **output\_update → 审核 → 保存** |
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
   不会。AI Agent 调用 write_output，这会触发一个 output_update 事件。数据流向前端，用户审核后点击"保存"才会持久化。
   </details>

3. **CCAAS 在前端和 AI Agent 之间扮演什么角色？**
   <details>
   <summary>答案</summary>
   CCAAS 充当中继。它管理会话、将消息路由到正确的 Skill、启动 AI Agent 进程、并通过 WebSocket 将事件（text_delta、output_update）流式推送回前端。
   </details>

4. **为什么设计阶段（第 1-3 章）在编码之前很重要？**
   <details>
   <summary>答案</summary>
   领域模型决定你的数据库 schema 和 API 端点。用户旅程决定你需要哪些 Skills 和 MCP 工具。数据流决定你的前端如何处理事件。跳过设计会导致返工。
   </details>

## 常见陷阱

{% hint style="danger" %}
**陷阱 1：在 CCAAS 中放入业务逻辑。** CCAAS 是中继和路由层。你的业务实体（Task、Project）和业务规则属于你的 Solution 后端，而不是 CCAAS。
{% endhint %}

{% hint style="danger" %}
**陷阱 2：跳过 output\_update 协议。** 一些开发者试图让 AI 通过自定义 MCP 工具直接写入数据库。这绕过了 Human-in-the-Loop 审核步骤，移除了用户在保存前编辑的能力。
{% endhint %}

{% hint style="danger" %}
**陷阱 3：在没有定义用户旅程的情况下构建 Solution。** 没有清晰的旅程，你不知道要写哪些 Skills、构建什么工具、或者 AI 应该如何表现。这会导致一个能聊天但实际上帮不了忙的聊天机器人。
{% endhint %}

## 检查点

在继续第 2 章之前，确保你能回答：

- [ ] 我理解什么是 Solution 以及它与传统 Web 应用的区别
- [ ] 我能说出四大构建块：领域模型、用户旅程、数据流、表单协议
- [ ] 我理解 CCAAS 是中继层，不是业务逻辑层
- [ ] 我理解 Human-in-the-Loop 模式：AI 提议、用户审核、然后保存
- [ ] 我知道 Solution 的标准目录结构

## 下一步

架构已经清晰了，是时候设计我们的领域模型了。继续前往[第 2 章：设计领域模型](02-domain-model.md)。
