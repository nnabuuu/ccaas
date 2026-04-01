# CLAUDE.md — Edu Platform Solution

## Overview

精准教学平台 Solution，包含 3 个 Skill（备课助手、出题专家、学情分析）和 7 个 MCP 工具，为中小学教师提供一体化教学辅助。

## Quick Links

- [README.md](./README.md) — 概述和启动说明
- [SOLUTION_DESIGN.md](./SOLUTION_DESIGN.md) — 设计决策和交互模式
- [mcp-server/README.md](./mcp-server/README.md) — 工具参考和 schema
- [solution.json](./solution.json) — Solution 配置

## Critical Rules

### CCAAS MCP 工具约定

- `show_info_card`：展示结构化数据（outline/bar_list/metrics/actions/text）
- `suggest_actions`：后续操作按钮，支持 `skill_hint` 跨 Skill 引导
- `write_output`：同步内容到前端面板
- `generate_docx`：生成 .docx 文件
- **禁止使用虚构 widget**：`FormCollect`、`TreeSelector`、`MetricDashboard`、`BarList` 不是平台工具

### show_info_card Section Types

只允许使用以下 5 种 section type（与 `mcp-server/src/index.ts` 的 enum 一致）：

| Type | 用途 |
|------|------|
| `outline` | 大纲树（items + selected_id） |
| `bar_list` | 进度条列表（items + color_thresholds） |
| `metrics` | 指标面板（items: label/value/suffix） |
| `actions` | 操作按钮（actions: label/prompt/primary） |
| `text` | 纯文本段落（content） |

### Skill 修改规则

1. **session context 优先**：从 sessionContext 获取 classId、grade、subject，不要让教师填表
2. **工具调用序列**：获取数据 → show_info_card 展示 → suggest_actions 后续操作
3. **lesson-plan-generator 是标杆**：其他 Skill 应遵循相同的交互模式
4. **JSON 示例必须可解析**：SKILL.md 中的 JSON 代码块必须是合法 JSON
5. **中文输出**：所有 SKILL.md 指令和示例用中文

### solution.json 配置规则

- `skills[].slug` 必须与 `skills/` 目录名完全匹配
- `mcpServers.edu-tools.args` 指向编译后的 `mcp-server/dist/index.js`
- `sessionTemplates.lesson-planning.enabledSkills` 必须包含全部 3 个 Skill

## Common Tasks

### 添加新的 MCP 工具

1. 在 `mcp-server/src/index.ts` 中定义 `Tool` 对象
2. 在 `CallToolRequestSchema` handler 中添加分支
3. 在 `ListToolsRequestSchema` handler 的 tools 数组中注册
4. 在相关 SKILL.md 的工具使用表中添加条目
5. 运行 `cd mcp-server && npx tsc --noEmit` 验证编译

### 添加新的 show_info_card Section Type

1. 在 `index.ts` 的 showInfoCardTool enum 中添加新类型
2. 在前端 InfoCard 组件中添加渲染逻辑
3. 在 SKILL.md 中添加使用示例
4. 更新 `mcp-server/README.md` 的 section types 文档

### 修改 Skill Prompt

1. 编辑 `skills/<slug>/SKILL.md`
2. 确保所有工具引用与 `index.ts` 定义一致
3. 确保 JSON 示例可解析（无尾逗号、正确引号）
4. 检查 show_info_card section type 拼写正确

### 验证配置完整性

```bash
# 验证 solution.json 可解析
node -e "JSON.parse(require('fs').readFileSync('solution.json','utf8'))"

# 验证 MCP Server 编译
cd mcp-server && npx tsc --noEmit

# 验证无虚构 widget 残留
grep -rn 'FormCollect\|TreeSelector\|MetricDashboard\|BarList' skills/*/SKILL.md
```
