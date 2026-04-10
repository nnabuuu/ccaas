# v4 Evaluation Report

## Pre-gate
- tsc --noEmit: **PASS** (0 errors)

## 总分: 75/100

| # | Dimension | Rating | Score | Notes |
|---|-----------|--------|-------|-------|
| D1 | 工具决策树清晰度 | 5/5 | 20/20 | 意图解析树完整，4 类型 + 模糊 + 查询全覆盖，歧义处理有 5 步流程 |
| D2 | 动态 Mock 正确性 | 5/5 | 20/20 | 7 教师共享课表，6 工具全部动态推算，matchScore 公式明确 |
| D3 | 确认流程严密性 | 5/5 | 15/15 | 硬性门控"禁止调用"语句存在，批量逐项确认 + 取消/修改路径完整 |
| D4 | 输出格式合规性 | 5/5 | 10/10 | 9 个 JSON 块全部可解析，section type 合规，无禁止 widget |
| D5 | 集成正确性 | 5/5 | 10/10 | solution.json 合法，skill 注册 + session template 更新，工具名 100% 一致 |
| D6 | E2E 教师体验 | 0/6 | 0/25 | E2E config (.e2e-config) 不存在，无法执行 |

## D1 Details

| Sub-item | Score | Evidence |
|----------|-------|----------|
| 意图解析树完整 | 1/1 | SKILL.md L24-41: 决策树覆盖 swap/substitute/reschedule/makeup + 模糊描述 + 查询类，每类有触发关键词 |
| 歧义处理 | 1/1 | SKILL.md L177-208: "模糊描述处理"独立章节，5 步强制流程（查课表→逐课分析→展示组合→确认→逐项提交） |
| 工具使用表完整 | 1/1 | SKILL.md L595-604: 8 工具全部列出（6 timetable + show_info_card + suggest_actions），含用途和调用时机 |
| 调用序列明确 | 1/1 | 4 类型各有编号步骤链：swap L49-83, substitute L88-124, reschedule L130-148, makeup L155-174 |
| Context 感知 | 1/1 | SKILL.md L12-18: 明确从 sessionContext 获取 teacherId/teacherName/subject/classIds；L214-217 禁止手动输入 |

**评语**: 决策树结构清晰，模糊描述处理是亮点 — 先查课表再按优先级逐课推荐（代课>互换>改时>补课）。工具响应处理规则（L626-692）额外增强了鲁棒性，对每个工具返回值都有必检字段和异常处理逻辑。

## D2 Details

| Sub-item | Score | Evidence |
|----------|-------|----------|
| 共享数据模型 | 1/1 | index.ts L264-346: TEACHERS(7人) + SCHEDULE(~70条) + ROOM_EVENTS(3条) + SUBMITTED_REQUESTS(5条)，共享常量 |
| query_schedule 查询 | 1/1 | index.ts L906-945: `SCHEDULE.filter(e => e.teacherId === teacherId)` + classId 过滤，结果排序后返回 |
| find_available_slots 动态 | 1/1 | index.ts L949-1059: 双层 for 循环遍历 day×period，逐个检查 teacher busy + class busy + room event，动态计算 freeRoom |
| check_conflicts 交叉 | 1/1 | index.ts L1062-1186: vacatedKeys 集合实现互换感知；检测 teacher_busy(hard) + class_busy(hard) + room_event(hard) + subject_overload(soft) |
| find_substitute matchScore | 1/1 | index.ts L1390-1400: `subjectMatch(40) + taughtThisClass(30) + availability(20) + historyBonus(max10)` 公式明确，historyCount 从 SUBMITTED_REQUESTS 动态计算 |

**评语**: 实现质量高。几个技术亮点：
1. **vacatedKeys 机制** (L1079-1084): 互换时两条变更互为配对，通过收集被腾出的时段避免误报冲突 — 这是正确的互换冲突检测
2. **服务端硬冲突安全网** (L1196-1244): submit_request 内部重复冲突检测，即使 Skill prompt 被绕过也能拒绝
3. **week ≥ 50 考试周** (L957-973): 直接返回 totalSlots=0 + hint，触发降级流程
4. **historyCount 动态计算** (L1385-1388): 从 SUBMITTED_REQUESTS 统计已批准代课记录，非硬编码

## D3 Details

| Sub-item | Score | Evidence |
|----------|-------|----------|
| 变更摘要卡片 | 1/1 | 每个工作流均有 show_info_card 展示变更详情步骤（swap L54, substitute L91, reschedule L134, makeup L158）；示例2 (L440-459) 展示完整变更摘要 |
| 显式确认按钮 | 1/1 | suggest_actions [确认提交][修改方案][取消] 在所有工作流中出现；JSON 示例 L571-591 结构正确 |
| 硬性门控 | 1/1 | L343: "⚠️ 在用户选择确认之前，禁止调用 timetable_submit_request。" — 明确的硬性禁令 |
| 批量逐项确认 | 1/1 | L357: "批量调课逐项确认：如果涉及多节课的变更，在摘要中逐条列出每节课的变更详情"；模糊描述步骤5 (L196-197) 逐项 check+submit |
| 取消/修改路径 | 1/1 | L362-406: 三种用户反馈处理 — "修改方案"(按类型回溯), "取消"(确认+后续按钮), "更改需求"(重新开始) |

**评语**: 确认流程设计严密。L345-358 "确认门控（强制规则）"章节以 5 条规则覆盖所有场景。L292-339 硬冲突处理也有"绝对禁止"语句。提交前冲突验证 (L358) 要求确认最近一次 check_conflicts 结果非 hard — 防止教师确认后数据变化。

## D4 Details

| Sub-item | Score | Evidence |
|----------|-------|----------|
| JSON 可解析 | 1/1 | 9 个 `json` 代码块全部通过 JSON.parse 验证，0 错误 |
| Section type 合规 | 1/1 | 只使用 5 种允许类型: actions, bar_list, metrics, outline, text |
| 无禁止 widget | 1/1 | grep 计数 = 0（FormCollect/TreeSelector/MetricDashboard/BarList 均未出现） |
| show_info_card 示例 | 1/1 | 7 个不同场景的 JSON 示例：方案推荐(L412)、提交确认(L440)、申请状态(L464)、代课候选(L495)、课表概览(L532)、无可用时段(L257)、硬冲突(L308) |
| suggest_actions 使用 | 1/1 | L571-591: 含 label + prompt + skill_hint 的完整结构；L383-398 取消后操作也有 skill_hint |

## D5 Details

| Sub-item | Score | Evidence |
|----------|-------|----------|
| solution.json 可解析 | 1/1 | `node -e "JSON.parse(...)"` → VALID |
| Skill slug 注册 | 1/1 | `skills` 数组含 `{ "slug": "reschedule-class" }` |
| Session template 更新 | 1/1 | `lesson-planning.enabledSkills` 含 `"reschedule-class"` |
| 工具名一致性 | 1/1 | SKILL.md 引用的 6 个 timetable 工具名在 mcp-server 中全部有定义（各 ≥2 处匹配） |
| tsc 通过 | 1/1 | `npx tsc --noEmit` 零错误 |

**额外检查**: 已有工具未被修改 — `curriculum_tree`, `student_proficiency` 定义完整存在（grep 确认）。solution.json `appendSystemPrompt` 包含调课技能的完整调用规范作为额外安全网。

## D6 Details

Skipped: E2E config file (`.e2e-config`) 不存在，无法执行 E2E 测试。D1-D5 = 75/75 ≥ 53 已满足激活条件，但缺少 CCAAS 服务连接配置。

D6 = 0/25

## Priority Fix

1. **D6 E2E 激活 (25pts potential)**: 创建 `.e2e-config` 文件配置 CCAAS_URL/TENANT_ID/API_KEY，启动后端服务后执行 6 场景 E2E 测试 — 这是唯一的失分项
2. **solution.json appendSystemPrompt 冗余**: 当前 `appendSystemPrompt` 含大量调课规则重复（与 SKILL.md 重叠），可精简为引用 SKILL.md 的关键强制规则，减少 token 消耗
3. **SKILL.md classIds vs classId 歧义**: sessionContext 定义 `classIds`（数组），但 SKILL.md 多处使用 `classId`（单数）。建议统一为 `classIds` 并在首次 query_schedule 时提取具体 classId
