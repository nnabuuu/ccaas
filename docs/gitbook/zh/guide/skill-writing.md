# Skill 编写指南

## 什么是 Skill

Skill 是 LoopAI 中定义 AI Agent 行为的核心抽象。每个 Skill 指定了 AI Agent 的角色、知识范围、可用工具和输出格式。

## 使用时机

Skill 定义了 agent 做什么以及如何行为。每个 CCAAS solution 至少需要一个 Skill。

问题不在于是否要写 Skill，而在于**选哪种 Skill 类型**：

- `type: prompt` 覆盖 90% 的场景。给 agent 一个角色、知识和工具权限，让它自己决定步骤。
- `type: workflow` 适用于需要强制顺序执行的情况——步骤 1 必须完成才能执行步骤 2，步骤之间可能有用户确认或条件分支。
- `type: sub-agent` 适用于某个子任务因成本或速度原因需要不同模型，主 agent 通过 Task tool 派发给它。

不确定用哪种就从 `prompt` 开始。只有当"让 agent 自己决定顺序"不够用时，再考虑 `workflow`。

## Skill 文件格式

Skill 以 Markdown 文件（`SKILL.md`）编写，包含 YAML frontmatter 和正文内容：

```markdown
---
name: "教案设计助手"
slug: "lesson-plan-designer"
description: "帮助教师设计符合课程标准的教案"
type: prompt
version: "1.0.0"
---

# 角色定义

你是一位经验丰富的教学设计专家...

# 知识范围

## 课程标准
...

## 教学理论
...

# 工作流程

1. 了解教学需求
2. 搜索课程标准
3. 设计教学目标
4. 规划教学活动
5. 生成完整教案

# 输出格式

使用 write_output 工具输出结构化教案数据...
```

## Skill 类型

### `type: prompt` — 默认（90% 的场景）

定义 agent 的系统提示词。Agent 自己决定如何使用工具以及执行顺序。

```yaml
---
type: prompt
---
```

**选择这个当：** 你想要一个结果导向的 agent。你关心的是完成什么，而不是步骤的精确顺序。大多数教案设计器、测验分析器和内容生成器都属于这里。

### `type: workflow` — 强制顺序执行

定义多步骤工作流，步骤按固定顺序执行。

```yaml
---
type: workflow
---
```

**选择这个当：**
- 步骤 1 必须完成才能开始步骤 2（例如：收集需求 → 用户确认 → 生成内容）
- 步骤之间有基于中间结果的条件分支
- 某步骤失败需要回退之前的操作

不要仅仅因为 agent 有多个步骤就使用 `workflow`——`prompt` 类型的 agent 完全可以自己处理多步骤任务。

### `type: sub-agent` — 带专用模型的专项子任务

由父 agent 通过 Task tool 调用的子 agent，有自己的模型配置。

```yaml
---
type: sub-agent
model: claude-3-5-sonnet
---
```

**选择这个当：** 某个特定子任务（如快速分类、图像分析）因速度或成本原因需要不同的模型。主 agent 派发给子 agent 并等待结果。

## 编写指南

### 1. 角色定义

开篇明确 AI Agent 的身份和核心能力：

```markdown
# 角色定义

你是一位专业的教案设计助手，具备以下能力：
- 深入理解各学科课程标准
- 掌握多种教学理论和教学设计方法
- 能够设计适合不同年级和学科的教案
```

### 2. 知识结构

提供 AI Agent 需要的领域知识：

```markdown
# 知识范围

## 教学设计理论
- Bloom 认知分类学（记忆→理解→应用→分析→评价→创造）
- ADDIE 模型（分析→设计→开发→实施→评估）
- UbD 逆向设计框架

## 学科知识
通过 MCP 工具查询：
- search_curriculum_standards: 查询课程标准
- search_textbook: 搜索教材内容
```

### 3. 工作流程

定义清晰的执行步骤：

```markdown
# 工作流程

## 步骤 1：需求分析
- 确认学科、年级、课题
- 了解教学时长和学生水平

## 步骤 2：标准对齐
- 使用 search_curriculum_standards 工具查询
- 确定教学目标与课标的对应关系

## 步骤 3：教案设计
- 设计教学目标（基于 Bloom 分类学）
- 规划教学活动和时间分配
- 设计评估方式

## 步骤 4：输出教案
- 使用 write_output 工具输出结构化数据
```

### 4. 输出格式

明确指定使用 write\_output 的格式：

```markdown
# 输出格式

使用 write_output 工具输出教案，格式如下：

{
  "title": "课题名称",
  "subject": "学科",
  "gradeLevel": "年级",
  "duration": 45,
  "objectives": ["教学目标1", "教学目标2"],
  "activities": [
    {
      "title": "活动名称",
      "duration": 10,
      "type": "introduction",
      "description": "活动描述"
    }
  ]
}
```

## 触发器配置

在 `solution.json` 中配置触发器：

```json
{
  "triggers": [
    {
      "type": "keyword",
      "value": "教案",
      "priority": 1
    },
    {
      "type": "pattern",
      "value": "请(帮我)?设计.*教案",
      "priority": 2
    },
    {
      "type": "intent",
      "value": "create_lesson_plan",
      "priority": 3
    }
  ]
}
```

**优先级规则**：数字越小优先级越高。当多个 Skill 的触发器同时匹配时，选择优先级最高的。

## 工具权限

在 `allowedTools` 中列出 Skill 可使用的工具：

```json
{
  "allowedTools": [
    "write_output",
    "search_curriculum_standards",
    "search_textbook",
    "search_teaching_resources"
  ]
}
```

{% hint style="warning" %}
只授权 Skill 实际需要的工具，遵循最小权限原则。
{% endhint %}

## 最佳实践

1. **角色清晰** —— 开篇就明确 AI 的身份和边界
2. **步骤明确** —— 工作流程步骤清晰，避免歧义
3. **输出规范** —— 使用 write\_output 时明确每个字段的含义和格式
4. **知识边界** —— 明确哪些知识内置在 Skill 中，哪些需要通过工具查询
5. **语言一致** —— 如果目标用户使用中文，Skill 指令也应使用中文
6. **测试验证** —— 编写 Skill 后实际运行测试，验证输出格式和行为
