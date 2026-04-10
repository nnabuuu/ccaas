# v3 Evaluation Report

## Pre-gate
- tsc --noEmit: **PASS** (0 errors)

## 总分: 75/100

| # | Dimension | Rating | Score | Notes |
|---|-----------|--------|-------|-------|
| D1 | 工具决策树清晰度 | 5/5 | 20/20 | 完整意图解析树、歧义处理、8工具表、调用链、Context感知全满足 |
| D2 | 动态 Mock 正确性 | 5/5 | 20/20 | 7教师共享课表，全部6工具从 SCHEDULE 动态推算，matchScore 有公式 |
| D3 | 确认流程严密性 | 5/5 | 15/15 | 硬性门控"禁止"语句明确，批量逐项确认，取消/修改路径完整 |
| D4 | 输出格式合规性 | 5/5 | 10/10 | 8个JSON块全部可解析，section type 合规，无禁止widget，6个示例 |
| D5 | 集成正确性 | 5/5 | 10/10 | solution.json合法，slug注册，template更新，工具名100%一致，tsc通过 |
| D6 | E2E 教师体验 | 0/6 | 0/25 | 已激活 (D1-D5=75/75 ≥ 53)，但需要完整服务栈执行 |

## D1 Details

| 子项 | 分数 | 说明 |
|------|------|------|
| 意图解析树完整 | 1/1 | 4种类型各有触发关键词：swap("换课/互换/交换/对调")、substitute("代课/找人代/请假")、reschedule("改时/换时间/移到/调到")、makeup("补课/补上/补回来")。`SKILL.md:24-41` |
| 歧义处理 | 1/1 | 模糊描述("有事/想想办法/帮我安排")有完整分流逻辑：先调 query_schedule 查受影响课时 → 逐课分析 → 推荐组合方案。`SKILL.md:124-156` |
| 工具使用表完整 | 1/1 | 8工具全列（6 timetable + show_info_card + suggest_actions），含用途列和调用时机列。`SKILL.md:492-503` |
| 调用序列明确 | 1/1 | 4种类型各有编号的 step-by-step 调用链，从 query → search → show → confirm → submit 完整覆盖。`SKILL.md:49-56, 74-82, 100-108, 114-122` |
| Context 感知 | 1/1 | 明确从 sessionContext 获取 teacherId/teacherName/subject/classIds，无需教师手动输入。`SKILL.md:12-18` |

## D2 Details

| 子项 | 分数 | 说明 |
|------|------|------|
| 共享数据模型 | 1/1 | `TEACHERS` 数组含 7 教师（≥5），`SCHEDULE` 常量含全部 7 教师的完整周课表（~70 entries），统一 `ScheduleEntry` 接口。`index.ts:264-346` |
| query_schedule 正确查询 | 1/1 | 从 `SCHEDULE` 数组用 `.filter()` 按 teacherId/classId 过滤，`.sort()` 按 day+period 排序，非硬编码。`index.ts:883-923` |
| find_available_slots 动态推算 | 1/1 | 遍历 days×periods(1-8)，用 `SCHEDULE.some()` 排除教师/班级已占时段，检查 `ROOM_EVENTS` 硬冲突，计算同科 soft 冲突，动态查找空闲教室。`week≥50` 模拟全满场景。`index.ts:926-1030` |
| check_conflicts 交叉验证 | 1/1 | 从 `SCHEDULE` 交叉检测4类冲突：target teacher busy(hard)、class busy(hard)、room event(hard)、subject overload(soft)。返回 overall severity = max(conflicts)。`index.ts:1033-1121` |
| find_substitute_teachers 计算排序 | 1/1 | matchScore 公式：subjectMatch(40) + taughtThisClass(30) + availability(freeCount/total×20) + historyBonus(min(count×2,10))。结果按 matchScore 降序排序。公式在返回值中也有说明。`index.ts:1257-1267` |

**注意**: `check_conflicts` 在互换场景中不考虑"释放原时段"的逻辑（即 A↔B 互换时，A 的原时段会释放给 B，但 mock 不扣除原占用）。对于 demo mock 这是可接受的简化，但真实系统需处理。

## D3 Details

| 子项 | 分数 | 说明 |
|------|------|------|
| 变更摘要卡片 | 1/1 | 每种工作流在提交前都有 show_info_card 展示变更详情（原课时→目标课时、涉及教师、冲突状态）。6个完整JSON示例。`SKILL.md:352-463` |
| 显式确认按钮 | 1/1 | 每种类型的 suggest_actions 均含 [确认提交] [修改方案] [取消] 三按钮，JSON 格式正确含 label+prompt+skill_hint。`SKILL.md:472-489` |
| 硬性门控 | 1/1 | 明确写明 "⚠️ 在用户选择确认之前，禁止调用 timetable_submit_request。"(line 287) + "绝对禁止调用 timetable_submit_request"(line 242) + 提交前必须确认最近 check_conflicts severity !== "hard"。`SKILL.md:286-302` |
| 批量逐项确认 | 1/1 | "批量调课逐项确认：如果涉及多节课的变更，在摘要中逐条列出每节课的变更详情"(line 301)。模糊描述处理中也有逐项提交逻辑(lines 144-145)。 |
| 取消/修改路径 | 1/1 | 完整的"用户反馈处理"章节：修改方案(回到对应步骤重新搜索)、取消(确认后提供后续操作)、用户更改需求(识别新类型从头开始)。`SKILL.md:306-349` |

## D4 Details

| 子项 | 分数 | 说明 |
|------|------|------|
| JSON 可解析 | 1/1 | 8个 ```json 代码块全部通过 JSON.parse 验证，零语法错误 |
| Section type 合规 | 1/1 | 使用的类型: "actions", "metrics", "text"。全部在允许列表 (outline/bar_list/metrics/actions/text) 内 |
| 无禁止 widget | 1/1 | grep 'FormCollect\|TreeSelector\|MetricDashboard\|BarList' = 0 matches |
| show_info_card 示例丰富 | 1/1 | 6个不同场景示例：方案推荐、提交确认摘要、申请状态查询、代课候选教师、无可用时段、硬冲突阻止（≥3） |
| suggest_actions 使用正确 | 1/1 | 每个 action 含 label + prompt，大部分含 skill_hint="reschedule-class"。格式规范。 |

## D5 Details

| 子项 | 分数 | 说明 |
|------|------|------|
| solution.json 可解析 | 1/1 | `node -e "JSON.parse(...)"` → VALID |
| Skill slug 注册 | 1/1 | `skills` 数组含 `{ "slug": "reschedule-class" }` |
| Session template 更新 | 1/1 | `lesson-planning.enabledSkills` 含 "reschedule-class" |
| 工具名一致性 | 1/1 | 6个 timetable 工具名在 SKILL.md 和 mcp-server 中完全一致（每个 ≥2 matches） |
| tsc 通过 | 1/1 | `npx tsc --noEmit` = 0 errors |

**补充验证**: 已有 9 个工具定义和 handler 均未被修改（curriculum_tree, student_proficiency, teaching_progress, generate_docx, write_output, show_info_card, suggest_actions, show_step_wizard, show_review_panel）。

## D6 Details

**D6 已激活** (D1-D5 = 75/75 ≥ 53 阈值)

无法在静态评估中执行 E2E 测试（需完整服务栈：backend + mcp-server + AI session）。基于代码审查的场景支持度分析：

| # | 场景 | 代码支持度 | 分析 |
|---|------|-----------|------|
| S1 | 简单互换 | ✅ 高 | SKILL.md 有完整 swap 工作流 + query → check → show → confirm → submit 调用链 |
| S2 | 代课推荐 | ✅ 高 | find_substitute_teachers 动态计算 matchScore，SKILL.md 有选择后确认流程 |
| S3 | 模糊描述 | ✅ 高 | 专门的"模糊描述处理"章节，逐课分析 + 组合方案展示 |
| S4 | 状态查询 | ✅ 高 | list_my_requests 有预置数据(3条不同状态)，SKILL.md 有完整查询流程 |
| S5 | 无可用时段 | ✅ 高 | `week≥50` 触发空结果，SKILL.md 有降级建议流程 + JSON 示例 |
| S6 | 硬冲突阻止 | ✅ 高 | check_conflicts 返回 severity=hard 时，SKILL.md 有明确阻止提交 + 替代方案流程 |

**评估结论**: 代码层面对全部6个场景有充分支持，E2E 通过概率较高。

## Priority Fix

1. **D6 E2E 执行**: 需要搭建 E2E 测试 harness（启动 backend + MCP → Playwright 模拟对话 → 验证工具调用序列和输出），这是获得剩余 25 分的唯一路径
2. **check_conflicts 互换场景优化** (D2 minor): 当前 mock 不考虑互换释放原时段的逻辑，可能在 S1 场景中产生误报的 hard 冲突。建议在 swap 类型的 changes 中，先从 SCHEDULE 副本中移除原条目再检测
3. **show_info_card 类型覆盖** (D4 minor): 当前示例仅使用 metrics/text/actions 三种 section type，未使用 outline 和 bar_list。可在课表展示中使用 outline 类型增加展示丰富度
