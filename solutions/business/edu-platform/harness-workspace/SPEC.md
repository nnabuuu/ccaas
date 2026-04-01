# Spec: Edu-Platform Skill Definitions + MCP + Documentation

## Context

edu-platform 是一个精准教学平台 Solution，包含 3 个 Skill、7 个 MCP 工具、React 前端和 NestJS 后端。当前存在两个核心问题：

1. **Skill 交互模式错误**：`quiz-generator` 和 `student-analysis` 的 SKILL.md 使用了不存在的 widget（`FormCollect`、`TreeSelector`、`MetricDashboard`、`BarList`），而非 CCAAS 平台真实的 MCP 工具（`show_info_card`、`suggest_actions`）。只有 `lesson-plan-generator` 正确使用了 MCP 工具模式。
2. **文档缺失**：Solution 根目录无 README.md、SOLUTION_DESIGN.md、CLAUDE.md，mcp-server 目录无 README.md。quiz-analyzer solution 作为参考标准已具备全部文档。

## Artifacts

### 需要修改的文件（REWRITE）
| File | Problem |
|------|---------|
| `skills/quiz-generator/SKILL.md` | 使用 FormCollect + TreeSelector — 不存在的 widget |
| `skills/student-analysis/SKILL.md` | 使用 MetricDashboard + BarList — 不存在的 widget |

### 需要验证的文件（VERIFY/POLISH）
| File | Status |
|------|--------|
| `skills/lesson-plan-generator/SKILL.md` | 已正确使用 show_info_card，仅需微调 |
| `mcp-server/src/index.ts` | 如果 show_info_card 需要新 section types 则扩展 |
| `solution.json` | 验证 skills、mcpServers、sessionTemplates 一致性 |

### 需要创建的文件（CREATE）
| File | Purpose |
|------|---------|
| `README.md` | Solution 概述、启动说明、架构 |
| `SOLUTION_DESIGN.md` | 设计决策、Skill 交互模式、MCP 工具目录 |
| `CLAUDE.md` | 开发者指南、关键规则、常见任务 |
| `mcp-server/README.md` | 工具参考、输入输出 schema、集成说明 |

## Target Audience

- **教师**：备课、出题、学情分析的直接使用者
- **开发者**：理解 Solution 架构、扩展 Skill/工具的参考

## Goal

让 edu-platform 在 7 维度评估中稳定达到 **85+** 分（满分 100）：
- 3 个 SKILL.md 全部使用正确的 CCAAS MCP 工具模式
- 4 个文档文件完整且有意义
- MCP server TypeScript 编译通过
- solution.json 配置正确

## 7 MCP Tools（edu-platform）

| # | Tool | Purpose |
|---|------|---------|
| 1 | `curriculum_tree` | 查询课标知识点树 |
| 2 | `student_proficiency` | 查询班级学情数据 |
| 3 | `teaching_progress` | 查询教学进度 |
| 4 | `generate_docx` | 生成 .docx 教案文件 |
| 5 | `write_output` | 同步内容到前端面板 |
| 6 | `show_info_card` | 展示结构化信息卡片（outline/bar_list/metrics/actions/text） |
| 7 | `suggest_actions` | 后续操作按钮 |

### show_info_card Section Types

```
outline    — 大纲树（含 selected_id）
bar_list   — 进度条列表（含 color_thresholds）
metrics    — 指标面板（多个 label/value/suffix）
actions    — 操作按钮（label/prompt/primary）
text       — 纯文本段落
```

## Frozen Constraints

1. **不修改前端代码**：React 组件、hooks 不在范围
2. **不修改后端代码**：NestJS controllers、services 不在范围
3. **保持 MCP 工具接口不变**：tool name 和 inputSchema 不变（section types 可扩展）
4. **中文输出**：所有 SKILL.md 指令和示例用中文
5. **每轮修改幅度**：不超过文件总行数的 50%（首轮可稍大，因为是 rewrite）
6. **lesson-plan-generator 是参考标杆**：其他 2 个 skill 应遵循相同模式
7. **quiz-analyzer 文档是模板**：文档风格和结构参考 quiz-analyzer solution

## Reference HTMLs

`reference/` 目录包含 3 个 HTML 原型，定义了理想的交互模式：
- `chat-interface.html` — 教师对话界面（show_info_card + suggest_actions 的实际渲染效果）
- `lesson-plan-wizard.html` — 备课向导（4 步交互流程）
- `skill-management-panel.html` — Skill 管理面板

## Correct Interaction Patterns（参考 lesson-plan-generator）

### Pattern 1: 结构化数据展示
```
调用 MCP 工具获取数据 → show_info_card(sections: [outline, bar_list, actions]) → suggest_actions
```

### Pattern 2: 参数收集（替代 FormCollect）
```
show_info_card(sections: [text(说明), actions(选项按钮)]) → 用户点击 → 继续流程
```

### Pattern 3: 数据可视化（替代 MetricDashboard/BarList）
```
show_info_card(sections: [metrics(指标), bar_list(掌握率)]) → suggest_actions(后续操作)
```
