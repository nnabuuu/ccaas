# Evaluation Report — v1

> **Coverage Warning**: 本轮仅运行了 **1/10** 道 benchmark 题目（benchmarkSize=1），且为最简单的 geo-001（difficulty=1，无动画）。得分仅反映该单题质量，不代表引擎对复杂题型（动画、翻折、解析几何等）的能力。Validation 脚本因路径错误未能执行 Zod 校验。

## 逐题明细

### geo-001: 直角三角形 ABC，∠C=90°，AC=3，BC=4，求 AB

| Dimension | Score | Notes |
|-----------|-------|-------|
| D1 Schema Validity | 5/5 | geometryFigure 完整：kind="2d"，bbox=[−1.5,6,5.5,−1.5] 为 4 数字数组，elements 非空（14 个），每个 element 有 type/parents/attrs。非动画题无需 solutionGeometryFigure |
| D2 Reference Integrity | 5/5 | 0 个断引用。ID registry: {C, A, B, segCA, segCB, segAB, tri, sq1, sq2, sq3}。所有 segment parents (C→A, C→B, A→B, sq1→sq2, sq2→sq3) 和 polygon parents (C,A,B) 均指向已定义 ID |
| D3 Geometric Correctness | 5/5 | 全部 expectedElements 覆盖：C(0,0), A(3,0), B(0,4) → AC=3✓, BC=4✓, ∠C=90°✓；segCA/segCB/segAB 三条边✓；sq1(0.35,0)/sq2(0.35,0.35)/sq3(0,0.35) 构成直角标记✓；text 标注 "AC=3"/"BC=4"/"AB=?" 增强教学表达 |
| D4 Bbox Quality | 5/5 | bbox=[-1.5, 6, 5.5, -1.5]，x-range=7.0, y-range=7.5，比例=7.0/7.5=0.933（在 0.7~1.4 范围内✓）。所有点在 bbox 内✓，padding 约 20-30%（含 text 标注空间）合理✓ |
| D5 Visual Polish | 4/5 | 3/3 可见 point 均有 name + label.fontSize + label.offset✓；辅助点 sq1/sq2/sq3 设 visible:false✓；颜色一致（#1a1a2e 点、#2c5f8a 边、#c0392b 斜边）✓；**但所有 14 个 element 均未设置 highlight:false，鼠标悬停会触发 JXGraph 默认高亮** |
| D6 Animation Quality | 5/5 | 非动画题，自动满分 |
| D7 Construction Usage | 5/5 | 本题无派生点（A/B/C 均为顶点，非 midpoint/foot/intersection），直接坐标定义合理。直角标记辅助点 sq1/sq2/sq3 用 hardcode 可接受（它们是视觉元素非几何构造） |

---

**geo-002 至 geo-010：未测试（benchmarkSize=1，无结果数据）**

> 以下 9 道题因 test-runner 配置 benchmarkSize=1 而未被执行，不纳入本轮评分计算。

---

## Penalty 扣分明细

| Rule | Count | Affected Questions | Deduction |
|------|-------|-------------------|-----------|
| 断引用渲染失败 | 0 | — | 0 |
| 动画题缺 solutionGeometryFigure | 0 | — | 0 |
| range 反转 | 0 | — | 0 |
| bbox 严重失衡 | 0 | — | 0 |
| **Penalty 小计** | | | **0** |

> geo-001 为非动画题，无 penalty 触发条件。动画题 geo-005/geo-010 未被测试。

## 维度平均分

> 基于已测试的 1 道题（geo-001）计算平均

| Dimension | Weight | Avg Score | Weighted |
|-----------|--------|-----------|----------|
| D1 Schema Validity | 15 | 5.0/5 | 15.0 |
| D2 Reference Integrity | 20 | 5.0/5 | 20.0 |
| D3 Geometric Correctness | 25 | 5.0/5 | 25.0 |
| D4 Bbox Quality | 10 | 5.0/5 | 10.0 |
| D5 Visual Polish | 10 | 4.0/5 | 8.0 |
| D6 Animation Quality | 15 | 5.0/5 | 15.0 |
| D7 Construction Usage | 5 | 5.0/5 | 5.0 |
| **维度小计** | | | **98.0** |
| Penalties | | | **0** |

## Top 3 未解决问题

1. **Benchmark 覆盖率极低（1/10）**：仅测试了最简单的直角三角形（difficulty=1，无动画），完全未验证动画题（geo-005/geo-010 的 animation 块、snapValues、solutionGeometryFigure）、翻折题（geo-004 的 reflection 构造）、圆切线（geo-006）、椭圆（geo-007）等核心题型。当前 98 分不具备全面代表性，真实分数在全量测试后可能显著下降。
2. **highlight:false 未全局设置**：geo-001 所有 14 个 element 均缺少 `highlight: false`，JXGraph 默认 highlight=true 会导致鼠标悬停时点/线/面变色放大，影响静态教学配图的展示效果。这很可能是 SKILL.md 模板中缺少对该属性的要求。
3. **Validation 脚本路径错误**：validate-construction.mjs 第 378 行 `readFileSync('benchmark.json')` 找不到文件（ENOENT），因 benchmark.json 位于 harness workspace 根目录而非 validation/ 子目录。导致 D1 的 Zod 自动校验完全缺失，仅靠人工审查。

## 改进建议（供 Generator 参考）

1. **[test-runner / harness.sh] 将 benchmarkSize 从 1 扩大到 10**：确保覆盖所有题型，特别是 hasAnimation=true 的 geo-005 和 geo-010（这两题涉及 animation 块、expr 动态点、solutionGeometryFigure，是质量评估的核心场景）。这是获得可信评估分数的前置条件。
2. **[SKILL.md — geometry-problem-figure 和 geometry-solution-figure] 在 attrs 规范中强制要求 `highlight: false`**：在两个 SKILL.md 的 element attrs 默认值部分，添加规则："所有 element 的 attrs 必须包含 `\"highlight\": false`"。可在示例 JSON 中也加入该字段，让 LLM 学习到此约束。
3. **[validation/validate-construction.mjs] 修复 benchmark.json 路径**：将第 378 行的路径从相对路径改为 `path.resolve(__dirname, '../benchmark.json')` 或通过 CLI 参数 `--benchmark` 传入路径，确保 Zod 自动校验正常执行，为后续迭代提供自动化 D1 检测能力。

总分: 98/100
