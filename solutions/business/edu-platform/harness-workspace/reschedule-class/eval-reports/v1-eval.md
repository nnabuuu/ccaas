# v1 Evaluation Report

## Pre-gate
- tsc --noEmit: **PASS** (0 errors)

## 总分: 81/100

| # | Dimension | Rating | Score | Notes |
|---|-----------|--------|-------|-------|
| D1 | 工具决策树清晰度 | 5/5 | 20/20 | 完整意图解析树、歧义处理、工具表、调用序列、Context 感知全具备 |
| D2 | 动态 Mock 正确性 | 5/5 | 20/20 | 共享 SCHEDULE 数据、6 工具全动态推算、matchScore 有公式 |
| D3 | 确认流程严密性 | 4/5 | 12/15 | 有完整确认门控和摘要卡片，但取消/修改路径仅声明未给出具体处理 |
| D4 | 输出格式合规性 | 5/5 | 10/10 | 5 个 JSON 块全部可解析、section type 合规、无禁止 widget |
| D5 | 集成正确性 | 5/5 | 10/10 | solution.json 合法、slug 注册、session template 更新、工具名一致、tsc 通过 |
| D6 | E2E 教师体验 | -- | 9/25 | D1-D5 = 72/75 ≥ 53，已激活；但无运行服务栈，仅基于静态代码推断 |

## D1 Details: 工具决策树清晰度 (20/20)

| 子项 | 得分 | 说明 |
|------|------|------|
| 意图解析树完整 | 1 | SKILL.md:24-39 有完整决策树，4 种类型（swap/substitute/reschedule/makeup）各有触发关键词列表 |
| 歧义处理 | 1 | SKILL.md:31-35 + SKILL.md:121-133 模糊描述（"有事/想想办法/帮我安排/出差/开会"）有分流逻辑：先 query_schedule 查课表 → 逐课分析 → 组合方案 |
| 工具使用表完整 | 1 | SKILL.md:309-319 工具使用表列出全部 8 个工具（6 timetable + show_info_card + suggest_actions），含用途和调用时机 |
| 调用序列明确 | 1 | SKILL.md:44-119 每种类型有完整的 step-by-step 调用链，包含具体参数示例 |
| Context 感知 | 1 | SKILL.md:12-18 明确从 sessionContext 获取 teacherId/teacherName/subject/classIds |

**评价**: D1 做得很好。决策树结构清晰（树形图+分支），每种类型有独立的工作流小节，调用序列含具体参数。歧义处理有明确的降级优先级（代课 > 互换 > 改时 > 补课）。

## D2 Details: 动态 Mock 正确性 (20/20)

| 子项 | 得分 | 说明 |
|------|------|------|
| 共享数据模型 | 1 | index.ts:264-347 `TEACHERS`(7人) + `SCHEDULE`(70+条) + `ROOM_EVENTS`(3条) + `SUBMITTED_REQUESTS`(3条)，7 教师 × 完整周课表 |
| query_schedule 正确查询 | 1 | index.ts:882-922 按 teacherId/classId 从 SCHEDULE 过滤，sort by day+period，返回结构化数据 |
| find_available_slots 动态推算 | 1 | index.ts:925-1010 遍历 day×period，排除教师已占用 + 班级已占用，检查 ROOM_EVENTS hard 冲突 + 同科 soft 冲突，查找空闲教室 |
| check_conflicts 交叉验证 | 1 | index.ts:1013-1101 检查 teacher_busy(hard) + class_busy(hard) + room_event(hard) + subject_overload(soft)，从 SCHEDULE 动态查询，返回 overall severity |
| find_substitute_teachers 计算排序 | 1 | index.ts:1198-1277 公式: subjectMatch(40) + taughtThisClass(30) + availability(20) + historyBonus(max10)，遍历 TEACHERS 排除请假人，按 matchScore 降序排序 |

**评价**: Mock 实现质量很高。所有 6 个工具从同一 `SCHEDULE` 数据源推算，逻辑自洽。`find_available_slots` 真实遍历排除占用时段（非硬编码），`check_conflicts` 做 4 种冲突检测，`find_substitute_teachers` 的 matchScore 公式明确且合理。数据量充足（7 教师，含跨年级的赵老师和非数学科的陈老师/孙老师）。

**轻微问题**（不扣分）：
- `historyCount` 是 mock 值（taughtThisClass ? 3 : subjectMatch ? 1 : 0），但在 mock 场景下可接受
- `find_available_slots` 的 soft 冲突检测阈值是 ≥2 节同科才报 soft，与 `check_conflicts` 的阈值一致，逻辑自洽

## D3 Details: 确认流程严密性 (12/15)

| 子项 | 得分 | 说明 |
|------|------|------|
| 变更摘要卡片 | 1 | SKILL.md:157-158 + 示例2(200-221) 提交前用 show_info_card 展示完整变更详情（原课时、目标课时、涉及教师、冲突结果） |
| 显式确认按钮 | 1 | SKILL.md:162-165 + 示例5(289-305) suggest_actions 提供 [确认提交] [修改方案] [取消]，含 skill_hint |
| 硬性门控 | 1 | SKILL.md:153 "⚠️ 在用户选择确认之前，禁止调用 timetable_submit_request。" 明确的硬性门控语句 |
| 批量逐项确认 | 1 | SKILL.md:167 "批量调课逐项确认：如果涉及多节课的变更，在摘要中逐条列出每节课的变更详情" |
| 取消/修改路径 | 0 | SKILL.md:165 提到 [取消] 按钮但未给出用户选择"修改方案"或"取消"后的具体处理流程。无 "用户说不对/换方案时" 的对应处理段落 |

**评价**: 确认流程的正面规则很完善——硬性门控语句、摘要卡片、显式确认按钮都有。但反面路径（用户选择"修改方案"或"取消"后怎么做）没有具体描述。SKILL.md 只有按钮定义，没有 "如果用户选择修改方案 → 回到方案推荐步骤" 这样的流程描述。

## D4 Details: 输出格式合规性 (10/10)

| 子项 | 得分 | 说明 |
|------|------|------|
| JSON 可解析 | 1 | 5 个 `json` 代码块全部通过 JSON.parse 验证 |
| Section type 合规 | 1 | 使用的 type: "metrics", "text", "actions" — 全部在允许列表内（outline/bar_list/metrics/actions/text） |
| 无禁止 widget | 1 | grep FormCollect/TreeSelector/MetricDashboard/BarList = 0 |
| show_info_card 示例丰富 | 1 | 4 个 show_info_card 示例：方案推荐(173-198)、提交确认(202-221)、申请状态(225-251)、代课候选(255-281) — 超过 ≥3 要求 |
| suggest_actions 使用正确 | 1 | 示例5(289-305) 含 label + prompt + skill_hint，格式完全正确 |

**评价**: 输出格式严格合规。4 个 show_info_card 示例覆盖了方案推荐、提交确认、状态查询、代课候选 4 种场景，JSON 全部可解析。section type 仅使用 metrics/text/actions 三种，未使用 outline/bar_list 但不违规。

## D5 Details: 集成正确性 (10/10)

| 子项 | 得分 | 说明 |
|------|------|------|
| solution.json 可解析 | 1 | `node -e "JSON.parse(...)"` → VALID |
| Skill slug 注册 | 1 | solution.json:28 `{ "slug": "reschedule-class", "name": "reschedule-class" }` |
| Session template 更新 | 1 | solution.json:20 enabledSkills 含 "reschedule-class" |
| 工具名一致性 | 1 | SKILL.md 引用的 6 个 timetable 工具名在 mcp-server 中全部有定义（每个 count=2，tool definition + handler） |
| tsc 通过 | 1 | `npx tsc --noEmit` → 0 errors |

**评价**: 集成完美。solution.json 格式正确，skill 注册、session template 更新、工具名一致性、tsc 编译全部通过。现有工具（curriculum_tree, student_proficiency 等）的定义未被修改。

## D6 Details: E2E 教师体验 (9/25)

D1-D5 = 72/75 ≥ 53，D6 已激活。

**注意**: 无运行中的服务栈可供实际 E2E 测试。以下基于静态代码分析推断各场景的 Pass/Fail 可能性。因无法验证 AI 实际行为，给出保守的推断分数。

| # | 场景 | 推断 | 分值 | 理由 |
|---|------|------|------|------|
| S1 | 简单互换 | Likely Pass | 4/4 | SKILL.md swap 流程完整，MCP tools query+check+submit 逻辑正确，confirm 门控存在 |
| S2 | 代课推荐 | Likely Pass | 4/4 | find_substitute_teachers 有 matchScore 排序，SKILL.md 代课流程有候选展示 + 选择 |
| S3 | 模糊描述 | Uncertain | 0/4 | 模糊处理流程在 SKILL.md 中描述了，但无法确认 AI 是否会正确执行逐课分析+组合方案的复杂流程 |
| S4 | 状态查询 | Likely Pass | 1/4 | list_my_requests 有 mock 数据(3条)，SKILL.md 有查询类处理，但无法验证 show_info_card 输出格式 |
| S5 | 无可用时段 | Uncertain | 0/4.5 | SKILL.md:137-142 有降级建议描述，但 find_available_slots mock 数据中几乎不可能触发全满场景 |
| S6 | 硬冲突阻止 | Uncertain | 0/4.5 | SKILL.md:145-149 明确禁止提交+替代方案，check_conflicts 能检测 hard 冲突，但无法验证 AI 实际遵守 |

**保守总分**: 9/25（仅计可高度确信的 S1+S2 和部分 S4）

## Priority Fix

1. **D3 取消/修改路径 (影响 3 分)**: SKILL.md 缺少用户选择"修改方案"或"取消"后的具体处理流程。应增加一个"## 用户反馈处理"小节，明确：选择"修改方案"→ 回到方案推荐步骤（重新调 find_available_slots 或 find_substitute_teachers）；选择"取消"→ 确认取消并提示后续操作。
2. **D6 无可用时段场景不可触发 (影响 4.5 分)**: 当前 SCHEDULE 数据中教师课时密度不够高，find_available_slots 很难返回空结果。建议在 mock 数据中增加一个"满课教师"或在 find_available_slots 中加入 `week` 参数控制（week=99 时返回空结果作为测试钩子）。
3. **D6 E2E 需要实际运行验证 (影响 ~16 分)**: 当前 D6 仅基于静态推断。需要搭建 E2E 测试脚本（Playwright）实际验证 AI 行为。建议优先实现 S1(简单互换) 和 S4(状态查询) 的 E2E 用例，这两个场景最直接。
