# Circles and Tangents Patterns (圆与切线)

## Construction types

### `tangent` — Tangent line to curve at a glider point
Parents: `[gliderPoint]` — draws tangent to the curve the glider is on.

```json
{ "id":"G", "type":"glider", "parents":[3, 0, "circleO"], "attrs":{"name":"T","size":4,"fillColor":"#c0392b","strokeColor":"white","highlight":false} }
{ "id":"tan1", "type":"tangent", "parents":["G"], "attrs":{"strokeColor":"#c0392b","strokeWidth":1.5,"highlight":false} }
```

### `arc` — Circular arc
Parents: `[center, point1, point2]` — arc from point1 to point2 counterclockwise around center.

```json
{ "type":"arc", "parents":["O","A","B"], "attrs":{"strokeColor":"#2c5f8a","strokeWidth":2,"highlight":false} }
```

### `sector` — Filled circular sector
Parents: `[center, point1, point2]` — filled region of arc.

```json
{ "type":"sector", "parents":["O","A","B"], "attrs":{"fillColor":"#2c5f8a","fillOpacity":0.15,"strokeColor":"#2c5f8a","highlight":false} }
```

### `semicircle` — Semicircle on a diameter
Parents: `[point1, point2]` — semicircle with diameter from p1 to p2.

```json
{ "type":"semicircle", "parents":["A","B"], "attrs":{"strokeColor":"#2c5f8a","strokeWidth":2,"highlight":false} }
```

### `circumcircle` — Circumscribed circle
Parents: `[A, B, C]` — circle through three points.

```json
{ "type":"circumcircle", "parents":["A","B","C"], "attrs":{"strokeColor":"#8e44ad","strokeWidth":1.5,"dash":2,"highlight":false} }
```

### `incircle` — Inscribed circle
Parents: `[A, B, C]` — circle tangent to all three sides of triangle ABC.

```json
{ "type":"incircle", "parents":["A","B","C"], "attrs":{"strokeColor":"#27ae60","strokeWidth":1.5,"highlight":false} }
```

### `glider` — Point constrained to an element
Parents: `[x, y, element]` — point that stays on the given line/circle/curve. x,y is starting position.

```json
{ "id":"G", "type":"glider", "parents":[2, 1, "circleO"], "attrs":{"name":"P","size":4,"fillColor":"#c0392b","strokeColor":"white","highlight":false} }
```

## Tangent at point on circle (glider approach)

1. Create circle
2. Place a `glider` on the circle at the desired position
3. Use `tangent` with the glider as parent

```json
{ "id":"circleO", "type":"circle", "parents":["O", 3], "attrs":{"strokeColor":"#2c5f8a","strokeWidth":2,"highlight":false} }
{ "id":"T", "type":"glider", "parents":[3, 0, "circleO"], "attrs":{"name":"T","fixed":true,"size":4,"fillColor":"#c0392b","strokeColor":"white","highlight":false} }
{ "id":"tangentT", "type":"tangent", "parents":["T"], "attrs":{"strokeColor":"#c0392b","strokeWidth":1.5,"highlight":false} }
```

## Tangent from external point (midpoint circle construction)

To draw tangent from external point P to circle O(r):
1. Find midpoint M of OP
2. Draw circle with center M, radius OM
3. Intersection of the two circles gives tangent points

```json
{ "id":"M", "type":"midpoint", "parents":["O","P"], "attrs":{"visible":false} },
{ "id":"circleM", "type":"circle", "parents":["M","O"], "attrs":{"visible":false} },
{ "id":"T1", "type":"intersection", "parents":["circleO","circleM",0], "attrs":{"name":"T₁","fixed":true,"size":4,"fillColor":"#c0392b","strokeColor":"white","highlight":false} },
{ "id":"T2", "type":"intersection", "parents":["circleO","circleM",1], "attrs":{"name":"T₂","fixed":true,"size":4,"fillColor":"#c0392b","strokeColor":"white","highlight":false} },
{ "type":"segment", "parents":["P","T1"], "attrs":{"strokeColor":"#c0392b","strokeWidth":1.5,"highlight":false} },
{ "type":"segment", "parents":["P","T2"], "attrs":{"strokeColor":"#c0392b","strokeWidth":1.5,"highlight":false} }
```

## Inscribed angle / arc marking

To mark an inscribed angle that subtends an arc:
1. Three points on circle: vertex V, and arc endpoints A, B
2. Use `angle` element with `parents: ["A","V","B"]`
3. Optionally add `arc` to highlight the subtended arc

## Worked example — Tangent from external point

Problem: Circle O with radius 3 centered at origin. Point P at (5, 0). Draw tangent lines from P to circle.

```json
{
  "kind": "2d",
  "bbox": [-4.5, 4.5, 6.5, -4.5],
  "elements": [
    { "id":"O", "type":"point", "parents":[[0,0]], "attrs":{"name":"O","fixed":true,"size":3,"fillColor":"#1a1a2e","strokeColor":"white","label":{"offset":[-14,-10]},"highlight":false} },
    { "id":"P", "type":"point", "parents":[[5,0]], "attrs":{"name":"P","fixed":true,"size":4,"fillColor":"#e67e22","strokeColor":"white","label":{"offset":[8,-10]},"highlight":false} },
    { "id":"circleO", "type":"circle", "parents":["O",3], "attrs":{"strokeColor":"#2c5f8a","strokeWidth":2,"highlight":false} },
    { "id":"M", "type":"midpoint", "parents":["O","P"], "attrs":{"visible":false} },
    { "id":"circleM", "type":"circle", "parents":["M","O"], "attrs":{"strokeColor":"#aaa","strokeWidth":1,"dash":2,"strokeOpacity":0.4,"highlight":false} },
    { "id":"T1", "type":"intersection", "parents":["circleO","circleM",0], "attrs":{"name":"T₁","fixed":true,"size":4,"fillColor":"#c0392b","strokeColor":"white","label":{"offset":[-6,10]},"highlight":false} },
    { "id":"T2", "type":"intersection", "parents":["circleO","circleM",1], "attrs":{"name":"T₂","fixed":true,"size":4,"fillColor":"#c0392b","strokeColor":"white","label":{"offset":[-6,-14]},"highlight":false} },
    { "type":"segment", "parents":["P","T1"], "attrs":{"strokeColor":"#c0392b","strokeWidth":1.8,"highlight":false} },
    { "type":"segment", "parents":["P","T2"], "attrs":{"strokeColor":"#c0392b","strokeWidth":1.8,"highlight":false} },
    { "type":"segment", "parents":["O","T1"], "attrs":{"strokeColor":"#2c5f8a","strokeWidth":1.5,"dash":2,"highlight":false} },
    { "type":"segment", "parents":["O","T2"], "attrs":{"strokeColor":"#2c5f8a","strokeWidth":1.5,"dash":2,"highlight":false} },
    { "type":"angle", "parents":["P","T1","O"], "attrs":{"type":"square","radius":0.2,"fillColor":"none","strokeColor":"#8e44ad","strokeWidth":1.2,"highlight":false} },
    { "type":"angle", "parents":["O","T2","P"], "attrs":{"type":"square","radius":0.2,"fillColor":"none","strokeColor":"#8e44ad","strokeWidth":1.2,"highlight":false} }
  ]
}
```
