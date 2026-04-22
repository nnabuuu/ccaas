# v2 Changelog

## 改动文件
- `classroom.service.ts` — 新增 4 个 Gap 实现：
  - G1: `getDimensionNameMap()` 方法 + `quality.cols` 字段（可读维度名）
  - G4: `computeAlertTag()` 方法（三级优先级告警）
  - G5: `questionAggregates` 字段（isHigh >= 4 阈值）
  - G7: `detectIssues()` 方法（支持 quiz/match/matrix/stance/order 五种题型的常见错误检测）
  - 加载 manifest 传入 `buildStepMetrics()` 支撑以上功能
- `classroom.service.spec.ts` — 新增 15 个测试覆盖全部新功能

## 对应维度
- D1 (字段完整性): 补全 G1（quality.cols 人类可读维度名）、G4（alertTag）、G5（questionAggregates）、G7（issues）四个缺失字段。byDimension 保留原始 code-name 键确保向后兼容，新增 quality.cols 提供设计期望的 `{name, good, partial, wrong}[]` 格式。
- D2 (计算正确性): alertTag 三级优先级逻辑（stuck >= 5 → wrong dim >= 30% → issue count >= 5）。issues 检测逐题型遍历学生提交，对比 answerKey 找相同错误答案（count >= 2）。questionAggregates 按 category 聚合 AI 问题数。
- D3 (Issues 质量): `detectIssues()` 覆盖 5 种题型：quiz（选项对比）、match（配对对比）、matrix（逐行逐列对比，跳过 demo 行）、stance（立场有效性 + 论据数量）、order（位置错误）。生成 `"N 人 X 选了 Y（应为 Z）"` 格式的可读描述，按出现次数降序排列。
- D4 (测试覆盖): 新增 15 个测试：G1（quiz/match/matrix 维度名映射，含 label 和无 label 两种路径）、G4（alertTag 触发和不触发）、G5（isHigh=true/false 边界）、G7（issues 检测、count < 2 过滤、排序）、空教室边界。

## 本轮重点
补全 v1 缺失的 4 个 Gap（G1/G4/G5/G7），将 D1 从 2/5 提升至目标 4-5/5，D3 从 1/5 提升至目标 4/5，同时通过 15 个新测试覆盖全部新功能。
