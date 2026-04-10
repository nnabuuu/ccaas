# v6 Evaluation Report

## Pre-gate
- tsc --noEmit: **PASS** (0 errors)

## 总分: 75/100

| # | Dimension | Rating | Score | Notes |
|---|-----------|--------|-------|-------|
| D1 | 工具决策树清晰度 | 5/5 | 20/20 | 意图解析树完整，4类+模糊+查询全覆盖，changes构造指南是亮点 |
| D2 | 动态 Mock 正确性 | 5/5 | 20/20 | 共享SCHEDULE+TEACHERS，vacatedKeys swap感知，matchScore公式明确 |
| D3 | 确认流程严密性 | 5/5 | 15/15 | 硬性门控"禁止调用"措辞到位，批量逐项+取消/修改路径完整 |
| D4 | 输出格式合规性 | 5/5 | 10/10 | 13个JSON块全部可解析，5种section type合规，0禁止widget |
| D5 | 集成正确性 | 5/5 | 10/10 | solution.json合法，slug/template已注册，6工具名100%一致，tsc通过 |
| D6 | E2E 教师体验 | 0/6 | 0/25 | 已激活(D1-D5=75≥53)，但需完整服务栈+AI模型端点，本轮未执行 |

## D1 Details: 工具决策树清晰度 (20/20)

| Sub-item | Score | Evidence |
|----------|-------|----------|
| 意图解析树完整 | 1/1 | 4种类型各有明确触发关键词：swap("换课/互换/交换/对调"), substitute("代课/找人代/请假"), reschedule("改时/换时间/移到/调到"), makeup("补课/补上/补回来") + 模糊描述("有事/想办法") + 查询类("申请/状态/批了吗") |
| 歧义处理 | 1/1 | 专设"模糊描述处理"章节，5步流程：query_schedule查受影响课时 → 逐课分析(代课优先→互换→改时→补课兜底) → show_info_card组合方案 → suggest_actions确认 → 逐项提交 |
| 工具使用表完整 | 1/1 | 专设"工具使用表"：6 timetable工具 + show_info_card + suggest_actions = 8个，每个含用途和调用时机 |
| 调用序列明确 | 1/1 | 4种类型均有编号步骤的MCP调用链，swap还包含示例对话的8步处理流程 |
| Context 感知 | 1/1 | "上下文感知"章节明确从sessionContext获取teacherId/teacherName/subject/classIds，含降级("如果没有这些信息，请先询问教师身份") |

**亮点**: "changes 数据结构指南"为每种调课类型提供了精确的JSON构造示例，特别是swap类型强调必须生成2条配对changes并解释了vacatedKeys机制。这是防止AI误构造的关键护栏。

## D2 Details: 动态 Mock 正确性 (20/20)

| Sub-item | Score | Evidence |
|----------|-------|----------|
| 共享数据模型 | 1/1 | `TEACHERS` 7人(≥5), `SCHEDULE` 70+条完整周课表(7教师×5天), `ROOM_EVENTS` 3条, `SUBMITTED_REQUESTS` 3条预置数据。数据模型匹配PRD建议的教师列表 |
| query_schedule 查询 | 1/1 | L885-925: `SCHEDULE.filter(e => e.teacherId === teacherId)` + classId过滤，非硬编码 |
| find_available_slots 动态推算 | 1/1 | L928-1032: 双重循环(day×period) → teacher busy check → class busy check → room events → soft conflict(同科≥2) → 空闲教室查找。week≥50模拟考试周(全满)场景 |
| check_conflicts 交叉验证 | 1/1 | L1035-1132: **vacatedKeys机制**（swap互换时释放原始时段），virtualSchedule排除已腾出的课时。检测4类冲突：teacher_busy(hard), class_busy(hard), room_event(hard), subject_overload(soft)。返回severity: none/soft/hard |
| find_substitute_teachers 计算排序 | 1/1 | L1229-1308: matchScore = subjectMatch(40) + taughtThisClass(30) + availability(freeCount/total×20) + historyBonus(min(count×2, 10))。公式在返回结果中也包含(`matchScoreFormula`字段) |

**v5→v6改进**: swap预置数据从1条change修正为2条配对changes(L360-366)，与SKILL.md的changes指南保持一致。list_my_requests移除了teacherId必填约束，更灵活。check_conflicts的vacatedKeys逻辑重构更清晰。

## D3 Details: 确认流程严密性 (15/15)

| Sub-item | Score | Evidence |
|----------|-------|----------|
| 变更摘要卡片 | 1/1 | 示例2"调课变更确认"卡片含metrics(变更类型/涉及教师/冲突状态) + text(逐行变更详情含教室) |
| 显式确认按钮 | 1/1 | 每个工作流末尾均有suggest_actions提供[确认提交][修改方案][取消]，含skill_hint |
| 硬性门控 | 1/1 | L340: "⚠️ 在用户选择确认之前，禁止调用 timetable_submit_request。" + "确认门控（强制规则）"专章。硬冲突场景额外加"⚠️ 绝对禁止调用 timetable_submit_request" |
| 批量逐项确认 | 1/1 | 确认门控第4条"批量调课逐项确认：如果涉及多节课的变更，在摘要中逐条列出每节课的变更详情"。模糊描述步骤5"对每节课分别调用check_conflicts…逐项调用submit_request" |
| 取消/修改路径 | 1/1 | "用户反馈处理"专章含3个子流程：修改方案(回到对应步骤)、取消(确认取消+后续操作按钮)、更改需求(重新开始新类型流程) |

## D4 Details: 输出格式合规性 (10/10)

| Sub-item | Score | Evidence |
|----------|-------|----------|
| JSON 可解析 | 1/1 | 13个JSON代码块全部通过JSON.parse验证 |
| Section type 合规 | 1/1 | 仅使用: "actions", "bar_list", "metrics", "outline", "text"（5种合规类型） |
| 无禁止 widget | 1/1 | grep结果 = 0（无FormCollect/TreeSelector/MetricDashboard/BarList） |
| show_info_card 示例丰富 | 1/1 | 7个不同场景示例：方案推荐、提交确认摘要、申请状态查询、代课候选(bar_list)、课时概览(outline)、无可用时段、硬冲突 |
| suggest_actions 使用正确 | 1/1 | 含label + prompt + 可选skill_hint，"suggest_actions 使用规范"专节示例 |

## D5 Details: 集成正确性 (10/10)

| Sub-item | Score | Evidence |
|----------|-------|----------|
| solution.json 可解析 | 1/1 | `node -e "JSON.parse(...)"` → VALID |
| Skill slug 注册 | 1/1 | `skills`数组含`{ "slug": "reschedule-class" }` |
| Session template 更新 | 1/1 | `lesson-planning.enabledSkills`含`"reschedule-class"` |
| 工具名一致性 | 1/1 | 6个timetable工具名在SKILL.md和index.ts中100%一致（每个2次匹配：定义+handler） |
| tsc 通过 | 1/1 | 0 errors |

**附注**: 验证了原始工具列表(commit dc4589e)为8个工具，v6添加了6个timetable工具，未修改任何已有工具定义或handler。show_step_wizard原本就未注册到ListTools（仅定义+handler），v6未改变此状态。

## D6 Details: E2E 教师体验

**状态**: 已激活 (D1-D5 = 75/75 ≥ 53)，但未执行。

**原因**: E2E 需要完整服务栈（backend + MCP server + AI 模型端点 + chat interface），当前评估环境不具备运行条件。

**基于静态分析的场景可行性预判**（仅供参考，不计分）：

| # | 场景 | 静态评估 | 依据 |
|---|------|---------|------|
| S1 | 简单互换 | 可行 | swap流程完整，changes指南含2条配对示例 |
| S2 | 代课推荐 | 可行 | find_substitute_teachers有matchScore排序，bar_list展示 |
| S3 | 模糊描述 | 可行 | 模糊描述处理5步流程清晰，query_schedule→逐课分析→组合方案 |
| S4 | 状态查询 | 可行 | list_my_requests从SUBMITTED_REQUESTS过滤，预置3条不同状态数据 |
| S5 | 无可用时段 | 可行 | week≥50模拟全满，SKILL.md有降级建议卡片示例 |
| S6 | 硬冲突阻止 | 可行 | ROOM_EVENTS触发hard冲突，"绝对禁止调用submit_request"门控 |

## Priority Fix

1. **D6 E2E 执行环境**: 搭建E2E测试框架以验证6个场景。建议创建`harness-workspace/reschedule-class/e2e/`目录，用Playwright模拟教师对话并验证工具调用序列。这是从75分突破到90+分的唯一障碍。

2. **模糊描述的batch提交类型**: SKILL.md模糊描述流程会产生多课变更，但changes指南未明确说明此时submit_request的`type`应为`"batch"`。建议在"模糊描述处理"步骤5补充：`timetable_submit_request({ type: "batch", ... })`。

3. **find_available_slots的excludeTeacherId+classIds联合查询**: 当前实现中如果不传classIds，只检查教师空闲，不检查班级空闲。SKILL.md的改时/补课流程说"该班级和教师都空闲的时段"，但如果AI忘记传classIds参数，结果会不准确。建议在工具description中强调"改时/补课场景必须传classIds"。
