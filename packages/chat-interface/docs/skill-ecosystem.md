# Skill 生态

## 生命周期

```
创建(draft) → 测试(testing) → 审核(in_review) → 发布(published) → [下架/归档]
                                    ↑ 退回(rejected)
```

## Fork 机制

Fork 不是复制, 是带 upstream 引用的继承:
- 校级 Fork 保留对区级模板的版本引用
- 区级更新时, 校级收到合并通知
- 校级 overrides 不被上游覆盖

## 参数化定制

Skill 通过 YAML frontmatter 的 params 字段声明可配置参数:

```yaml
params:
  - key: default_difficulty_curve
    label: 默认难度曲线
    type: json
    defaultValue: {easy: 0.3, medium: 0.5, hard: 0.2}
    editableBy: school  # district | school | teacher
    group: 试卷结构
```

## SKILL.md 中的 Widget 声明

```yaml
---
name: lesson-plan-generator
version: 2.1.0
category: lesson_planning
subjects: [math, chinese, english, physics]
stages: [junior]

# Widget catalog 扩展 — 声明本 Skill 需要的组件
widgets:
  - type: StepWizard    # 来自 Jijian 教育 catalog
  - type: TreeSelector
  - type: BarList
  - type: Summary

# MCP 依赖
mcp_tools:
  - name: curriculum_tree
    required: true
    purpose: 课标知识点树查询
  - name: learning_analytics
    required: true
    purpose: 班级学情数据
  - name: textbook_mapping
    required: false
    purpose: 校本教材映射

# 可定制参数
params:
  - key: lesson_template
    label: 教案模板
    type: enum
    options: [{value: district_standard, label: 区级标准}, {value: school_custom, label: 学校自定义}]
    defaultValue: district_standard
    editableBy: school
    group: 输出格式
---

# Prompt 部分

你是一个备课助手。当教师请求备课时:

1. 输出一个 StepWizard 组件收集参数 (学科/年级/班级/课型 → 章节选择 → 学情分析 → 确认)
2. 收到 submitToEngine 的结构化参数后, 生成教案

## 教案输出格式
...
```

## 管理面板

同一面板, 不同角色看不同视图:
- 区级: 全部 Skill / 待审核 / 使用分析
- 学校: 已启用 / 区级市场 / 校级定制 / 待审核
- 教师: 我的 Skill / 市场 / 我的创作

## 使用分析

每个 Skill 的分析仪表盘包含:
- 调用量趋势 (30 天)
- 月活教师数
- 学校覆盖率 + 教师采纳率分布
- 教师反馈 (近期高信息量评价)

## 权限矩阵

| 操作 | 区教育局 | 学校管理员 | 教师 |
|------|---------|-----------|------|
| 创建区级模板 | ✅ | - | - |
| 审核区级发布 | ✅ | - | - |
| Fork 区级 Skill | - | ✅ | - |
| 修改校级参数 | - | ✅ | - |
| 启用/停用 | - | ✅ | - |
| 审核教师提交 | - | ✅ | - |
| 使用已启用 Skill | - | - | ✅ |
| 创建个人 Skill | - | - | ✅ |
| 评分反馈 | - | ✅ | ✅ |
| 查看使用分析 | ✅ | ✅(本校) | - |
