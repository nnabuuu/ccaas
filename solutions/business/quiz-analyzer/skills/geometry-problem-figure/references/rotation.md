# Rotation Patterns (旋转)

## Rotation formula

Point P rotated by angle theta around center O:

```
P' = O + R(theta) * (P - O)

where R(theta) = [[cos(theta), -sin(theta)],
                   [sin(theta),  cos(theta)]]
```

Expanded:
```
P'_x = O_x + (P_x - O_x) * cos(theta) - (P_y - O_y) * sin(theta)
P'_y = O_y + (P_x - O_x) * sin(theta) + (P_y - O_y) * cos(theta)
```

## Static rotation — use `{expr}` parents

JSXGraph `transform` doesn't fit our replay model, so use `{expr}` for rotated point coordinates.

For a **static** rotation (fixed angle), pre-compute the coordinates and use hardcoded values.
For a **dynamic** rotation (animation parameter), use `{expr}` parents:

```json
{ "id":"Ap", "type":"point", "parents":[
    {"expr": "O_x + (A_x - O_x) * Math.cos(theta * Math.PI / 180) - (A_y - O_y) * Math.sin(theta * Math.PI / 180)"},
    {"expr": "O_y + (A_x - O_x) * Math.sin(theta * Math.PI / 180) + (A_y - O_y) * Math.cos(theta * Math.PI / 180)"}
  ], "attrs":{"name":"A'","fixed":true,"size":4,"fillColor":"#c0392b","strokeColor":"white","label":{"offset":[8,4]},"highlight":false}
}
```

Replace `O_x, O_y, A_x, A_y` with actual numeric values. Only `theta` is the variable.

## Arc to show rotation path

Use `arc` to visually indicate the rotation sweep:

```json
{ "type":"arc", "parents":["O","A","Ap"], "attrs":{"strokeColor":"#c0392b","strokeWidth":1.5,"dash":2,"highlight":false} }
```

Parents: `[center, pointOnArc_start, pointOnArc_end]` — arc goes counterclockwise from start to end.

## Worked example — Rotate triangle ABC 60 deg around A

Problem: Equilateral triangle ABC with side 2. Rotate 60 deg counterclockwise around A to get A'B'C'.

Base points:
- A = (0, 0) (center of rotation, A' = A)
- B = (2, 0)
- C = (1, sqrt(3)) = (1, 1.732)

Rotated points (theta = 60 deg):
- B' = (2*cos60, 2*sin60) = (1, 1.732)
- C' = (cos60 - 1.732*sin60, sin60 + 1.732*cos60) = (-1, 1.732) — wait, let me compute:
  - C'_x = 1*cos60 - 1.732*sin60 = 0.5 - 1.5 = -1.0
  - C'_y = 1*sin60 + 1.732*cos60 = 0.866 + 0.866 = 1.732

```json
{
  "kind": "2d",
  "bbox": [-2, 3, 3.5, -1],
  "elements": [
    { "id":"A", "type":"point", "parents":[[0,0]], "attrs":{"name":"A(A')","fixed":true,"size":4,"fillColor":"#2c5f8a","strokeColor":"white","label":{"offset":[-10,-14]},"highlight":false} },
    { "id":"B", "type":"point", "parents":[[2,0]], "attrs":{"name":"B","fixed":true,"size":4,"fillColor":"#2c5f8a","strokeColor":"white","label":{"offset":[8,-10]},"highlight":false} },
    { "id":"C", "type":"point", "parents":[[1,1.732]], "attrs":{"name":"C","fixed":true,"size":4,"fillColor":"#2c5f8a","strokeColor":"white","label":{"offset":[6,8]},"highlight":false} },
    { "id":"Bp", "type":"point", "parents":[[1,1.732]], "attrs":{"name":"B'","fixed":true,"size":4,"fillColor":"#c0392b","strokeColor":"white","label":{"offset":[8,8]},"highlight":false} },
    { "id":"Cp", "type":"point", "parents":[[-1,1.732]], "attrs":{"name":"C'","fixed":true,"size":4,"fillColor":"#c0392b","strokeColor":"white","label":{"offset":[-14,8]},"highlight":false} },
    { "type":"polygon", "parents":["A","B","C"], "attrs":{"fillColor":"#2c5f8a","fillOpacity":0.07,"borders":{"strokeColor":"none"},"highlight":false} },
    { "type":"segment", "parents":["A","B"], "attrs":{"strokeColor":"#2c5f8a","strokeWidth":2,"highlight":false} },
    { "type":"segment", "parents":["B","C"], "attrs":{"strokeColor":"#2c5f8a","strokeWidth":2,"highlight":false} },
    { "type":"segment", "parents":["C","A"], "attrs":{"strokeColor":"#2c5f8a","strokeWidth":2,"highlight":false} },
    { "type":"polygon", "parents":["A","Bp","Cp"], "attrs":{"fillColor":"#c0392b","fillOpacity":0.06,"borders":{"strokeColor":"none"},"highlight":false} },
    { "type":"segment", "parents":["A","Bp"], "attrs":{"strokeColor":"#c0392b","strokeWidth":2,"highlight":false} },
    { "type":"segment", "parents":["Bp","Cp"], "attrs":{"strokeColor":"#c0392b","strokeWidth":2,"highlight":false} },
    { "type":"segment", "parents":["Cp","A"], "attrs":{"strokeColor":"#c0392b","strokeWidth":2,"highlight":false} },
    { "type":"arc", "parents":["A","B","Bp"], "attrs":{"strokeColor":"#e67e22","strokeWidth":1.5,"dash":2,"highlight":false} },
    { "type":"angle", "parents":["B","A","Bp"], "attrs":{"radius":0.4,"fillColor":"#e67e2218","strokeColor":"#e67e22","label":{"text":"60°"},"highlight":false} }
  ]
}
```
