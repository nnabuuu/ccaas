# v3 Changelog

## 目标

基于 v2 eval report 的 Priority Fix 列表，重点提升 D6（E2E 教师体验）的静态分析置信度和实际运行可靠性。

v2 状态：86/100（D1-D5 = 75/75 满分，D6 = 11/25）
- S4-S6 被评为 "Uncertain"（0 分），原因是无法从静态分析确认 AI 行为
- Priority Fix #2: classId 参数传递规范不一致
- Priority Fix #3: requestId 日期格式不一致

## 策略

**双层防御**：工具响应中嵌入行为指令（hint 字段）+ SKILL.md 场景速查表，确保 AI 在关键决策点获得即时、明确的行为指引。

## 修改清单

### mcp-server/src/index.ts — 4 处 hint 字段 + 1 处格式修复

1. **`find_available_slots`（week≥50 路径）**: totalSlots=0 响应新增 `data.hint` 字段，指令 AI 展示降级建议卡片 + 禁止结束对话。→ 目标：S5 场景

2. **`find_available_slots`（正常路径）**: 当 slots.length===0 时动态添加同样 hint。覆盖非考试周但无空闲的边界。→ 目标：S5 场景

3. **`check_conflicts`**: severity=hard 时新增 `data.hint`，明确指令绝对禁止 submit + 展示冲突 + 搜索替代。→ 目标：S6 场景

4. **`find_substitute_teachers`**: candidates.length===0 时新增 `data.hint`，建议切换方案类型。

5. **requestId 格式修复**: dateStr 从 `YYYY-MM-DD` 改回 `YYYY-MMDD`，与预置数据（`#2025-0418-001` 等）格式一致，消除混淆。

### skills/reschedule-class/SKILL.md — 3 处增强

1. **hint 字段处理说明**: "工具响应处理规则"引言段新增说明：异常情况下 `data.hint` 包含行为指引，必须优先遵循。

2. **requestId 示例修正**: `list_my_requests` 响应说明中 requestId 从 `#2025-04-18-001` 修正为 `#2025-0418-001`。

3. **"关键场景预期行为"速查表**: 6 行表格，汇总每个 E2E 场景的触发条件、必须调用的工具序列、必须展示的输出、禁止行为。

## 自检结果

- tsc: **PASS** (0 errors)
- solution.json: **VALID**
- 禁止 widget: **0** matches
- 工具名一致性: **全部匹配** (6/6)
- JSON 可解析: **全部通过** (8/8 blocks)

## 设计决策

**为什么在工具响应中嵌入 hint 而不是只强化 SKILL.md？**
- SKILL.md 作为系统提示在长对话中可能被上下文稀释
- hint 在工具返回时即时出现，是 AI 做决策的"最后一英里"提醒
- 两层防御（SKILL.md 规则 + tool response hint + 服务端冲突守卫）确保关键行为不被遗漏

## 本轮跳过

- D1-D5：v2 已全部满分，无需调整
- solution.json：v2 已完善，无需修改
