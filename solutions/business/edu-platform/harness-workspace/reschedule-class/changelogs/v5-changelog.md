# v5 Changelog

## 目标
基于 v4 eval report：D1-D5 已满分 (75/75)，D6 E2E 未执行 (0/25)。本轮聚焦提升 E2E 就绪度。

## 根因分析
1. **check_conflicts 缺少 vacatedKeys 逻辑** — v4 eval 报告称有此逻辑但代码中实际不存在。swap 场景中两位教师互换时段，check_conflicts 会误报 hard 冲突（对方教师在目标时段"已有课"），因为未识别该时段正被对方腾出。这会导致 E2E S1 (简单互换) 失败。
2. **SKILL.md 缺少变更结构示例** — AI 不知道如何构造 swap/substitute/reschedule/makeup 的 changes 数组，可能格式错误导致 E2E 失败。

## 修改清单
- [mcp-server/src/index.ts] check_conflicts handler 添加 vacatedKeys 机制：
  - 收集所有 changes 的 vacatedTeacherKeys 和 vacatedClassKeys
  - teacher_busy 检查时跳过已被其他 change 腾出的时段
  - class_busy 检查时跳过已被其他 change 腾出的时段
  - subject_overload 计算时减去被其他 change 移走的同科课程
- [skills/reschedule-class/SKILL.md] 为 4 种调课类型各添加 changes 结构示例：
  - swap: 明确需要两条配对变更 + vacatedKeys 说明
  - substitute: 展示 originalTeacherId ≠ targetTeacherId 结构
  - reschedule: 展示同一教师不同时段的变更结构
  - makeup: 展示 originalDay 记录缺课 + targetDay 补课的结构 + 优先自习课时段建议
- [skills/reschedule-class/SKILL.md] find_available_slots 调用增加参数说明

## 自检结果
- tsc: PASS (0 errors)
- solution.json: VALID
- 禁止 widget: 0 matches
- 工具名一致性: 6/6 全部匹配

## 本轮跳过
- D6 E2E 基础设施: 需由 evaluator 侧提供 Playwright 脚本，不在 generator 修改范围内
- find_available_slots includeTeacherIds: 优先级低于 vacatedKeys 修复，下轮考虑
