# v5 Evaluation Report

## Pre-gate
- tsc --noEmit: **PASS** (0 errors)

## 总分: 75/100

| # | Dimension | Rating | Score | Notes |
|---|-----------|--------|-------|-------|
| D1 | 工具决策树清晰度 | 5/5 | 20/20 | 完整意图解析树、歧义处理、工具表、调用序列、Context 感知均到位 |
| D2 | 动态 Mock 正确性 | 5/5 | 20/20 | 共享数据模型、动态推算、vacatedKeys 交叉验证、matchScore 公式完整 |
| D3 | 确认流程严密性 | 5/5 | 15/15 | 硬性门控、摘要卡片、显式按钮、批量逐项确认、取消/修改路径 |
| D4 | 输出格式合规性 | 5/5 | 10/10 | 8 个 JSON 块全部合法、section type 合规、无禁止 widget、6 个场景示例 |
| D5 | 集成正确性 | 5/5 | 10/10 | solution.json 合法、skill 注册、template 更新、工具名一致、tsc 通过 |
| D6 | E2E 教师体验 | 0/6 | 0/25 | Activated (D1-D5 = 75/75 ≥ 53)，但无 E2E 测试基础设施可执行 |

## D1 Details

### Sub-item Scoring (5/5 × 4 = 20/20)

| # | Sub-item | Score | Evidence |
|---|----------|-------|----------|
| 1 | 意图解析树完整 | 1 | `SKILL.md:24-41` — 决策树覆盖 swap("换课/互换/交换/对调"), substitute("代课/找人代/请假"), reschedule("改时/换时间/移到/调到/挪到"), makeup("补课/补上/补回来") |
| 2 | 歧义处理 | 1 | `SKILL.md:31-35` + `176-207` — 模糊描述("有事/想想办法/帮我安排/出差/开会")先 query_schedule 查课表，逐课按优先级分析（代课→互换→改时→补课兜底），5 步处理流程 |
| 3 | 工具使用表完整 | 1 | `SKILL.md:543-554` — 8 个工具全部列出（6 timetable + show_info_card + suggest_actions），含用途和调用时机 |
| 4 | 调用序列明确 | 1 | 每种类型有完整 step-by-step 序列：swap(49-82), substitute(88-122), reschedule(126-147), makeup(149-173)。v5 新增每种类型的 changes 数据结构示例 |
| 5 | Context 感知 | 1 | `SKILL.md:12-18` — 明确从 sessionContext 获取 teacherId/teacherName/subject/classIds，缺失时先询问 |

**质量点评**: v5 相比 v4 的关键改进是为每种调课类型增加了 changes 结构示例（swap 双条配对变更、substitute 教师替换、reschedule 同教师跨时段、makeup 缺课→补课映射），降低 AI 构造错误请求的风险。find_substitute_teachers 调用规范也增加了 classId 必传说明。

## D2 Details

### Sub-item Scoring (5/5 × 4 = 20/20)

| # | Sub-item | Score | Evidence |
|---|----------|-------|----------|
| 1 | 共享数据模型 | 1 | `index.ts:264-347` — `TEACHERS`(7人) + `SCHEDULE`(72+条,7教师×5天) + `ROOM_EVENTS`(3条) + `SUBMITTED_REQUESTS`(3条预置) |
| 2 | query_schedule 正确查询 | 1 | `index.ts:882-922` — `SCHEDULE.filter(teacherId)` + `.filter(classId)` + `.sort(day,period)`，动态过滤 |
| 3 | find_available_slots 动态推算 | 1 | `index.ts:926-1029` — 双重循环 day×period(1-8)，排除 teacher busy + class busy + room events + soft conflicts(同科同日数)。week≥50 模拟考试周全满 |
| 4 | check_conflicts 交叉验证 | 1 | `index.ts:1032-1151` — **v5 新增 vacatedKeys 机制**：收集所有 changes 的 vacatedTeacherKeys/vacatedClassKeys，teacher_busy/class_busy 检查时跳过已腾出时段。检测 hard(teacher_busy/class_busy/room_event) + soft(subject_overload) |
| 5 | find_substitute_teachers 计算排序 | 1 | `index.ts:1268-1312` — matchScore = subjectMatch(40) + taughtThisClass(30) + availability(freeCount/total×20) + historyBonus(min(count×2,10))。按 matchScore 降序排列。公式在返回值中暴露 |

**质量点评**:
- **v5 关键修复**: `check_conflicts` 的 `vacatedKeys` 逻辑（`index.ts:1050-1055`）是 swap 场景正确运行的前提。v4 eval 报告声称已有此逻辑，但 v5 changelog 指出实际不存在并在本轮补上。这修复了 swap 双方互换时的误报 hard 冲突问题。
- `subject_overload` 软冲突计算也做了 vacated entry 减法（`index.ts:1114-1122`），防止 swap 后同科计数偏高。
- 数据量充足：7 教师 × ~10 节/人 ≈ 72 条记录，3 条 ROOM_EVENTS 覆盖不同日期/教室。

## D3 Details

### Sub-item Scoring (5/5 × 3 = 15/15)

| # | Sub-item | Score | Evidence |
|---|----------|-------|----------|
| 1 | 变更摘要卡片 | 1 | `SKILL.md:341-345` — show_info_card 展示原/目标课时+涉及教师+冲突结果。JSON 示例2(`434-455`) 含 metrics(变更类型/涉及教师/冲突) + text(逐行变更详情) |
| 2 | 显式确认按钮 | 1 | `SKILL.md:347-351` — suggest_actions [确认提交][修改方案][取消]。JSON 示例(`519-541`) 含 label+prompt+skill_hint |
| 3 | 硬性门控 | 1 | `SKILL.md:338` — "⚠️ 在用户选择确认之前，禁止调用 timetable_submit_request"。`SKILL.md:293` — "⚠️ 绝对禁止调用 timetable_submit_request"(硬冲突场景) |
| 4 | 批量逐项确认 | 1 | `SKILL.md:352` — "批量调课逐项确认"。`195-196` — 逐课 check_conflicts + 逐项 submit_request |
| 5 | 取消/修改路径 | 1 | `SKILL.md:358-402` — "修改方案"按类型回退到对应步骤；"取消"确认后提供 suggest_actions；"用户更改需求"从新类型重新开始 |

**质量点评**: 确认流程三道门：(1) show_info_card 变更摘要 → (2) suggest_actions 显式按钮 → (3) 硬性文字禁令。硬冲突场景额外加了"绝对禁止"+冲突原因卡片+替代方案搜索。`SKILL.md:353-354` 还加了提交前冲突验证：必须确认最近一次 check_conflicts 结果 severity !== "hard"。

## D4 Details

### Sub-item Scoring (5/5 × 2 = 10/10)

| # | Sub-item | Score | Evidence |
|---|----------|-------|----------|
| 1 | JSON 可解析 | 1 | 8 个 JSON 块全部通过 `JSON.parse` 验证（python3 脚本逐块校验） |
| 2 | Section type 合规 | 1 | 仅使用 `"actions"`, `"metrics"`, `"text"` — 全部在允许列表内（outline/bar_list/metrics/actions/text） |
| 3 | 无禁止 widget | 1 | grep FormCollect/TreeSelector/MetricDashboard/BarList = 0 匹配 |
| 4 | show_info_card 示例丰富 | 1 | 6 个 show_info_card 场景：方案推荐(407)、提交确认(434)、申请状态(457)、代课候选(487)、无可用时段(253)、硬冲突(301)。远超 ≥3 要求 |
| 5 | suggest_actions 使用正确 | 1 | `SKILL.md:519-541` — 确认按钮含 label+prompt+skill_hint。`380-394` — 取消后含 label+prompt+skill_hint |

**质量点评**: v5 相比 v4 减少了 JSON 块数量（9→8），去掉了 bar_list 和 outline 类型的示例。虽然不影响合规性（都是允许类型），但场景多样性略有下降——代课候选排名用 text 而非 bar_list 展示，课时概览用 text 而非 outline。功能上等价但视觉丰富度降低。

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

已有工具未被修改：curriculum_tree(`index.ts:21`), student_proficiency(`index.ts:44`), show_info_card(`index.ts:138`), show_step_wizard(`index.ts:166`), suggest_actions(`index.ts:199`) 等均保持原位。

## D6 Details

**Status**: Activated (D1-D5 = 75/75 ≥ 53 threshold)

**Cannot execute**: 无 Playwright E2E 测试脚本和运行基础设施。

**Static readiness assessment** (仅供参考，不计分):

| # | 场景 | 就绪度 | v5 改进影响 |
|---|------|--------|-----------|
| S1 | 简单互换 | High | **vacatedKeys 修复是关键** — 没有此逻辑 swap 必定误报 hard 冲突。v5 直接解决 S1 阻塞 |
| S2 | 代课推荐 | High | classId 必传规范帮助 AI 正确调用。matchScore 计算透明 |
| S3 | 模糊描述 | High | 5 步处理流程完整。changes 结构示例帮助 AI 构造正确请求 |
| S4 | 状态查询 | High | 3 条预置数据(pending/approved/rejected) + summary 统计 |
| S5 | 无可用时段 | High | week≥50 触发 + 3 个降级建议 + suggest_actions 选择 |
| S6 | 硬冲突阻止 | High | ROOM_EVENTS 触发 + "绝对禁止" 门控 + 自动搜索替代方案 |

**v5 核心价值**: vacatedKeys 修复从根本上解除了 S1 (简单互换) 的阻塞——这是 v4 的隐藏缺陷（eval 报告误判为已存在）。changes 结构示例降低了所有场景的 AI 格式错误风险。

**D6 Score: 0/25** (E2E 未执行)

## v4→v5 Delta Analysis

| 维度 | v4 分数 | v5 分数 | 变化 | 说明 |
|------|--------|--------|------|------|
| D1 | 20/20 | 20/20 | 0 | 新增 changes 结构示例但已满分 |
| D2 | 20/20 | 20/20 | 0 | vacatedKeys 实际新增但 v4 已误判为满分 |
| D3 | 15/15 | 15/15 | 0 | 无变化 |
| D4 | 10/10 | 10/10 | 0 | JSON 块 9→8，去掉 bar_list/outline 但仍合规 |
| D5 | 10/10 | 10/10 | 0 | 无变化 |
| D6 | 0/25 | 0/25 | 0 | 仍无 E2E 基础设施 |
| **总分** | **75** | **75** | **0** | D1-D5 已顶格，D6 仍是唯一提分空间 |

**重要说明**: v5 的实际代码质量显著优于 v4（vacatedKeys 是 swap 场景的关键修复），但由于 v4 eval 对 D2.4 误判为满分，反映在分数上变化为 0。如果 v4 被正确评估（D2.4 = 0），v4 总分应为 16/20 = 71/100，v5 则是真正的 75/100，提升 +4 分。

## Priority Fix

1. **D6 E2E 基础设施** (25 分): D1-D5 已满分 75/75，25 分 E2E 是唯一提分空间。需要：(a) Playwright 测试脚本覆盖 6 场景，(b) 服务启动脚本（backend + mcp-server），(c) Session 创建 + 消息发送 API 调用，(d) AI 响应等待 + 工具调用日志检查逻辑。建议从 S1(简单互换) 和 S4(状态查询) 开始——这两个场景最简单且 mock 数据最完备。
2. **show_info_card 场景多样性**: v5 去掉了 bar_list(代课匹配度) 和 outline(课时概览) 类型示例，所有卡片都只用 metrics+text+actions。建议恢复 bar_list 用于代课候选排名展示——视觉上更直观且平台支持。不影响分数但提升 E2E S2 体验。
3. **find_available_slots 多教师约束**: 当前 `excludeTeacherId` 只排除一位教师。swap 场景需要同时确保两位教师都空闲。建议增加 `includeTeacherIds` 参数，E2E S1 场景中可能暴露此问题。
