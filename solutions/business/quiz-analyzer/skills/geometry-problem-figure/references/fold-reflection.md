# Fold / Reflection Patterns (翻折/反射)

## Construction types

### `reflection` — Axial symmetry (轴对称)
Parents: `[point, line]` — reflects point across line.

```json
{ "id":"Dp", "type":"reflection", "parents":["D","lineAE"], "attrs":{"name":"D'","fixed":true,"size":4,"fillColor":"#c0392b","strokeColor":"white","label":{"offset":[8,4]},"highlight":false} }
```

### `mirrorpoint` — Point symmetry (点对称)
Parents: `[point, centerPoint]` — reflects point across center point.

```json
{ "id":"Mp", "type":"mirrorpoint", "parents":["P","center"], "attrs":{"name":"P'","fixed":true,"size":4,"fillColor":"#c0392b","strokeColor":"white","label":{"offset":[8,4]},"highlight":false} }
```

## Fold construction pattern

When a triangle is folded along a line:
1. Define the **fold line** as an invisible `line`
2. Use `reflection` for the folded point: `"parents": ["D", "foldLine"]`
3. Use `line` + `intersection` for where the folded edge crosses original edges
4. **Never hardcode** folded-point or intersection coordinates

## Parallelogram coordinate recipe

Parallelogram ABCD with angle B = alpha (acute):

```
A = (0, 0),  B = (a, 0)
D = (d * cos(180 - alpha), d * sin(180 - alpha))
C = (B_x + D_x,  D_y)
```

Example: angle B = 52 deg, a = 6, d = 3
- cos(128) = -0.616, sin(128) = 0.788
- D = (-1.85, 2.36), C = (4.15, 2.36)

## Point E on line CD satisfying angle DAE = theta

```
Ray AE angle = (180 - alpha) - theta   (from positive x-axis)
E_y = D_y
E_x = D_y / tan(ray_angle)
```

## Worked example — Parallelogram fold problem

Problem: Parallelogram ABCD, angle B = 52 deg, fold triangle ADE along AE so that
AD' intersects CE at F. Find angles.

```json
{
  "kind": "2d",
  "bbox": [-2.5, 3.2, 5.2, -0.8],
  "elements": [
    { "id":"A", "type":"point", "parents":[[0,0]], "attrs":{"name":"A","fixed":true,"size":4,"fillColor":"#2c5f8a","strokeColor":"white","label":{"offset":[-14,-10]},"highlight":false} },
    { "id":"B", "type":"point", "parents":[[6,0]], "attrs":{"name":"B","fixed":true,"size":4,"fillColor":"#2c5f8a","strokeColor":"white","label":{"offset":[8,-10]},"highlight":false} },
    { "id":"D", "type":"point", "parents":[[-1.85,2.36]], "attrs":{"name":"D","fixed":true,"size":4,"fillColor":"#2c5f8a","strokeColor":"white","label":{"offset":[-14,6]},"highlight":false} },
    { "id":"C", "type":"point", "parents":[[4.15,2.36]], "attrs":{"name":"C","fixed":true,"size":4,"fillColor":"#2c5f8a","strokeColor":"white","label":{"offset":[8,6]},"highlight":false} },
    { "id":"E", "type":"point", "parents":[[2.8,2.36]], "attrs":{"name":"E","fixed":true,"size":4,"fillColor":"#e67e22","strokeColor":"white","label":{"offset":[0,10]},"highlight":false} },
    { "type":"polygon", "parents":["A","B","C","D"], "attrs":{"fillColor":"#2c5f8a","fillOpacity":0.07,"borders":{"strokeColor":"none"},"highlight":false} },
    { "type":"segment", "parents":["A","B"], "attrs":{"strokeColor":"#2c5f8a","strokeWidth":2,"highlight":false} },
    { "type":"segment", "parents":["B","C"], "attrs":{"strokeColor":"#2c5f8a","strokeWidth":2,"highlight":false} },
    { "type":"segment", "parents":["C","D"], "attrs":{"strokeColor":"#2c5f8a","strokeWidth":2,"highlight":false} },
    { "type":"segment", "parents":["D","A"], "attrs":{"strokeColor":"#2c5f8a","strokeWidth":2,"highlight":false} },
    { "type":"segment", "parents":["A","E"], "attrs":{"strokeColor":"#e67e22","strokeWidth":1.8,"dash":2,"highlight":false} },
    { "type":"segment", "parents":["D","E"], "attrs":{"strokeColor":"#aaa","strokeWidth":1.5,"dash":2,"highlight":false} },
    { "id":"lineAE", "type":"line", "parents":["A","E"], "attrs":{"visible":false} },
    { "id":"Dp", "type":"reflection", "parents":["D","lineAE"], "attrs":{"name":"D'","fixed":true,"size":4,"fillColor":"#c0392b","strokeColor":"white","label":{"offset":[8,4]},"highlight":false} },
    { "id":"lineADp","type":"line", "parents":["A","Dp"], "attrs":{"visible":false} },
    { "id":"lineCE", "type":"line", "parents":["C","E"], "attrs":{"visible":false} },
    { "id":"F", "type":"intersection", "parents":["lineADp","lineCE",0], "attrs":{"name":"F","fixed":true,"size":4,"fillColor":"#8e44ad","strokeColor":"white","label":{"offset":[8,4]},"highlight":false} },
    { "type":"segment", "parents":["A","Dp"], "attrs":{"strokeColor":"#c0392b","strokeWidth":1.8,"highlight":false} },
    { "type":"segment", "parents":["E","Dp"], "attrs":{"strokeColor":"#c0392b","strokeWidth":1.8,"dash":2,"highlight":false} },
    { "type":"polygon", "parents":["A","E","Dp"], "attrs":{"fillColor":"#c0392b","fillOpacity":0.06,"borders":{"strokeColor":"none"},"highlight":false} }
  ]
}
```

## Rectangle fold variant

For rectangle ABCD folded along EF (E on AB, F on CD):
- Rectangle: A=(0,h), B=(w,h), C=(w,0), D=(0,0)
- Fold line EF: define as `line` through E and F
- Folded corners: use `reflection` for each folded vertex
- Overlap region: use `intersection` to find where folded edges meet original edges
