# 教师端 API 数据完整性 — Spec

## 目标

让 `classroom.service.ts` 的 `getState()` 返回体包含教师端设计原型 (`design/surfaces/teacher.html`) 渲染所需的全部数据。当前已完成 stepMetrics 增强（byDimension / medianTime / avgTime / aiRounds / aiPeople / questionAggregates），尚需补全 7 个 gap 以完全匹配设计。

## Artifact（被修改的文件）

| 文件 | 角色 |
|------|------|
| `solutions/business/live-lesson/backend/src/classroom/classroom.service.ts` | 核心服务——`getState()` + 私有聚合方法 |
| `solutions/business/live-lesson/backend/src/classroom/classroom.service.spec.ts` | 测试文件 |

## 设计参考

- **设计原型**: `solutions/business/live-lesson/design/surfaces/teacher.html`（JS 数据模型 `STEPS[]` + `STUDENT_HISTORY` + `renderClassCompare`）
- **设计文档**: `solutions/business/live-lesson/design/docs/teacher-dashboard-design.md`

## Gap 列表（需补全）

### G1: byDimension 维度名（manifest 提取）
- **现状**: `byDimension` 键为代码名 (`q0`, `place`, `position` 等)
- **设计期望**: `quality.cols[].name` 用可读名（`Q1 Edem`, `Where`, `Position` 等）
- **方案**: 从 lesson manifest 的 `readingSteps[].answerKey` 提取维度标签；如果 answerKey 无标签则用默认映射（quiz→`Q{idx}`, match→`P{idx}`, matrix→`place/practice/reason`, stance→`position/evidence`, order→`correct`）

### G2: per-student 步骤用时 + AI 轮次
- **现状**: 步骤级聚合有 `medianTime`/`avgTime`，但 `students[]` 中无 per-step 用时
- **设计期望**: 学生弹窗需要每步用时（如 `3:20`），班级对比需要对比学生用时 vs 中位数
- **方案**: 在 `getState()` 的 `students[].submissions[step]` 中增加 `duration` 字段（秒），按同一逻辑（task1: submittedAt - joinedAt; taskN: submittedAt[N] - submittedAt[N-1]）。同时增加 per-student-per-step `aiRoundsCount`。

### G3: stuck 状态检测
- **现状**: `student.currentPhase` 只有 `listen` / `completed`
- **设计期望**: Step 卡片中学生点阵有 `done/prog/stuck/reading` 四种状态
- **方案**: 在 `getState()` 的 `students[]` 中增加 `status` 字段。逻辑：
  - `done` = currentPhase === 'completed' 或已提交所有 5 步
  - `stuck` = 在当前步骤停留超过中位用时 × 1.5 且没有新提交
  - `reading` = currentPhase === 'listen'（听讲阶段）
  - `prog` = 正在做题（非 listen，非 stuck，非 done）

### G4: alertTag 生成
- **现状**: 无
- **设计期望**: Step 卡片有 `alertTag`（如 `Why 错误偏高`、`5 人卡住`）
- **方案**: 在 `stepMetrics[taskNum]` 增加 `alertTag: string | null`。规则：
  1. 如果 stuck 学生数 ≥ 5 → `"${stuckCount} 人卡住"`
  2. 如果 byDimension 中某维度 wrong ≥ 30% → `"${dimName} 错误偏高"`
  3. 如果有 issues 中某条 count ≥ 5 → 取最严重的 issue 作为 alertTag
  4. 优先级: stuck > wrong_dimension > issue

### G5: questionAggregates isHigh 阈值
- **现状**: `isHigh: count >= 3`
- **设计期望**: `≥ 4` 才标为"高频"
- **方案**: 改阈值为 4

### G6: Health Cards 聚合数据
- **现状**: `metrics` 只有 `total / submitted / inProgress`
- **设计期望**: 顶部 Health Cards 需要: 最快进度(step + count), 中位进度(step), 卡点学生(count + 集中位置), AI 对话(总轮数 + 总人数)
- **方案**: 在 `getState()` 返回值增加 `healthCards` 对象

### G7: issues 生成（common wrong answer detection）
- **现状**: 无
- **设计期望**: Step 详情弹窗的"主要问题"列表，如 `"7 人将 Myanmar 与 Indonesia 合并"`
- **方案**: 在 `stepMetrics[taskNum]` 增加 `issues: string[]`。逻辑：
  - 遍历该步骤所有提交的 `dataJson`
  - 对比 `answerKey`，找出出现 ≥ 2 次的相同错误答案
  - 生成可读描述（需要从 answerKey 获取正确答案来描述错误模式）

## 冻结约束

1. **Entity 不变** — 不能修改 `*.entity.ts` 文件，不能加新列或新表
2. **Controller 不变** — `classroom.controller.ts` 签名不变
3. **现有测试全部通过** — 不能删除或修改现有测试的断言
4. **向后兼容** — 所有新字段是增量添加，不删除现有字段
5. **无外部依赖** — 不引入新 npm 包

## Prerequisites

### Preflight
| Check | Command | On failure |
|-------|---------|------------|
| jq installed | `command -v jq` | Install: `brew install jq` |
| claude CLI available | `command -v claude` | Install: `npm install -g @anthropic-ai/claude-code` |
| better-sqlite3 installed | `cd solutions/business/live-lesson/backend && node -e "require('better-sqlite3')"` | Run `npm install` |
| Tests pass | `cd solutions/business/live-lesson/backend && npx jest --no-coverage 2>&1 \| tail -1 \| grep -q 'passed'` | Fix broken tests first |

### Health (between iterations)
| Check | Command | On failure |
|-------|---------|------------|
| Tests still pass | `cd solutions/business/live-lesson/backend && npx jest --no-coverage 2>&1 \| tail -1 \| grep -q 'passed'` | Revert last iteration |
| Build compiles | `cd solutions/business/live-lesson/backend && npx nest build 2>&1` | Fix compile errors |
