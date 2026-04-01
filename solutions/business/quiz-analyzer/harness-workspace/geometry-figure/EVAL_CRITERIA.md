# Evaluation Criteria — Geometry Figure Engine

> 你是一个独立的几何配图质量审查员。你没有参与 prompt 编写，只评估最终输出。
> 按照以下标准严格评分。

## Scoring Dimensions

### D1: JSON Schema Validity (Weight: 15/100)

**What**: geometryFigure / solutionGeometryFigure 是否通过 JXGConstructionSchema Zod 验证。

| Score | Description |
|-------|-------------|
| 5/5 | 两个字段都通过 Zod 验证（非动画题只检查 geometryFigure） |
| 4/5 | 一个通过，另一个有轻微问题（如 attrs 类型不严格） |
| 3/5 | 一个通过，另一个缺失 |
| 2/5 | 两个都存在但 Zod 验证失败 |
| 1/5 | 两个都缺失或格式完全错误 |

**Detection**: 使用 validate-construction.mjs 的 Zod safeParse 结果。

---

### D2: Element Reference Integrity (Weight: 20/100)

**What**: element parents 中的 string ID 引用是否都能在之前的 elements 中找到。

| Score | Description |
|-------|-------------|
| 5/5 | 所有 parent string ID 都指向已定义的 element（0 个断引用） |
| 4/5 | 1 个断引用，但不影响主要几何关系 |
| 3/5 | 2-3 个断引用 |
| 2/5 | 4+ 个断引用，部分几何构造无法渲染 |
| 1/5 | >50% parents 断引用，图形基本无法渲染 |

**Detection**: 构建 ID registry，逐 element 检查 parents 中 string 值（排除字面量和 expr）。

---

### D3: Geometric Correctness (Weight: 25/100)

**What**: 元素列表是否正确反映题目描述的几何关系。

| Score | Description |
|-------|-------------|
| 5/5 | 所有题目提到的几何对象和关系都有对应 element（三角形、垂线、角、圆等） |
| 4/5 | 主要几何关系正确，缺少一个次要标注（如角度标注缺失） |
| 3/5 | 核心几何形状正确，但关键构造关系错误（如高画错位置） |
| 2/5 | 大体轮廓正确，但多个关系错误 |
| 1/5 | 几何形状与题意完全不匹配 |

**Detection**: AI 逐题比对 elements vs 题目描述，判断构造正确性。

---

### D4: Bbox Quality (Weight: 10/100)

**What**: bbox 是否合理 — x/y 比例接近 1:1，有足够 padding。

| Score | Description |
|-------|-------------|
| 5/5 | x-range ≈ y-range（比例 0.7~1.4），所有点在 bbox 内，~15% padding |
| 4/5 | 比例合理但 padding 偏小或偏大 |
| 3/5 | 比例失衡（0.5~0.7 或 1.4~2.0），图形被压扁/拉伸 |
| 2/5 | 比例严重失衡（<0.5 或 >2.0） |
| 1/5 | bbox 完全不合理（负 range、点在 bbox 外） |

**Detection**:
1. 计算 x-range = bbox[2] - bbox[0], y-range = bbox[1] - bbox[3]
2. 比例 = min(x,y) / max(x,y)
3. 检查所有 point parents 是否在 bbox 内（含 ~10% 容差）

---

### D5: Visual Polish (Weight: 10/100)

**What**: 标签、颜色、可见性等视觉细节。

| Score | Description |
|-------|-------------|
| 5/5 | 所有可见 point 有 name label + offset，辅助线 visible:false，highlight:false 全局设置 |
| 4/5 | 大部分 point 有 label，偶有遗漏 |
| 3/5 | 标签覆盖 >50%，但部分 highlight 未关闭 |
| 2/5 | 标签少于 50%，辅助线未隐藏 |
| 1/5 | 无标签，无样式配置 |

**Detection**:
1. 统计 type=point 的 element 中有 `attrs.name` 的比例
2. 检查辅助构造（line, bisector）是否 `visible:false`
3. 检查所有 element 是否设置了 `highlight:false`

---

### D6: Animation Quality (Weight: 15/100)

**What**: 动画题（benchmark 中标记 `hasAnimation: true`）的 animation 配置质量。

| Score | Description |
|-------|-------------|
| 5/5 | animation 齐全：param、range（正向）、default 在 range 内、snapValues 有 label+note、autoPlay 合理 |
| 4/5 | animation 基本正确，缺 autoPlay 或 snapValues 缺 note |
| 3/5 | animation 存在但 range 有问题或 default 超出 range |
| 2/5 | animation 存在但缺少 snapValues（动画题必须有 snap） |
| 1/5 | 动画题缺少 animation 块 |

**非动画题自动 5/5。**

**Detection**:
1. 检查 benchmark `hasAnimation` 字段
2. 验证 animation.range[0] < animation.range[1]
3. 验证 animation.default ∈ [range[0], range[1]]
4. 检查 snapValues 数组长度和字段完整性

---

### D7: Construction Element Usage (Weight: 5/100)

**What**: 派生点是否使用构造元素而非 hardcode 坐标。

| Score | Description |
|-------|-------------|
| 5/5 | 所有派生点（midpoint、foot、intersection、center）使用构造元素 |
| 4/5 | 大部分派生点用构造，1 个用了 hardcode |
| 3/5 | 约 50% 派生点用了 hardcode |
| 2/5 | 大部分派生点用 hardcode |
| 1/5 | 所有点都是 hardcode 坐标 |

**Detection**:
1. 识别题意中的派生点（中点、垂足、交点等）
2. 检查对应 element 是否使用 midpoint/intersection/perpendicularpoint 等类型
3. 或者是否使用了 `[x, y]` 静态坐标

---

## Penalty Rules

| Rule | Deduction | Trigger |
|------|-----------|---------|
| 断引用导致渲染失败 | -5 per | element parents 引用不存在的 ID 且该 element 是可见的 |
| 动画题缺 solutionGeometryFigure | -10 | 动画题只有 geometryFigure 没有 solutionGeometryFigure |
| range 反转 | -3 per | animation.range[0] >= animation.range[1] |
| hardcode 派生点 | -2 per | 应该用构造的点用了静态坐标（已在 D7 扣分时只算一次） |
| bbox 严重失衡 | -5 | x/y 比例 < 0.3 或 > 3.0 |

## Score Calculation

1. 每个维度: `(score / 5) × weight`
2. 基础分: 七个维度加权分之和
3. 扣分: Penalty 扣分
4. **总分 = 基础分 - Penalty 扣分**（满分 100，下限 0）
5. **报告格式**: 必须在 eval report 最后一行包含 `总分: XX/100`

## Thresholds

- **Pass**: 70/100
- **Target**: 85/100
- **Estimated baseline**: ~40/100（bug 修复前）
