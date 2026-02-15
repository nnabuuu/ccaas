# 6.4 Skills

## 本节目标

在本节中，你将为任务管理器 Solution 编写 Skill 定义。Skill 是 Markdown 文件，充当 AI Agent 的使用手册——定义 Agent 知道什么、可以使用哪些工具，以及应该如何响应用户请求。

完成本节后，你将拥有：

- 一个用于创建和编辑单个任务的 **Task Creator** Skill
- 一个用于批量导入多个任务的 **Bulk Import** Skill
- 在 `solution.json` 中注册的两个 Skill 及其触发器配置
- 对 Skill、MCP 工具和同步字段如何关联的理解

## 什么是 Skill？

Skill 是一个 Markdown 文件 (`SKILL.md`)，作为 AI Agent 在特定任务中的系统提示。当用户发送消息时，CCAAS 将其与 Skill 触发器匹配，并将匹配的 Skill 内容注入到 Agent 的上下文中。

```
用户消息: "创建一个修复登录 bug 的任务"
                │
                ▼
CCAAS Skill 路由器:
  - 匹配触发器: "create task" → task-creator Skill
                │
                ▼
AI Agent 接收到:
  - 系统提示: SKILL.md 的内容
  - 可用工具: write_output (来自 MCP Server)
  - 用户消息: "创建一个修复登录 bug 的任务"
                │
                ▼
AI Agent 调用 write_output(field="taskTitle", value="修复登录 bug")
```

## Skill 文件结构

一个 Skill 文件有四个主要部分：

```markdown
# Skill 名称

## 角色定义
AI Agent 是谁，做什么。

## 知识范围
领域知识和约束条件。

## 工作流程
Agent 遵循的分步流程。

## 输出格式
如何使用 write_output 以及有哪些可用字段。
```

## 第 1 步：编写 Task Creator Skill

创建 `skills/task-creator/SKILL.md`：

```markdown
# Task Creator

## 角色定义

你是一个任务管理助手，通过自然语言对话帮助用户创建和管理任务。你能理解
项目上下文，从非正式描述中提取任务细节，并生成结构良好的任务条目。

## 知识范围

### 任务字段
- **taskTitle**: 简洁的、可操作的标题（推荐使用"动词 + 对象"的模式）
- **taskDescription**: 需要做什么的详细描述
- **priority**: low、medium、high 或 urgent
- **status**: todo、in_progress、done 或 cancelled
- **dueDate**: ISO 日期格式 (YYYY-MM-DD)
- **tags**: 分类标签数组

### 优先级指南
- **urgent**: 阻塞其他工作或有即时截止日期
- **high**: 重要，应尽快完成
- **medium**: 正常优先级，标准时间线
- **low**: 锦上添花，可以推迟

### 好的任务标题
- 使用祈使句: "修复登录 bug" 而不是 "登录 bug"
- 要具体: "为注册表单添加邮箱验证" 而不是 "修复表单"
- 保持在 80 个字符以内

## 工作流程

1. **解析请求**: 从用户消息中提取任务细节
   - 识别任务标题（需要做什么）
   - 寻找优先级指示词（"紧急"、"尽快"、"有空的时候"）
   - 寻找截止日期（"周五之前"、"下周"、"3月15日"）
   - 识别标签或分类（"前端"、"后端"、"bug"）

2. **填充缺失值**: 对缺失字段使用合理的默认值
   - 默认优先级: medium
   - 默认状态: todo
   - 默认标签: 尽可能从上下文推断

3. **同步到表单**: 使用 write_output 将每个字段发送到前端
   - 每个字段调用一次 write_output
   - 先发标题，然后描述，再发其他字段

4. **与用户确认**: 同步后，简要描述创建的内容并询问用户是否要在
   保存前做任何修改。

## 输出格式

使用 write_output 工具逐个更新任务字段。
每次调用应包含字段名及其值。

可用字段及其类型:
- field: "taskTitle" → 字符串 (任务标题，1-200 字符)
- field: "taskDescription" → 字符串 (详细描述)
- field: "priority" → "low" | "medium" | "high" | "urgent"
- field: "status" → "todo" | "in_progress" | "done" | "cancelled"
- field: "dueDate" → ISO 日期字符串 (例如 "2026-03-15")
- field: "tags" → 字符串数组 (例如 ["frontend", "bug"])

### 示例

用户说: "创建一个高优先级的任务来修复登录页面跳转，
下周五截止，标记为 frontend 和 bug"

你应该进行以下 write_output 调用:
1. write_output(field="taskTitle", value="修复登录页面跳转")
2. write_output(field="taskDescription", value="登录页面在成功认证后没有
   正确跳转用户。需要调查跳转逻辑并修复路由问题。")
3. write_output(field="priority", value="high")
4. write_output(field="status", value="todo")
5. write_output(field="dueDate", value="2026-02-21")
6. write_output(field="tags", value=["frontend", "bug"])

## 约束

- 始终使用 write_output 同步数据。不要只用文字描述任务。
- 不要编造项目 ID。如果用户提到一个项目，请让他们从列表中选择。
- 如果用户的请求模糊不清，在创建任务之前先请求澄清。
- 保持描述专业清晰。可以在用户输入的基础上扩展，但不要编造
  未被提及或暗示的细节。
```

### 这个 Skill 中的关键设计决策

**1. 在输出格式部分明确列出字段。** 这确保 AI Agent 知道在调用 `write_output` 时使用哪些确切的字段名。这些名称必须与 MCP Server 中的 `SYNC_FIELDS` 匹配。

**2. 分步工作流程。** Agent 遵循可预测的模式：解析、填充默认值、同步、确认。这使行为一致且可调试。

**3. 约束部分。** 明确的边界防止 Agent 做不需要的事情，如编造数据或跳过表单同步。

**4. 示例交互。** 具体的例子比抽象描述更能帮助 AI Agent 理解预期的行为模式。

## 第 2 步：编写 Bulk Import Skill

创建 `skills/bulk-import/SKILL.md`：

```markdown
# Bulk Import

## 角色定义

你是一个任务导入助手，帮助用户从文本输入一次性创建多个任务。你可以将
纯文本列表、编号列表、CSV 数据和非正式描述解析为结构化的任务条目。

## 支持的输入格式

### 纯文本列表
```
- 审查 API 文档
- 修复登录 bug
- 更新部署脚本
```

### 编号列表
```
1. 审查 API 文档 (高优先级)
2. 修复登录 bug (紧急)
3. 更新部署脚本
```

### CSV 格式
```
title,priority,tags
审查 API 文档,high,backend
修复登录 bug,urgent,frontend;bug
更新部署脚本,medium,devops
```

### 非正式描述
"我需要审查 API 文档，修复那个紧急的登录 bug，
有空的时候更新一下部署脚本"

## 工作流程

1. **识别格式**: 确定用户提供的是哪种输入格式
2. **解析所有任务**: 为每个任务提取标题、优先级、标签和截止日期
3. **填充默认值**: 为缺失字段应用默认值
   - 默认优先级: medium
   - 默认状态: todo
4. **同步到前端**: 使用 write_output 的 field="tasks"，value 为
   任务对象数组
5. **报告摘要**: 告诉用户解析了多少个任务并简要列出

## 输出格式

对于批量导入，使用 write_output 的特殊 "tasks" 字段，接受数组:

```json
write_output(
  field="tasks",
  value=[
    {
      "taskTitle": "审查 API 文档",
      "priority": "high",
      "status": "todo",
      "tags": ["backend"]
    },
    {
      "taskTitle": "修复登录 bug",
      "priority": "urgent",
      "status": "todo",
      "tags": ["frontend", "bug"]
    }
  ]
)
```

每个任务对象可以包含以下同步字段:
- taskTitle (必填)
- taskDescription
- priority
- status
- dueDate
- tags

## 约束

- 每个任务必须至少有一个标题
- 如果某些条目解析失败，导入有效的条目并报告哪些无法解析
- 每次导入最多 50 个任务
- 不要静默跳过任务。始终报告解析总数和发现的任何问题
```

## 第 3 步：在 solution.json 中注册 Skill

将两个 Skill 添加到 `solution.json`：

```json
{
  "skills": [
    {
      "name": "Task Creator",
      "slug": "task-creator",
      "description": "通过 AI 辅助创建和管理任务",
      "skillFile": "skills/task-creator/SKILL.md",
      "scope": "tenant",
      "triggers": [
        { "type": "keyword", "value": "create task", "priority": 10 },
        { "type": "keyword", "value": "add task", "priority": 10 },
        { "type": "keyword", "value": "new task", "priority": 9 },
        { "type": "keyword", "value": "task priority", "priority": 8 },
        { "type": "keyword", "value": "assign task", "priority": 8 }
      ],
      "allowedTools": ["write_output", "Read", "Write"]
    },
    {
      "name": "Bulk Import",
      "slug": "bulk-import",
      "description": "从文本、CSV 或结构化输入导入多个任务",
      "skillFile": "skills/bulk-import/SKILL.md",
      "scope": "tenant",
      "triggers": [
        { "type": "keyword", "value": "bulk import", "priority": 10 },
        { "type": "keyword", "value": "import tasks", "priority": 10 },
        { "type": "keyword", "value": "batch create", "priority": 9 },
        { "type": "keyword", "value": "multiple tasks", "priority": 8 }
      ],
      "allowedTools": ["write_output", "Read", "Write"]
    }
  ]
}
```

### 触发器配置说明

| 字段 | 描述 |
|------|------|
| `type` | `keyword` 匹配消息中的精确词语 |
| `value` | 要匹配的关键词或模式 |
| `priority` | 数字越大 = 当多个 Skill 匹配时优先级越高 |

**触发器如何工作：**

1. 用户发送: "Create a task to fix the login page"
2. CCAAS 将消息与所有 Skill 触发器进行扫描匹配
3. "create task" 匹配 Task Creator Skill（优先级 10）
4. CCAAS 将 Task Creator Skill 注入 AI Agent 上下文

**当多个 Skill 匹配时：**

如果用户说 "create multiple tasks"，"create task"（Task Creator）和 "multiple tasks"（Bulk Import）都会匹配。CCAAS 选择优先级最高的触发器。由于它们分别是优先级 10 和 8，Task Creator 会被选中。为确保正确路由，可以考虑调整触发器优先级或使用更具体的模式。

### allowedTools

`allowedTools` 数组限制了 Skill 可以使用哪些 MCP 工具。这遵循最小权限原则：

- `write_output` —— 同步数据到前端所必需的
- `Read` —— 允许读取文件（内置 Claude Code 工具）
- `Write` —— 允许写入文件（内置 Claude Code 工具）

未列出的工具在该 Skill 激活时无法被调用，即使 MCP Server 提供了它们。

## Skill、MCP Server 和前端如何关联

以下是三个组件如何协同工作的完整图景：

```
┌─────────────────────────────────────────────────────┐
│                    SKILL.md                         │
│                                                     │
│  "使用 write_output, field='taskTitle'"             │
│  "priority 的有效值: low, medium, high"             │
│                                                     │
│  告诉 AI Agent 做什么                                │
└──────────────────────┬──────────────────────────────┘
                       │ AI Agent 遵循
                       │ 这些指令
                       ▼
┌─────────────────────────────────────────────────────┐
│                  MCP Server                         │
│                                                     │
│  SYNC_FIELDS = ['taskTitle', 'priority', ...]       │
│  验证: 'taskTitle' 是有效字段吗？ ✓                  │
│  验证: 'critical' 是有效的优先级吗？ ✗               │
│                                                     │
│  告诉 CCAAS 数据是否有效                             │
└──────────────────────┬──────────────────────────────┘
                       │ CCAAS 包装成
                       │ output_update 事件
                       ▼
┌─────────────────────────────────────────────────────┐
│                   前端                               │
│                                                     │
│  switch (field) {                                   │
│    case 'taskTitle': setTitle(value); break;         │
│    case 'priority': setPriority(value); break;       │
│  }                                                  │
│                                                     │
│  告诉 UI 如何显示数据                                │
└─────────────────────────────────────────────────────┘
```

{% hint style="danger" %}
**字段名在三者之间必须完全相同。** 如果 Skill 说 `"title"`，MCP Server 验证 `"taskTitle"`，前端处理 `"task_title"`，那什么都不会工作。使用 `SYNC_FIELDS` 常量作为唯一数据源。
{% endhint %}

## 将 Skill 注入 CCAAS

在 `solution.json` 中定义的 Skill 在运行 setup 脚本时会自动注入。你也可以手动注入：

```bash
#!/bin/bash
# inject-skills.sh

CCAAS_URL="http://localhost:3001"

# 注入 Task Creator Skill
curl -X POST "$CCAAS_URL/api/v1/skills" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Task Creator",
    "slug": "task-creator",
    "description": "通过 AI 辅助创建和管理任务",
    "type": "prompt",
    "content": "'"$(cat skills/task-creator/SKILL.md)"'",
    "triggers": [
      {"type": "keyword", "value": "create task", "priority": 10},
      {"type": "keyword", "value": "add task", "priority": 10}
    ],
    "allowedTools": ["write_output", "Read", "Write"]
  }'

# 注入 Bulk Import Skill
curl -X POST "$CCAAS_URL/api/v1/skills" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Bulk Import",
    "slug": "bulk-import",
    "description": "从文本或 CSV 导入多个任务",
    "type": "prompt",
    "content": "'"$(cat skills/bulk-import/SKILL.md)"'",
    "triggers": [
      {"type": "keyword", "value": "bulk import", "priority": 10},
      {"type": "keyword", "value": "import tasks", "priority": 10}
    ],
    "allowedTools": ["write_output", "Read", "Write"]
  }'

echo "Skills 注入成功"
```

## 测试 Skill

### 手动测试

测试 Skill 的最佳方式是使用聊天界面：

1. 启动 CCAAS 后端: `npm run dev:backend`
2. 启动 Solution 后端: `cd solutions/task-manager-tutorial/backend && npm run start:dev`
3. 打开前端或使用管理控制台
4. 发送匹配触发器的消息: "Create a task to review the API documentation"
5. 验证:
   - 正确的 Skill 被激活（检查 agent 日志）
   - `write_output` 被调用时使用了正确的字段名
   - 前端表单更新了生成的值

### 常见测试问题

| 症状 | 可能原因 |
|------|---------|
| 激活了错误的 Skill | 触发器优先级冲突；调整优先级数字 |
| AI Agent 没有调用 write_output | 输出格式部分不够清晰；添加更多示例 |
| write_output 返回错误 | Skill 和 MCP Server 之间字段名不匹配 |
| 表单没有更新 | 前端没有处理 output_update 中的字段名 |

## 检查点

进入下一节之前，请验证：

- [ ] `skills/task-creator/SKILL.md` 存在，包含角色、工作流程和输出格式部分
- [ ] `skills/bulk-import/SKILL.md` 存在，支持多种输入格式
- [ ] 两个 Skill 都在 `solution.json` 中注册了合适的触发器
- [ ] Skill 输出格式中的字段名与 MCP Server 的 `SYNC_FIELDS` 匹配
- [ ] `allowedTools` 包含两个 Skill 都需要的 `write_output`

## 练习：添加状态更新 Skill

创建第三个 Skill 来处理任务状态更新。当用户说"将任务标记为完成"或"将任务移到进行中"时，这个 Skill 应该：

1. 询问要更新哪个任务（如果从上下文中不清楚）
2. 用 `field: "status"` 和新状态值调用 `write_output`
3. 与用户确认更改

<details>
<summary>提示</summary>

- 使用触发器如 `"mark as"`、`"change status"`、`"move to"`
- Skill 应该理解非正式的状态描述: "完成了" = "done"、"正在做" = "in_progress"、"还没开始" = "todo"
- 考虑边界情况: 如果用户说"完成登录任务"——"完成"是指状态还是指"完成构建"？

</details>

## 本节小结

在本节中你学到了：

- **Skill 结构**: 角色、知识、工作流程和输出格式四个部分
- **编写有效的 Skill**: 明确字段名，提供示例，设置约束
- **触发器配置**: 带优先级的关键词决定哪个 Skill 处理消息
- **三方契约**: Skill 告诉 AI 做什么，MCP Server 验证数据，前端渲染——三者必须使用相同的字段名
- **Skill 注入**: Skill 如何通过 `solution.json` 或 REST API 注册到 CCAAS

有了 MCP Server 和 Skill，AI Agent 现在可以生成结构化的任务数据并同步到前端。在下一节中，我们将构建接收这些更新并将其渲染到表单中的**前端**。

---

**下一节：** [6.5 前端实现](05-frontend.md)
**上一节：** [6.3 MCP Server](03-mcp-server.md)
