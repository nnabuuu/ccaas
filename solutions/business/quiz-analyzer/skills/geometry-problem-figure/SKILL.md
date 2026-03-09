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
  Common placement: Rt△ ∠C=90° ∠B=α → C=(0,0), B=(1,0), A=(0,tan α)
- **Derived points** (intersections, feet, midpoints, centers): NEVER
  hardcode — use construction elements (bisector, intersection,
  perpendicularpoint, midpoint, incenter, …). JSXGraph computes the
  exact position.

## Step 2 — Bbox

keepaspectratio is always true. Choose bbox so x-range ≈ y-range.
Add ~15% padding. Wrong: triangle at x∈[0,4],y∈[0,1.9] with bbox [-0.5,2.5,4.5,-0.5]
(x-range=5, y-range=3 → squashed angles). Fix: use [-0.5,4.8,4.5,-0.5].

## Step 3 — Construction elements

Rule: derived points MUST use construction elements — never manually compute coordinates.

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

Order matters: define points before using them in segments/polygons.

Parent values:
- `"A"` → string id reference to element with id "A"
- `[x, y]` → static 2D coordinate
- `[x, y, z]` → static 3D coordinate
- `123` → literal number (e.g. radius)

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

### Full example — angle bisector intersection

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
