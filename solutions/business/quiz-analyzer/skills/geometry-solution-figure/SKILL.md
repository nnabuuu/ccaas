---
name: geometry-solution-figure
description: >
  Generate a JXGConstruction JSON for an interactive solution diagram with
  a parameter slider and optional auto-play animation. Use when the solution
  involves a moving point, rotating segment, or parameter the student should
  explore. Paired with geometry-problem-figure: problem figure shows first,
  this appears in the solution view. Output ONLY a fenced json block.
---

# Geometry Solution Figure

Output a single fenced ```json block. Nothing else.

Extends the static schema with an `animation` block and `{ expr }` parents
for dynamic points. The renderer handles slider, play button, and snap buttons.

**触发条件** — 仅当题目包含以下关键词时生成本 skill 的输出：
- 旋转、绕...转、rotate
- 动点、滑动、参数变化
- "当...时求"（需要探索多个位置）
- "使得...成为等腰/垂直/平行"（需要 snapValues 展示特殊位置）

静态题目（无动画参数）**不生成** solution figure。

## Step 1 — Solve the problem first

**必须先完成解题，再生成 JSON**：
1. 解析求出所有答案值（如角度、长度）
2. 将答案值写为 snapValues（每个 snap 必须包含 `value`, `label`, `note`）
3. 确定动画参数（如 theta）及其合理范围 → `range[0] < range[1]`
4. 推导动态点坐标关于参数的表达式（用 Math.cos/Math.sin 等）
5. 验证：将每个 snapValue 代入 expr，确认动态点位置正确

**旋转类问题的 expr 公式**（绕中心 O=(ox,oy) 旋转角度 θ）：
```
P'_x = ox + (Px - ox) * Math.cos(theta * Math.PI / 180) - (Py - oy) * Math.sin(theta * Math.PI / 180)
P'_y = oy + (Px - ox) * Math.sin(theta * Math.PI / 180) + (Py - oy) * Math.cos(theta * Math.PI / 180)
```
**注意**：将 ox, oy, Px, Py 替换为实际数值，只保留 `theta` 作为变量名。

**顺时针旋转**：题目说"顺时针旋转 β 角"时，用负角度。等价公式：
```
P'_x = ox + (Px - ox) * Math.cos(beta * Math.PI / 180) + (Py - oy) * Math.sin(beta * Math.PI / 180)
P'_y = oy - (Px - ox) * Math.sin(beta * Math.PI / 180) + (Py - oy) * Math.cos(beta * Math.PI / 180)
```
注意：顺时针 = sin 项符号翻转（第一行 `-sin` 变 `+sin`，第二行 `+sin` 变 `-sin`）。

## Dynamic parent syntax

A `{ "expr": "..." }` parent is evaluated each frame with the param in scope:

```json
{ "id":"P", "type":"point", "parents":[
    {"expr": "-Math.cos(theta * Math.PI / 180)"},
    {"expr": "-Math.sin(theta * Math.PI / 180)"}
  ], "attrs":{"name":"P","fixed":true,"size":5,"fillColor":"#c0392b","strokeColor":"white","label":{"offset":[6,-14]},"highlight":false}
}
```

The param name (e.g. `theta`) comes from `animation.param`. `Math.*` is in scope.

For static derived points in the base figure, use construction elements
(bisector, intersection, midpoint, etc.) — do NOT hardcode coordinates.
Reserve `{ expr }` only for the animated parameter.

## Animation block

**必须满足的约束**：
- `range[0] < range[1]`（Zod 校验会拒绝反转的 range）
- `default` 必须在 `[range[0], range[1]]` 之内
- 每个 `snapValues[].value` 必须在 range 之内
- `snapValues` 的 note 说明该值对应的几何意义（如"等腰"、"垂直"等）

```json
"animation": {
  "param":   "theta",
  "label":   "θ (度)",
  "range":   [1, 179],
  "default": 45,
  "snapValues": [
    { "value": 56, "label": "56°", "note": "BC = BP" },
    { "value": 62, "label": "62°", "note": "PB = PC" },
    { "value": 68, "label": "68°", "note": "CB = CP" }
  ],
  "autoPlay": {
    "duration": 5,
    "mode": "bounce"
  }
}
```

`autoPlay` is optional. Include it when watching the full sweep is informative
(e.g. seeing P trace through all three isosceles positions).

## Construction elements（构造元素）

Derived points MUST use construction elements — never manually compute coordinates.

### High-level sugar (renderer auto-expands)

```json
{ "id":"I", "type":"incenter",     "parents":["A","B","C"], "attrs":{...} }
{ "id":"O", "type":"circumcenter", "parents":["A","B","C"], "attrs":{...} }
{ "id":"H", "type":"orthocenter",  "parents":["A","B","C"], "attrs":{...} }
{ "id":"G", "type":"centroid",     "parents":["A","B","C"], "attrs":{...} }
```

### JSXGraph native construction elements

```json
{ "id":"lineBC", "type":"line", "parents":["B","C"], "attrs":{"visible":false} }
{ "id":"bisAE", "type":"bisector", "parents":["B","A","C"], "attrs":{"visible":false} }
{ "id":"E", "type":"intersection", "parents":["bisAE","lineBC",0], "attrs":{...} }
{ "id":"D", "type":"perpendicularpoint", "parents":["O","lineBC"], "attrs":{...} }
{ "id":"M", "type":"midpoint", "parents":["A","B"], "attrs":{...} }
```

### Extended types (also available)

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
- `bisector` parents: `[sidePoint1, vertex, sidePoint2]` — middle is the vertex
- Helper elements: `"visible": false`
- `intersection` third parent: index (0 or 1)
- Sub-element reference: `"perpSeg.point"` for perpendicular foot
- Dynamic `{expr}` parents still work for animation parameters

## 输出前自检清单（必须逐项执行）

### 第零步：确保输出完整 JSON（最易丢分！）
动画题**必须**同时输出两个 JSON：
1. **geometryFigure**（静态图）— 使用 geometry-problem-figure skill 生成
2. **solutionGeometryFigure**（带 animation 的动态图）— 本 skill 生成

缺少任一 = 直接扣分。先输出静态图，再输出动画图。**任何有效 JSON 都比没有输出好。**

### 第一步：ID 引用完整性验证（最重要！断引用 = 直接扣 20 分）

逐元素执行以下算法：
1. 维护一个"已定义 ID 集合"（初始为空）
2. 按 elements 数组顺序遍历每个元素：
   a. 如果元素有 `id`，将其加入集合
   b. 检查元素的 `parents`：每个**字符串类型**的 parent 必须**已在集合中**
   c. 特别注意：`intersection` 必须有第 3 个 parent（数字 0 或 1）
   d. `polygon` 的每个 parent 必须是 **point 类型**元素的 id
3. 如发现任何未定义引用 → **立即停止**，在引用位置之前补充缺失的元素定义

### 第二步：逐项检查（三条铁律 + 通用规则）

**三条铁律**（每个元素都必须遵守）：
- [ ] **每个元素**的 attrs 中必须有 `"highlight": false`（无例外）
- [ ] **circle / ellipse** 必须有 `"fillColor": "none"`
- [ ] **polygon** 的 `borders` 必须设为 `{"strokeColor": "none"}`

**通用规则**：
- [ ] `kind` 已设置（"2d" 或 "3d"）
- [ ] `bbox` 的 x-range ≈ y-range（差距 < 20%）
- [ ] 每个 point 都有 `id`
- [ ] 每个可见 point 都有 `name`、`label.offset`、`fixed:true`

### 第三步：动画专项检查
- [ ] `animation.range[0] < animation.range[1]`（Zod 会拒绝反转 range！）
- [ ] `animation.default` 在 `[range[0], range[1]]` 范围内
- [ ] 每个 `snapValues[].value` 在 range 范围内
- [ ] 每个 `snapValues[]` 都有 `note` 字段说明几何意义
- [ ] expr 中只使用 `animation.param` 定义的变量名（如 `theta`），配合 `Math.*` 函数
- [ ] 静态派生点用构造元素，只有动画相关的点才用 `{expr}`
- [ ] 包含 `autoPlay` 配置（`duration` 和 `mode`）

### 常见错误（绝对避免）
- ❌ parents 中引用了未定义的 id（如引用 `"lineBC"` 但没有定义该 line 元素）
- ❌ `range` 为 `[大值, 小值]`（如 `[179, 1]`）— Zod 校验会直接拒绝
- ❌ expr 中使用了 `animation.param` 以外的变量
- ❌ `intersection` 的 parents 缺少第三个参数（index: 0 或 1）
- ❌ `circle` 没有 `"fillColor":"none"` — 圆被填充后遮挡内部元素
- ❌ 元素缺少 `"highlight":false`
- ❌ `snapValues` 的 `note` 字段为空或缺失 — 每个 snap 必须说明几何意义

## Example outputs

### Example 1 — 绕中点旋转（逆时针）

Problem: Rt△ABC, ∠ACB=90°, ∠ABC=28°, O=midpoint(AB). Rotate OA by θ to OP.
Find θ when △BCP isosceles. Answer: 56°, 62°, 68°.

```json
{
  "kind": "2d",
  "bbox": [-1.4, 1.4, 1.4, -1.4],
  "elements": [
    { "id":"O", "type":"point", "parents":[[0,0]],       "attrs":{"name":"O","fixed":true,"size":3,"fillColor":"#1a1a2e","strokeColor":"white","label":{"offset":[-14,-12]},"highlight":false} },
    { "id":"A", "type":"point", "parents":[[-1,0]],      "attrs":{"name":"A","fixed":true,"size":4,"fillColor":"#2c5f8a","strokeColor":"white","label":{"offset":[-14,-4]},"highlight":false} },
    { "id":"B", "type":"point", "parents":[[1,0]],       "attrs":{"name":"B","fixed":true,"size":4,"fillColor":"#2c5f8a","strokeColor":"white","label":{"offset":[6,-4]},"highlight":false} },
    { "id":"C", "type":"point", "parents":[[-0.5592,0.8290]], "attrs":{"name":"C","fixed":true,"size":4,"fillColor":"#2c5f8a","strokeColor":"white","label":{"offset":[-6,10]},"highlight":false} },
    { "id":"P", "type":"point", "parents":[
        {"expr": "-Math.cos(theta * Math.PI / 180)"},
        {"expr": "-Math.sin(theta * Math.PI / 180)"}
      ], "attrs":{"name":"P","fixed":true,"size":5,"fillColor":"#c0392b","strokeColor":"white","label":{"offset":[6,-14]},"highlight":false}
    },
    { "type":"circle", "parents":["O",1], "attrs":{"strokeColor":"#aaa","strokeWidth":1,"dash":2,"strokeOpacity":0.4,"fillColor":"none","highlight":false} },
    { "type":"polygon","parents":["A","B","C"], "attrs":{"fillColor":"#2c5f8a","fillOpacity":0.06,"borders":{"strokeColor":"none"},"highlight":false} },
    { "type":"segment","parents":["A","C"], "attrs":{"strokeColor":"#2c5f8a","strokeWidth":1.8,"highlight":false} },
    { "type":"segment","parents":["A","B"], "attrs":{"strokeColor":"#2c5f8a","strokeWidth":1.8,"highlight":false} },
    { "type":"segment","parents":["B","C"], "attrs":{"strokeColor":"#27ae60","strokeWidth":2,"highlight":false} },
    { "type":"segment","parents":["O","P"], "attrs":{"strokeColor":"#c0392b","strokeWidth":2.2,"highlight":false} },
    { "type":"segment","parents":["B","P"], "attrs":{"strokeColor":"#e67e22","strokeWidth":2,"highlight":false} },
    { "type":"segment","parents":["C","P"], "attrs":{"strokeColor":"#8e44ad","strokeWidth":2,"highlight":false} },
    { "type":"angle",  "parents":["A","C","B"], "attrs":{"type":"square","radius":0.08,"fillColor":"none","strokeColor":"#2c5f8a","strokeWidth":1.2,"highlight":false} },
    { "type":"angle",  "parents":["C","B","A"], "attrs":{"radius":0.28,"fillColor":"#2c5f8a18","strokeColor":"#2c5f8a","label":{"text":"28°","fontSize":10},"highlight":false} },
    { "type":"angle",  "parents":["A","O","P"], "attrs":{"radius":0.22,"fillColor":"#c0392b22","strokeColor":"#c0392b","label":{"text":"θ","fontSize":11},"highlight":false} }
  ],
  "animation": {
    "param":   "theta",
    "label":   "θ (度)",
    "range":   [1, 179],
    "default": 45,
    "snapValues": [
      { "value": 56, "label": "56°", "note": "BC = BP，B 为顶角" },
      { "value": 62, "label": "62°", "note": "PB = PC，P 为顶角" },
      { "value": 68, "label": "68°", "note": "CB = CP，C 为顶角" }
    ],
    "autoPlay": { "duration": 5, "mode": "bounce" }
  }
}
```

### Example 2 — 绕顶点顺时针旋转（clockwise rotation）

Problem: △ABC, AB=3, AC=4, ∠BAC=90°. 将△ABC绕A顺时针旋转β角得△AB'C'. 求β使AB'⊥BC.

关键 expr（顺时针旋转，A=(0,3) 为旋转中心，B=(0,0)）：
```json
{ "id":"Bp", "type":"point", "parents":[
    {"expr": "0 + (0-0)*Math.cos(beta*Math.PI/180) + (0-3)*Math.sin(beta*Math.PI/180)"},
    {"expr": "3 - (0-0)*Math.sin(beta*Math.PI/180) + (0-3)*Math.cos(beta*Math.PI/180)"}
  ], "attrs":{"name":"B'","fixed":true,"size":5,"fillColor":"#c0392b","strokeColor":"white","label":{"offset":[8,-10]},"highlight":false}
}
```

注意：
- 顺时针 = sin 项符号与逆时针相反
- 旋转中心坐标代入 `ox`, `oy`，被旋转点代入 `Px`, `Py`，只保留 `beta` 为变量
- `animation.range` 必须 `[0, 90]`（或合适范围），不能反转
