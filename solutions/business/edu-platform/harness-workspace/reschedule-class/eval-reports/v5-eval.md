# v5 Evaluation Report

## Pre-gate
- tsc --noEmit: **PASS** (0 errors)

## 总分: 75/100

| # | Dimension | Rating | Score | Notes |
|---|-----------|--------|-------|-------|
| D1 | 工具决策树清晰度 | 5/5 | 20/20 | 意图解析树完整，歧义处理详细，工具表+调用序列齐全 |
| D2 | 动态 Mock 正确性 | 5/5 | 20/20 | 共享 SCHEDULE/TEACHERS 数据模型，6 工具全部动态推算 |
| D3 | 确认流程严密性 | 5/5 | 15/15 | 硬性门控明确，变更摘要+确认按钮+取消路径完整 |
| D4 | 输出格式合规性 | 5/5 | 10/10 | 9 个 JSON 块全部可解析，section type 合规，无禁止 widget |
| D5 | 集成正确性 | 5/5 | 10/10 | solution.json 合法，skill 注册+template 更新+tsc 通过 |
| D6 | E2E 教师体验 | 0/6 | 0/25 | E2E config 文件不存在，无法执行 |

## D1 Details

**意图解析树完整: 1/1** — SKILL.md `意图解析决策树` section 以树状结构覆盖全部场景：
- swap: "换课/互换/交换/对调" (grep count: 23)
- substitute: "代课/找人代/请假/找人上" (grep count: 33)
- reschedule: "改时/换时间/移到/调到/挪到" (grep count: 15)
- makeup: "补课/补上/补回来" (grep count: 13)
- 查询类: "申请/状态/批了吗/进度/记录"

**歧义处理: 1/1** — `模糊描述处理` section 有完整 5 步流程：
1. query_schedule 查受影响课时
2. 逐课分析（优先级：代课→互换→改时→补课）
3. show_info_card 展示组合方案
4. suggest_actions 确认
5. 逐项 check_conflicts + submit

关键词覆盖："有事/想想办法/帮我安排/出差/开会"，grep 命中 6 次。

**工具使用表完整: 1/1** — `工具使用表` section 列出全部 8 个工具（6 timetable + show_info_card + suggest_actions），每个含用途和调用时机。

**调用序列明确: 1/1** — 4 种类型各有编号步骤的 MCP 调用链：
- swap: query(self) → query(other) → check_conflicts → show_info_card → suggest_actions → wait → submit
- substitute: query → find_substitute(**含 classId**) → show → choose → check → show → confirm → submit
- reschedule: query → find_available → check → show → choose → show → confirm → submit
- makeup: 同 reschedule 结构

底部 `关键场景预期行为` 表格进一步强化，包含"必须调用的工具序列"和"禁止行为"列。

**Context 感知: 1/1** — `上下文感知` section 明确从 sessionContext 获取 teacherId/teacherName/subject/classIds，并处理 classId(单数) vs classIds(数组) 兼容。状态查询流程中有 CRITICAL 标注："teacherId 是必填参数，必须从 sessionContext 获取"。grep `sessionContext` 命中 13 次。

## D2 Details

**共享数据模型: 1/1** — `index.ts:264-450`
- TEACHERS: 8 教师（7 常规 + 1 E2E teacher-wang），含 teacherId/name/subject/classIds
- SCHEDULE: ~78 条课程记录，覆盖 7 位教师 × 5 天的课表（非等量但合理）
- ROOM_EVENTS: 3 条教室事件（硬冲突触发源）
- SUBMITTED_REQUESTS: 7 条预置申请（含历史代课记录，用于 historyCount 动态计算）

所有 6 个工具共享同一数据源。

**query_schedule 正确查询: 1/1** — `index.ts:941-981`
```typescript
let results = [...SCHEDULE];
if (teacherId) results = results.filter(e => e.teacherId === teacherId);
if (classId) results = results.filter(e => e.classId === classId);
results.sort((a, b) => a.day - b.day || a.period - b.period);
```
返回 `totalEntries` 计数 + 完整 schedule 数组。非硬编码。

**find_available_slots 动态推算: 1/1** — `index.ts:984-1114`
- 双重循环 `for day of validDays` × `for period 1-8`
- 排除教师忙时段：`SCHEDULE.some(e => e.teacherId === excludeTeacherId && e.day === day && e.period === period)`
- 排除班级忙时段：同上逻辑检查 classId
- 检查 ROOM_EVENTS 硬冲突
- 检查 soft 冲突（同班同日同科 ≥2 节）
- 动态找空闲教室
- 特殊处理：week ≥ 50 返回 totalSlots=0 + hint；周末 preferredDays 过滤

**check_conflicts 交叉验证: 1/1** — `index.ts:1117-1257`
- 硬冲突检测：教师忙、班级忙、教室事件、批量内同教师双重预订
- Soft 冲突：同班同日同科过载（计数 ≥ 2）
- **亮点**：vacatedKeys 机制（`vacatedTeacherKeys`/`vacatedClassKeys`）正确处理互换场景——互换时双方原时段释放，不误报为冲突
- 返回 severity: none/soft/hard + conflicts 数组 + hint

**find_substitute_teachers 计算排序: 1/1** — `index.ts:1431-1518`
matchScore 公式明确：
```
subjectMatch(40) + taughtThisClass(30) + availability(freeCount/totalSlots × 20) + historyBonus(min(historyCount×2, 10))
```
- historyCount 从 SUBMITTED_REQUESTS 动态统计（approved substitute requests）
- 按 matchScore 降序排序
- 返回 matchScoreFormula 字段供 AI 解释

## D3 Details

**变更摘要卡片: 1/1** — `确认门控（强制规则）` 步骤 1 要求 show_info_card 展示"原课时信息、目标课时信息、涉及教师、冲突检测结果"。示例2（提交确认摘要卡片）提供完整 JSON 模板。

**显式确认按钮: 1/1** — 步骤 2 明确要求 suggest_actions 三选项：[确认提交] [修改方案] [取消]。`suggest_actions 使用规范` section 提供 JSON 模板含 label + prompt + skill_hint。grep `确认提交|修改方案|取消` 命中 23 次。

**硬性门控: 1/1** — 原文："⚠️ 在用户选择确认之前，禁止调用 timetable_submit_request。" 步骤 5 额外强化："如果为 'hard'，绝对禁止提交"。工具描述中也重复："禁止未经确认直接调用"。grep `禁止|不得` 命中 12 次。

**批量逐项确认: 1/1** — 步骤 4："如果涉及多节课的变更，在摘要中逐条列出每节课的变更详情"。模糊描述处理步骤 5："对每节课分别调用 timetable_check_conflicts 检测冲突，无 hard 冲突的逐项调用 timetable_submit_request 提交"。

**取消/修改路径: 1/1** — `用户反馈处理` section 覆盖三种场景：
- 修改方案：按类型回到对应步骤重新搜索
- 取消：确认 + suggest_actions [重新开始/查看申请]
- 更改需求：识别新类型，从头开始

## D4 Details

**JSON 可解析: 1/1** — Python `json.loads()` 验证全部 9 个 JSON 代码块，结果：9/9 VALID。无尾逗号、引号错误。

**Section type 合规: 1/1** — grep 提取所有 `"type"` 值，去重结果：
- `"actions"`, `"bar_list"`, `"metrics"`, `"outline"`, `"text"`
- 全部在允许列表内（outline/bar_list/metrics/actions/text）

**无禁止 widget: 1/1** — grep `FormCollect|TreeSelector|MetricDashboard|BarList` 命中 0 次。

**show_info_card 示例丰富: 1/1** — 7 个独立 JSON 示例：
1. 方案推荐卡片（互换场景）
2. 提交确认摘要卡片
3. 申请状态查询卡片
4. 代课候选教师卡片（含 bar_list）
5. 课表概览卡片（含 outline）
6. 无可用时段降级卡片
7. 硬冲突阻止卡片

远超 ≥3 要求。

**suggest_actions 使用正确: 1/1** — `suggest_actions 使用规范` section 明确格式，JSON 示例含 `label` + `prompt` + `skill_hint`(可选)。多处引用正确。

## D5 Details

**solution.json 可解析: 1/1** — `node -e "JSON.parse(...)"` 输出 VALID。

**Skill slug 注册: 1/1** — `skills` 数组包含 `{ "slug": "reschedule-class", "name": "reschedule-class" }`。

**Session template 更新: 1/1** — `sessionTemplates.lesson-planning.enabledSkills` 包含 `"reschedule-class"`。appendSystemPrompt 中有完整的调课技能指引（调课类型、周次解析、工具调用流程、强制规则）。

**工具名一致性: 1/1** — SKILL.md 中引用的 6 个 timetable 工具全部在 mcp-server 中有定义（每个 grep 命中 ≥2 次）：
- timetable_query_schedule: 2
- timetable_find_available_slots: 2
- timetable_check_conflicts: 2
- timetable_submit_request: 2
- timetable_list_my_requests: 2
- timetable_find_substitute_teachers: 2

**tsc 通过: 1/1** — `npx tsc --noEmit` 零错误输出。

现有工具未被修改（spot check）：
- `curriculum_tree`: 定义和 handler 存在，未被修改
- `student_proficiency`: 同上

## D6 Details

D1-D5 = 75/75 ≥ 53 → **D6 已激活**，但 `.e2e-config` 文件不存在。

```
E2E_CONFIG="harness-workspace/reschedule-class/.e2e-config"
→ E2E config not found
```

**D6 = 0/25**（原因：E2E 配置文件缺失，无 CCAAS_URL/TENANT_ID/API_KEY 可供连接）

## Priority Fix

1. **[D6] 创建 `.e2e-config` 文件** — 这是唯一的失分项。需要提供 CCAAS_URL、TENANT_ID、API_KEY 以启用 E2E 测试。D1-D5 已全部满分（75/75），E2E 通过后总分可达 100/100。
2. **[D6/准备] solution.json appendSystemPrompt 长度** — appendSystemPrompt 已达 ~2000 字符，虽然当前功能完整，但若后续添加更多技能指引可能需要精简。非扣分项，仅作观察。
3. **[D2/可选] ROOM_EVENTS 覆盖度** — 当前仅 3 条教室事件，E2E S6 硬冲突场景可能依赖 `changes` 构造而非 ROOM_EVENTS 触发。建议确认 S6 测试向量能可靠触发 hard 冲突。
