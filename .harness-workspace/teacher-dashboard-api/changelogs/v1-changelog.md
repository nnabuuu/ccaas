# v1 Changelog

## 改动文件
- `classroom.service.ts` — Refactored `getState()` to use extracted private helpers; added `computeStudentDurations()`, `buildStepMetrics()`, `extractMedianTimes()`, `computeStudentStatus()`, `computeHealthCards()`. Enriched stepMetrics with byDimension/avgTime/medianTime/aiRounds/aiPeople. Added per-student duration and aiRoundsCount to submissions. Added student status field. Added top-level healthCards object.
- `classroom.service.spec.ts` — Added 8 new tests in 'teacher dashboard — enriched getState' block covering: byDimension aggregation, timing fields, AI stats, per-student duration/aiRoundsCount, student status (reading/done), healthCards structure, backward compatibility of existing stepMetrics fields.

## 对应维度
- D1 (字段完整性): Added `byDimension`, `avgTime`, `medianTime`, `aiRounds`, `aiPeople` to stepMetrics. Added `duration`, `aiRoundsCount` to student submissions. Added `status` to students. Added `healthCards` top-level object with furthest/median/stuck/aiTotal.
- D2 (计算正确性): byDimension aggregates boolean dimensions as good/wrong, numeric as good/partial/wrong with percentage. Duration uses submittedAt delta. Stuck detection uses median×1.5 threshold. Health cards compute furthest/median from student currentTask.
- D3 (Issues 质量): Not addressed in v1 (deferred to v2)
- D4 (测试覆盖): 8 new tests covering all new fields and edge cases (completed student, empty steps)

## 本轮重点
Foundation layer: enriched stepMetrics (G2 partial), student status (G3), and healthCards (G6) to provide all core data the teacher dashboard needs for step cards and health overview.
