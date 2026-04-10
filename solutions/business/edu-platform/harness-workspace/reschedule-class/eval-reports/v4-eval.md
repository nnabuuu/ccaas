# v4 Evaluation Report

## Pre-gate
- tsc --noEmit: **PASS** (0 errors)

## 总分: 75/100

| # | Dimension | Rating | Score | Notes |
|---|-----------|--------|-------|-------|
| D1 | 工具决策树清晰度 | 5/5 | 20/20 | 完整的意图解析树、歧义处理、工具表、调用序列、Context 感知 |
| D2 | 动态 Mock 正确性 | 5/5 | 20/20 | 共享数据模型、动态推算、交叉验证、matchScore 公式全部到位 |
| D3 | 确认流程严密性 | 5/5 | 15/15 | 硬性门控、摘要卡片、显式按钮、批量逐项、取消/修改路径完整 |
| D4 | 输出格式合规性 | 5/5 | 10/10 | 9 个 JSON 块全部合法、section type 合规、无禁止 widget |
| D5 | 集成正确性 | 5/5 | 10/10 | solution.json 合法、skill 注册、template 更新、工具名一致、tsc 通过 |
| D6 | E2E 教师体验 | 0/6 | 0/25 | Activated (D1-D5 = 75/75 ≥ 53)，但无 E2E 测试基础设施可执行 |

## D1 Details

### Sub-item Scoring (5/5 × 4 = 20/20)

| # | Sub-item | Score | Evidence |
|---|----------|-------|----------|
| 1 | 意图解析树完整 | 1 | SKILL.md:24-39 — 决策树覆盖 swap/substitute/reschedule/makeup 4 种类型，各有明确触发关键词 |
| 2 | 歧义处理 | 1 | SKILL.md:31-35 + 121-153 — 模糊描述（"有事/想想办法"）先 query_schedule 查课表，逐课分析后按优先级推荐方案类型 |
| 3 | 工具使用表完整 | 1 | SKILL.md:486-497 — 8 个工具全部列出（6 timetable + show_info_card + suggest_actions），含用途和调用时机 |
| 4 | 调用序列明确 | 1 | 每种类型有完整的 step-by-step 序列：swap(48-67), substitute(72-91), reschedule(97-105), makeup(109-119) |
| 5 | Context 感知 | 1 | SKILL.md:12-18 — 明确从 sessionContext 获取 teacherId/teacherName/subject/classIds |

**质量点评**: 决策树结构清晰，使用缩进树形图展示分流逻辑。歧义处理不仅有分流逻辑还有详细的 5 步处理流程，包含逐课分析的优先级排序（代课优先 → 互换 → 改时 → 补课兜底）。与 v3 相比，整体结构已经非常成熟。

## D2 Details

### Sub-item Scoring (5/5 × 4 = 20/20)

| # | Sub-item | Score | Evidence |
|---|----------|-------|----------|
| 1 | 共享数据模型 | 1 | `index.ts:264-347` — `TEACHERS`(7人) + `SCHEDULE`(70+条) + `ROOM_EVENTS` + `SUBMITTED_REQUESTS`，统一数据源 |
| 2 | query_schedule 正确查询 | 1 | `index.ts:882-922` — `SCHEDULE.filter(e => e.teacherId === teacherId)` + `.filter(e => e.classId === classId)` + sort |
| 3 | find_available_slots 动态推算 | 1 | `index.ts:924-1029` — 双重循环 day×period，排除 teacher busy + class busy，检查 room events + soft conflicts |
| 4 | check_conflicts 交叉验证 | 1 | `index.ts:1032-1129` — Swap-aware `vacatedKeys` 逻辑，检查 teacher_busy/class_busy/room_event(hard) + subject_overload(soft) |
| 5 | find_substitute_teachers 计算排序 | 1 | `index.ts:1264-1274` — `matchScore = subjectMatch(40) + taughtThisClass(30) + availability(20) + historyBonus(max10)` |

**质量点评**:
- **亮点**: `check_conflicts` 的 `vacatedKeys` 逻辑是 swap 场景的关键——互换时原时段被释放，不应计入冲突。这是 v4 相对 v3 的显著进步。
- **亮点**: `find_available_slots` 的 `week >= 50` 模拟考试周/活动周场景，为 E2E S5（无可用时段）提供了可控触发条件。
- **亮点**: matchScore 公式在工具返回值中也输出了（`matchScoreFormula`），增加了透明度。
- **数据量**: 7 教师 × 完整周课表，总计约 73 条 SCHEDULE 记录，覆盖了多种冲突场景。

## D3 Details

### Sub-item Scoring (5/5 × 3 = 15/15)

| # | Sub-item | Score | Evidence |
|---|----------|-------|----------|
| 1 | 变更摘要卡片 | 1 | SKILL.md:254-258 — 明确要求 show_info_card 展示原课时→目标课时、涉及教师、冲突结果；JSON 示例2(347-366) 完整 |
| 2 | 显式确认按钮 | 1 | SKILL.md:259-262 — suggest_actions [确认提交][修改方案][取消]；JSON 示例(461-483) 含 skill_hint |
| 3 | 硬性门控 | 1 | SKILL.md:250 — "⚠️ 在用户选择确认之前，禁止调用 timetable_submit_request"；206 — "⚠️ 绝对禁止调用 timetable_submit_request"(hard 冲突时) |
| 4 | 批量逐项确认 | 1 | SKILL.md:264 + 139-142 — 多节课逐条列出 + 逐项 check_conflicts + 逐项 submit_request |
| 5 | 取消/修改路径 | 1 | SKILL.md:272-312 — "修改方案"回到对应步骤重新搜索；"取消"确认后提供 suggest_actions 后续操作 |

**质量点评**: 确认流程是三道门：(1) show_info_card 摘要 → (2) suggest_actions 显式按钮 → (3) 硬性文字禁令。硬冲突场景还有额外的绝对禁止。取消/修改路径的处理非常完整，按调课类型分别回到对应步骤。

## D4 Details

### Sub-item Scoring (5/5 × 2 = 10/10)

| # | Sub-item | Score | Evidence |
|---|----------|-------|----------|
| 1 | JSON 可解析 | 1 | 9 个 JSON 块全部通过 `JSON.parse` 验证 |
| 2 | Section type 合规 | 1 | 只使用 `actions`, `bar_list`, `metrics`, `outline`, `text` — 全部在允许列表内 |
| 3 | 无禁止 widget | 1 | grep FormCollect/TreeSelector/MetricDashboard/BarList = 0 匹配 |
| 4 | show_info_card 示例丰富 | 1 | 7 个 show_info_card JSON 示例：方案推荐、提交确认、申请状态、代课候选(bar_list)、课时概览(outline)、无可用时段、硬冲突 |
| 5 | suggest_actions 使用正确 | 1 | JSON 示例(461-483) 含 label + prompt + skill_hint；取消流程(290-305) 也有正确格式 |

**质量点评**: JSON 示例数量从 v3 的水平进一步丰富到 7 个场景，覆盖了正常流程和异常流程。bar_list(代课匹配度) 和 outline(课时概览) 的使用恰当。

## D5 Details

### Sub-item Scoring (5/5 × 2 = 10/10)

| # | Sub-item | Score | Evidence |
|---|----------|-------|----------|
| 1 | solution.json 可解析 | 1 | `node -e "JSON.parse(...)"` → VALID |
| 2 | Skill slug 注册 | 1 | `skills.some(k=>k.slug==='reschedule-class')` → `true` |
| 3 | Session template 更新 | 1 | `sessionTemplates['lesson-planning'].enabledSkills.includes('reschedule-class')` → `true` |
| 4 | 工具名一致性 | 1 | 6/6 timetable 工具名在 SKILL.md 和 mcp-server 中完全匹配 |
| 5 | tsc 通过 | 1 | `npx tsc --noEmit` → 0 errors |

**检查明细**:
```
timetable_check_conflicts: 2 (definition + handler)
timetable_find_available_slots: 2
timetable_find_substitute_teachers: 2
timetable_list_my_requests: 2
timetable_query_schedule: 2
timetable_submit_request: 2
```

已有工具未被修改（curriculum_tree, student_proficiency, show_info_card, show_step_wizard 等均保持原位）。

## D6 Details

**Status**: Activated (D1-D5 = 75/75 ≥ 53 threshold)

**Cannot execute**: 无 Playwright E2E 测试脚本和运行基础设施。

**Static readiness assessment** (仅供参考，不计分):

| # | 场景 | 代码就绪度 | 关键支撑 |
|---|------|-----------|---------|
| S1 | 简单互换 | High | SKILL.md swap 流程完整 + check_conflicts 有 vacatedKeys swap 感知 |
| S2 | 代课推荐 | High | find_substitute_teachers 有 matchScore 公式 + bar_list 展示 |
| S3 | 模糊描述 | High | 5 步处理流程 + 逐课分析优先级 |
| S4 | 状态查询 | High | list_my_requests 有预置数据(3条不同状态) + summary 统计 |
| S5 | 无可用时段 | High | week >= 50 触发 + 降级建议卡片(3 alternatives) |
| S6 | 硬冲突阻止 | High | ROOM_EVENTS 触发 + "绝对禁止" 门控 + 替代方案搜索 |

**D6 Score: 0/25** (E2E 未执行)

## Priority Fix

1. **D6 E2E 基础设施**: 编写 Playwright 测试脚本实现 6 个场景自动化验证。当前 D1-D5 已满分，25 分 E2E 是唯一提分空间。需要：启动脚本、session 创建 API 调用、消息发送 + AI 响应等待、工具调用日志检查。
2. **find_available_slots 教师参数**: 当前 `excludeTeacherId` 只排除一位教师，但 swap 场景可能需要同时确保两位教师都空闲。建议增加 `includeTeacherIds` 参数支持多教师约束。
3. **SKILL.md 补课场景细化**: makeup 类型的工作流与 reschedule 几乎相同（都是 find_available_slots → check_conflicts → submit），缺少 makeup 特有的逻辑（如：关联原缺课记录、补课时限约束）。当前不影响评分但影响 E2E S3 场景中的补课兜底路径质量。
