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

## Step 1 — Solve the problem first

Derive all answer values analytically. Write them as snap values.
Express the dynamic point's coordinates as functions of the parameter.

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

Notes:
- `bisector` parents: `[sidePoint1, vertex, sidePoint2]` — middle is the vertex
- Helper elements: `"visible": false`
- `intersection` third parent: index (0 or 1)
- Sub-element reference: `"perpSeg.point"` for perpendicular foot
- Dynamic `{expr}` parents still work for animation parameters

## Example output

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
