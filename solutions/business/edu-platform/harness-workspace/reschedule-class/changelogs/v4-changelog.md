# v4 Changelog

## 目标

基于 v3 eval report 的分析：D1-D5 = 75/75（满分），D6 = 0/25（API quota exceeded 导致 E2E 无法运行）。本轮目标是**优化 E2E 就绪度**，确保当 API 额度恢复后 D6 能尽可能高分通过。同时采纳评估者建议使用 outline 和 bar_list section type。

## 修改清单

### SKILL.md

- **新增 bar_list section type 示例**（示例4：代课候选教师卡片）：添加 `bar_list` section 用于可视化候选教师匹配度分数，使卡片信息密度更高。采纳 v3 评估者建议。

- **新增 outline section type 示例**（示例5：课表概览卡片）：添加 `outline` section 用于树状展示课表结构。采纳 v3 评估者建议。现在 5 种允许的 section type 中有 4 种有示例（metrics/text/actions/bar_list/outline）。

- **新增"周次解析规则"**：明确 week 参数如何从教师描述中提取（"本周"→1、"下周"→2、"第N周"→N、"考试周"→50）。帮助 AI 在 E2E S5（无可用时段）场景中正确传入 week>=50 触发降级流程。

- **新增"多节次请求处理"**：当教师说"第5-6节请假"但课表中并非所有节次都有课时，明确指导 AI 只处理有课的节次。

- **强化代课流程参数推导**：步骤3-4 添加显式字段路径引用（如 `data.schedule` 数组中筛选 `day===3 && period===5` 的条目，提取 `classId` 字段），确保 AI 从正确的数据源获取参数，降低 E2E 参数错误风险。

- **强化互换流程参数推导**：步骤2-3 添加显式字段路径引用，步骤5 添加"立即检查 `data.severity`"提示。

### solution.json

- **强化 appendSystemPrompt**：
  - 新增"查询"意图类型（"批了吗/申请状态/查看申请"→查申请列表）
  - 新增"周次解析"规则（与 SKILL.md 一致）
  - 工具调用流程中添加关键字段检查提示（data.totalEntries/data.totalSlots/data.severity）
  - 强化强制规则为7条，新增"响应即检"、"hint优先"、"classId必传"规则
  - sections 列表从 metrics/text/actions 扩展到 metrics/text/bar_list/outline/actions

### mcp-server/src/index.ts

- 无修改（D2 = 20/20 满分，避免引入回归）

## 自检结果

- tsc: **PASS** (0 errors)
- solution.json: **VALID**
- 禁止 widget: **0** matches
- 工具名一致性: **全部匹配**（6 个工具名各 2 处匹配）
- JSON 可解析: **9/9 blocks** 全部通过 JSON.parse

## 本轮跳过

- D1-D5: 已满分（75/75），无需修改，仅做 E2E 就绪优化
- MCP server: 不做改动，避免 D2/D5 回归风险
