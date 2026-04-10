# v4 Evaluation Report

## Pre-gate
- tsc --noEmit: **PASS** (0 errors)

## 总分: 75/100

| # | Dimension | Rating | Score | Notes |
|---|-----------|--------|-------|-------|
| D1 | 工具决策树清晰度 | 5/5 | 20/20 | 完整意图树 + 歧义处理 + 工具表 + 调用链 + Context |
| D2 | 动态 Mock 正确性 | 5/5 | 20/20 | 共享数据模型 + 全部动态推算 + matchScore 公式 |
| D3 | 确认流程严密性 | 5/5 | 15/15 | 硬性门控 + 摘要卡片 + 确认按钮 + 批量逐项 + 取消路径 |
| D4 | 输出格式合规性 | 5/5 | 10/10 | 13 个 JSON 全部合法 + section type 合规 + 无禁止 widget |
| D5 | 集成正确性 | 5/5 | 10/10 | solution.json 合法 + slug 注册 + template 更新 + 工具名一致 + tsc 通过 |
| D6 | E2E 教师体验 | 0/6 | 0/25 | 已激活（D1-D5=75/75≥53），但 CCAAS 未加载 skill prompt，AI 用 Claude Code 工具探索代码库而非调用 MCP timetable 工具。基础设施部署问题，非代码质量问题 |

## D1 Details — 工具决策树清晰度 (20/20)

| 子项 | 分值 | 结果 |
|------|------|------|
| 意图解析树完整 | 4/4 | ✅ 4 种类型各有触发关键词：swap("换课/互换/交换/对调")、substitute("代课/找人代/请假")、reschedule("改时/换时间/移到/调到")、makeup("补课/补上/补回来") |
| 歧义处理 | 4/4 | ✅ 决策树含"模糊描述"分支（"有事/想想办法/帮我安排"），专门"模糊描述处理"章节含 5 步流程：查课表→逐课分析→展示组合方案→确认→逐项提交 |
| 工具使用表完整 | 4/4 | ✅ 底部"工具使用表"列出全部 8 个工具（6 timetable + show_info_card + suggest_actions），含用途和调用时机 |
| 调用序列明确 | 4/4 | ✅ 4 种类型各有 step-by-step 序列。swap 8 步含双方课表查询；substitute 8 步含候选筛选；reschedule/makeup 各 8 步含空闲搜索 |
| Context 感知 | 4/4 | ✅ "从 sessionContext 中获取当前教师信息：teacherId、teacherName、subject、classIds"，明确不要求手动输入 |

**亮点**: changes 数据结构指南独立成章，swap 类型明确要求 2 条配对 changes 并解释 vacatedKeys 机制避免误报。

## D2 Details — 动态 Mock 正确性 (20/20)

| 子项 | 分值 | 结果 |
|------|------|------|
| 共享数据模型 | 4/4 | ✅ `TEACHERS` 7 人（≥5）+ `SCHEDULE` 完整周课表（~70 条），含 `ROOM_EVENTS` 和 `SUBMITTED_REQUESTS` 预置数据 |
| query_schedule 正确 | 4/4 | ✅ `index.ts:908-951` 按 teacherId/classId 从 SCHEDULE 过滤 + resolveTeacher 模糊匹配（支持 "t-wang"、"teacher-wang"、"王老师"） |
| find_available_slots 动态 | 4/4 | ✅ `index.ts:954-1062` 双层循环 days×periods，排除教师忙碌 (`SCHEDULE.some`)、班级忙碌、ROOM_EVENTS 硬冲突、soft 冲突（同日同科≥2），动态查找空闲教室 |
| check_conflicts 交叉验证 | 4/4 | ✅ `index.ts:1064-1162` vacatedKeys 机制（swap 感知）+ virtualSchedule 排除已释放时段 → 检测 teacher_busy(hard)、class_busy(hard)、room_event(hard)、subject_overload(soft) |
| find_substitute_teachers 计算 | 4/4 | ✅ `index.ts:1262-1346` 公式：subjectMatch(40) + taughtThisClass(30) + (freeCount/totalSlots×20) + min(historyCount×2, 10)，按 matchScore 降序排列，公式随响应返回 |

**亮点**: week≥50 模拟考试周（所有时段占满）用于测试"无可用时段"场景。resolveTeacher 模糊匹配增强容错性。

## D3 Details — 确认流程严密性 (15/15)

| 子项 | 分值 | 结果 |
|------|------|------|
| 变更摘要卡片 | 3/3 | ✅ 每种类型流程在 submit 前均有 `show_info_card` 展示变更详情。示例2（提交确认摘要）含原课时→目标课时、涉及教师、冲突状态 |
| 显式确认按钮 | 3/3 | ✅ `suggest_actions` 提供 [确认提交] [修改方案] [取消] 三按钮，含 skill_hint |
| 硬性门控 | 3/3 | ✅ 专门"确认门控（强制规则）"章节：`"⚠️ 在用户选择确认之前，禁止调用 timetable_submit_request"` + 硬冲突时 `"⚠️ 绝对禁止调用 timetable_submit_request"` |
| 批量逐项确认 | 3/3 | ✅ `"批量调课逐项确认：如果涉及多节课的变更，在摘要中逐条列出每节课的变更详情"` + 模糊描述步骤5逐项 check_conflicts → 逐项 submit |
| 取消/修改路径 | 3/3 | ✅ 专门"用户反馈处理"章节覆盖：修改方案（回到对应步骤）、取消（确认+后续选项）、更改需求（重新识别类型） |

## D4 Details — 输出格式合规性 (10/10)

| 子项 | 分值 | 结果 |
|------|------|------|
| JSON 可解析 | 2/2 | ✅ 13 个 JSON 代码块全部通过 `json.loads()` 验证 |
| Section type 合规 | 2/2 | ✅ 仅使用 5 种允许类型：`actions`、`bar_list`、`metrics`、`outline`、`text` |
| 无禁止 widget | 2/2 | ✅ grep 结果为 0（FormCollect/TreeSelector/MetricDashboard/BarList） |
| show_info_card 示例 | 2/2 | ✅ 7 个不同场景示例：方案推荐、提交确认、申请状态、代课候选(bar_list)、受影响课时(outline)、无可用时段、硬冲突 |
| suggest_actions 正确 | 2/2 | ✅ 专门"suggest_actions 使用规范"章节，示例含 label + prompt + skill_hint |

## D5 Details — 集成正确性 (10/10)

| 子项 | 分值 | 结果 |
|------|------|------|
| solution.json 可解析 | 2/2 | ✅ `node -e "JSON.parse(...)"` → VALID |
| Skill slug 注册 | 2/2 | ✅ `skills` 数组含 `{ "slug": "reschedule-class" }` |
| Session template 更新 | 2/2 | ✅ `lesson-planning.enabledSkills` 包含 `"reschedule-class"` |
| 工具名一致性 | 2/2 | ✅ SKILL.md 中 6 个 timetable 工具名在 index.ts 中全部有定义（每个≥2次匹配） |
| tsc 通过 | 2/2 | ✅ `npx tsc --noEmit` 零错误 |

**附加验证**: 现有工具未被修改 — `curriculum_tree`、`student_proficiency` 等定义和 handler 保持原样。`appendSystemPrompt` 含调课相关指引。

## D6 Details — E2E 教师体验 (0/25)

**状态**: 已激活（D1-D5 = 75/75 ≥ 53）

**E2E 配置**: `.e2e-config` 存在，CCAAS_URL=http://localhost:3001，健康检查 200 OK。

**结果**: 0/25 — **基础设施部署问题**

**S1 测试详情**:
- Session 创建：`POST /api/v1/sessions` 返回 404（该端点不存在）
- 改用 `POST /api/v1/sessions/:sessionId/messages` 自动创建 session + 发送消息
- 请求包含 `templateName: "lesson-planning"` + context
- **观察到的行为**：AI 启动 Claude Code Explore agent，使用 Bash/Glob/Grep/Read 探索代码库（搜索 "reschedule" 相关文件），而非调用 MCP timetable 工具
- **实际 tool 调用**：Agent, Bash, Glob, Grep, Read（Claude Code 内置工具）
- **期望 tool 调用**：timetable_query_schedule, show_info_card, suggest_actions（MCP 工具）
- 90 秒超时，无 `done` 事件

**根因分析**: CCAAS agent engine 未将 `reschedule-class/SKILL.md` 加载为 AI 的系统提示。AI 不知道 timetable MCP 工具的存在，因此用通用代码探索工具尝试理解请求。这是平台 skill-sync 机制的部署问题，非 SKILL.md 或 index.ts 的代码质量问题。

| # | 场景 | 结果 | 分值 | 说明 |
|---|------|------|------|------|
| S1 | 简单互换 | FAIL | 0/4 | AI 探索代码库而非调用 timetable 工具 |
| S2 | 代课推荐 | SKIP | 0/4 | 未测试（S1 已确认基础设施问题） |
| S3 | 模糊描述 | SKIP | 0/4 | 未测试 |
| S4 | 状态查询 | SKIP | 0/4 | 未测试 |
| S5 | 无可用时段 | SKIP | 0/4.5 | 未测试 |
| S6 | 硬冲突阻止 | SKIP | 0/4.5 | 未测试 |

## Priority Fix

1. **D6 基础设施**: CCAAS skill-sync 需确保 `reschedule-class/SKILL.md` 被加载为 AI agent 的系统提示。当前 AI 完全不知道 timetable MCP 工具的存在。这是获得 D6 分数的前提条件，价值 25 分。
2. **D6 session API**: 评估脚本使用 `POST /api/v1/sessions` 创建 session，但该端点不存在（404）。需要添加 session 创建端点或更新评估脚本使用正确的 API 路径（`POST /api/v1/sessions/:sessionId/messages` with `templateName`）。
3. **无代码质量修复**: D1-D5 全部满分（75/75）。SKILL.md 决策树完整、MCP 工具动态推算正确、确认门控严密、JSON 格式合规、集成配置正确。当前瓶颈完全在基础设施层面。
