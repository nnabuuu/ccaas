# v3 Evaluation Report

## Pre-gate
- tsc --noEmit: **PASS** (0 errors)

## 总分: 75/100

| # | Dimension | Rating | Score | Notes |
|---|-----------|--------|-------|-------|
| D1 | 工具决策树清晰度 | 5/5 | 20/20 | 完整的意图解析树、歧义处理、工具表、调用序列、Context 感知 |
| D2 | 动态 Mock 正确性 | 5/5 | 20/20 | 共享 SCHEDULE/TEACHERS 数据，所有工具动态推算，matchScore 有公式 |
| D3 | 确认流程严密性 | 5/5 | 15/15 | 硬性门控语句明确，变更摘要+确认按钮+批量逐项+取消修改路径全覆盖 |
| D4 | 输出格式合规性 | 5/5 | 10/10 | 8 个 JSON 块全部可解析，section type 合规，无禁止 widget |
| D5 | 集成正确性 | 5/5 | 10/10 | solution.json 合法，skill 注册，template 更新，工具名一致，tsc 通过 |
| D6 | E2E 教师体验 | 0/6 | 0/25 | 已激活(D1-D5=75/75≥53)，但 session 未加载 skill/MCP 上下文 |

## D1 Details — 工具决策树清晰度 (20/20)

| Sub-item | Score | Evidence |
|----------|-------|----------|
| 意图解析树完整 | 1/1 | SKILL.md:24-41 — 完整决策树覆盖 4 类型 + 模糊 + 查询，每类有触发关键词 |
| 歧义处理 | 1/1 | SKILL.md:175-207 — "模糊描述处理"独立章节，5 步流程：查课表→逐课分析→按优先级推荐→展示组合方案→逐项提交 |
| 工具使用表完整 | 1/1 | SKILL.md:543-554 — 8 个工具全部列出(6 timetable + show_info_card + suggest_actions)，含用途和调用时机 |
| 调用序列明确 | 1/1 | 4 种类型各有 6-8 步 step-by-step 调用链，含示例对话和变更结构 |
| Context 感知 | 1/1 | SKILL.md:12-18 — 明确列出 sessionContext 字段(teacherId/teacherName/subject/classIds)，有 fallback 逻辑 |

**观察**: SKILL.md 结构清晰，决策树用 ASCII 图形表示，每种类型有独立章节和示例对话。歧义处理章节特别详细，包含按优先级尝试不同方案类型的逻辑。

## D2 Details — 动态 Mock 正确性 (20/20)

| Sub-item | Score | Evidence |
|----------|-------|----------|
| 共享数据模型 | 1/1 | index.ts:264-347 — `TEACHERS`(7 教师) + `SCHEDULE`(~70 条课表记录) + `ROOM_EVENTS`(3 条)，统一命名空间 |
| query_schedule 正确查询 | 1/1 | index.ts:883-922 — 从 SCHEDULE filter by teacherId/classId，sort by day+period，返回 totalEntries |
| find_available_slots 动态推算 | 1/1 | index.ts:926-1030 — 遍历 day×period，排除教师忙(.some)、班级忙(.some)、教室事件；计算 soft 冲突(同日同科≥2)；动态找空闲教室 |
| check_conflicts 交叉验证 | 1/1 | index.ts:1033-1152 — **亮点：vacatedKeys 机制**处理互换配对（两条变更互为镜像时不误报冲突），检测 teacher_busy(hard) + class_busy(hard) + room_event(hard) + subject_overload(soft) |
| find_substitute_teachers 计算排序 | 1/1 | index.ts:1288-1298 — matchScore = subjectMatch(40) + taughtThisClass(30) + availability(freeCount/total×20) + historyBonus(min(count×2,10))，公式在代码和响应中均有文档 |

**观察**: 代码质量高。vacatedKeys 机制是一个关键设计——确保互换操作不会在 check_conflicts 中产生误报。所有工具从同一 SCHEDULE 数据源查询，交叉一致性有保证。week≥50 的考试周模拟是巧妙的边界测试设计。

## D3 Details — 确认流程严密性 (15/15)

| Sub-item | Score | Evidence |
|----------|-------|----------|
| 变更摘要卡片 | 1/1 | SKILL.md:434-455 — "调课变更确认"卡片包含变更详情(原课时→目标、涉及教师、冲突状态)，每种工作流均有 show_info_card 步骤 |
| 显式确认按钮 | 1/1 | SKILL.md:517-541 — suggest_actions 含 [确认提交]+[修改方案]+[取消]，每个 action 有 label+prompt+skill_hint |
| 硬性门控 | 1/1 | SKILL.md:338 — **"⚠️ 在用户选择确认之前，禁止调用 timetable_submit_request。"** + 293:"绝对禁止调用 timetable_submit_request" |
| 批量逐项确认 | 1/1 | SKILL.md:352 — "批量调课逐项确认：如果涉及多节课的变更，在摘要中逐条列出每节课的变更详情" + 模糊描述处理中 195-196:"对每节课分别调用 check_conflicts" |
| 取消/修改路径 | 1/1 | SKILL.md:357-398 — "修改方案"路径（按类型回到对应步骤），"取消"路径（确认取消+提供后续 suggest_actions），"更改需求"路径（识别新类型从头开始） |

**观察**: 确认流程是该 Skill 的核心安全机制。三重防线设计：(1) 每次提交前必须 show_info_card 展示摘要；(2) suggest_actions 强制显式确认；(3) 硬性门控语句用 ⚠️ 标记，措辞明确("禁止""绝对禁止")。硬冲突阻止流程(SKILL.md:287-334)更是在 severity=hard 时完全阻断提交路径。

## D4 Details — 输出格式合规性 (10/10)

| Sub-item | Score | Evidence |
|----------|-------|----------|
| JSON 可解析 | 1/1 | 8 个 JSON 块全部通过 json.loads()，无尾逗号、引号错误 |
| Section type 合规 | 1/1 | 使用的类型: "actions", "metrics", "text" — 均在允许列表(outline/bar_list/metrics/actions/text)内 |
| 无禁止 widget | 1/1 | grep FormCollect/TreeSelector/MetricDashboard/BarList = 0 |
| show_info_card 示例丰富 | 1/1 | 6 个示例：方案推荐(407)、提交确认(436)、申请状态(459)、代课候选(490)、无可用时段(254)、硬冲突(303) — 远超≥3 的要求 |
| suggest_actions 使用正确 | 1/1 | 含 label + prompt + 可选 skill_hint(380-394, 517-541)，格式正确 |

**观察**: JSON 质量高，所有示例都可直接用于前端渲染。未使用 bar_list 和 outline 类型（虽然允许），这减少了复杂度但也意味着代课候选列表没有使用 bar_list 可视化——用 text section 的 markdown 格式替代，功能等价。

## D5 Details — 集成正确性 (10/10)

| Sub-item | Score | Evidence |
|----------|-------|----------|
| solution.json 可解析 | 1/1 | `node -e "JSON.parse(...)"` → VALID |
| Skill slug 注册 | 1/1 | `skills.some(k=>k.slug==='reschedule-class')` → true |
| Session template 更新 | 1/1 | `sessionTemplates['lesson-planning'].enabledSkills.includes('reschedule-class')` → true |
| 工具名一致性 | 1/1 | SKILL.md 中 6 个 timetable 工具名在 index.ts 中均有定义(definition+handler 各 1 处) |
| tsc 通过 | 1/1 | `npx tsc --noEmit` → 0 errors |

**观察**: 集成无缺陷。已有工具(curriculum_tree, student_proficiency 等)未被修改(grep 验证)。solution.json 格式简洁，skills 数组和 sessionTemplate 均正确更新。

## D6 Details — E2E 教师体验 (0/25)

**状态**: 已激活 (D1-D5 = 75/75 ≥ 53)

**执行结果**: E2E 基础设施可达(CCAAS 健康检查 200, .e2e-config 存在)，但 session 未正确加载 skill/MCP 上下文。

**具体问题**:
- S1 (简单互换): session 创建成功，SSE 流正常，但 AI 使用 Bash/Read/Agent 探索文件系统，而非调用 timetable MCP 工具。90 秒超时未完成。
- S2-S6: 因 S1 超时未执行。

**根因分析**:
SSE 响应中 `tool_activity` 事件显示 AI 调用了 `Bash`(28 次)、`Read`(36 次)、`Agent`(1 次)，timetable_* 在输出中的出现(~120 次)来自 AI 读取 SKILL.md 和 index.ts 文件内容，**不是** MCP 工具调用。

原因推测:
1. 技能注入(inject_skills)可能未将 SKILL.md 内容正确加载为 session 的系统提示词
2. MCP server 注入(inject_mcp_servers)可能未将 timetable 工具注册为 session 可调用的 MCP 工具
3. templateName="lesson-planning" 在请求体中传递，但可能未触发 skill 上下文加载

**影响**: 这是 E2E 基础设施配置问题，不影响 SKILL.md 和 index.ts 的代码质量评估。D1-D5 静态审查已验证代码正确性。

| # | 场景 | 结果 | 分值 |
|---|------|------|------|
| S1 | 简单互换 | FAIL — AI 未调用 timetable MCP 工具 | 0/4 |
| S2 | 代课推荐 | 未执行 | 0/4 |
| S3 | 模糊描述 | 未执行 | 0/4 |
| S4 | 状态查询 | 未执行 | 0/4 |
| S5 | 无可用时段 | 未执行 | 0/4.5 |
| S6 | 硬冲突阻止 | 未执行 | 0/4.5 |

## Priority Fix

1. **D6/E2E 基础设施**: session 未加载 skill/MCP 上下文。需排查 inject_skills 和 inject_mcp_servers 是否正确将 reschedule-class SKILL.md 注入为系统提示词、timetable MCP 工具注册为可调用工具。这是获得 D6 分数（最高 +25 分）的前提。
2. **E2E 超时**: 即使 skill 上下文正确加载，90 秒可能不足以完成完整的多轮工具调用。考虑增加超时到 120-180 秒，或使用 autoClose=true 避免 session 挂起。
3. **无当前代码质量问题**: D1-D5 全部满分(75/75)，SKILL.md 和 index.ts 代码质量无需修改。瓶颈完全在 E2E 基础设施配置。
