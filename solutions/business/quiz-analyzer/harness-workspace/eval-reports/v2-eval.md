# Evaluation Report — v2

> 评估范围：benchmark 12 题，实际测试 1 题（benchmarkSize=1），仅 bench-001 有结果。
> 评估基于实际产出数据评分，未测试的 11 题不纳入维度平均分计算。

## 测试概况

| 指标 | 值 |
|------|-----|
| Benchmark 总题数 | 12 |
| 实际测试题数 | 1 (benchmarkSize=1) |
| 成功产出分析 | 1 |
| 错误数 | 0 |
| 平均核心字段数 | 8.0/10 |
| 平均工具调用数 | 34 |
| 平均耗时 | 271,691ms (~4.5min) |

---

## 逐题明细

### bench-001: 判断方程 x² - 4x + 4 = 0 的根的情况（选择题）

| Dimension | Score | Notes |
|-----------|-------|-------|
| D1 Field Completion | 4/5 | 8/10 核心字段成功。**缺失**: `quickSummary`、`analysisStrategy`。`quizAnalysis` 写入有错误（值为 `<tool_use_error>Sibling tool call errored</tool_use_error>`），但该字段不在核心10字段内 |
| D2 Answer Correctness | 5/5 | correctAnswer="B"，与 expectedAnswer="B" 完全匹配。solutionSteps 最后一步 formula "Δ = 0 → 两个相等的实数根" 与答案 B 完全一致 |
| D3 Quiz Type | 5/5 | quizType="choice" 正确 ✅，options 4 个匹配 optionCount=4 ✅，stem 干净无选项标记混入 ✅，**options 已去除 A./B./C./D. 前缀**（v1 问题已修复） |
| D4 Solution Steps | 5/5 | 3 个步骤，逻辑递进清晰（提取系数→代入判别式→判断结论）。**每步均有独立 formula 字段**（v1 问题已修复），描述具体，最终结论与 correctAnswer 一致 |
| D5 KP Tags | 5/5 | 2 个标签均为叶节点(level=6)：①"一元二次方程根的判别式" confidence=0.95 ②"一元二次方程的根" confidence=0.70。verified=true ✅, path 6 层 ✅, confidence∈[0.7,1.0] ✅, source 有值 ✅。覆盖 benchmark expectedKP "一元二次方程的判别式"(模糊匹配tag①) 和 "一元二次方程"(tag②为其叶子后代) |
| D6 Geometry | 5/5 | hasGeometry=false，自动满分 |

---

## v1 → v2 改进对比

| 维度 | v1 Score | v2 Score | 改进点 |
|------|----------|----------|--------|
| D1 | 4/5 | 4/5 | 缺失字段从 `analysisStrategy`+`knowledgeGapAnalysis` 变为 `quickSummary`+`analysisStrategy`。`knowledgeGapAnalysis` 已修复产出 |
| D3 | 4/5 | 5/5 | options 已去除 A./B./C./D. 前缀 |
| D4 | 4/5 | 5/5 | solutionSteps 每步增加了独立 formula 字段 |
| D5 | 4/5 | 5/5 | 从 1 个 KP 标签增加到 2 个，覆盖度提升 |
| Penalty | -6 | -3 | parsedContent 不再重复写入，quizAnalysis 重试次数从 ~20 次降至 ~12 次 |

---

## Penalty 扣分明细

| Rule | Count | Affected Questions | Deduction |
|------|-------|-------------------|-----------|
| 答案与步骤矛盾 | 0 | — | 0 |
| 父节点当叶子 | 0 | — | 0 |
| 重复字段写入 | 1 field | bench-001: `quizAnalysis`(12次写入) | -3 |
| 英文输出 | 0 | — | 0 |
| **Penalty 小计** | | | **-3** |

**重复写入详情**: `duplicateFields` 数组共 24 条记录。`quizAnalysis` 被 write_output 12 次（首次返回错误后仍持续重试），违反 SKILL.md "失败不重试" 规则。相比 v1（~20次），重试次数有所减少但仍然显著。其余字段（parsedContent, correctAnswer, knowledgePointTags 等）均仅写入 1 次（v1 中 parsedContent 重复的问题已修复）。

---

## 维度平均分

> 仅基于实际测试的 1 题（bench-001）计算平均分。

| Dimension | Weight | Avg Score | Weighted |
|-----------|--------|-----------|----------|
| D1 Field Completion | 25 | 4.00/5 | 20.00 |
| D2 Answer Correctness | 20 | 5.00/5 | 20.00 |
| D3 Quiz Type | 15 | 5.00/5 | 15.00 |
| D4 Solution Steps | 15 | 5.00/5 | 15.00 |
| D5 KP Tags | 15 | 5.00/5 | 15.00 |
| D6 Geometry | 10 | 5.00/5 | 10.00 |
| **维度小计** | | | **95.00** |
| Penalties | | | **-3.00** |

---

## Top 3 未解决问题

1. **核心字段缺失 2/10（影响 D1，损失 5 加权分）**: `quickSummary` 和 `analysisStrategy` 两个核心字段未输出。v1 缺失的是 `analysisStrategy` + `knowledgeGapAnalysis`，v2 修复了 `knowledgeGapAnalysis` 但新增 `quickSummary` 缺失。说明 SKILL.md 对这两个字段的产出指令不够显著，或它们在工作流中被排在低优先级位置。

2. **quizAnalysis 仍在重复写入（触发 -3 penalty）**: quizAnalysis 被写入 12 次（v1 约 20 次），虽有改善但仍然严重。每次写入均触发 "Sibling tool call errored"，Agent 未遵守"失败立即跳过"规则。34 次总工具调用中约 11 次被浪费在 quizAnalysis 无效重试上，占总调用的 32%。这直接消耗 token 预算并可能导致后续字段无法输出。

3. **耗时增加（271s vs v1 的 148s）**: 平均耗时从 v1 的 ~2.5min 增加到 ~4.5min，增长 83%。新增的 formula 字段生成和更完整的 KP 标签查找增加了有效工作量，但 quizAnalysis 的 12 次重试也浪费了大量时间。

---

## 改进建议（供 Generator 参考）

1. **[SKILL.md §核心字段清单] 确保 `quickSummary` 和 `analysisStrategy` 被生成**: 这两个字段连续两轮缺失（`analysisStrategy` 两轮均缺，`quickSummary` v2 新增缺失）。建议在 SKILL.md 工作流中为这两个字段设立**独立的步骤编号**（而非附属于其他步骤），并在核心字段检查清单中用醒目标记标注：
   ```
   🔴 必须输出（历史上最常遗漏）:
   - quickSummary: 一句话概括题目和解法
   - analysisStrategy: 解题策略选择的理由
   将这两个字段放在 parsedContent 之后、solutionSteps 之前的位置
   ```

2. **[SKILL.md §工具调用纪律] 进一步强化 quizAnalysis 重试禁令**: v1→v2 重试次数从 ~20 降至 12，说明当前措辞有一定效果但不够。建议采用**硬编码计数限制**的措辞：
   ```
   🔴 每个字段的 write_output 调用次数上限 = 1
   quizAnalysis 写入如果返回任何错误（包括 "Sibling tool call errored"）→ 立即跳到下一步
   绝对不可以对同一字段进行第 2 次 write_output
   ```

3. **[SKILL.md §工作流顺序] 将 quickSummary 和 analysisStrategy 前置到工作流早期**: 当前 `quickSummary` 可能排在工作流末尾或根本未出现在步骤清单中。作为"快速概要"，它应是最早生成的字段之一（题目解析后立即生成）。`analysisStrategy` 作为"策略选择"也应在实际解题（solutionSteps）之前生成。

总分: 92/100
