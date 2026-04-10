# v6 Changelog

## 目标

基于 v5 eval report：D1-D5 已满分 75/75，D6 = 0/25（无 E2E 基础设施）。本轮聚焦提升 E2E 场景通过率的前提条件——确保 AI 能正确构造 swap 的 2 条配对 changes。

## 根因分析

v5 eval 的 Priority Fix #3 指出 swap 场景的关键缺陷：`check_conflicts` 的 `vacatedKeys` 机制要求 swap 必须提交 2 条 changes（双方原时段都释放），但 SKILL.md 未明确说明此规则。如果 AI 只生成 1 条 changes，对方教师的原时段不在 vacatedKeys 中，导致误报 hard 冲突，swap 流程必定失败。

这是 E2E S1（简单互换）能否通过的关键前提。

## 修改清单

### SKILL.md
- **新增 "changes 数据结构指南" 章节**：在 4 种类型工作流和模糊描述处理之间，添加完整的 changes 构造规则：
  - swap: 必须 2 条配对 changes + 详细 JSON 示例 + 误报警告
  - substitute: 1 条（换教师不换时段）
  - reschedule: 1 条（换时段不换教师）
  - makeup: 1 条（同 reschedule）
- **更新 swap 步骤4**：从模糊的"构造变更方案"改为明确引用 changes 指南，强调必须包含双方课时移动

### mcp-server/src/index.ts
- **修复 SUBMITTED_REQUESTS swap 数据**：将 `#2025-0418-001` 的 changes 从 1 条改为 2 条配对格式（`targetTeacherId` 改为各自的 `originalTeacherId`），使历史数据与 SKILL.md 指南一致

## 自检结果
- tsc: PASS (0 errors)
- solution.json: VALID
- 禁止 widget: 0 matches
- 工具名一致性: 6/6 全部匹配
- JSON 可解析: 13/13 块全部通过

## 本轮跳过
- D6 E2E 测试脚本创建：不在 Generator 可修改文件范围内（SPEC 限定 SKILL.md + index.ts + solution.json）
- find_available_slots includeTeacherIds 参数：swap 流程不使用 find_available_slots（用 check_conflicts），优先级低
