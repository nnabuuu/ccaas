# v5 Changelog

## 目标

基于 v4 eval report 的 Priority Fix 列表：
1. [D4/Minor] SKILL.md:117 "用 bar_list 展示排名" 与实际 JSON 示例不一致
2. [D2/Minor] find_substitute_teachers 的 historyCount 使用启发式推断，非动态计算

## 修改清单

- **skills/reschedule-class/SKILL.md**
  - Line 117: 移除 "用 bar_list" 描述，改为 "按匹配度排序展示排名"，与示例4（使用 text section）保持一致

- **mcp-server/src/index.ts**
  - `find_substitute_teachers` handler: historyCount 改为从 SUBMITTED_REQUESTS 动态统计已审批的代课记录（`type === 'substitute' && status === 'approved' && targetTeacherId 匹配`），替代原有的启发式推断 (`taughtThisClass ? 3 : (subjectMatch ? 1 : 0)`)
  - SUBMITTED_REQUESTS: 新增 2 条历史代课记录（#2025-0320-001, #2025-0305-002），使 t-liu 的 historyCount=3，提供有意义的排名差异化
  - requestCounter: 从 4 调整为 6，反映新增的 seed 数据

## 自检结果

- tsc: PASS (0 errors)
- solution.json: VALID
- 禁止 widget: 0 matches
- 工具名一致性: 全部匹配 (6/6, 每个 ≥2 matches)

## 本轮跳过

- D6: token 配额已耗尽，E2E 无法执行（基础设施问题，非代码问题）
- D1, D3, D5: 已满分，无需修改
