# 6.4 Skills

## 本节目标

在本节中，你将为备课方案设计器编写 Skill 定义。Skill 是 Markdown 文件，充当 AI Agent 的使用手册——定义 Agent 知道什么、可以使用哪些工具，以及应该如何响应用户请求。

完成本节后，你将拥有：

- 一个用于打磨教案和生成材料的 **Lesson Plan Designer** Skill
- 一个将教案转化为教师讲稿的 **Teaching Script Generator** Skill
- 一个生成音频和 PDF 幻灯片的 **NotebookLM** Skill
- 在 `solution.json` 中注册的所有 Skill（v3.0 `{ slug, name }` 格式）
- 对 Skill、MCP 工具和同步字段如何关联的理解

## 什么是 Skill？

Skill 是一个 Markdown 文件 (`SKILL.md`)，作为 AI Agent 在特定任务中的系统提示。当用户发送消息时，CCAAS 将其与 Skill 触发器匹配，并将匹配的 Skill 内容注入到 Agent 的上下文中。

```
用户消息: "帮我优化教学目标"
                │
                ▼
CCAAS Skill 路由器:
  - 匹配触发器: "教学目标" → lesson-plan-designer Skill
                │
                ▼
AI Agent 接收到:
  - 系统提示: SKILL.md 的内容
  - 可用工具: write_output, read_context, attach_file
  - 用户消息: "帮我优化教学目标"
                │
                ▼
AI Agent 先调用 read_context() 获取当前表单状态，
然后调用 write_output(field="objectives", value="...")
```

## Skill 文件结构

备课方案设计器的 Skill 文件包含以下主要部分：

```markdown
# Skill 名称

## 角色定义
AI Agent 是谁，做什么。

## 理论框架
Agent 应用的领域知识和教学理论。

## 工作流程
Agent 遵循的分步流程。

## 输出格式
如何使用 write_output / attach_file 以及有哪些可用字段。

## 约束条件
明确的边界和强制步骤（如先调用 read_context）。
```

与通用 Skill 的关键区别在于**强制的上下文读取步骤**——备课 Skill 必须在响应之前调用 `read_context`，这样 Agent 才知道用户已在表单中填写了什么。

## 第 1 步：编写 Lesson Plan Designer Skill

创建 `skills/lesson-plan-designer/SKILL.md`：

这是主 Skill。它负责教案打磨、教学目标优化、评价设计以及多格式输出生成（讲稿、音频、PPT）。它基于崔允漷教授的课程与教学设计理论。

```markdown
# 教案优化专家 - 基于崔允漷理论

> **⚠️ 强制要求：在回复用户任何消息之前，你必须首先调用 `read_context` 工具，
> 了解用户当前正在编辑的备课方案。不要直接询问用户已经在表单中填写的信息。**

## 何时使用

当你需要：
- 优化一份已有的教案
- 检查教案是否符合课程标准要求
- 改进学习目标的表述
- 设计更有效的评价任务

## 理论框架

本 Skill 基于华东师范大学崔允漷教授的课程与教学设计理论。核心包括：

### 1. 逆向设计三阶段
- 阶段一：确定预期结果（大概念、核心素养）
- 阶段二：确定合适的评估证据（表现性任务）
- 阶段三：设计学习体验和教学

### 2. 学习目标的规范表述（ABCD法）
- A - Audience（行为主体）：学生
- B - Behavior（行为动词）：可观察的行为（分析、比较、创作…）
- C - Condition（行为条件）：在什么情境下
- D - Degree（达成程度）：到什么标准

### 3. 表现性评价任务设计（GRASPS框架）
- Goal, Role, Audience, Situation, Product, Standards

## 获取当前上下文（强制）

每次响应前调用 `read_context()`。返回结构：

{
  "pageType": "lesson-plan-editor",
  "pageData": {
    "currentForm": {
      "title": "...",
      "subject": "...",
      "gradeLevel": 3,
      "objectives": "...",
      "content": "...",
      "assessmentMethods": "...",
      ...
    }
  }
}

后续调用使用 `mode: "diff"` 以节省 tokens。

## 输出格式

使用 write_output 更新教案字段：
- field: "objectives" → 字符串（ABCD格式的学习目标）
- field: "content" → 字符串（教学过程 / 学习活动）
- field: "assessmentMethods" → 字符串（评价设计）
- field: "extraProperties" → 对象（额外键值数据）

## 多格式输出

| 指令 | 功能 |
|------|------|
| "优化教案" | 基于崔允漷理论优化 |
| "生成讲稿" | 生成教学讲稿 |
| "生成音频" | 生成讲稿 + 通过 NotebookLM 生成音频 |
| "生成PPT" | 通过 NotebookLM 生成 PDF 幻灯片 |
| "全套材料" | 完整流程：讲稿 + 音频 + 幻灯片 |
```

### 这个 Skill 中的关键设计决策

**1. 每次响应前强制调用 `read_context`。** Agent 必须知道用户已在表单中输入的内容。这防止 Agent 重复提问，并能提供有针对性的建议。

**2. 教学理论作为领域知识。** 不是通用助手，而是将特定理论框架（逆向设计、ABCD 目标）编码到 Skill 中。这使 Agent 成为领域专家而非通用聊天机器人。

**3. 多格式输出编排。** 主 Skill 可以通过 `Skill` 工具触发其他 Skill（讲稿生成器、NotebookLM），充当"全套材料"工作流的编排者。

**4. `read_context` 的 diff 模式。** 首次完整读取上下文后，后续调用使用 `mode: "diff"` 只返回变化的字段，减少 90-95% 的 token 使用。

## 第 2 步：编写 Teaching Script Generator Skill

创建 `skills/teaching-script-generator/SKILL.md`：

这个 Skill 将结构化教案转化为口语化的教学讲稿——教师在课堂上使用的授课指南。

```markdown
# 教学讲稿生成器

> **⚠️ 强制要求：在回复前，先读取 `.context/lesson-plan.json` 了解当前教案。
> 不要直接询问用户已经在表单中填写的信息。**

## 何时使用

当你需要：
- 将教案转化为教师授课讲稿
- 生成课堂对话建议
- 创建包含过渡语的完整教学指南

## 讲稿 vs. 教案

| 特征 | 教案 (Lesson Plan) | 讲稿 (Teaching Script) |
|------|-------------------|----------------------|
| 语言风格 | 书面语、程序化 | 口语化、对话式 |
| 受众 | 教研员、同行教师 | 授课教师本人 |
| 内容 | 目标、活动、评价 | 教师话术、过渡语 |

## 强制前置步骤

读取教案上下文：

Read(".context/lesson-plan.json")

必填字段：title, subject, gradeLevel, objectives, content
可选但建议：studentAnalysis, assessmentMethods

## 讲稿结构（9个章节）

1. 课程基本信息（学科、年级、课时）
2. 开场白（建议问候语和情境导入）
3. 教学目标讲解（目标的口语化表述）
4. 重难点分析（什么是难点、为什么、如何突破）
5. 教学过程讲解（逐环节教师对话脚本）
6. 评价与检测说明（观察要点、关键问题）
7. 课堂管理提示（时间控制、突发应对）
8. 课程总结（结束语）
9. 教学反思提示（课后自评问题）

## 双重输出

生成后，同时同步文本和文件：

1. write_output({ field: "extraProperties",
   value: { "讲稿": scriptContent },
   preview: "📝 教学讲稿 (2500字)" })

2. 保存文件：Write({ file_path: "教学讲稿.md", content: ... })

3. attach_file({ filePath: "教学讲稿.md",
   fileType: "script",
   description: "教学讲稿 - 包含9个章节的完整授课指南" })
```

### 关键设计决策

**1. 双重输出模式（文本 + 文件）。** 讲稿同时同步到 `extraProperties` 用于表单内直接查看，并通过 `attach_file` 保存为可下载的 `.md` 文件。用户既能在应用内查看，也能离线使用。

**2. 九章节模板。** 固定结构确保所有生成的讲稿一致性。每个章节对应特定教学需求（开场白、过渡语、提问策略、应急预案）。

**3. 上下文文件 vs. `read_context` 工具。** 这个 Skill 使用 `Read` 工具直接读取 `.context/lesson-plan.json`，而主 Skill 使用 `read_context` MCP 工具。两种方式都可行——平台会在表单状态变化时写入上下文文件。

## 第 3 步：编写 NotebookLM Skill

创建 `skills/notebooklm/SKILL.md`：

这个 Skill 集成 Google NotebookLM 来从教案内容生成音频播客和 PDF 幻灯片。通常作为链式 Skill 从主 Lesson Plan Designer Skill 调用。

```markdown
# NotebookLM Automation

自动化 Google NotebookLM：创建笔记本、添加源、
生成内容（播客、幻灯片）、下载结果。

## 何时激活

- 显式调用：用户说 "/notebooklm" 或 "使用 notebooklm"
- 意图检测："关于[主题]创建一个播客"，
  "从我的研究生成幻灯片"

## 核心工作流程

1. notebooklm create "标题"          → 创建笔记本
2. notebooklm source add <file>      → 添加教案作为源
3. notebooklm source wait <id>       → 等待处理
4. notebooklm generate audio "..."   → 生成播客
5. notebooklm artifact wait <id>     → 等待生成
6. notebooklm download audio ./out   → 下载结果

## 教案集成

关键：下载任何文件后，必须调用 attach_file：

attach_file({
  filePath: "教学讲解音频.mp3",
  fileType: "audio",
  description: "教学讲解音频 - 约8分钟中文讲解"
})

## 语言匹配

在所有 NotebookLM 指令中匹配用户语言：
- 中文用户 → "用中文讲解关键概念"
- 英文用户 → "Explain key concepts in English"
```

### 关键设计决策

**1. 长操作使用 Subagent 模式。** 音频生成需要 5-15 分钟。Skill 使用 `Task` 工具启动后台 subagent 等待和下载，保持主对话不被阻塞。

**2. 下载后强制调用 `attach_file`。** 每个下载的文件都必须通过 `attach_file` 附加到教案。这确保文件出现在教案的附件部分。

**3. 语言感知指令。** NotebookLM 使用指令的语言生成内容。Skill 检测用户语言并传递匹配的指令，确保正确的输出语言。

## 第 4 步：编写 Lesson Plan PPTX Skill

创建 `skills/lesson-plan-pptx/SKILL.md`：

这个 Skill 使用 NotebookLM 的 slide-deck 功能从教案生成 PDF 幻灯片。虽然名为"PPTX"，但实际产出 PDF 格式以确保通用兼容性。

```markdown
# Lesson Plan PPTX - 幻灯片生成器

统一幻灯片生成：无论用户说"生成PPT"、"创建课件"还是
"生成PDF"，本技能统一使用 NotebookLM 生成 PDF 格式的
专业教学幻灯片。

## 触发器（来自 SKILL.md frontmatter）

triggers:
  - type: keyword
    value: "生成PPT"
    priority: 100
  - type: keyword
    value: "生成幻灯片"
    priority: 95
  - type: keyword
    value: "创建课件"
    priority: 90
  - type: intent
    value: "将教案转化为幻灯片或演示文稿"
    priority: 80

## 工作流程

1. 从 `.context/lesson-plan.json` 读取教案
2. 验证必填字段（title, objectives, content）
3. 格式化为 Markdown 并保存临时文件
4. 创建 NotebookLM 笔记本，添加源
5. 使用本地化指令生成 slide-deck
6. 启动 subagent 等待、下载并调用 attach_file

## 输出

- 格式：PDF（不是 .pptx）
- 页数：10-15（由 NotebookLM 自动确定）
- 生成时间：5-15 分钟（后台执行）
- 完成后通过 attach_file 自动附加
```

## 第 5 步：在 solution.json 中注册 Skill

将所有 Skill 添加到 `solution.json`。以下是备课方案设计器的实际配置：

```json
{
  "skills": [
    { "slug": "lesson-plan-designer", "name": "lesson-plan-designer" },
    { "slug": "teaching-script-generator", "name": "teaching-script-generator" },
    { "slug": "lesson-plan-pptx", "name": "lesson-plan-pptx" },
    { "slug": "notebooklm", "name": "notebooklm" }
  ]
}
```

{% hint style="info" %}
**v3.0 schema 简化。** 在 v3.0 的 solution.json 格式中，Skill 只需注册 `slug` 和 `name`。触发器配置、`allowedTools` 和其他 Skill 设置在 SKILL.md 的 frontmatter 中定义，或通过管理后台配置。这使 `solution.json` 专注于声明 *有哪些* Skill，而 Skill 文件本身定义 *如何工作*。
{% endhint %}

### 触发器配置

在 v3.0 格式中，触发器在 SKILL.md 的 frontmatter 中配置，而不是在 `solution.json` 中。触发器系统使用以下主要属性：

| 字段 | 描述 |
|------|------|
| `type` | `keyword` 精确匹配词语；`intent` 使用语义匹配 |
| `value` | 要匹配的关键词或意图描述 |
| `priority` | 数字越大 = 当多个 Skill 匹配时优先级越高 |

**触发器如何工作：**

1. 用户发送："帮我优化教学目标"
2. CCAAS 将消息与所有 Skill 的 SKILL.md frontmatter 中定义的触发器进行扫描匹配
3. "教学目标" 匹配 Lesson Plan Designer Skill（优先级 8）
4. CCAAS 将 Lesson Plan Designer SKILL.md 注入 AI Agent 上下文

**当多个 Skill 匹配时：**

如果用户说"生成PPT"，Lesson Plan Designer（"生成PPT" 优先级 9）和 Lesson Plan PPTX Skill（"生成PPT" 优先级 100）都会匹配。CCAAS 选择优先级最高的触发器，因此 PPTX Skill 会处理这个请求。这展示了专门化的 Skill 如何通过优先级覆盖通用 Skill。

### 触发器类型

备课方案设计器使用两种触发器类型：

| 类型 | 工作方式 | 示例 |
|------|---------|------|
| `keyword` | 用户消息中的精确子串匹配 | `"生成PPT"` 匹配 "请帮我生成PPT" |
| `intent` | 语义相似度匹配 | `"将教案转化为幻灯片"` 匹配 "我想把教案做成课件" |

关键词触发器快速且确定性强。意图触发器更灵活但需要语义匹配，会增加延迟。

### Skill 间调用

在 v3.0 格式中，`solution.json` 中的 `chainedSkills` 部分已移除。现在 Skill 通过 `Skill` 工具互相调用：

```typescript
// 在 SKILL.md 指令中：
// "当用户请求全套材料时，使用 Skill 工具调用 NotebookLM Skill
// 来生成音频和幻灯片。"
```

这种方式更简单、更明确——编排逻辑存在于 Skill 指令中，而不是配置中。

## Skill、MCP 工具和前端如何关联

以下是使用备课方案设计器实际字段名的完整图景：

```
┌─────────────────────────────────────────────────────┐
│                    SKILL.md                         │
│                                                     │
│  "使用 write_output, field='objectives'"            │
│  "使用 attach_file 附加生成的音频/PDF"              │
│  "每次响应前调用 read_context"                      │
│                                                     │
│  告诉 AI Agent 做什么                                │
└──────────────────────┬──────────────────────────────┘
                       │ AI Agent 遵循
                       │ 这些指令
                       ▼
┌─────────────────────────────────────────────────────┐
│                  MCP Server                         │
│                                                     │
│  SYNC_FIELDS = [                                    │
│    'title', 'subject', 'gradeLevel',                │
│    'objectives', 'content',                         │
│    'assessmentMethods', 'extraProperties',          │
│    'attachments', ...                               │
│  ]                                                  │
│                                                     │
│  工具: write_output, attach_file,                   │
│        read_context, get_curriculum_standards       │
│                                                     │
│  验证并路由数据                                      │
└──────────────────────┬──────────────────────────────┘
                       │ CCAAS 包装成
                       │ output_update 事件
                       ▼
┌─────────────────────────────────────────────────────┐
│                   前端                               │
│                                                     │
│  switch (field) {                                   │
│    case 'objectives': setObjectives(value); break;  │
│    case 'content': setContent(value); break;        │
│    case 'attachments': addAttachment(value); break; │
│  }                                                  │
│                                                     │
│  在教案表单中渲染数据                                │
└─────────────────────────────────────────────────────┘
```

{% hint style="danger" %}
**字段名在三者之间必须完全相同。** 如果 Skill 说 `"title"`，MCP Server 必须验证 `"title"`，前端也必须处理 `"title"`。使用 `mcp-server/src/types.ts` 中的 `SYNC_FIELDS` 数组作为唯一数据源。
{% endhint %}

### 完整的 SYNC_FIELDS 列表

以下是 `mcp-server/src/types.ts` 中定义的实际同步字段：

```typescript
export const SYNC_FIELDS = [
  'title',              // 课题名称
  'subject',            // 学科（数学、语文等）
  'gradeLevel',         // 年级（1-12）
  'durationMinutes',    // 课时（分钟）
  'lessonPlanCode',     // 教案编号
  'objectives',         // 教学目标（ABCD格式）
  'content',            // 教学过程 / 学习活动
  'teachingMethods',    // 教学方法
  'materialsNeeded',    // 所需材料
  'assessmentMethods',  // 评价设计
  'curriculumRequirements', // 课程标准引用
  'studentAnalysis',    // 学情分析
  'extraProperties',    // 可扩展键值存储（如讲稿）
  'status',             // 教案状态
  'attachments',        // 文件附件（音频、PDF等）
] as const;
```

## 附件工作流

备课方案设计器的一个特色模式是生成内容的**双重输出**：

```
┌─────────────────────────────────────────────────────┐
│  AI 生成教学讲稿                                     │
│                                                     │
│  输出 1: write_output → extraProperties             │
│    - 文本同步到表单用于内联查看                       │
│    - 用户看到"同步到表单"按钮                        │
│                                                     │
│  输出 2: Write 文件 + attach_file → attachments      │
│    - 文件保存并附加用于下载                           │
│    - 用户看到"添加附件"按钮                          │
└─────────────────────────────────────────────────────┘
```

用户在聊天中看到两个同步按钮：
1. **同步到表单** —— 将讲稿文本写入 `extraProperties` 用于内联查看
2. **添加附件** —— 将 `.md` 文件添加到教案的附件列表

这种双重输出模式适用于所有生成的材料：教学讲稿、音频文件和 PDF 幻灯片。

## 将 Skill 注入 CCAAS

在 `solution.json` 中定义的 Skill 在运行 setup 脚本时会自动注入。你也可以手动注入：

```bash
#!/bin/bash
# inject-skills.sh

CCAAS_URL="http://localhost:3001"

# 注入 Lesson Plan Designer Skill
curl -X POST "$CCAAS_URL/api/v1/skills" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Lesson Plan Designer",
    "slug": "lesson-plan-designer",
    "description": "AI备课助手",
    "type": "prompt",
    "content": "'"$(cat skills/lesson-plan-designer/SKILL.md)"'",
    "triggers": [
      {"type": "keyword", "value": "备课", "priority": 10},
      {"type": "keyword", "value": "教学目标", "priority": 8},
      {"type": "keyword", "value": "全套材料", "priority": 10}
    ],
    "allowedTools": ["write_output", "Read", "Write", "Skill"]
  }'

# 注入 Teaching Script Generator Skill
curl -X POST "$CCAAS_URL/api/v1/skills" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Teaching Script Generator",
    "slug": "teaching-script-generator",
    "description": "根据教案生成教学讲稿",
    "type": "prompt",
    "content": "'"$(cat skills/teaching-script-generator/SKILL.md)"'",
    "triggers": [
      {"type": "keyword", "value": "生成讲稿", "priority": 100},
      {"type": "keyword", "value": "生成教学脚本", "priority": 100}
    ],
    "allowedTools": ["write_output", "Read", "Write", "attach_file"]
  }'

echo "Skills 注入成功"
```

## 测试 Skill

### 手动测试

测试 Skill 的最佳方式是使用聊天界面：

1. 启动 CCAAS 后端：`npm run dev:backend`
2. 启动 Solution 后端：`cd solutions/lesson-plan-designer/backend && npm run start:dev`
3. 打开前端，创建一个教案并填写基本字段
4. 发送匹配触发器的消息："帮我优化教学目标"
5. 验证：
   - 正确的 Skill 被激活（检查 agent 日志）
   - `read_context` 被先调用（Agent 没有询问已填写的字段）
   - `write_output` 被调用时使用了正确的字段名
   - 前端表单更新了生成的值

### 常见测试问题

| 症状 | 可能原因 |
|------|---------|
| 激活了错误的 Skill | 触发器优先级冲突；调整优先级数字 |
| Agent 询问表单中已有的信息 | `read_context` 未被调用；检查 SKILL.md 中的强制步骤 |
| write_output 返回错误 | Skill 和 MCP Server 之间字段名不匹配 |
| 表单没有更新 | 前端没有处理 output_update 中的字段名 |
| 附件按钮没有出现 | 文件生成后未调用 `attach_file` |
| 音频/PPT 永远不完成 | Subagent 模式未生效；检查 Task 工具调用 |

## 检查点

进入下一节之前，请验证：

- [ ] `skills/lesson-plan-designer/SKILL.md` 存在，包含强制 `read_context`、理论框架和输出格式部分
- [ ] `skills/teaching-script-generator/SKILL.md` 存在，使用双重输出模式（文本 + 文件）
- [ ] `skills/notebooklm/SKILL.md` 存在，包含语言匹配和 `attach_file` 集成
- [ ] 所有 Skill 都在 `solution.json` 中注册了合适的触发器
- [ ] Skill 输出格式中的字段名与 MCP Server 的 `SYNC_FIELDS` 匹配
- [ ] `allowedTools` 包含内容 Skill 需要的 `write_output` 和文件生成 Skill 需要的 `attach_file`
- [ ] 需要调用其他 Skill 的 Skill 在其 SKILL.md 指令中引用了目标 Skill

## 练习：添加课程标准查找 Skill

创建一个新 Skill 帮助教师查找相关课程标准。当用户说"查找课程标准"或"课标对齐"时，这个 Skill 应该：

1. 调用 `read_context` 获取当前学科和年级
2. 调用 `get_curriculum_standards` MCP 工具，传入学科和相关关键词
3. 向用户展示匹配的标准
4. 可选地调用 `write_output`，`field: "curriculumRequirements"`，将选中的标准同步到表单

<details>
<summary>提示</summary>

- 使用触发器如 `"课程标准"`、`"课标"`、`"标准对齐"`
- `get_curriculum_standards` 工具接受 `subject` 和 `keyword` 参数
- 解析用户的教学目标以提取搜索关键词
- 允许用户选择要应用的标准，然后再同步

</details>

## 本节小结

在本节中你学到了：

- **Skill 结构**：角色定义、理论框架、工作流程、输出格式和约束条件
- **上下文感知 Skill**：使用 `read_context` 避免重复提问并提供有针对性的建议
- **双重输出模式**：文本同步到 `extraProperties` 用于内联查看，文件通过 `attach_file` 用于下载
- **触发器类型**：`keyword` 用于精确匹配，`intent` 用于语义匹配，基于优先级路由
- **Skill 间调用**：Skill 通过 `Skill` 工具调用其他 Skill（如 Lesson Plan Designer 编排 NotebookLM 实现"全套材料"）
- **三方契约**：Skill 告诉 AI 做什么，MCP Server 用 `SYNC_FIELDS` 验证，前端渲染——三者必须使用相同的字段名
- **Subagent 模式**：长时间操作（音频、PDF 生成）使用后台 subagent 保持对话不被阻塞

有了 MCP Server 和 Skill，AI Agent 现在可以生成结构化的教案数据、教学讲稿、音频和幻灯片——并将所有内容同步到前端。在下一节中，我们将构建接收这些更新并渲染它们的**前端**。

---

**下一节：** [6.5 前端实现](05-frontend.md)
**上一节：** [6.3 MCP Server](03-mcp-server.md)
