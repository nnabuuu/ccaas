# v3 Evaluation Report

## Pre-gate
- tsc --noEmit: **PASS** (0 errors)

## 总分: 75/100

| # | Dimension | Rating | Score | Notes |
|---|-----------|--------|-------|-------|
| D1 | 工具决策树清晰度 | 5/5 | 20/20 | 完整的意图解析树、歧义处理、工具表、调用链、Context 感知 |
| D2 | 动态 Mock 正确性 | 5/5 | 20/20 | 共享数据模型、所有 6 工具动态推算、matchScore 有公式 |
| D3 | 确认流程严密性 | 5/5 | 15/15 | 硬性门控语句、变更摘要卡片、确认按钮、批量逐项、取消/修改路径 |
| D4 | 输出格式合规性 | 5/5 | 10/10 | 8 个 JSON 块全部可解析、section type 合规、无禁止 widget |
| D5 | 集成正确性 | 5/5 | 10/10 | solution.json 合法、skill 注册、template 更新、工具名一致、tsc 通过 |
| D6 | E2E 教师体验 | 0/6 | 0/25 | ⚠️ API quota exceeded (200k/200k monthly tokens) — 无法执行 |

## D1 Details: 工具决策树清晰度 (20/20)

| Sub-item | Score | Evidence |
|----------|-------|----------|
| 1. 意图解析树完整 | 1/1 | SKILL.md L22-41: 完整决策树覆盖 4 种类型 (swap/substitute/reschedule/makeup) + 模糊描述 + 查询类，每种有明确触发关键词 |
| 2. 歧义处理 | 1/1 | SKILL.md L31-35 + L175-207: 模糊描述独立分支，5 步强制流程（查课表→逐课分析→展示组合方案→确认→逐项提交） |
| 3. 工具使用表完整 | 1/1 | SKILL.md L547-558: 8 个工具全部列出（6 timetable + show_info_card + suggest_actions），含用途和调用时机 |
| 4. 调用序列明确 | 1/1 | 4 种类型各有编号的 step-by-step 调用链：swap(L49-82)、substitute(L88-123)、reschedule(L126-137)、makeup(L149-173) |
| 5. Context 感知 | 1/1 | SKILL.md L12-17: 明确从 sessionContext 获取 teacherId/teacherName/subject/classIds；L213-216 强调 teacherId 必须从 sessionContext 获取 |

## D2 Details: 动态 Mock 正确性 (20/20)

| Sub-item | Score | Evidence |
|----------|-------|----------|
| 1. 共享数据模型 | 1/1 | index.ts L264-347: `TEACHERS` (7 教师) + `SCHEDULE` (~70 条课表记录，7 教师 × 5 天 × 变化节次) + `ROOM_EVENTS` + `SUBMITTED_REQUESTS` |
| 2. query_schedule 正确查询 | 1/1 | index.ts L906-946: 从 SCHEDULE 用 `.filter()` 按 teacherId/classId 动态过滤，按 day/period 排序，返回 totalEntries |
| 3. find_available_slots 动态推算 | 1/1 | index.ts L949-1059: 遍历 day×period 组合，用 `SCHEDULE.some()` 排除教师/班级已占用时段，检查 ROOM_EVENTS，计算同科目 soft 冲突，查找空闲教室 |
| 4. check_conflicts 交叉验证 | 1/1 | index.ts L1062-1186: vacatedKeys 机制支持互换配对检测；检查 teacher_busy(hard) + class_busy(hard) + room_event(hard) + subject_overload(soft)；正确计算 overall severity |
| 5. find_substitute_teachers 计算排序 | 1/1 | index.ts L1349-1414: matchScore = subjectMatch(40) + taughtThisClass(30) + availability(20) + historyBonus(max10)；historyCount 从 SUBMITTED_REQUESTS 动态统计；按 matchScore 降序排序 |

**亮点**: vacatedKeys 互换感知逻辑（L1079-1084）是一个细致的实现，正确处理了 swap 场景中两条变更互相腾出时段的情况。

## D3 Details: 确认流程严密性 (15/15)

| Sub-item | Score | Evidence |
|----------|-------|----------|
| 1. 变更摘要卡片 | 1/1 | 每种类型流程中都有 `show_info_card` 步骤展示变更详情；6 个 JSON 示例覆盖方案推荐(L411)、确认摘要(L440)、申请状态(L462)、代课候选(L492)、无可用时段(L256)、硬冲突(L306) |
| 2. 显式确认按钮 | 1/1 | `suggest_actions` 提供 [确认提交] [修改方案] [取消]（L521-545）；每种流程都有 suggest_actions 步骤 |
| 3. 硬性门控 | 1/1 | L342: "⚠️ 在用户选择确认之前，禁止调用 timetable_submit_request"；L293: "⚠️ 绝对禁止调用 timetable_submit_request"（硬冲突时）；L357: 提交前必须确认 severity !== "hard" |
| 4. 批量逐项确认 | 1/1 | L356: "批量调课逐项确认：如果涉及多节课的变更，在摘要中逐条列出每节课的变更详情"；L195-196: 模糊描述逐项 check + submit |
| 5. 取消/修改路径 | 1/1 | L360-405: 完整的"用户反馈处理"三级分支 — 修改方案(按类型回退)、取消(确认+后续选项)、更改需求(重新开始) |

**亮点**: 双重安全网设计 — SKILL.md 层面禁止 + MCP 服务端 `timetable_submit_request` handler (L1196-1244) 也有硬冲突校验拒绝。

## D4 Details: 输出格式合规性 (10/10)

| Sub-item | Score | Evidence |
|----------|-------|----------|
| 1. JSON 可解析 | 1/1 | 8 个 `json` 代码块全部通过 JSON.parse 验证 |
| 2. Section type 合规 | 1/1 | 仅使用 `"metrics"`, `"text"`, `"actions"` — 全部在允许列表 (outline/bar_list/metrics/actions/text) 内 |
| 3. 无禁止 widget | 1/1 | grep FormCollect/TreeSelector/MetricDashboard/BarList = 0 |
| 4. show_info_card 示例 ≥ 3 | 1/1 | 6 个不同场景的完整 JSON 示例：方案推荐、确认摘要、申请状态、代课候选、无可用时段、硬冲突 |
| 5. suggest_actions 使用正确 | 1/1 | 包含 label + prompt + 可选 skill_hint (L521-545, L383-398) |

## D5 Details: 集成正确性 (10/10)

| Sub-item | Score | Evidence |
|----------|-------|----------|
| 1. solution.json 可解析 | 1/1 | `node -e "JSON.parse(...)"` → VALID |
| 2. Skill slug 注册 | 1/1 | `skills` 数组含 `{ "slug": "reschedule-class" }` |
| 3. Session template 更新 | 1/1 | `lesson-planning.enabledSkills` 含 `"reschedule-class"` |
| 4. 工具名一致性 | 1/1 | SKILL.md 中 6 个 timetable 工具名全部在 mcp-server 中有定义（每个 grep 结果 ≥ 2） |
| 5. tsc 通过 | 1/1 | `npx tsc --noEmit` → 0 errors |

**额外观察**: `show_step_wizard` 工具已定义(L166-183)且有 handler(L1439-1447)，但未注册到 ListToolsRequestSchema(L551-556)。这可能是预先存在的问题，非本次变更引入。

**solution.json 的 appendSystemPrompt**: 质量很高 — 包含了调课技能的完整摘要，工具调用流程、强制规则、类型列表，有效地将关键信息注入 session 级别的 system prompt，降低了 AI 遗漏 SKILL.md 规则的风险。

## D6 Details: E2E 教师体验 (0/25)

**D1-D5 = 75/75 ≥ 53 — D6 已激活**

但 E2E 测试无法执行：CCAAS API 返回 `QUOTA_EXCEEDED`（月度 token 额度 200,000 已用完）。

```
{"code":"QUOTA_EXCEEDED","message":"Monthly token quota exceeded (200,000 tokens)","statusCode":429}
```

所有 6 个场景 (S1-S6) 均返回相同错误。D6 = 0/25，非实现质量问题。

## Priority Fix

1. **[D6/运维] API 额度不足** — 重置或增加月度 token 额度后重新执行 E2E 测试。当前 D1-D5 已满分 (75/75)，E2E 通过后总分预期可达 90+/100
2. **[D5/观察] show_step_wizard 未注册到工具列表** — `showStepWizardTool` 定义存在 (L166) 但未出现在 `ListToolsRequestSchema` handler 的 tools 数组中 (L551-556)。此问题可能非本次变更引入，建议确认后补加
3. **[D4/建议] 未使用 outline 和 bar_list section type** — 当前仅用了 metrics/text/actions，虽然合规但可考虑在课表展示中使用 outline（如树状课表结构）或 bar_list（如代课匹配度可视化）增强信息密度

## Overall Assessment

这是一个非常高质量的实现。SKILL.md 结构完整、逻辑清晰，覆盖了 PRD 要求的所有场景（4 种调课类型 + 模糊描述 + 状态查询 + 异常处理）。MCP 工具全部基于共享数据模型动态推算，没有硬编码返回值。确认流程有硬性门控保障。唯一阻碍满分的是 API 额度限制导致 E2E 无法验证。
