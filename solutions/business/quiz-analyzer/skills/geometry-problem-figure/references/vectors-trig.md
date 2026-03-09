# Vector and Trigonometric Function Patterns (向量/三角函数)

## Construction types

### `arrow` — Vector arrow
Parents: `[tailPoint, headPoint]` — draws an arrow from tail to head.

```json
{ "type":"arrow", "parents":["O","A"], "attrs":{"strokeColor":"#2c5f8a","strokeWidth":2,"highlight":false} }
```

Use `arrow` (not `segment`) when representing vectors. The arrowhead appears at the second parent.

### `functiongraph` — Plot a mathematical function
Parents: `[function, xmin, xmax]` — the function parent must be a JavaScript function string.

**IMPORTANT**: Use a function parent, NOT an `{expr}` parent:

```json
{ "type":"functiongraph", "parents":["function(x){ return Math.sin(x); }", -6.28, 6.28], "attrs":{"strokeColor":"#2c5f8a","strokeWidth":2,"highlight":false} }
```

Common functions:
- `"function(x){ return Math.sin(x); }"`
- `"function(x){ return Math.cos(x); }"`
- `"function(x){ return Math.tan(x); }"`
- `"function(x){ return 2 * Math.sin(x + Math.PI/3); }"`

### `curve` — Parametric curve
Parents: `[xFunc, yFunc, tmin, tmax]` — parametric curve x(t), y(t).

```json
{ "type":"curve", "parents":["function(t){ return 2*Math.cos(t); }", "function(t){ return 2*Math.sin(t); }", 0, 6.28], "attrs":{"strokeColor":"#2c5f8a","strokeWidth":2,"highlight":false} }
```

## Vector addition — parallelogram law

To show vector a + b using the parallelogram law:

```json
{ "id":"O", "type":"point", "parents":[[0,0]], "attrs":{"name":"O","fixed":true,"size":3,...} },
{ "id":"A", "type":"point", "parents":[[3,1]], "attrs":{"name":"A","fixed":true,"size":4,...} },
{ "id":"B", "type":"point", "parents":[[1,2.5]], "attrs":{"name":"B","fixed":true,"size":4,...} },
{ "id":"C", "type":"parallelogram", "parents":["B","O","A"], "attrs":{"name":"C","fixed":true,"size":4,...} },
{ "type":"arrow", "parents":["O","A"], "attrs":{"strokeColor":"#2c5f8a","strokeWidth":2.5,"highlight":false} },
{ "type":"arrow", "parents":["O","B"], "attrs":{"strokeColor":"#27ae60","strokeWidth":2.5,"highlight":false} },
{ "type":"arrow", "parents":["O","C"], "attrs":{"strokeColor":"#c0392b","strokeWidth":2.5,"highlight":false} },
{ "type":"segment", "parents":["A","C"], "attrs":{"strokeColor":"#aaa","strokeWidth":1,"dash":2,"highlight":false} },
{ "type":"segment", "parents":["B","C"], "attrs":{"strokeColor":"#aaa","strokeWidth":1,"dash":2,"highlight":false} }
```

## Vector labeling

Use the point label with vector notation:
```json
"attrs":{"name":"","label":{"offset":[10,8],"text":"\\vec{a}","fontSize":14},"highlight":false}
```

Or label the arrow's midpoint area by placing a text point.

## Unit circle construction

```json
{
  "kind": "2d",
  "bbox": [-1.8, 1.8, 1.8, -1.8],
  "elements": [
    { "type":"segment", "parents":[[-1.5,0],[1.5,0]], "attrs":{"strokeColor":"#ddd","strokeWidth":1,"highlight":false} },
    { "type":"segment", "parents":[[0,-1.5],[0,1.5]], "attrs":{"strokeColor":"#ddd","strokeWidth":1,"highlight":false} },
    { "id":"O", "type":"point", "parents":[[0,0]], "attrs":{"name":"O","fixed":true,"size":2,"fillColor":"#1a1a2e","strokeColor":"white","label":{"offset":[-14,-10]},"highlight":false} },
    { "type":"circle", "parents":["O",1], "attrs":{"strokeColor":"#2c5f8a","strokeWidth":2,"highlight":false} },
    { "id":"P", "type":"point", "parents":[[0.5,0.866]], "attrs":{"name":"P","fixed":true,"size":4,"fillColor":"#c0392b","strokeColor":"white","label":{"offset":[8,6]},"highlight":false} },
    { "type":"segment", "parents":["O","P"], "attrs":{"strokeColor":"#c0392b","strokeWidth":2,"highlight":false} },
    { "id":"Px", "type":"point", "parents":[[0.5,0]], "attrs":{"name":"","fixed":true,"size":2,"fillColor":"#e67e22","strokeColor":"white","highlight":false} },
    { "type":"segment", "parents":["P","Px"], "attrs":{"strokeColor":"#e67e22","strokeWidth":1.5,"dash":2,"highlight":false} },
    { "type":"angle", "parents":["Px","O","P"], "attrs":{"radius":0.25,"fillColor":"#c0392b18","strokeColor":"#c0392b","label":{"text":"60°"},"highlight":false} }
  ]
}
```

## Worked example — Sine function graph with key points

Problem: Plot y = sin(x) for x in [-pi, 2pi], mark key points.

```json
{
  "kind": "2d",
  "bbox": [-4, 1.8, 7.5, -1.8],
  "elements": [
    { "type":"segment", "parents":[[-3.5,0],[7,0]], "attrs":{"strokeColor":"#ddd","strokeWidth":1,"highlight":false} },
    { "type":"segment", "parents":[[0,-1.5],[0,1.5]], "attrs":{"strokeColor":"#ddd","strokeWidth":1,"highlight":false} },
    { "type":"functiongraph", "parents":["function(x){ return Math.sin(x); }", -3.14, 6.28], "attrs":{"strokeColor":"#2c5f8a","strokeWidth":2.5,"highlight":false} },
    { "id":"p1", "type":"point", "parents":[[0,0]], "attrs":{"name":"0","fixed":true,"size":3,"fillColor":"#1a1a2e","strokeColor":"white","label":{"offset":[-10,-14]},"highlight":false} },
    { "id":"p2", "type":"point", "parents":[[1.571,1]], "attrs":{"name":"","fixed":true,"size":3,"fillColor":"#c0392b","strokeColor":"white","label":{"offset":[6,8],"text":"(π/2, 1)","fontSize":10},"highlight":false} },
    { "id":"p3", "type":"point", "parents":[[3.14,0]], "attrs":{"name":"π","fixed":true,"size":3,"fillColor":"#1a1a2e","strokeColor":"white","label":{"offset":[-6,-14]},"highlight":false} },
    { "id":"p4", "type":"point", "parents":[[4.712,-1]], "attrs":{"name":"","fixed":true,"size":3,"fillColor":"#c0392b","strokeColor":"white","label":{"offset":[6,-14],"text":"(3π/2, -1)","fontSize":10},"highlight":false} },
    { "id":"p5", "type":"point", "parents":[[6.28,0]], "attrs":{"name":"2π","fixed":true,"size":3,"fillColor":"#1a1a2e","strokeColor":"white","label":{"offset":[-8,-14]},"highlight":false} }
  ]
}
```
