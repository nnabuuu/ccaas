# Skill 编写指南

## 什么是 Skill

Skill 是 LoopAI 中定义 AI Agent 行为的核心抽象。每个 Skill 指定了 AI Agent 的角色、知识范围、可用工具和输出格式。

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

### Prompt 类型（最常用）

直接定义 AI Agent 的系统提示词：

```yaml
---
type: prompt
---
```

适用场景：大多数 Skill。指令清晰，工具权限明确。

### Workflow 类型

定义多步骤工作流：

```yaml
---
type: workflow
---
```

适用场景：需要严格按步骤执行的复杂流程。

### Sub-agent 类型

可配置独立模型参数的子 Agent：

```yaml
---
type: sub-agent
model: claude-3-5-sonnet
---
```

适用场景：需要专门模型处理的专业子任务。

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
