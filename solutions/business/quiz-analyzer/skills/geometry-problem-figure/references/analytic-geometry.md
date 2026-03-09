# Analytic Geometry Patterns (解析几何)

## Construction types

### `ellipse` — Ellipse from foci and semi-major axis
Parents: `[focus1, focus2, semiMajorAxis]`

```json
{ "id":"F1", "type":"point", "parents":[[-2,0]], "attrs":{"name":"F₁","fixed":true,"size":3,"fillColor":"#c0392b","strokeColor":"white","label":{"offset":[-10,-14]},"highlight":false} }
{ "id":"F2", "type":"point", "parents":[[2,0]], "attrs":{"name":"F₂","fixed":true,"size":3,"fillColor":"#c0392b","strokeColor":"white","label":{"offset":[8,-14]},"highlight":false} }
{ "type":"ellipse", "parents":["F1","F2",5], "attrs":{"strokeColor":"#2c5f8a","strokeWidth":2,"highlight":false} }
```

Note: Third parent is `a` (semi-major axis length), NOT `2a`. For x²/a² + y²/b² = 1, c = sqrt(a²-b²), place F1=(-c,0), F2=(c,0), third parent = a.

### `parabola` — Parabola from focus and directrix
Parents: `[focus, directrixLine]`

```json
{ "id":"focus", "type":"point", "parents":[[1,0]], "attrs":{"name":"F","fixed":true,"size":3,"fillColor":"#c0392b","strokeColor":"white","label":{"offset":[8,-10]},"highlight":false} }
{ "id":"directrix", "type":"line", "parents":[[-1,0],[-1,1]], "attrs":{"strokeColor":"#aaa","strokeWidth":1,"dash":2,"highlight":false} }
{ "type":"parabola", "parents":["focus","directrix"], "attrs":{"strokeColor":"#2c5f8a","strokeWidth":2,"highlight":false} }
```

### `hyperbola` — Hyperbola from foci and semi-transverse axis
Parents: `[focus1, focus2, semiTransverseAxis]`

```json
{ "type":"hyperbola", "parents":["F1","F2",3], "attrs":{"strokeColor":"#2c5f8a","strokeWidth":2,"highlight":false} }
```

Third parent is `a` (semi-transverse axis). For x²/a² - y²/b² = 1, c = sqrt(a²+b²).

## Standard forms and coordinate placement

### Ellipse x²/a² + y²/b² = 1 (a > b > 0)
- Center: (0, 0)
- Foci: (±c, 0) where c = sqrt(a² - b²)
- Vertices: (±a, 0), (0, ±b)
- Create: `"parents": ["F1", "F2", a]`

### Parabola y² = 2px (p > 0, opens right)
- Focus: (p/2, 0)
- Directrix: x = -p/2 (vertical line through (-p/2, 0))
- Vertex: (0, 0)

### Hyperbola x²/a² - y²/b² = 1
- Center: (0, 0)
- Foci: (±c, 0) where c = sqrt(a² + b²)
- Vertices: (±a, 0)
- Asymptotes: y = ±(b/a)x
- Create: `"parents": ["F1", "F2", a]`

## Focus/directrix placement tips

- Always add coordinate axes using invisible helper lines + visible segments:
  ```json
  { "type":"segment", "parents":[[-5,0],[5,0]], "attrs":{"strokeColor":"#ccc","strokeWidth":1,"highlight":false} },
  { "type":"segment", "parents":[[0,-4],[0,4]], "attrs":{"strokeColor":"#ccc","strokeWidth":1,"highlight":false} }
  ```

- Label vertices and foci explicitly
- Use dashed lines for directrix and asymptotes

## Worked example — Ellipse with foci and tangent

Problem: Ellipse x²/9 + y²/5 = 1. Mark foci. Draw tangent at point P(3cos(60°), sqrt(5)*sin(60°)).

a = 3, b = sqrt(5), c = sqrt(9-5) = 2. P = (1.5, 1.936).

```json
{
  "kind": "2d",
  "bbox": [-4.5, 3.5, 4.5, -3.5],
  "elements": [
    { "type":"segment", "parents":[[-4,0],[4,0]], "attrs":{"strokeColor":"#ddd","strokeWidth":1,"highlight":false} },
    { "type":"segment", "parents":[[0,-3],[0,3]], "attrs":{"strokeColor":"#ddd","strokeWidth":1,"highlight":false} },
    { "id":"F1", "type":"point", "parents":[[-2,0]], "attrs":{"name":"F₁","fixed":true,"size":3,"fillColor":"#c0392b","strokeColor":"white","label":{"offset":[-10,-14]},"highlight":false} },
    { "id":"F2", "type":"point", "parents":[[2,0]], "attrs":{"name":"F₂","fixed":true,"size":3,"fillColor":"#c0392b","strokeColor":"white","label":{"offset":[8,-14]},"highlight":false} },
    { "id":"O", "type":"point", "parents":[[0,0]], "attrs":{"name":"O","fixed":true,"size":2,"fillColor":"#1a1a2e","strokeColor":"white","label":{"offset":[-14,-10]},"highlight":false} },
    { "id":"ellipse1", "type":"ellipse", "parents":["F1","F2",3], "attrs":{"strokeColor":"#2c5f8a","strokeWidth":2,"highlight":false} },
    { "id":"P", "type":"point", "parents":[[1.5,1.936]], "attrs":{"name":"P","fixed":true,"size":4,"fillColor":"#e67e22","strokeColor":"white","label":{"offset":[8,6]},"highlight":false} },
    { "type":"segment", "parents":["F1","P"], "attrs":{"strokeColor":"#c0392b","strokeWidth":1.5,"dash":2,"highlight":false} },
    { "type":"segment", "parents":["F2","P"], "attrs":{"strokeColor":"#c0392b","strokeWidth":1.5,"dash":2,"highlight":false} }
  ]
}
```

## Worked example — Parabola with directrix

Problem: Parabola y² = 4x. Mark focus and directrix.

p = 2, focus = (1, 0), directrix: x = -1.

```json
{
  "kind": "2d",
  "bbox": [-3, 4, 6, -4],
  "elements": [
    { "type":"segment", "parents":[[-2.5,0],[5.5,0]], "attrs":{"strokeColor":"#ddd","strokeWidth":1,"highlight":false} },
    { "type":"segment", "parents":[[0,-3.5],[0,3.5]], "attrs":{"strokeColor":"#ddd","strokeWidth":1,"highlight":false} },
    { "id":"focus", "type":"point", "parents":[[1,0]], "attrs":{"name":"F","fixed":true,"size":3,"fillColor":"#c0392b","strokeColor":"white","label":{"offset":[8,-14]},"highlight":false} },
    { "id":"dirP1", "type":"point", "parents":[[-1,-4]], "attrs":{"visible":false} },
    { "id":"dirP2", "type":"point", "parents":[[-1,4]], "attrs":{"visible":false} },
    { "id":"directrix", "type":"line", "parents":["dirP1","dirP2"], "attrs":{"strokeColor":"#aaa","strokeWidth":1.5,"dash":2,"highlight":false} },
    { "type":"parabola", "parents":["focus","directrix"], "attrs":{"strokeColor":"#2c5f8a","strokeWidth":2,"highlight":false} }
  ]
}
```
