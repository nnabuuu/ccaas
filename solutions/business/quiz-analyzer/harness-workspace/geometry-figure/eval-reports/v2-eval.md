# Evaluation Report — v2

## 概要

| 指标 | 值 |
|------|------|
| Benchmark 总题数 | 10 |
| 实际测试题数 | 2 (benchmarkSize: 2) |
| 成功产出 geometry 数据 | 0 |
| 错误数 | 2 (均为 HTTP 429) |
| 平均耗时 | 16,542ms |
| 平均工具调用 | 0 |

**关键发现**: 本轮测试仅覆盖 2/10 题，且均因 HTTP 429 速率限制失败，未产出任何 geometryFigure 数据。评分基于实际产出（零输出）。

---

## 逐题明细

### geo-001: 直角三角形 ABC，∠C=90°，AC=3，BC=4，求 AB

**错误**: HTTP 429 — 无任何输出

| Dimension | Score | Notes |
|-----------|-------|-------|
| D1 Schema Validity | 1/5 | geometryFigure 和 solutionGeometryFigure 均缺失（fields 为空对象） |
| D2 Reference Integrity | 1/5 | 无 elements，无法评估引用完整性 |
| D3 Geometric Correctness | 1/5 | 无几何元素输出，题目要求的三角形、直角标记等全部缺失 |
| D4 Bbox Quality | 1/5 | 无 bbox |
| D5 Visual Polish | 1/5 | 无任何视觉元素 |
| D6 Animation Quality | 5/5 | 非动画题，自动满分 |
| D7 Construction Usage | 1/5 | 无构造元素 |

---

### geo-002: 等腰三角形 ABC，AB=AC=5，BC=6，AD⊥BC 于 D，求 AD

**错误**: HTTP 429 — 无任何输出

| Dimension | Score | Notes |
|-----------|-------|-------|
| D1 Schema Validity | 1/5 | geometryFigure 和 solutionGeometryFigure 均缺失（fields 为空对象） |
| D2 Reference Integrity | 1/5 | 无 elements，无法评估引用完整性 |
| D3 Geometric Correctness | 1/5 | 无几何元素输出，预期的等腰三角形、高 AD、垂足 D 等全部缺失 |
| D4 Bbox Quality | 1/5 | 无 bbox |
| D5 Visual Polish | 1/5 | 无任何视觉元素 |
| D6 Animation Quality | 5/5 | 非动画题，自动满分 |
| D7 Construction Usage | 1/5 | 无构造元素（D 应用 perpendicularpoint 构造） |

---

### geo-003 ~ geo-010: 未测试

本轮 benchmarkSize 设置为 2，以下 8 题未执行测试：
- geo-003: 角平分线 (未测试)
- geo-004: 矩形翻折 (未测试)
- geo-005: 旋转等腰三角形 — 动画题 (未测试)
- geo-006: 圆的切线 (未测试)
- geo-007: 椭圆焦点 (未测试)
- geo-008: 菱形对角线 (未测试)
- geo-009: 单位圆三角函数 (未测试)
- geo-010: 绕点旋转 — 动画题 (未测试)

---

## Penalty 扣分明细

| Rule | Count | Affected Questions | Deduction |
|------|-------|-------------------|-----------|
| 断引用渲染失败 | 0 | — | 0 |
| 动画题缺 solutionGeometryFigure | 0 | — (动画题 geo-005, geo-010 未测试) | 0 |
| range 反转 | 0 | — | 0 |
| bbox 严重失衡 | 0 | — | 0 |
| **Penalty 小计** | | | **0** |

> 注：因完全无输出，penalty 规则无触发条件。但这不代表质量良好——恰恰相反，是因为产出为零无法进一步扣分。

---

## 维度平均分

基于 2 道已测试题目计算平均：

| Dimension | Weight | Avg Score | Weighted |
|-----------|--------|-----------|----------|
| D1 Schema Validity | 15 | 1.0/5 | 3.0 |
| D2 Reference Integrity | 20 | 1.0/5 | 4.0 |
| D3 Geometric Correctness | 25 | 1.0/5 | 5.0 |
| D4 Bbox Quality | 10 | 1.0/5 | 2.0 |
| D5 Visual Polish | 10 | 1.0/5 | 2.0 |
| D6 Animation Quality | 15 | 5.0/5 | 15.0 |
| D7 Construction Usage | 5 | 1.0/5 | 1.0 |
| **维度小计** | | | **32.0** |
| Penalties | | | **0** |

> D6 高分（15.0）仅因两道测试题均为非动画题自动满分，不反映实际动画质量。动画题 geo-005、geo-010 未被测试覆盖。

---

## Top 3 未解决问题

1. **HTTP 429 速率限制导致全面失败**: 2/2 测试题均因 HTTP 429 失败，零 geometry 输出。这是基础设施层面的阻塞问题——在 rate limit 解决之前，无法评估实际 figure 质量。
2. **Benchmark 覆盖率极低 (20%)**: benchmarkSize 仅为 2，8 道题（含 2 道关键动画题 geo-005、geo-010）完全未测试。无法评估角平分线、翻折、旋转、圆、椭圆、菱形等高级几何类型。
3. **无法验证 v1→v2 改进效果**: 由于本轮零输出，无法与 v1 对比是否有质量提升。Generator 可能已做了改进，但无法通过本轮测试验证。

---

## 改进建议（供 Generator 参考）

1. **解决 HTTP 429 问题（优先级最高）**: test-runner 需要在请求之间增加延时（如 5-10 秒间隔），或实现 retry with exponential backoff。这是 `harness.sh` 或 `test-runner.mjs` 的问题，不是 SKILL.md 的问题。建议修改 `test-runner.mjs` 增加 `await sleep(5000)` 在每次 API 调用之间。
2. **将 benchmarkSize 提升至 10**: 当前仅测试 2 题无法全面评估质量。建议在 `harness.sh` 或 test-runner 配置中将 benchmarkSize 设置为 10（或至少 5 以覆盖所有 category）。
3. **先做冒烟测试**: 在跑完整 benchmark 之前，先用单题手动测试确认 CCAAS 后端正常响应且 geometryFigure 字段有数据返回。可通过 `curl` 直接调用 API 验证。

---

总分: 32/100
