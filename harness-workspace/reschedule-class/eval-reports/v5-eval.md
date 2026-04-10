# v5 Evaluation Report

## Pre-gate
- tsc --noEmit: **PASS** (0 errors)

## 总分: 75/100

| # | Dimension | Rating | Score | Notes |
|---|-----------|--------|-------|-------|
| D1 | 工具决策树清晰度 | 5/5 | 20/20 | 完整的意图解析树、歧义处理、工具表、调用链、上下文感知 |
| D2 | 动态 Mock 正确性 | 5/5 | 20/20 | 7 教师共享数据模型，所有工具动态推算，matchScore 有公式 |
| D3 | 确认流程严密性 | 5/5 | 15/15 | 强制门控、批量逐项、取消/修改路径完整 |
| D4 | 输出格式合规性 | 5/5 | 10/10 | JSON 合法，section types 合规，无禁止 widget |
| D5 | 集成正确性 | 5/5 | 10/10 | solution.json 合法，skill 注册，template 更新，工具名一致，tsc 通过 |
| D6 | E2E 教师体验 | 0/6 | 0/25 | 6 场景全部失败 — agent 使用代码探索工具而非 MCP timetable 工具 |

## D1 Details — 工具决策树清晰度 (20/20)

| Sub-item | Score | Finding |
|----------|-------|---------|
| 意图解析树完整 | 4/4 | `SKILL.md:20-41` 决策树覆盖 4 种调课类型 + 模糊描述 + 查询类，每种类型有明确触发关键词（互换: 换课/互换/交换/对调, 代课: 代课/找人代/请假, 改时: 改时/换时间/移到/调到/挪到, 补课: 补课/补上/补回来）|
| 歧义处理存在 | 4/4 | `SKILL.md:175-207` 完整的"模糊描述处理"章节，5 步骤流程：查课表 → 逐课分析（优先级: 代课>互换>改时>补课）→ 展示组合方案 → 教师确认 → 逐项提交。有详细示例对话 |
| 工具使用表完整 | 4/4 | `SKILL.md:543-554` 列出全部 8 个工具（6 timetable + show_info_card + suggest_actions），每个工具有用途和调用时机说明 |
| 调用序列明确 | 4/4 | 4 种类型各有 6-8 步 numbered step-by-step MCP 调用链（swap:49-56, substitute:88-96, reschedule:129-137, makeup:154-161），互换类型还详细说明了双条配对变更结构（`SKILL.md:58-69`） |
| Context 感知 | 4/4 | `SKILL.md:12-18` 明确从 sessionContext 获取 teacherId/teacherName/subject/classIds，有 fallback: "如果没有这些信息，请先询问教师身份"。全文 5 处引用 sessionContext |

**评价**: D1 是本次实现的亮点。决策树结构清晰，关键词分组合理，模糊描述处理流程比 v3/v4 显著改善。互换类型的 vacatedKeys 机制说明（`SKILL.md:58-69`）是高质量细节。

## D2 Details — 动态 Mock 正确性 (20/20)

| Sub-item | Score | Finding |
|----------|-------|---------|
| 共享数据模型存在 | 4/4 | `index.ts:264-347` — TEACHERS(7 教师, ≥5 ✓), SCHEDULE(~72 条完整周课表), ROOM_EVENTS(3 条), SUBMITTED_REQUESTS(3 条预置历史). 统一的 TypeScript 接口: `ScheduleEntry`, `TeacherInfo`, `RescheduleRequest` |
| query_schedule 正确查询 | 4/4 | `index.ts:883-923` — 从 SCHEDULE 动态 filter by teacherId/classId，sort by day→period，返回 totalEntries 统计。非硬编码 |
| find_available_slots 动态推算 | 4/4 | `index.ts:926-1030` — 遍历 days×periods(1-8)，SCHEDULE.some() 检查教师忙碌 + 班级忙碌 + ROOM_EVENTS 硬冲突 + 同日同科 soft 冲突。week≥50 模拟考试周（totalSlots=0）。动态计算空闲教室 |
| check_conflicts 交叉验证 | 4/4 | `index.ts:1033-1152` — 4 类冲突检测: teacher_busy(hard), class_busy(hard), room_event(hard), subject_overload(soft)。**关键亮点**: vacatedTeacherKeys/vacatedClassKeys 机制正确处理互换场景（`index.ts:1047-1055`），避免误报 |
| find_substitute_teachers 计算排序 | 4/4 | `index.ts:1250-1329` — matchScore 公式: subjectMatch(40) + taughtThisClass(30) + availability(freeCount/total×20) + historyBonus(min(count×2,10))。按 matchScore 降序排列。公式在返回数据中也有声明 |

**评价**: D2 实现质量高。所有 6 个工具都基于共享 SCHEDULE/TEACHERS 数据动态推算，没有硬编码返回值。vacatedKeys 互换机制是比较精妙的设计，正确解决了"互换两方同时释放时段"的问题。

## D3 Details — 确认流程严密性 (15/15)

| Sub-item | Score | Finding |
|----------|-------|---------|
| 变更摘要卡片 | 3/3 | `SKILL.md:434-455` 示例2展示完整确认摘要卡片（metrics + text），含变更类型、涉及教师、冲突状态、逐行变更详情。4 种类型工作流中每种都有 show_info_card 步骤 |
| 显式确认按钮 | 3/3 | `SKILL.md:517-541` 明确定义 suggest_actions 三按钮格式: [确认提交] [修改方案] [取消]，每个有 label + prompt + skill_hint |
| 硬性门控语句 | 3/3 | 多处强制禁止: `SKILL.md:338` "⚠️ 在用户选择确认之前，禁止调用 timetable_submit_request"，`SKILL.md:292` "⚠️ 绝对禁止调用 timetable_submit_request"（hard 冲突），`SKILL.md:353` "提交前冲突验证" 门控。工具描述(`index.ts:460`)也内嵌禁止语句 |
| 批量逐项确认 | 3/3 | `SKILL.md:352` "批量调课逐项确认：如果涉及多节课的变更，在摘要中逐条列出"。模糊描述处理步骤5(`SKILL.md:196`) "对每节课分别调用 timetable_check_conflicts 检测冲突，无 hard 冲突的逐项调用 timetable_submit_request" |
| 取消/修改路径 | 3/3 | `SKILL.md:357-401` 完整的"用户反馈处理"章节：修改方案(按调课类型回退到对应步骤)、取消(确认 + 提供后续操作 suggest_actions)、用户更改需求(识别新类型重新开始) |

**评价**: 确认流程设计严密。硬性门控在 SKILL.md 和工具 description 中双重声明，形成防御纵深。批量确认和取消路径都有完整的处理流程。

## D4 Details — 输出格式合规性 (10/10)

| Sub-item | Score | Finding |
|----------|-------|---------|
| JSON 可解析 | 2/2 | 8 个 ````json` 块，人工审查均为合法 JSON（正确的引号、逗号、括号嵌套）|
| Section type 合规 | 2/2 | 使用的 type 值: `"metrics"`, `"text"`, `"actions"` — 全部在允许列表内（outline, bar_list, metrics, actions, text）|
| 无禁止 widget | 2/2 | FormCollect=0, TreeSelector=0, MetricDashboard=0, BarList=0 |
| show_info_card 示例 ≥ 3 | 2/2 | 7 个完整 show_info_card JSON 示例: 无可用时段(`SKILL.md:254`), 硬冲突(`SKILL.md:303`), 方案推荐(`SKILL.md:407`), 提交确认(`SKILL.md:437`), 申请状态(`SKILL.md:459`), 代课教师(`SKILL.md:489`), 取消操作(`SKILL.md:379`) |
| suggest_actions 使用正确 | 2/2 | `SKILL.md:517-541` 规范格式 (label + prompt + skill_hint)，多处使用正确 |

**评价**: 格式完全合规。7 个 show_info_card 示例覆盖了所有主要场景，远超 ≥3 的要求。

## D5 Details — 集成正确性 (10/10)

| Sub-item | Score | Finding |
|----------|-------|---------|
| solution.json 可解析 | 2/2 | `node -e "JSON.parse(...)"` → VALID |
| Skill slug 注册 | 2/2 | `solution.json:28` — `{ "slug": "reschedule-class", "name": "reschedule-class" }` |
| Session template 更新 | 2/2 | `solution.json:20` — `enabledSkills` 包含 `"reschedule-class"`。`appendSystemPrompt` 包含完整的调课工作流摘要(关键词→类型映射, 6 步工具调用流程, ⚠️ 强制规则) |
| 工具名一致性 | 2/2 | 全部 6 个 timetable 工具在 SKILL.md 和 index.ts 中名称完全一致（timetable_query_schedule, timetable_find_available_slots, timetable_check_conflicts, timetable_submit_request, timetable_list_my_requests, timetable_find_substitute_teachers）|
| tsc 通过 | 2/2 | `npx tsc --noEmit` → 0 errors |

**评价**: 集成完整无误。v5 的 appendSystemPrompt 比 v4 更详细，包含了完整的调课工作流摘要作为 fallback。已有工具（curriculum_tree, student_proficiency）未受影响。

## D6 Details — E2E 教师体验 (0/25)

**D1-D5 = 75/75 ≥ 53 → E2E 激活**

E2E 配置: CCAAS_URL=http://localhost:3001, TENANT_ID=fe322e3c..., 服务器健康检查 200 OK。

| # | 场景 | 用户消息 | 结果 | 分值 |
|---|------|---------|------|------|
| S1 | 简单互换 | "我下周二第3节数学课和周四第5节想互换一下" | **FAIL** — agent 使用 Read/Bash/Grep/Glob 探索代码，未调用任何 MCP timetable 工具 | 0/4 |
| S2 | 代课推荐 | "我下周三请假，帮我找个代课老师上第2节数学课" | **FAIL** — agent 使用 Read/Bash/Grep/Glob 探索代码，未调用 timetable_find_substitute_teachers | 0/4 |
| S3 | 模糊描述 | "下周有事，数学课帮我想办法" | **FAIL** — agent 回复了澄清问题"是想调课还是想迭代代码"，未调用任何工具 | 0/4 |
| S4 | 状态查询 | "查一下我之前提的调课申请状态" | **FAIL** — agent 回复"Let me search for your rescheduling-related issues in Linear"，未调用 timetable_list_my_requests | 0/4 |
| S5 | 无可用时段 | "我想把周一到周五所有数学课都换到周六" | **FAIL** — agent 使用 Agent(Explore) 探索 reschedule-class 代码实现，未调用 timetable_find_available_slots | 0/4.5 |
| S6 | 硬冲突阻止 | "把周一第1节和第2节都换到周三第1节" | **FAIL** — agent 使用 Read 读取 EVAL_CRITERIA.md，未调用 timetable_check_conflicts | 0/4.5 |

### 根因分析

全部 6 场景失败的根因一致：**CCAAS 平台的 Agent Engine 未将 SKILL.md 注入为系统提示词**。

证据:
1. `tool_activity` 事件中只有 Read/Bash/Grep/Glob/Agent — 全是 Claude Code 的内置工具，没有任何 MCP 工具调用
2. S3 的回复明确问"是想用调课功能还是想迭代代码"，说明 agent 不知道自己应该扮演"调课助手"角色
3. S4 回复"Let me search in Linear"，说明 agent 在默认 developer 模式下运行
4. S1/S2/S5/S6 都启动了 Explore subagent 搜索 reschedule-class 源码，而非调用 MCP 工具

v5 的 `appendSystemPrompt` fallback 包含了完整的调课工作流摘要，但 agent 仍然没有遵循——这说明 appendSystemPrompt 可能未被正确注入，或被 Claude Code 的默认系统提示覆盖。

### 与 v4 对比

v4 D6=0/25（同样的根因），v5 未改善。appendSystemPrompt 策略未能解决平台层面的 skill 注入问题。

## Priority Fix

1. **[D6/Platform] CCAAS skill-sync 未注入 SKILL.md** — 这是唯一的 blocker，占 25 分。需要确认 `SkillSyncService` 是否将 `skills/reschedule-class/SKILL.md` 的内容作为系统提示词注入到 Agent Engine 的 LLM 上下文中。可能需要检查: (a) skill-sync 是否在 session 创建时触发, (b) SKILL.md 内容是否被放到 system prompt 或 `.claude/skills/` 目录, (c) Agent Engine (Claude Code) 是否读取了这些 skill 文件
2. **[D6/Platform] appendSystemPrompt 未生效** — `solution.json` 中的 `appendSystemPrompt` 包含了完整调课指令，但 agent 仍然表现为开发者模式。需要验证 `templateName: "lesson-planning"` 是否正确应用到新建 session，以及 appendSystemPrompt 是否被传递到 LLM 的 system prompt 中
3. **[D1-D5] 无显著改进空间** — D1-D5 全满分（75/75），代码质量和文档质量已达上限。进一步分数提升完全依赖 D6（平台层修复）
