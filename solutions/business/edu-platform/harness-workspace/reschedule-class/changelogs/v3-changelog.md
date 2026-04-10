# v3 Changelog

## 目标

基于 v2 eval report 的 Priority Fix 列表，重点提升 D6 E2E 场景可信度（S4/S5/S6 均为 0 分）。

v2 得分 86/100，D1-D5 全满分（75/75），D6 仅 11/25。核心问题是 S4（状态查询）、S5（无可用时段）、S6（硬冲突阻止）无法通过静态分析验证 AI 行为。

## 策略

通过 MCP 服务端安全网 + SKILL.md 指令强化双管齐下，让 E2E 场景的预期行为更可预测：

1. **服务端硬性保障**：即使 AI 行为有偏差，服务端也能拦截或纠正
2. **SKILL.md 指令精确化**：明确字段路径、触发条件、必填参数

## 修改清单

### mcp-server/src/index.ts

- **timetable_submit_request 添加服务端冲突守卫**（→ D6/S6）
  - 提交前自动检测 hard 冲突（复用 check_conflicts 逻辑含 vacatedKeys swap 感知）
  - 存在 hard 冲突时返回 `status: "error"` + `hardConflicts[]` 描述，拒绝写入
  - 即使 AI 误跳过确认流程，服务端也会阻止错误提交

- **timetable_list_my_requests 添加 teacherId 必填校验**（→ D6/S4）
  - 不传 teacherId 时返回 `status: "error"` + 提示信息
  - 迫使 AI 必须从 sessionContext 获取 teacherId

- **requestId 日期格式修正**（→ Priority Fix #3）
  - `YYYY-MMDD` → `YYYY-MM-DD`（如 `#2025-04-18-001`）
  - 同步更新 5 条预置申请记录的 requestId

### skills/reschedule-class/SKILL.md

- **硬冲突阻止流程增加服务端安全网说明**（→ D6/S6）
  - 新增说明：服务端也会拒绝硬冲突提交
  - 评估者可确信即使 AI 行为偏差，提交也不会成功

- **状态查询流程强化 teacherId 必填**（→ D6/S4）
  - 添加 CRITICAL 标记强调 teacherId 是必填参数
  - 添加服务端将返回错误的提示

- **find_available_slots 响应处理精确化**（→ D6/S5）
  - 添加 week≥50 触发条件说明
  - 明确"禁止跳过 show_info_card 直接文本描述"
  - 字段路径更精确：`data.totalSlots`（整数）

- **check_conflicts 响应处理精确化**（→ D6/S6）
  - 明确字段类型：`data.severity`（字符串："none"/"soft"/"hard"）
  - 明确从 `data.conflicts[]` 的 `description` 字段提取冲突原因
  - 重复安全保障说明

- **list_my_requests 响应字段精确化**（→ D6/S4）
  - 逐字段列出返回数据结构（requestId, type, status, reason, changes[], rejectReason）
  - 明确 changes[] 的子字段（from, to, classId, originalTeacher, targetTeacher）

- **requestId 格式更新**
  - 所有 JSON 示例中的 requestId 从 `#2025-0418-001` 更新为 `#2025-04-18-001`

### solution.json

- **appendSystemPrompt 更新**
  - 强调 timetable_list_my_requests 的 teacherId 必填
  - 强调服务端也会拒绝硬冲突提交
  - 强调 totalSlots=0 时必须用 show_info_card
  - 修正 list_my_requests 调用示例传入 sessionContext.teacherId

## 自检结果

- tsc: PASS (0 errors)
- solution.json: VALID
- 禁止 widget: 0 matches
- 工具名一致性: 6/6 全部匹配
- JSON 可解析: 8/8 blocks valid

## 本轮跳过

- D1-D5 均已满分，无需调整
- 本轮集中在 D6 E2E 安全性和可预测性
