---
name: geometry-problem-figure
description: >
  Generate a JXGConstruction JSON for a static geometry diagram.
  Use whenever a math problem contains geometric content — triangles, circles,
  polygons, solid geometry — even when no figure is provided and even when the
  user does not explicitly ask for one. Output ONLY a fenced json block.
  The GeometryFigure React component handles all rendering.
---

# Geometry Problem Figure

Output a single fenced ```json block. Nothing else. No prose, no JSXGraph code.

The schema is a **JXGConstruction**: a list of JSXGraph elements to replay.
Each element maps directly to `board.create(type, parents, attrs)`.

## Step 1 — Place base points; construct derived points

Two kinds of points:

- **Base points** (triangle vertices, given points): hardcode coordinates.
- **Derived points** (intersections, feet, midpoints, centers): NEVER
  hardcode — use construction elements (bisector, intersection,
  perpendicularpoint, midpoint, incenter, …). JSXGraph computes the
  exact position.

常用坐标配方（按题目条件选择）：

| 条件 | 坐标放置 |
|------|----------|
| Rt△ ∠C=90°, AC=b, BC=a | C=(0,0), B=(a,0), A=(0,b) |
| 等腰△ AB=AC, BC=a, 高=h | B=(-a/2,0), C=(a/2,0), A=(0,h) |
| 一般△ ∠B=α, ∠C=β, BC=a | B=(0,0), C=(a,0), A=(a·sinβ/sin(α+β)·cosα, a·sinβ/sin(α+β)·sinα) |
| 等边△ 边长=a | A=(0,0), B=(a,0), C=(a/2, a√3/2) |
| 矩形 AB=w, BC=h | D=(0,0), C=(w,0), B=(w,h), A=(0,h) |
| 菱形 对角线 AC=p, BD=q | 中心 O=(0,0), A=(-p/2,0), C=(p/2,0), B=(0,q/2), D=(0,-q/2) |
| 圆O(r), 外点P距d | O=(0,0), P=(d,0)，切点用构造（见 circles-tangents.md）|
| 椭圆 x²/a²+y²/b²=1 | O=(0,0), F1=(-c,0), F2=(c,0)，c=√(a²-b²) |

**每个 point 元素必须有 `id`**。段、多边形、角等引用 point 的 id 字符串。

**ID 命名规范**（严格遵守，避免引用断裂）：
- 三角形顶点：`A`, `B`, `C`（大写单字母，与题目标注一致）
- 特殊点：`D`, `E`, `F`, `G`, `H`（按题目命名）
- 中心/原点：`O`（圆心、对角线交点、旋转中心）
- 辅助线：`lineBC`, `lineAC`（`line` + 两端点名拼接）
- 角平分线：`bisAE`（`bis` + 端点名拼接）
- 辅助圆：`circleO`, `circleM`（`circle` + 圆心名）
- 反射点：`Cp`（表示 C'，不要用特殊字符）

## Step 2 — Bbox

Bbox 格式: `[xmin, ymax, xmax, ymin]`（注意：第2个是 ymax，第4个是 ymin）。

keepaspectratio = true → **x-range 必须 ≈ y-range**，否则图形变形。

计算方法：
1. 找所有点的 x∈[x_lo, x_hi], y∈[y_lo, y_hi]
2. span = max(x_hi - x_lo, y_hi - y_lo)
3. 加 15% padding → bbox 范围 = span × 1.3
4. 居中：cx=(x_lo+x_hi)/2, cy=(y_lo+y_hi)/2

Wrong: 三角形 x∈[0,4],y∈[0,1.9] → bbox [-0.5,2.5,4.5,-0.5] (x=5,y=3 压扁)
Fix: bbox [-0.5,4.8,4.5,-0.5] (两轴≈5，等比例)

**特殊场景 bbox**：
- 以原点为中心（椭圆、单位圆）：bbox 对称，如 `[-a*1.3, a*1.3, a*1.3, -a*1.3]`
- 菱形用对角线定义，中心在原点：bbox 应包裹 `±(AC/2+pad)` 和 `±(BD/2+pad)`
- 极端扁平图形（如 x=8, y=2）：span=8, bbox y 轴也扩展到 8，居中显示

## Step 3 — Construction elements

Rule: derived points MUST use construction elements — never manually compute coordinates.

### 构造 vs Hardcode 对比（绝对禁止 hardcode 派生点！）

❌ **错误** — hardcode 垂足 D 的坐标：
```json
{ "id":"D", "type":"point", "parents":[[3,0]], "attrs":{"name":"D","fixed":true} }
```

✅ **正确** — 用构造元素自动计算：
```json
{ "id":"lineBC", "type":"line", "parents":["B","C"], "attrs":{"visible":false} }
{ "id":"D", "type":"perpendicularpoint", "parents":["A","lineBC"], "attrs":{"name":"D","fixed":true,"size":3,"fillColor":"#e67e22","strokeColor":"white","label":{"offset":[4,-14]},"highlight":false} }
```
同理：midpoint、intersection、incenter 等**必须**用构造元素，不得手动计算坐标值。

### Core construction elements (always available)

```json
{ "id":"lineBC", "type":"line", "parents":["B","C"], "attrs":{"visible":false} }
{ "id":"bisAE", "type":"bisector", "parents":["B","A","C"], "attrs":{"visible":false} }
{ "id":"E", "type":"intersection", "parents":["bisAE","lineBC",0], "attrs":{...} }
{ "id":"D", "type":"perpendicularpoint", "parents":["O","lineBC"], "attrs":{...} }
{ "id":"M", "type":"midpoint", "parents":["A","B"], "attrs":{...} }
```

### High-level sugar (renderer auto-expands)

```json
{ "id":"I", "type":"incenter",     "parents":["A","B","C"], "attrs":{...} }
{ "id":"O", "type":"circumcenter", "parents":["A","B","C"], "attrs":{...} }
{ "id":"H", "type":"orthocenter",  "parents":["A","B","C"], "attrs":{...} }
{ "id":"G", "type":"centroid",     "parents":["A","B","C"], "attrs":{...} }
```

### Extended types catalog

Also available (see `references/` for full patterns and worked examples):

| Type | Parents | Description |
|------|---------|-------------|
| `reflection` | `[point, line]` | Reflect point across line (axial symmetry) |
| `mirrorpoint` | `[point, center]` | Reflect point across center (point symmetry) |
| `tangent` | `[glider]` | Tangent line at a glider point |
| `arc` | `[center, p1, p2]` | Circular arc counterclockwise |
| `sector` | `[center, p1, p2]` | Filled circular sector |
| `semicircle` | `[p1, p2]` | Semicircle on diameter |
| `circumcircle` | `[A, B, C]` | Circle through three points |
| `incircle` | `[A, B, C]` | Inscribed circle of triangle |
| `glider` | `[x, y, element]` | Point constrained to element |
| `ellipse` | `[F1, F2, a]` | Ellipse from foci + semi-major |
| `parabola` | `[focus, directrix]` | Parabola from focus + directrix line |
| `hyperbola` | `[F1, F2, a]` | Hyperbola from foci + semi-transverse |
| `arrow` | `[p1, p2]` | Vector arrow |
| `parallel` | `[line, point]` | Line through point parallel to line |
| `parallelogram` | `[A, B, C]` | Auto-compute 4th vertex (D = A+C-B) |
| `regularpolygon` | `[p1, p2, n]` | Regular n-gon |
| `functiongraph` | `[func, xmin, xmax]` | Plot function (uses function string, not expr) |
| `curve` | `[xFunc, yFunc, tmin, tmax]` | Parametric curve |

Notes:
- `bisector` parents order: `[sidePoint1, vertex, sidePoint2]` — the middle point is the angle vertex
- Helper construction elements: set `"visible": false`
- Draw visible segments separately: `{ "type":"segment", "parents":["A","E"] }`
- `intersection` third parent is the index (0 or 1), selecting which intersection point
- Sub-element reference: `"perpSeg.point"` refers to the foot point of a perpendicular segment

## Reference files — Read before generating

When the problem matches a category below, **Read the reference file FIRST** to get
full construction patterns, coordinate recipes, and worked examples.

| Keywords in problem | File | Category |
|---------------------|------|----------|
| 翻折, 折叠, fold, reflect, 对称轴, 对称 | references/fold-reflection.md | 翻折/反射 |
| 旋转, rotate, 绕...转 | references/rotation.md | 旋转 |
| 圆, 切线, tangent, 弧, 扇形, 内切, 外接 | references/circles-tangents.md | 圆与切线 |
| 椭圆, 抛物线, 双曲线, 焦点, 准线, ellipse | references/analytic-geometry.md | 解析几何 |
| 平行四边形, 菱形, 梯形, 正多边形 | references/quadrilaterals.md | 四边形 |
| 向量, 三角函数, sin, cos, 单位圆 | references/vectors-trig.md | 向量/三角函数 |

If the problem is a basic triangle/angle problem, no reference needed — core rules suffice.

## Step 4 — Elements

**⚠️ 三条铁律（每个元素都必须遵守）**：
1. **每个元素**的 attrs 中必须有 `"highlight": false`（无例外）
2. **circle / ellipse / circumcircle / incircle** 必须有 `"fillColor": "none"`
3. **polygon** 的 `borders` 必须设为 `{"strokeColor": "none"}`（边由独立 segment 绘制）

**定义顺序规则**（违反会导致引用失败，这是最常见的致命错误！）：
1. **第一层**：base points（三角形顶点、给定点）— 每个必须有 `id`
2. **第二层**：polygon 填充（引用第一层 point id）
3. **第三层**：helper lines/circles（`visible:false`，每个必须有 `id`）
4. **第四层**：derived points（intersection, perpendicularpoint, midpoint — 引用第一层和第三层的 id）
5. **第五层**：segments, angles, 标注（引用已定义的 point id）

**铁律**：元素只能引用排在它**前面**的元素的 id。如果 A 引用了 B，那么 B 必须在 A 之前定义。

**ID 引用规则**：每个 `parents` 中的字符串引用必须对应前面某个元素的 `id`。
输出前自检：收集所有 `id` 值，确认每个 parents 中的字符串都在 id 集合中。如有遗漏，**必须停止并补充**。

Parent values:
- `"A"` → string id reference to element with id "A"
- `[x, y]` → static 2D coordinate
- `[x, y, z]` → static 3D coordinate
- `123` → literal number (e.g. radius)

**标准配色**（统一使用，避免随意选色）：
- 主色（顶点/主边）: `#2c5f8a`
- 高亮红（动点/关键线）: `#c0392b`
- 橙色（派生点/辅助）: `#e67e22`
- 绿色（重点边）: `#27ae60`
- 紫色（角/距离标注）: `#8e44ad`
- 灰色（辅助线/圆）: `#aaa`
- 中心/原点: `#1a1a2e`

**标签偏移指南**（根据点在图中的位置选择 label.offset）：

| 点的位置 | offset | 说明 |
|----------|--------|------|
| 左上方 | `[-14, 10]` | label 向左上偏移 |
| 右上方 | `[8, 10]` | label 向右上偏移 |
| 左下方 | `[-14, -10]` | label 向左下偏移 |
| 右下方 | `[8, -10]` | label 向右下偏移 |
| 正上方（顶点） | `[-6, 10]` | label 居中偏上 |
| 原点/中心 | `[-14, -12]` | label 偏左下，避免遮挡 |

Common patterns:

```json
{ "id":"A", "type":"point", "parents":[[0,0]], "attrs":{"name":"A","fixed":true,"size":4,"fillColor":"#2c5f8a","strokeColor":"white","label":{"offset":[-14,-10]},"highlight":false} }

{ "type":"segment", "parents":["A","B"], "attrs":{"strokeColor":"#2c5f8a","strokeWidth":2,"highlight":false} }

{ "type":"polygon", "parents":["A","B","C"], "attrs":{"fillColor":"#2c5f8a","fillOpacity":0.07,"borders":{"strokeColor":"none"},"highlight":false} }

{ "type":"angle", "parents":["C","B","A"], "attrs":{"radius":0.4,"fillColor":"#2c5f8a18","strokeColor":"#2c5f8a","label":{"text":"28°"},"highlight":false} }
```

Right-angle mark — use JSXGraph's built-in:

```json
{ "type":"angle", "parents":["A","C","B"], "attrs":{"type":"square","radius":0.12,"fillColor":"none","strokeColor":"#2c5f8a","strokeWidth":1.2,"highlight":false} }
```

Circle（圆）— **必须** `fillColor:"none"`，否则圆会被填充遮挡内部元素：

```json
{ "id":"circleO", "type":"circle", "parents":["O",5], "attrs":{"strokeColor":"#2c5f8a","strokeWidth":2,"fillColor":"none","highlight":false} }
```

Ellipse（椭圆）— 第三个 parent 是半长轴 `a`（不是 `2a`），**必须** `fillColor:"none"`：

```json
{ "id":"ellipse1", "type":"ellipse", "parents":["F1","F2",5], "attrs":{"strokeColor":"#2c5f8a","strokeWidth":2,"fillColor":"none","highlight":false} }
```

Dashed auxiliary segment:

```json
{ "type":"segment", "parents":["D","E"], "attrs":{"strokeColor":"#c0392b","dash":2,"strokeWidth":1.8,"highlight":false} }
```

3D elements (when kind is "3d"):

```json
{ "id":"A", "type":"point3d", "parents":[[-1,-1,0]], "attrs":{"name":"A","size":4,"fillColor":"#1a1a2e","strokeColor":"white","label":{"offset":[-18,-10]},"highlight":false} }

{ "type":"line3d", "parents":["A","B"], "attrs":{"straightFirst":false,"straightLast":false,"strokeColor":"#2c5f8a","strokeWidth":2,"highlight":false} }

{ "type":"line3d", "parents":["A","D"], "attrs":{"straightFirst":false,"straightLast":false,"strokeColor":"#aaa","strokeWidth":1.5,"dash":2,"strokeOpacity":0.5,"highlight":false} }

{ "type":"polygon3d", "parents":["A","B","C","D"], "attrs":{"fillColor":"#2c5f8a","fillOpacity":0.08,"highlight":false} }
```

## 输出前自检清单（必须逐项执行）

输出 JSON 之前，**必须执行以下验证**：

### 第零步：确保输出完整 JSON（不可省略！）
即使对题目类型不确定，也**必须输出**一个包含 `kind`、`bbox`、`elements` 的完整 JSON。
空输出（不调用 write_output）= 自动 0 分。**任何有效 JSON 都比没有输出好。**

### 第一步：ID 引用完整性验证（最重要！断引用 = 直接扣 20 分）

逐元素执行以下算法：
1. 维护一个"已定义 ID 集合"（初始为空）
2. 按 elements 数组顺序遍历每个元素：
   a. 如果元素有 `id`，将其加入集合
   b. 检查元素的 `parents`：每个**字符串类型**的 parent 必须**已在集合中**
   c. 特别注意：`intersection` 必须有第 3 个 parent（数字 0 或 1）
   d. `polygon` 的每个 parent 必须是 **point 类型**元素的 id
3. 如发现任何未定义引用 → **立即停止**，在引用位置之前补充缺失的元素定义
4. 最常遗漏：`intersection` 引用了 `"lineBC"` 但忘记在前面定义 `{ "id":"lineBC", "type":"line", ... }`

### 第二步：逐项检查
- [ ] `kind` 已设置（"2d" 或 "3d"）
- [ ] `bbox` 的 x-range ≈ y-range（差距 < 20%）
- [ ] 每个 point 都有 `id`
- [ ] 所有元素都有 `"highlight": false`
- [ ] 每个可见 point 都有 `name`、`label.offset`、`fixed:true`
- [ ] 派生点用构造元素（不 hardcode 坐标）
- [ ] 直角处有 `type:"square"` 的角标记
- [ ] 题目提到的角度都有 angle 标注
- [ ] `polygon` 的 `borders` 设为 `{"strokeColor":"none"}`（边由独立 segment 绘制）
- [ ] `circle` 和 `ellipse` 必须有 `"fillColor":"none"`（除非需要填充）
- [ ] `ellipse` 的第三个 parent 是 `a`（半长轴），不是 `2a`
- [ ] 解析几何题（椭圆/双曲线）有坐标轴辅助线

### 常见错误（绝对避免）
- ❌ parents 中引用了未定义的 id（如引用 `"lineBC"` 但没有定义该 line 元素）
- ❌ `polygon` 的 parents 引用了一个不是 point 的元素
- ❌ bbox x-range 和 y-range 差距 > 30%（图形变形）
- ❌ 忘记给 `intersection` 的 parents 加第三个参数（index: 0 或 1）
- ❌ `bisector` 的 parents 顺序错误（中间必须是角的顶点）
- ❌ `ellipse` parents 写成 `["F1","F2",10]` — 第三个应是半长轴 `a`，不是 `2a`
- ❌ 矩形/菱形折叠题忘记读 reference file
- ❌ `circle`/`ellipse` 没有 `"fillColor":"none"` — 圆被填充后遮挡内部元素
- ❌ 元素缺少 `"highlight":false` — 鼠标悬停时元素会高亮闪烁
- ❌ 定义元素引用了后面才定义的 id（违反"先定义后引用"铁律）

### Example 1 — 直角三角形 + 高（right triangle with altitude）

题目：Rt△ABC，∠C=90°，AC=3，BC=4。D 是 AB 上的高的垂足。

```json
{
  "kind": "2d",
  "bbox": [-1.2, 4.2, 5.2, -1.2],
  "elements": [
    { "id":"C", "type":"point", "parents":[[0,0]], "attrs":{"name":"C","fixed":true,"size":4,"fillColor":"#2c5f8a","strokeColor":"white","label":{"offset":[-14,-10]},"highlight":false} },
    { "id":"B", "type":"point", "parents":[[4,0]], "attrs":{"name":"B","fixed":true,"size":4,"fillColor":"#2c5f8a","strokeColor":"white","label":{"offset":[8,-10]},"highlight":false} },
    { "id":"A", "type":"point", "parents":[[0,3]], "attrs":{"name":"A","fixed":true,"size":4,"fillColor":"#2c5f8a","strokeColor":"white","label":{"offset":[-14,10]},"highlight":false} },
    { "type":"polygon", "parents":["A","B","C"], "attrs":{"fillColor":"#2c5f8a","fillOpacity":0.07,"borders":{"strokeColor":"none"},"highlight":false} },
    { "type":"segment", "parents":["A","B"], "attrs":{"strokeColor":"#2c5f8a","strokeWidth":2,"highlight":false} },
    { "type":"segment", "parents":["B","C"], "attrs":{"strokeColor":"#2c5f8a","strokeWidth":2,"highlight":false} },
    { "type":"segment", "parents":["A","C"], "attrs":{"strokeColor":"#2c5f8a","strokeWidth":2,"highlight":false} },
    { "id":"lineAB", "type":"line", "parents":["A","B"], "attrs":{"visible":false} },
    { "id":"D", "type":"perpendicularpoint", "parents":["C","lineAB"], "attrs":{"name":"D","fixed":true,"size":3,"fillColor":"#e67e22","strokeColor":"white","label":{"offset":[4,-14],"color":"#e67e22"},"highlight":false} },
    { "type":"segment", "parents":["C","D"], "attrs":{"strokeColor":"#c0392b","strokeWidth":1.8,"dash":2,"highlight":false} },
    { "type":"angle", "parents":["A","C","B"], "attrs":{"type":"square","radius":0.12,"fillColor":"none","strokeColor":"#2c5f8a","strokeWidth":1.2,"highlight":false} },
    { "type":"angle", "parents":["C","D","B"], "attrs":{"type":"square","radius":0.12,"fillColor":"none","strokeColor":"#8e44ad","strokeWidth":1.2,"highlight":false} }
  ]
}
```

注意：D 使用 `perpendicularpoint` 构造（不 hardcode 坐标），直角标记用 `type:"square"`。

### Example 2 — angle bisector intersection

```json
{
  "kind": "2d",
  "bbox": [-1, 6, 8, -1],
  "elements": [
    { "id":"B", "type":"point", "parents":[[0,0]], "attrs":{"name":"B","fixed":true,"size":4,"fillColor":"#2c5f8a","strokeColor":"white","label":{"offset":[-14,-10]},"highlight":false} },
    { "id":"C", "type":"point", "parents":[[7,0]], "attrs":{"name":"C","fixed":true,"size":4,"fillColor":"#2c5f8a","strokeColor":"white","label":{"offset":[8,-10]},"highlight":false} },
    { "id":"A", "type":"point", "parents":[[2.5,5]], "attrs":{"name":"A","fixed":true,"size":4,"fillColor":"#2c5f8a","strokeColor":"white","label":{"offset":[-6,10]},"highlight":false} },
    { "type":"polygon", "parents":["A","B","C"], "attrs":{"fillColor":"#2c5f8a","fillOpacity":0.07,"borders":{"strokeColor":"none"},"highlight":false} },
    { "id":"lineBC", "type":"line", "parents":["B","C"], "attrs":{"visible":false} },
    { "id":"lineAC", "type":"line", "parents":["A","C"], "attrs":{"visible":false} },
    { "id":"bisAE", "type":"bisector", "parents":["B","A","C"], "attrs":{"visible":false} },
    { "id":"bisBF", "type":"bisector", "parents":["A","B","C"], "attrs":{"visible":false} },
    { "id":"O", "type":"intersection", "parents":["bisAE","bisBF",0], "attrs":{"name":"O","fixed":true,"size":4,"fillColor":"#c0392b","strokeColor":"white","label":{"offset":[8,4],"color":"#c0392b"},"highlight":false} },
    { "id":"E", "type":"intersection", "parents":["bisAE","lineBC",0], "attrs":{"name":"E","fixed":true,"size":3,"fillColor":"#e67e22","strokeColor":"white","label":{"offset":[4,-14],"color":"#e67e22"},"highlight":false} },
    { "id":"F", "type":"intersection", "parents":["bisBF","lineAC",0], "attrs":{"name":"F","fixed":true,"size":3,"fillColor":"#e67e22","strokeColor":"white","label":{"offset":[8,4],"color":"#e67e22"},"highlight":false} },
    { "id":"D", "type":"perpendicularpoint", "parents":["O","lineBC"], "attrs":{"name":"D","fixed":true,"size":3,"fillColor":"#e67e22","strokeColor":"white","label":{"offset":[4,-14],"color":"#e67e22"},"highlight":false} },
    { "type":"segment", "parents":["A","E"], "attrs":{"strokeColor":"#c0392b","strokeWidth":1.5,"dash":2,"highlight":false} },
    { "type":"segment", "parents":["B","F"], "attrs":{"strokeColor":"#c0392b","strokeWidth":1.5,"dash":2,"highlight":false} },
    { "type":"segment", "parents":["O","D"], "attrs":{"strokeColor":"#8e44ad","strokeWidth":1.5,"dash":2,"highlight":false} },
    { "type":"angle", "parents":["O","D","C"], "attrs":{"type":"square","radius":0.15,"fillColor":"none","strokeColor":"#8e44ad","strokeWidth":1.2,"highlight":false} }
  ]
}
```
