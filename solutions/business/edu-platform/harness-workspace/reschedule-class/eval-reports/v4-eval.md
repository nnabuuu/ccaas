# v4 Evaluation Report

## Pre-gate
- tsc --noEmit: **PASS** (0 errors)

## 总分: 75/100

| # | Dimension | Rating | Score | Notes |
|---|-----------|--------|-------|-------|
| D1 | 工具决策树清晰度 | 5/5 | 20/20 | 完整的意图解析树 + 歧义处理 + 工具使用表 + 调用序列 + Context 感知 |
| D2 | 动态 Mock 正确性 | 5/5 | 20/20 | 共享 SCHEDULE 数据 + 所有工具动态推算 + matchScore 公式 + vacatedKeys swap 感知 |
| D3 | 确认流程严密性 | 5/5 | 15/15 | 硬性门控 + 变更摘要卡片 + 显式确认按钮 + 批量逐项确认 + 取消/修改路径 |
| D4 | 输出格式合规性 | 5/5 | 10/10 | 8 个 JSON 块全部可解析 + section type 合规 + 无禁止 widget + 6 个 show_info_card 示例 |
| D5 | 集成正确性 | 5/5 | 10/10 | solution.json 合法 + skill 注册 + template 更新 + 工具名一致 + tsc 通过 |
| D6 | E2E 教师体验 | 0/6 | 0/25 | Skipped: QUOTA_EXCEEDED (月度 token 配额已用完 200,683/200,000) |

## D1 Details: 工具决策树清晰度 (20/20)

| Sub-item | Score | Evidence |
|----------|-------|----------|
| 意图解析树完整 | 1/1 | SKILL.md:23-41 — 决策树涵盖 4 种明确类型 (swap/substitute/reschedule/makeup) + 模糊描述 + 查询类，每种有触发关键词 |
| 歧义处理 | 1/1 | SKILL.md:175-207 — "模糊描述处理"独立章节，5 步强制流程：查课表 → 逐课分析 → 展示组合方案 → 确认 → 逐项提交 |
| 工具使用表完整 | 1/1 | SKILL.md:547-556 — 8 个工具全部列出（6 timetable + show_info_card + suggest_actions），含用途和调用时机说明 |
| 调用序列明确 | 1/1 | 每种类型有编号步骤：swap(SKILL.md:49-82), substitute(86-122), reschedule(126-148), makeup(150-173) |
| Context 感知 | 1/1 | SKILL.md:12-18 明确定义从 sessionContext 获取 teacherId/teacherName/subject/classIds。SKILL.md:213-214 强化 teacherId 获取规则 |

**评价**: 决策树结构清晰完整。亮点：模糊描述处理流程非常详尽（5 步强制执行），互换类型明确要求构造两条配对变更（SKILL.md:57-69）。无明显缺陷。

## D2 Details: 动态 Mock 正确性 (20/20)

| Sub-item | Score | Evidence |
|----------|-------|----------|
| 共享数据模型 | 1/1 | index.ts:264-347 — `TEACHERS`(7人) + `SCHEDULE`(~70条，7教师×5天×多节) + `ROOM_EVENTS`(3条) 共享数据源 |
| query_schedule 正确查询 | 1/1 | index.ts:883-923 — `SCHEDULE.filter(e => e.teacherId === teacherId)` + classId 过滤 + sort by day/period |
| find_available_slots 动态推算 | 1/1 | index.ts:926-1048 — 双重排除：教师 `SCHEDULE.some(teacherBusy)` + 班级 `SCHEDULE.some(classBusy)`，room event 检测，soft conflict (同科同日统计)，空闲教室搜索 |
| check_conflicts 交叉验证 | 1/1 | index.ts:1051-1170 — teacher_busy(hard) + class_busy(hard) + room_event(hard) + subject_overload(soft)。`vacatedTeacherKeys`/`vacatedClassKeys` 机制正确处理互换配对 |
| find_substitute_teachers 计算排序 | 1/1 | index.ts:1306-1316 — 公式: subjectMatch(40) + taughtThisClass(30) + availability(freeCount/total×20) + historyBonus(min(count×2, 10))。按 matchScore 降序排序 |

**评价**: Mock 实现质量高。所有 6 个工具从 SCHEDULE/TEACHERS 共享数据动态推算，无硬编码返回值。特别值得注意：
- `check_conflicts` 的 vacatedKeys 机制 (index.ts:1065-1073) 正确处理互换场景，避免误报教师/班级冲突
- `find_available_slots` 处理了非教学日 (day > 5 过滤, index.ts:933) 和考试周 (week >= 50, index.ts:952)
- 空闲教室搜索 (index.ts:1019-1022) 基于实际占用推算

## D3 Details: 确认流程严密性 (15/15)

| Sub-item | Score | Evidence |
|----------|-------|----------|
| 变更摘要卡片 | 1/1 | SKILL.md:345-348 — 要求展示原课时/目标课时/涉及教师/冲突状态。示例2 (SKILL.md:437-457) 展示完整确认摘要 |
| 显式确认按钮 | 1/1 | SKILL.md:349-352 — suggest_actions 三选项 [确认提交]/[修改方案]/[取消]。示例 (SKILL.md:519-543) 含 label+prompt+skill_hint |
| 硬性门控 | 1/1 | SKILL.md:340 — "⚠️ 在用户选择确认之前，禁止调用 timetable_submit_request。" + SKILL.md:293 "绝对禁止调用 timetable_submit_request" (hard 冲突) |
| 批量逐项确认 | 1/1 | SKILL.md:354 — "批量调课逐项确认：如果涉及多节课的变更，在摘要中逐条列出每节课的变更详情" + 模糊描述步骤5 (SKILL.md:195-196) 逐项 check+submit |
| 取消/修改路径 | 1/1 | SKILL.md:357-403 — 三个子章节：修改方案(363-373 按类型回退)、取消(376-396 含后续 suggest_actions)、更改需求(398-403 重新开始) |

**评价**: 确认流程非常严密。多层防护：
1. 硬性门控语句明确（"禁止"/"绝对禁止"）
2. hard 冲突双重保险：SKILL.md:295 "即使用户要求'直接提交'，也必须拒绝"
3. 工具响应处理规则章节 (SKILL.md:560-566) 强制每次工具调用后立即检查返回数据

## D4 Details: 输出格式合规性 (10/10)

| Sub-item | Score | Evidence |
|----------|-------|----------|
| JSON 可解析 | 1/1 | 8/8 JSON 块全部通过 JSON.parse 验证 |
| Section type 合规 | 1/1 | 使用的类型: actions, metrics, text — 全部在允许列表 {outline, bar_list, metrics, actions, text} 内 |
| 无禁止 widget | 1/1 | grep 结果: FormCollect=0, TreeSelector=0, MetricDashboard=0, BarList=0 |
| show_info_card 示例 ≥3 | 1/1 | 6 个不同场景: 无可用时段卡片、硬冲突卡片、方案推荐(示例1)、提交确认(示例2)、申请状态(示例3)、代课候选(示例4) |
| suggest_actions 使用正确 | 1/1 | 所有 actions 含 label+prompt。取消操作含 skill_hint (SKILL.md:388-395)。确认操作含 skill_hint (SKILL.md:526-542) |

**评价**: 格式完全合规。唯一可改进点：SKILL.md:117 提到 "用 bar_list 展示排名" 但实际 JSON 示例使用 text section 代替。功能等价但风格不统一。这不扣分（bar_list 和 text 都是合法类型），但可考虑在代课候选卡片中实际使用 bar_list section。

## D5 Details: 集成正确性 (10/10)

| Sub-item | Score | Evidence |
|----------|-------|----------|
| solution.json 可解析 | 1/1 | `node -e "JSON.parse(...)"` → VALID |
| Skill slug 注册 | 1/1 | `skills.some(k=>k.slug==='reschedule-class')` → true |
| Session template 更新 | 1/1 | `sessionTemplates['lesson-planning'].enabledSkills.includes('reschedule-class')` → true |
| 工具名一致性 | 1/1 | SKILL.md 引用的 6 个 timetable 工具全部在 index.ts 中有定义 (每个 ≥2 matches) |
| tsc 通过 | 1/1 | `npx tsc --noEmit` → 0 errors |

**补充检查**:
- 已有工具未被修改: curriculum_tree ✅, student_proficiency ✅, show_step_wizard ✅, show_review_panel ✅ (grep count=3, 包含第三个已有 widget)
- solution.json appendSystemPrompt 包含调课技能核心规则摘要，强化 AI 遵守

## D6 Details: E2E 教师体验 (0/25)

**Status**: Skipped — QUOTA_EXCEEDED

**Detail**:
- D1-D5 = 75/75 ≥ 53 threshold → D6 activated
- E2E config found: CCAAS_URL=http://localhost:3001, TENANT_ID=fe322e3c...
- Backend health check: 200 OK
- Session template sync: {"synced":1}
- Message send attempt: HTTP 429 `{"code":"QUOTA_EXCEEDED","message":"Monthly token quota exceeded (200,000 tokens)","used":200683}`
- **All 6 scenarios untested due to quota exhaustion**

| # | Scenario | Result | Score |
|---|----------|--------|-------|
| S1 | 简单互换 | SKIPPED (quota) | 0/4 |
| S2 | 代课推荐 | SKIPPED (quota) | 0/4 |
| S3 | 模糊描述 | SKIPPED (quota) | 0/4 |
| S4 | 状态查询 | SKIPPED (quota) | 0/4 |
| S5 | 无可用时段 | SKIPPED (quota) | 0/4.5 |
| S6 | 硬冲突阻止 | SKIPPED (quota) | 0/4.5 |

## Priority Fix

1. **[D6/Infra] Token 配额不足导致 E2E 无法执行** — 当前月度配额 200,000 tokens 已耗尽 (used: 200,683)。需要增加配额或等待月度重置 (resets 2026-04-30) 才能运行 E2E 验证。这是获取剩余 25 分的唯一阻塞项。D1-D5 静态审查已达满分 75/75。
2. **[D4/Minor] SKILL.md:117 提到 "用 bar_list 展示排名" 但 JSON 示例未使用 bar_list section** — 代课候选教师卡片 (示例4) 用 text section 替代。考虑改为 bar_list 实现以保持描述与示例一致。不影响得分但提升 prompt 自洽性。
3. **[D2/Minor] find_substitute_teachers 的 historyCount 使用启发式推断** — index.ts:1304 `taughtThisClass ? 3 : (subjectMatch ? 1 : 0)` 是合理的 mock 策略，但如果需要更精确的 E2E 测试，可考虑从 SUBMITTED_REQUESTS 动态统计历史代课次数。
