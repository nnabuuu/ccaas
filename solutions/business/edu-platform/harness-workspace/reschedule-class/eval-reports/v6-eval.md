# v6 Evaluation Report

## Pre-gate
- tsc --noEmit: **PASS** (0 errors)

## 总分: 93/100

| # | Dimension | Rating | Score | Notes |
|---|-----------|--------|-------|-------|
| D1 | 工具决策树清晰度 | 5/5 | 20/20 | 完整的意图解析树、歧义处理、8 工具全表、详细调用链、Context 感知 |
| D2 | 动态 Mock 正确性 | 5/5 | 20/20 | 共享 SCHEDULE/TEACHERS、全部 6 工具动态推算、matchScore 公式完整 |
| D3 | 确认流程严密性 | 5/5 | 15/15 | 硬性门控语句、show_info_card 摘要 + suggest_actions 确认按钮、批量逐项、取消/修改路径 |
| D4 | 输出格式合规性 | 5/5 | 10/10 | 9 个 JSON 块全部可解析、5 种 section type 合规、无禁止 widget、≥5 个 show_info_card 示例 |
| D5 | 集成正确性 | 5/5 | 10/10 | solution.json 合法、skill 注册、session template 更新、6 工具名 100% 一致、tsc 零错误 |
| D6 | E2E 教师体验 | 4/6 | 18/25 | S3/S5/S6 Pass; S1/S2/S4 Partial — 详见下方 |

## D1 Details

| Sub-item | Score | Finding |
|----------|-------|---------|
| 1. 意图解析树完整 | 1 | SKILL.md:23-41 完整决策树，4 种类型各有触发关键词（swap: 换课/互换/交换/对调; substitute: 代课/找人代/请假; reschedule: 改时/换时间/移到; makeup: 补课/补上）+ 模糊描述分支 + 查询类分支 |
| 2. 歧义处理 | 1 | SKILL.md:215-247「模糊描述处理」5 步流程: query → 逐课分析 → show_info_card 组合方案 → suggest_actions → 逐项提交。关键词覆盖"有事/想想办法/帮我安排/出差/开会" |
| 3. 工具使用表完整 | 1 | SKILL.md:632-643 列出全部 8 工具（6 timetable + show_info_card + suggest_actions），含用途和调用时机 |
| 4. 调用序列明确 | 1 | 4 种类型各有 step-by-step 调用链：swap(53-110), substitute(116-152), reschedule(158-188), makeup(192-214)。每种含工具调用序列号 + 子类型分支（如 swap 分「与他人互换」和「自身互换」） |
| 5. Context 感知 | 1 | SKILL.md:12-18 明确 sessionContext 字段（teacherId/teacherName/subject/classIds），含 classId 单数→数组转换逻辑。多处强调「从 sessionContext 获取，禁止要求教师输入」(254, 640, 715) |

**D1 = 5 × 4 = 20/20**

## D2 Details

| Sub-item | Score | Finding |
|----------|-------|---------|
| 1. 共享数据模型 | 1 | `TEACHERS` 数组含 8 位教师（含 E2E teacher-wang），`SCHEDULE` 数组含完整周课表（~80 条 ScheduleEntry），`ROOM_EVENTS` 含 3 条教室占用事件，`SUBMITTED_REQUESTS` 含 6 条历史申请。所有 6 个工具从同一数据源推算 |
| 2. query_schedule 正确查询 | 1 | index.ts:953-993 按 teacherId/classId 从 SCHEDULE 过滤，按 day/period 排序，返回含 dayName 映射的结构化结果。非硬编码 |
| 3. find_available_slots 动态推算 | 1 | index.ts:996-1126 双层循环 day×period，逐一检查：教师是否空闲(SCHEDULE.some)、班级是否空闲、教室事件冲突、同科目超载(soft)。周末(d>=6)过滤、考试周(week>=50)返回 totalSlots=0。动态查找空闲教室 |
| 4. check_conflicts 交叉验证 | 1 | index.ts:1129-1269 含 5 层检测: (1)目标教师忙-hard (2)目标班级忙-hard (3)教室事件-hard (4)同科目超载-soft (5)批内冲突(同教师同时段双重预订)-hard。实现 vacatedKeys 机制识别互换配对，避免误报 |
| 5. find_substitute_teachers 计算排序 | 1 | index.ts:1443-1530 公式: `subjectMatch(40) + taughtThisClass(30) + availability(freeCount/total*20) + historyBonus(min(count*2,10))`。历史代课次数从 SUBMITTED_REQUESTS 动态计算。按 matchScore 降序排序 |

**D2 = 5 × 4 = 20/20**

## D3 Details

| Sub-item | Score | Finding |
|----------|-------|---------|
| 1. 变更摘要卡片 | 1 | SKILL.md:386-388 要求「调用 show_info_card 展示完整的变更详情」含原/目标课时、涉及教师、冲突状态。5 个 JSON 示例覆盖方案推荐(451)、提交确认(480)、状态查询(503)、代课候选(533)、课表概览(569) |
| 2. 显式确认按钮 | 1 | SKILL.md:391-394 明确要求 suggest_actions 提供 [确认提交][修改方案][取消]。JSON 示例(606-630)含 label + prompt + skill_hint |
| 3. 硬性门控 | 1 | SKILL.md:382 精确语句：「⚠️ 在用户选择确认之前，禁止调用 timetable_submit_request。」另有 SKILL.md:695「绝对禁止调用 timetable_submit_request（即使教师坚持也必须拒绝）」。MCP 工具描述(529-530)也重复此约束 |
| 4. 批量逐项确认 | 1 | SKILL.md:396「如果涉及多节课的变更，在摘要中逐条列出每节课的变更详情」。模糊描述流程(235-236)逐课分析+逐项提交 |
| 5. 取消/修改路径 | 1 | SKILL.md:399-445 三种反馈处理: (1)修改方案→回到对应搜索步骤 (2)取消→确认取消+suggest_actions后续选项 (3)更改需求→识别新类型从头开始。JSON 示例(423-438)含取消后的 suggest_actions |

**D3 = 5 × 3 = 15/15**

## D4 Details

| Sub-item | Score | Finding |
|----------|-------|---------|
| 1. JSON 可解析 | 1 | 9 个 `json` 代码块全部通过 JSON.parse 验证，无语法错误 |
| 2. Section type 合规 | 1 | 检测到 5 种 type: `actions`, `bar_list`, `metrics`, `outline`, `text`。全部在允许列表内 |
| 3. 无禁止 widget | 1 | FormCollect/TreeSelector/MetricDashboard/BarList 出现次数 = 0 |
| 4. show_info_card 示例丰富 | 1 | 7 个 show_info_card JSON 示例: 方案推荐(451)、提交确认(480)、申请状态(503)、代课候选(533)、课表概览(569)、无可用时段降级(297)、硬冲突阻止(347) |
| 5. suggest_actions 使用正确 | 1 | JSON 示例含 label + prompt + skill_hint(可选)。确认流程(606-630)、取消后续(423-438)均格式正确 |

**D4 = 5 × 2 = 10/10**

## D5 Details

| Sub-item | Score | Finding |
|----------|-------|---------|
| 1. solution.json 可解析 | 1 | `node -e "JSON.parse(...)"` → VALID |
| 2. Skill slug 注册 | 1 | `skills` 数组含 `{ "slug": "reschedule-class" }` |
| 3. Session template 更新 | 1 | `sessionTemplates.lesson-planning.enabledSkills` 含 `"reschedule-class"` |
| 4. 工具名一致性 | 1 | SKILL.md 引用的 6 个 timetable 工具名与 mcp-server 定义 100% 一致: timetable_query_schedule(2), timetable_find_available_slots(2), timetable_check_conflicts(2), timetable_submit_request(2), timetable_list_my_requests(2), timetable_find_substitute_teachers(2) |
| 5. tsc 通过 | 1 | `npx tsc --noEmit` → 0 errors |

**已有工具检查**: `curriculum_tree`, `student_proficiency` 等原有工具定义和 handler 未被修改。通过。

**D5 = 5 × 2 = 10/10**

## D6 Details

**D1-D5 = 75/75 ≥ 53 → D6 activated**

CCAAS URL: http://localhost:3001 | Health: OK | API Key: sk-edu-plat-...

Session context: `{ teacherId: "teacher-wang", teacherName: "王老师", subject: "数学", grade: "七年级", classId: "class-701" }`

### Scenario Results

| # | 场景 | Score | Tool Invocations (actual) | Verdict |
|---|------|-------|---------------------------|---------|
| S1 | 简单互换 | 2/4 | query_schedule(1), suggest_actions(1) | **Partial** — 查了课表但用了错误 teacherId 上下文（返回 t-zhang 数据而非 teacher-wang），导致告知用户"该时段无课"。无 show_info_card、无 check_conflicts |
| S2 | 代课推荐 | 2/4 | query_schedule(3), show_info_card(1), suggest_actions(1) | **Partial** — 未调用 find_substitute_teachers，改用 query_schedule 手动查找代课教师。多次查询均未找到 teacher-wang 课表数据。show_info_card/suggest_actions 已调用但内容不完整 |
| S3 | 模糊描述 | 4/4 | query_schedule(1), show_info_card(1), suggest_actions(1) | **Pass** — 查询课表 → 分析受影响课时 → show_info_card 展示组合方案 → suggest_actions 提供选项 |
| S4 | 状态查询 | 1/4 | list_my_requests(1) | **Partial** — 调用了正确工具但 teacherId 传了 `"current"` 而非 `"teacher-wang"`，返回 0 条记录。无 show_info_card、无 suggest_actions |
| S5 | 无可用时段 | 4.5/4.5 | query_schedule(1), find_available_slots(1), show_info_card(1), suggest_actions(1) | **Pass** — find_available_slots 正确传入 preferredDays:[6]。展示降级分析卡片（10 课 > 8 时段），提供 [周六排8节+剩余另安排][只调部分][取消] 选项，未直接放弃 |
| S6 | 硬冲突阻止 | 4.5/4.5 | query_schedule(1), check_conflicts(1), find_available_slots(1), show_info_card(1), suggest_actions(1) | **Pass** — check_conflicts 检测到 hard 冲突（severity:"hard"），**submit_request 未被调用**（正确阻止）。show_info_card 展示冲突详情 + 3 个替代时段 |

**D6 = 2 + 2 + 4 + 1 + 4.5 + 4.5 = 18/25**

### E2E 系统性问题

**teacherId 上下文提取失败**（影响 S1/S2/S4）: AI 未能正确从 sessionContext 提取 `teacherId: "teacher-wang"`。具体表现:
- S1: 查询返回了 t-zhang 的课表数据
- S2: 多次查询未找到 teacher-wang 的课表
- S4: 传入 `teacherId: "current"` 字面量

**根因分析**: solution.json 的 `appendSystemPrompt` 中使用 `t-zhang` 作为示例 teacherId，AI 可能跟随示例而非从实际 sessionContext 提取。SKILL.md 本身的指令是正确的（多处强调从 sessionContext 获取），但 appendSystemPrompt 中的示例可能产生误导。

**S5 运行时注意**: find_available_slots 返回 day:6 共 8 个时段（totalSlots=8），但源码中 `validDays.filter(d => d >= 1 && d <= 5)` 应将 day 6 过滤为空→totalSlots=0。推测 dist/ 为旧版构建。AI 仍表现出正确降级行为（分析 10>8 容量不足并提供替代方案）。

## Priority Fix

1. **[D6/S1/S2/S4] appendSystemPrompt 中示例 teacherId 误导 AI**: solution.json 第 21 行的 appendSystemPrompt 使用 `t-zhang` 作为示例，应改为占位符 `sessionContext.teacherId` 或明确说明"以下仅为示例，实际使用时必须从 sessionContext 提取"。这是导致 3 个 E2E 场景失分的系统性根因。预计修复后 D6 可提升 5-7 分。

2. **[D6/运行时] MCP server dist/ 需重新构建**: `npm run build` 后 dist/index.js 应与 src/index.ts 一致。当前 find_available_slots 的周末过滤逻辑在源码中正确但运行时未生效，说明 dist 为旧版本。

3. **[D6/S4] AI 对 list_my_requests 的 teacherId 参数处理**: 即使 SKILL.md 已有 3 处强调从 sessionContext 获取 teacherId（lines 254, 640, 715），AI 仍传了 `"current"` 字面量。可在 appendSystemPrompt 中增加针对 list_my_requests 的特别提醒，或在 MCP 工具描述中加入 `"teacherId 必须是实际的教师 ID 字符串（如 teacher-wang），不可传 'current' 或其他占位符"`。
