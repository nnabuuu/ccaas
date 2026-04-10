# v4 Changelog

## 目标

基于 v3 eval report 的 Priority Fix 列表。v3 得分 75/100（D1-D5=75/75, D6=0/25）。

D1-D5 已满分，本轮专注于：
1. **check_conflicts 互换场景优化**（D2 minor → E2E S1 可靠性）
2. **show_info_card section type 覆盖**（D4 minor → 使用全部 5 种 section type）

## 根因分析

| 扣分项 | 根因类型 | 修复策略 |
|--------|----------|----------|
| check_conflicts 互换误报 | C: 推算逻辑缺失 | 添加 vacated slots 排除逻辑 |
| 未使用 outline/bar_list | A: 内容缺失 | 添加示例 |
| D6 E2E 未执行 | 外部依赖（需完整服务栈） | 提升代码层面 E2E 通过率 |

## 修改清单

### mcp-server/src/index.ts

1. **check_conflicts swap-aware 冲突检测**：在冲突检测循环前，计算所有 changes 中被释放的原始时段（vacatedKeys），创建 virtualSchedule（排除被释放的条目）。teacher_busy、class_busy、subject_overload 三项检查全部使用 virtualSchedule 代替 SCHEDULE。room_events 检查不变（外部事件不受课表变更影响）。
   - 修复场景：A↔B 互换时，B 的原时段被 A 的原条目占用，导致 class_busy 误报为 hard conflict
   - originalEntry 查找仍用 SCHEDULE（需查原始条目的学科信息）

### skills/reschedule-class/SKILL.md

1. **示例4 改用 bar_list**：将"代课候选教师卡片"中的 text section 替换为 bar_list section，展示匹配度条形图（value/max 结构）
2. **新增示例5（outline）**：添加"受影响课时概览卡片"，使用 outline section 展示课时树形结构（label + children）。适用于模糊描述场景中展示受影响课时

### solution.json

无变更（v3 已完整）

## 自检结果

- tsc: **PASS** (0 errors)
- solution.json: **VALID**
- 禁止 widget: **0** matches
- 工具名一致性: **全部匹配** (6/6)
- JSON 代码块: **全部可解析** (9/9)
- Section type 覆盖: **5/5**（actions, bar_list, metrics, outline, text）

## 本轮跳过

- D6 E2E 执行：依赖完整服务栈（backend + MCP + AI session + Playwright），非代码层面可解决
- D1-D5 其他子项：已全部满分，无需修改
