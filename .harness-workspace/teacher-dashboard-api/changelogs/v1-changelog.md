# v1 Changelog (v4 iteration)

## 改动文件
- `classroom.service.ts` — 新增 4 个 helper 方法（`deriveResult()`, `formatDuration()`, `getStepTypeDesc()`）；stepMetrics 新增 `name`/`desc`/`avgTimeFormatted`/`medianTimeFormatted` 字段；enrichedSubs 新增 `result`/`timeFormatted` 字段；students 新增 `stepHistory`（task 1-5 keyed，含 status/result/time/aiRounds）
- `classroom.service.spec.ts` — 新增 5 个测试：stepMetrics name/desc 验证、formatted time 格式验证、stepHistory status/result 全链路、enriched submission result/timeFormatted、completed student 全 done

## 对应维度
- D1 (字段完整性): 补全 stepMetrics 的 `name`（从 manifest label）和 `desc`（从 answerKey type 映射中文）；补全 formatted time 字符串（m:ss 格式）；新增 `stepHistory` 字段完全匹配设计原型的 student modal 数据结构（status/result/time/aiRounds per step）；enrichedSubs 新增 `result` 和 `timeFormatted`。预期 4→5
- D2 (计算正确性): `deriveResult` 使用 score.total 映射：100→correct, 0→wrong, else→partial。`formatDuration` 将秒转为 m:ss。stepHistory 对 done/prog/stuck/reading/future 的判定复用已有 studentStatuses 逻辑
- D3 (Issues 质量): 无变化（已在 v3 达到满分）
- D4 (测试覆盖): 新增 5 个测试覆盖所有新增字段和边界情况（5 步全完成、wrong result、future 状态等）

## 本轮重点
补全 D1 最后的 gap：stepMetrics 的 name/desc、formatted times、per-student stepHistory，使 API 输出完全匹配设计原型的 step card 和 student modal 数据模型。
