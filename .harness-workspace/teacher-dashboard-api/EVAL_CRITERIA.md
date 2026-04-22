# 评分标准 — 教师端 API 数据完整性

## 评分维度

| # | 维度 | 权重 | 检测方法 |
|---|------|------|---------|
| D1 | 字段完整性 | 25/100 | 对比设计 STEPS 数据模型每个字段，检查 getState() 是否返回 |
| D2 | 计算正确性 | 25/100 | 构造已知输入，验证聚合值数学正确 |
| D3 | Issues 质量 | 20/100 | 给定特定错误分布的 submission data，验证 issues 检测到常见错误模式 |
| D4 | 测试覆盖 | 15/100 | 所有新字段有对应测试，且全部通过 |
| D5 | 向后兼容 | 15/100 | 现有测试全通过，无 entity 变更，无 controller 签名变更 |

---

## 维度详细评分

### D1: 字段完整性 (25/100)

**5/5 (25分)**:
- `stepMetrics[n]` 包含: `currentCount, completedCount, completionRate, avgScore, byDimension, medianTime, avgTime, aiRounds, aiPeople, alertTag, issues`
- `byDimension` 的键为可读维度名（非 `q0`/`place` 代码名）
- `students[]` 每个学生有 `status` 字段 (`done/prog/stuck/reading`)
- `students[].submissions[step]` 有 `duration` 秒数和 `aiRoundsCount`
- `healthCards` 对象包含 `furthest`, `median`, `stuck`, `aiTotal`
- `questionAggregates[]` 的 `isHigh` 阈值为 `count >= 4`

**3/5 (15分)**: 缺少 1-2 个字段，或字段存在但格式不完全匹配

**1/5 (5分)**: 缺少 3+ 个字段，或返回结构有明显偏差

**检测方法**: 读取 `getState()` 源码，列出所有返回字段，逐项对比 SPEC.md 的 Gap 列表

---

### D2: 计算正确性 (25/100)

**5/5 (25分)**:
- byDimension 维度名从 manifest readingSteps 正确提取
- per-student duration 计算逻辑正确（task1: submitted - joined; taskN: submitted[N] - submitted[N-1]）
- stuck 检测逻辑合理（基于时间阈值或无新提交）
- alertTag 优先级正确（stuck > wrong_dimension > issue）
- healthCards 各指标计算正确
- issues 的 common wrong answer detection 能正确识别重复错误

**3/5 (15分)**: 1-2 个聚合值计算有 off-by-one 或边��问题

**1/5 (5分)**: 核心计算逻辑有误（如时间差方向反了、百分比分母为 0 未处理）

**检测方法**: 读取私有方法源码 + 测试用例，验证算法逻辑和边界处理

---

### D3: Issues 质量 (20/100)

**5/5 (20分)**:
- 对 quiz/match 类型：检测到多人选择相同错误选项，生成如 "N 人选了 X（应为 Y）"
- 对 matrix 类型：检测到多人在同一行/列犯相同错误，生成如 "N 人将 X 与 Y 混淆"
- 对 stance 类型：检测到常见的证据不足模式
- issues 按严重程度（出现次数）降序排列
- 测试验证至少 2 种题型的 issue 生成

**3/5 (12分)**: 只处理了 1-2 种题型，或描述质量一般

**1/5 (4分)**: issues 始终为空，或只做了 byDimension 的文字转述

**检测方法**: 构造含特定错误模式的测试数据，验证 issues 输出

---

### D4: 测试覆盖 (15/100)

**5/5 (15分)**:
- 每个新字段（G1-G7）至少有 1 个测试用例
- 测试使用精确构造的输入（非随机），验证精确的期望输出
- 所有新测试通过 `npx jest --no-coverage`
- 测试覆盖了边界情况（空教室、单人、全部完成）

**3/5 (9分)**: 覆盖了主要字段但缺少边界测试

**1/5 (3分)**: 新字段缺少测试，或测试写了但不通过

**检测方法**: 运行 `npx jest --no-coverage` 并读取测试文件，统计新增测试数

---

### D5: 向后兼容 (15/100)

**5/5 (15分)**:
- 所有现有测试通过（0 failure）
- 无 entity 文件变更（`git diff` 验证 `*.entity.ts`）
- Controller 签名未变
- 现有返回字段未删除或重命名

**3/5 (9分)**: 测试全通过但有不必要的改动（如注释变更、import 重排）

**1/5 (3分)**: 有测试失败，或修改了 entity 文件

**检测方法**: `npx jest --no-coverage`（结果行），`git diff --name-only` 检查范围

---

## Penalty 规则

| 触发条件 | 扣分 |
|---------|------|
| 修改了任何 `*.entity.ts` | -10 |
| 引入新 npm 依赖 | -5 |
| 测试用了 `setTimeout` / `sleep` 等时间等待 | -3 |
| 有 `any` 类型在新增的公开接口中 | -2 |
| console.log / debugger 残留 | -2 |

## 阈值

- **Pass score**: 75/100
- **Target score**: 90/100

## 评分输出格式

```
总分: XX/100
```
