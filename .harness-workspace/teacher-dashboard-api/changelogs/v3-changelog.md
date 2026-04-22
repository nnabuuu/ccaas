# v3 Changelog

## 改动文件
- `classroom.service.ts` — 修复 `computeAlertTag` 使用 code-name 维度键（`q0`, `place`）生成 alertTag 的 bug，改为使用 human-readable 名称（`Q1`, `Where`）；在 `buildStepMetrics` 中将 `_nameMap` 存入 stepMetrics 供 alertTag 使用
- `classroom.service.spec.ts` — 新增 6 个测试：stuck 状态检测（2 个）、match 类型 issue 检测（1 个）、alertTag 使用 readable name（2 个）、alertTag stuck 优先级（1 个）

## 对应维度
- D1 (字段完整性): 无变化，保持 4/5
- D2 (计算正确性): 修复 alertTag 维度名 bug — `computeAlertTag` 现在通过 `metrics._nameMap` 查找 human-readable 名称，输出 `Q1 错误偏高` 而非 `q0 错误偏高`。预期 3→5 (+10 weighted)
- D3 (Issues 质量): 新增 match issue 检测测试验证。预期 4→5 (+4 weighted)
- D4 (测试覆盖): 新增 stuck 状态测试、prog 状态测试、match issue 测试、alertTag readable name 测试、alertTag stuck 优先级测试。预期 4→5 (+3 weighted)

## 本轮重点
修复 alertTag 使用 code-name 维度键的 D2 bug（最大扣分项 +10），补充 stuck/match issue/alertTag 测试覆盖。
