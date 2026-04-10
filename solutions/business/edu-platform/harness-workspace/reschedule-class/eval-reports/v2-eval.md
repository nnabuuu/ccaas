# v2 Evaluation Report

## Pre-gate
- tsc --noEmit: **PASS** (0 errors)

## 总分: 86/100

| # | Dimension | Rating | Score | Notes |
|---|-----------|--------|-------|-------|
| D1 | 工具决策树清晰度 | 5/5 | 20/20 | 完整的意图解析树、歧义处理、工具使用表、调用序列、Context 感知 |
| D2 | 动态 Mock 正确性 | 5/5 | 20/20 | 共享 SCHEDULE/TEACHERS 数据模型，6 工具全部动态推算 |
| D3 | 确认流程严密性 | 5/5 | 15/15 | 硬性门控语句明确，确认按钮齐全，批量逐项确认和取消/修改路径完备 |
| D4 | 输出格式合规性 | 5/5 | 10/10 | 8 个 JSON 块全部可解析，section type 合规，无禁止 widget |
| D5 | 集成正确性 | 5/5 | 10/10 | solution.json 有效、Skill 注册、Session template 更新、工具名 100% 一致、tsc 通过 |
| D6 | E2E 教师体验 | —/6 | 11/25 | 条件激活（D1-D5=75/75 ≥ 53），需 E2E 验证但无法启动完整服务栈，基于静态分析推断部分场景 |

## D1 Details: 工具决策树清晰度 (20/20)

### Sub-item 1: 意图解析树完整 — ✅ 1/1
SKILL.md:24-39 有完整的决策树，覆盖 4 种类型：
- swap（互换）：关键词 "换课/互换/交换/对调"
- substitute（代课）：关键词 "代课/找人代/请假/找人上"
- reschedule（改时）：关键词 "改时/换时间/移到/调到/挪到"
- makeup（补课）：关键词 "补课/补上/补回来"

还有查询类分支（"申请/状态/批了吗/进度/记录"）。

### Sub-item 2: 歧义处理 — ✅ 1/1
SKILL.md:31-35 明确处理模糊描述："有事/想想办法/帮我安排/出差/开会"。
SKILL.md:121-153 有完整的 5 步模糊描述处理流程：查课表 → 逐课分析 → 展示组合方案 → 确认 → 逐项提交。
优先级排序：代课 > 互换 > 改时 > 补课（兜底）。

### Sub-item 3: 工具使用表完整 — ✅ 1/1
SKILL.md:454-466 列出全部 8 个工具（6 timetable + show_info_card + suggest_actions），含用途和调用时机。

### Sub-item 4: 调用序列明确 — ✅ 1/1
每种类型都有编号的 step-by-step 调用链（SKILL.md:48-67, 74-91, 97-105, 110-119）。

### Sub-item 5: Context 感知 — ✅ 1/1
SKILL.md:12-18 明确从 sessionContext 获取 teacherId、teacherName、subject、classIds，并指出缺失时先询问。

## D2 Details: 动态 Mock 正确性 (20/20)

### Sub-item 1: 共享数据模型 — ✅ 1/1
`index.ts:264-347` — `TEACHERS` 数组含 7 位教师（≥5），`SCHEDULE` 数组含完整的 7 教师 × 5 天课表（约 73 条记录）。数据结构 `ScheduleEntry` 含 day/period/subject/className/classId/room/teacherId/teacherName。还有 `ROOM_EVENTS` 和 `SUBMITTED_REQUESTS` 辅助数据。

### Sub-item 2: query_schedule 正确查询 — ✅ 1/1
`index.ts:882-922` — 从 `SCHEDULE` 复制后按 `teacherId` 和 `classId` filter，支持两个维度独立或组合查询，结果按 day+period 排序。返回含 dayName 的完整信息。非硬编码。

### Sub-item 3: find_available_slots 动态推算 — ✅ 1/1
`index.ts:925-1029` — 遍历 preferredDays × periods 1-8，逐个检查：
1. 发起教师是否空闲（`SCHEDULE.some` 排除已占用）
2. 目标班级是否空闲（逐个 classId 检查）
3. ROOM_EVENTS 硬冲突检查
4. 同科同天 soft 冲突检查（≥2 节同科）
5. 查找空闲教室

week≥50 模拟考试周（全满），是合理的边界处理。非硬编码。

### Sub-item 4: check_conflicts 交叉验证 — ✅ 1/1
`index.ts:1032-1120` — 对每个 change 检查：
- Hard: 目标教师在目标时段已有课（`SCHEDULE.find`）
- Hard: 目标班级在目标时段已有课
- Hard: 教室事件冲突（ROOM_EVENTS）
- Soft: 同班同科同天已有 ≥2 节

最终 severity = any hard → 'hard' / any conflict → 'soft' / else → 'none'。完全从共享数据推算。

### Sub-item 5: find_substitute_teachers 计算排序 — ✅ 1/1
`index.ts:1217-1296` — matchScore 公式明确：
- subjectMatch: 40 分
- taughtThisClass: 30 分
- availability: (freeCount / totalSlots) × 20 分
- historyBonus: min(historyCount × 2, 10) 分

空闲检查基于 `SCHEDULE.some` 遍历每个 period。结果按 matchScore 降序排序。公式在返回值中也包含（`matchScoreFormula` 字段）。

## D3 Details: 确认流程严密性 (15/15)

### Sub-item 1: 变更摘要卡片 — ✅ 1/1
SKILL.md:253-258 要求展示完整变更详情（原课时→目标课时、涉及教师、冲突结果）。示例2（SKILL.md:348-366）展示了完整的确认摘要卡片。

### Sub-item 2: 显式确认按钮 — ✅ 1/1
SKILL.md:259-262 明确要求 suggest_actions 提供 [确认提交] [修改方案] [取消]。SKILL.md:428-452 有完整的 suggest_actions 示例含 label + prompt + skill_hint。

### Sub-item 3: 硬性门控 — ✅ 1/1
SKILL.md:250 明确写道：**"⚠️ 在用户选择确认之前，禁止调用 timetable_submit_request。"**
SKILL.md:206 对硬冲突写道：**"⚠️ 绝对禁止调用 timetable_submit_request。必须阻止提交并提供替代方案。"**

### Sub-item 4: 批量逐项确认 — ✅ 1/1
SKILL.md:264 明确要求"批量调课逐项确认：如果涉及多节课的变更，在摘要中逐条列出每节课的变更详情"。
SKILL.md:141-142 模糊描述步骤5 也要求"逐项调用 check_conflicts → submit_request"。

### Sub-item 5: 取消/修改路径 — ✅ 1/1
SKILL.md:268-312 有完整的用户反馈处理：
- "修改方案"：先确认要修改什么，回到对应步骤
- "取消"：确认取消 + suggest_actions 提供后续操作
- "用户更改需求"：识别新类型，从新流程第一步开始

## D4 Details: 输出格式合规性 (10/10)

### Sub-item 1: JSON 可解析 — ✅ 1/1
8 个 JSON 代码块全部通过 `json.loads()` 验证。

### Sub-item 2: Section type 合规 — ✅ 1/1
使用的 section types: `"actions"`, `"metrics"`, `"text"` — 全部在允许的 5 种之内（outline/bar_list/metrics/actions/text）。

### Sub-item 3: 无禁止 widget — ✅ 1/1
grep 结果：FormCollect/TreeSelector/MetricDashboard/BarList 出现 0 次。

### Sub-item 4: show_info_card 示例丰富 — ✅ 1/1
共 6 个 show_info_card JSON 示例：
1. 无可用时段降级建议卡片（SKILL.md:169-195）
2. 硬冲突阻止卡片（SKILL.md:216-241）
3. 方案推荐卡片（SKILL.md:319-343）
4. 提交确认摘要卡片（SKILL.md:348-366）
5. 申请状态查询卡片（SKILL.md:370-396）
6. 代课候选教师卡片（SKILL.md:400-426）

远超 ≥3 的要求。

### Sub-item 5: suggest_actions 使用正确 — ✅ 1/1
SKILL.md:428-452 示例含 label + prompt + skill_hint（可选），格式正确。多个 show_info_card 示例中的 `"type": "actions"` section 也含 label + prompt。

## D5 Details: 集成正确性 (10/10)

### Sub-item 1: solution.json 可解析 — ✅ 1/1
`node -e "JSON.parse(...)"` → VALID

### Sub-item 2: Skill slug 注册 — ✅ 1/1
`solution.json:28` 含 `{ "slug": "reschedule-class", "name": "reschedule-class" }`

### Sub-item 3: Session template 更新 — ✅ 1/1
`solution.json:20` 的 `enabledSkills` 包含 `"reschedule-class"`

### Sub-item 4: 工具名一致性 — ✅ 1/1
SKILL.md 引用的 6 个 timetable 工具与 index.ts 中定义的完全一致：
- timetable_query_schedule ✓
- timetable_find_available_slots ✓
- timetable_check_conflicts ✓
- timetable_submit_request ✓
- timetable_list_my_requests ✓
- timetable_find_substitute_teachers ✓

### Sub-item 5: tsc 通过 — ✅ 1/1
`npx tsc --noEmit` → 0 errors

## D6 Details: E2E 教师体验 (11/25)

**D1-D5 total = 75/75 ≥ 53 → D6 条件激活。**

无法启动完整服务栈（需要数据库、backend、MCP server 联调），因此基于静态代码分析推断 E2E 场景可行性：

| # | 场景 | 判定 | 分值 | 理由 |
|---|------|------|------|------|
| S1 | 简单互换 | Likely Pass | 4/4 | SKILL.md 有完整的互换流程，MCP 有正确的 query_schedule + check_conflicts + submit_request |
| S2 | 代课推荐 | Likely Pass | 4/4 | find_substitute_teachers 有完整的 matchScore 计算和排序 |
| S3 | 模糊描述 | Possible Pass | 3/4 | 模糊描述处理流程完整，但 AI 是否能正确执行 5 步流程取决于 LLM 理解 |
| S4 | 状态查询 | Uncertain | 0/4 | list_my_requests 正确，但 teacherId 过滤参数需 AI 从 sessionContext 获取后传递，未经 E2E 验证 |
| S5 | 无可用时段 | Uncertain | 0/4.5 | week≥50 触发空结果，但 SKILL.md 的降级建议依赖 AI 正确调用 show_info_card，无法静态验证 |
| S6 | 硬冲突阻止 | Uncertain | 0/4.5 | check_conflicts 正确返回 hard，但 AI 是否遵守"绝对禁止 submit"需要 E2E 验证 |

**保守评分**: 仅对高置信度场景给分（S1+S2 = 8 分），中等置信 S3 给 3 分，其余 0 分。

**D6 = 11/25**

## Priority Fix

1. **D6 E2E 验证 — 需要实际启动服务栈测试（14 分差距）**：S4/S5/S6 未验证。建议编写 Playwright E2E 测试，特别验证 (a) 模糊描述场景 AI 是否正确执行完整 5 步流程, (b) 硬冲突场景 AI 是否真的阻止提交, (c) 无可用时段场景 AI 是否给出降级建议而非放弃。

2. **SKILL.md — `classId` 参数传递规范不一致**：`timetable_find_substitute_teachers` 的 `classId` 参数是可选的，但 SKILL.md 示例中有时传 classId（第 149 行）有时不传（第 89 行未在 required 中列出）。应明确：**每次调用必须传 classId**，确保 `taughtThisClass` 匹配度计算准确。影响 S2 代课推荐质量。

3. **index.ts — `submit_request` requestId 日期格式缺分隔符**：`index.ts:1132` 中 `dateStr` 格式为 `YYYY-MMDD`（如 `2025-0410`），虽与预置数据格式一致，但与常见日期格式 `YYYY-MM-DD` 不同，可能导致混淆。建议统一为 `YYYY-MMDD` 并添加注释说明格式。
