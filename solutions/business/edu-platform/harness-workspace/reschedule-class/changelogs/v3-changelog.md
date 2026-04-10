# v3 Changelog

## 目标

基于 v2 eval report 的 Priority Fix：
- D6 S4/S5/S6 场景评估为 Uncertain (0分)，原因是"无法静态验证 AI 是否正确执行响应检查"
- 需要让 AI 的 post-tool-call 行为更加确定性和可预测

## 修改清单

### SKILL.md

1. **新增"工具响应处理规则（强制）"section**（工具使用表之后）
   - 5 个 timetable 工具各有明确的响应检查规则
   - `find_available_slots` → 必检 `totalSlots`，为 0 则进入无可用时段流程
   - `check_conflicts` → 必检 `severity`，为 `hard` 则进入硬冲突阻止流程
   - `find_substitute_teachers` → 必检 `totalCandidates`
   - `list_my_requests` → 解析 `summary` + `requests[]` 的映射关系
   - `query_schedule` → 检查 `totalEntries`

2. **4 种工作流内联响应检查标注**
   - swap 流程 step 3: check_conflicts 后标注"必检 severity"
   - substitute 流程 step 5: check_conflicts 后标注"必检 severity"
   - reschedule 流程 step 2: find_available_slots 后标注"必检 totalSlots"
   - reschedule 流程 step 3: check_conflicts 后标注"必检 severity"
   - makeup 流程 step 2: find_available_slots 后标注"必检 totalSlots"
   - makeup 流程 step 3: check_conflicts 后标注"必检 severity"

### mcp-server/src/index.ts

无修改。v2 版本所有 6 个工具已正确实现动态推算。

### solution.json

无修改。v2 版本配置已完整。

## 自检结果

- tsc: PASS (0 errors)
- solution.json: VALID
- 禁止 widget: 0 matches
- 工具名一致性: 全部匹配（6/6）
- JSON 可解析: 8/8 blocks OK

## 预期影响

- D6 S4: list_my_requests 响应解析规则明确 summary→metrics, requests→text 映射 → Uncertain→Likely Pass
- D6 S5: find_available_slots 响应检查规则 + 内联标注 → Uncertain→Likely Pass
- D6 S6: check_conflicts 响应检查规则 + 内联标注 + 反复强化禁止 submit → Uncertain→Likely Pass

## 本轮跳过

- D1-D5: 已满分(75/75)，无需修改
- MCP 工具: 已正确实现，无需修改
- requestId 日期格式: 与预置数据一致，不修改
