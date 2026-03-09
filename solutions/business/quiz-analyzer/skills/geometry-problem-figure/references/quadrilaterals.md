# Quadrilateral Patterns (四边形)

## Construction types

### `parallelogram` — Auto-compute 4th point
Parents: `[A, B, C]` — computes D such that ABCD is a parallelogram (D = A + C - B).

```json
{ "id":"D", "type":"parallelogram", "parents":["A","B","C"], "attrs":{"name":"D","fixed":true,"size":4,"fillColor":"#2c5f8a","strokeColor":"white","label":{"offset":[-14,6]},"highlight":false} }
```

Note: Parent order matters! `[A, B, C]` means D = A + C - B. So if you want ABCD to be a parallelogram, the 4th vertex is computed from the other three.

### `regularpolygon` — Regular polygon
Parents: `[point1, point2, n]` — regular n-gon with one side from point1 to point2.

```json
{ "type":"regularpolygon", "parents":["A","B",6], "attrs":{"fillColor":"#2c5f8a","fillOpacity":0.07,"borders":{"strokeColor":"#2c5f8a","strokeWidth":2},"highlight":false} }
```

### `parallel` — Line through a point parallel to another line
Parents: `[line, point]` — draws line through point parallel to given line.

```json
{ "id":"lineAB", "type":"line", "parents":["A","B"], "attrs":{"visible":false} }
{ "id":"parLine", "type":"parallel", "parents":["lineAB","C"], "attrs":{"strokeColor":"#c0392b","strokeWidth":1.5,"dash":2,"highlight":false} }
```

## Parallelogram ABCD coordinate recipe

For a parallelogram with given angle at B:

**Method 1: Manual coordinates**
```
A = (0, 0),  B = (a, 0)
D = (d * cos(180 - alpha), d * sin(180 - alpha))
C = (B_x + D_x, D_y)
```

Where `alpha` = angle at B, `a` = AB length, `d` = AD length.

**Method 2: Using `parallelogram` type**
Place A, B, D manually, then use parallelogram to auto-compute C:
```json
{ "id":"A", "type":"point", "parents":[[0,0]], "attrs":{...} }
{ "id":"B", "type":"point", "parents":[[4,0]], "attrs":{...} }
{ "id":"D", "type":"point", "parents":[[-1,2.5]], "attrs":{...} }
{ "id":"C", "type":"parallelogram", "parents":["D","A","B"], "attrs":{"name":"C",...} }
```

Note: `parallelogram` parents `[D, A, B]` means C = D + B - A. Choose the parent order so the 4th point lands in the right position.

## Rhombus (菱形)

A rhombus is a parallelogram with equal sides. Use same coordinate recipe but with a = d:

```
A = (0, 0),  B = (s, 0)
D = (s * cos(180 - alpha), s * sin(180 - alpha))
C = (B_x + D_x, D_y)
```

Alternatively, define by diagonals:
- Center O = midpoint of AC = midpoint of BD
- A, C on horizontal; B, D on vertical (for axis-aligned diagonals)

## Trapezoid (梯形)

Trapezoid with AB // CD:

```
A = (0, 0),  B = (a, 0)            # Bottom base (longer)
D = (offset, h),  C = (offset + b, h)   # Top base (shorter)
```

For isosceles trapezoid: `offset = (a - b) / 2`

### Trapezoid midline

Use `midpoint` for the midpoints of the legs, then segment between them:

```json
{ "id":"M", "type":"midpoint", "parents":["A","D"], "attrs":{...} }
{ "id":"N", "type":"midpoint", "parents":["B","C"], "attrs":{...} }
{ "type":"segment", "parents":["M","N"], "attrs":{"strokeColor":"#c0392b","dash":2,...} }
```

## Worked example — Parallelogram with diagonal intersection

Problem: Parallelogram ABCD, diagonals AC and BD intersect at O.

```json
{
  "kind": "2d",
  "bbox": [-2, 3.5, 5.5, -1],
  "elements": [
    { "id":"A", "type":"point", "parents":[[0,0]], "attrs":{"name":"A","fixed":true,"size":4,"fillColor":"#2c5f8a","strokeColor":"white","label":{"offset":[-14,-10]},"highlight":false} },
    { "id":"B", "type":"point", "parents":[[4,0]], "attrs":{"name":"B","fixed":true,"size":4,"fillColor":"#2c5f8a","strokeColor":"white","label":{"offset":[8,-10]},"highlight":false} },
    { "id":"D", "type":"point", "parents":[[-0.5,2.5]], "attrs":{"name":"D","fixed":true,"size":4,"fillColor":"#2c5f8a","strokeColor":"white","label":{"offset":[-14,6]},"highlight":false} },
    { "id":"C", "type":"parallelogram", "parents":["D","A","B"], "attrs":{"name":"C","fixed":true,"size":4,"fillColor":"#2c5f8a","strokeColor":"white","label":{"offset":[8,6]},"highlight":false} },
    { "type":"polygon", "parents":["A","B","C","D"], "attrs":{"fillColor":"#2c5f8a","fillOpacity":0.07,"borders":{"strokeColor":"none"},"highlight":false} },
    { "type":"segment", "parents":["A","B"], "attrs":{"strokeColor":"#2c5f8a","strokeWidth":2,"highlight":false} },
    { "type":"segment", "parents":["B","C"], "attrs":{"strokeColor":"#2c5f8a","strokeWidth":2,"highlight":false} },
    { "type":"segment", "parents":["C","D"], "attrs":{"strokeColor":"#2c5f8a","strokeWidth":2,"highlight":false} },
    { "type":"segment", "parents":["D","A"], "attrs":{"strokeColor":"#2c5f8a","strokeWidth":2,"highlight":false} },
    { "id":"diagAC", "type":"line", "parents":["A","C"], "attrs":{"visible":false} },
    { "id":"diagBD", "type":"line", "parents":["B","D"], "attrs":{"visible":false} },
    { "id":"O", "type":"intersection", "parents":["diagAC","diagBD",0], "attrs":{"name":"O","fixed":true,"size":3,"fillColor":"#c0392b","strokeColor":"white","label":{"offset":[8,6]},"highlight":false} },
    { "type":"segment", "parents":["A","C"], "attrs":{"strokeColor":"#e67e22","strokeWidth":1.5,"dash":2,"highlight":false} },
    { "type":"segment", "parents":["B","D"], "attrs":{"strokeColor":"#8e44ad","strokeWidth":1.5,"dash":2,"highlight":false} }
  ]
}
```
