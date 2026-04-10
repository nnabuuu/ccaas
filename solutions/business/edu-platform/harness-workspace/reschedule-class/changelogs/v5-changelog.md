# v5 Changelog

## 目标

基于 v4 eval report：D1-D5 全部满分（75/75），D6 = 0/25 因基础设施问题（CCAAS 未加载 SKILL.md，AI 使用 Claude Code 工具而非 MCP timetable 工具）。

本轮目标：通过 `appendSystemPrompt` 注入调课工作流指引作为 fallback，使 AI 即使在 SKILL.md 未被加载时也能正确使用 timetable MCP 工具。

## 根因分析

D6 失败的两个层面：
1. **skill-sync 机制**：CCAAS agent engine 未将 `reschedule-class/SKILL.md` 加载为 AI 系统提示（基础设施层面，后端冻结无法修改）
2. **AI 行为**：AI 不知道 timetable MCP 工具的存在，因此用 Bash/Grep/Read 探索代码库

**可行的修复路径**：`appendSystemPrompt` 是 session template 级别的配置，始终会注入到 AI 系统提示中。在其中添加调课工作流指引，可作为 SKILL.md 未加载时的 fallback。

## 修改清单

### 1. solution.json — appendSystemPrompt 扩展

- 新增 `## 调课技能 (reschedule-class)` 章节
- 包含：4 种调课类型触发关键词、6 步工具调用流程、强制规则（确认门控/硬冲突阻止/降级建议/sessionContext 获取）
- 明确指示 **禁止使用代码探索类工具** 处理调课请求
- 这确保即使 SKILL.md 未加载，AI 也知道：
  - 何时触发调课流程
  - 使用哪些 timetable MCP 工具
  - 工具调用顺序
  - 确认门控规则

### 2. mcp-server/src/index.ts — timetable 工具描述增强

6 个工具的 description 字段增加工作流上下文：
- `timetable_query_schedule`: 添加 "调课流程第一步：先查课表确认受影响的课时信息"
- `timetable_find_available_slots`: 添加 "用于改时/补课场景" + "totalSlots=0 时需提供降级建议"
- `timetable_check_conflicts`: 添加 "severity=hard 时必须阻止提交并提供替代方案，绝对禁止调用 timetable_submit_request"
- `timetable_submit_request`: 强化为 "⚠️ 必须在用 show_info_card 展示变更摘要并用 suggest_actions 让教师选择确认提交之后才能调用。禁止未经确认直接调用"
- `timetable_list_my_requests`: 添加触发关键词 + "用 show_info_card 展示结果"
- `timetable_find_substitute_teachers`: 添加 "用于代课场景" + "用 show_info_card 展示候选列表"

### 3. SKILL.md — 无变更

D1-D5 已满分，SKILL.md 内容无需修改。

## 自检结果

- tsc: PASS (0 errors)
- solution.json: VALID
- 禁止 widget: 0 matches
- 工具名一致性: 全部匹配（6/6 工具各 2 次匹配）

## 本轮跳过

- D1-D5: 无需修改（已满分 75/75）
- SKILL.md: 无变更（内容完整且正确）

## 预期影响

- D1-D5: 保持 75/75（仅修改 description 字符串和 appendSystemPrompt，不影响评分）
- D6: 期望从 0/25 提升。`appendSystemPrompt` 注入使 AI 能识别调课请求并正确调用 timetable 工具，而非使用代码探索工具。但 D6 最终得分仍取决于 CCAAS 是否正确启动 MCP server 并提供 timetable 工具。
