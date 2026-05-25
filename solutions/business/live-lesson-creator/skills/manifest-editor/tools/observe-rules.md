# observe — per-block teacher dashboard metrics + alerts

`readingSteps[].observe` (optional) drives what the teacher dashboard shows + when it raises an alert. If omitted, sensible defaults are derived from the answerKey type (server-side via `observation-resolver.ts`).

## Shape

Per-step `observe` is an **array of metric/rule objects**:

```json
"observe": {
  "metrics": [
    {
      "id": "completionRate",          // matches a known metric for this type
      "enabled": true,
      "threshold": 60,                  // optional — triggers alert when below/above
      "severity": "warn"                // "info" | "warn" | "urg"
    },
    { "id": "avgRounds", "enabled": true },
    { "id": "fallbackCount", "enabled": true, "threshold": 5, "severity": "urg" }
  ],
  "views": ["结果漏斗", "逐轮理解", "误解聚类"],   // optional — pin specific drill views to step
  "rules": [
    {
      "id": "r1",
      "condition": { "metric": "fallbackCount", "op": ">=", "value": 5 },
      "action": { "type": "alert", "message": "较多学生无法通过对话达标" }
    }
  ]
}
```

## Known metric ids by exercise type

| Type | Metric ids |
|---|---|
| `quiz` | `completionRate`, `avgScore`, `perQuestion[idx]Wrong`, `misconception:<id>Count` |
| `match` | `completionRate`, `avgScore` |
| `matrix` | `cellsFilled`, `avgQuality`, `whatVsWhy` |
| `select-evidence` | `sectionsCompleted`, `evidenceHitRate`, `funcWrongCount` |
| `map` | `placementSpread`, `axisConsensus` |
| `image-upload` | `submittedCount`, `passRate`, `scaffoldUsage` |
| `rich-content-quiz` | `partsCompleted`, `scaffoldDepth`, `passRate` |
| `discuss` (when block.type=discuss) | `goalRate`, `avgRounds`, `fallbackCount`, `misconceptionCount` |

When in doubt, **don't set `observe`** — defaults are good. Only set it when the teacher explicitly wants a custom threshold or alert.

## Common patterns

- **"Alert if >5 students stuck"** — `rules: [{condition: {metric:"fallbackCount", op:">=", value:5}, action:{type:"alert", message:"..."}}]`
- **"Show only the funnel view"** — `views: ["结果漏斗"]` (omit others)
- **"Default config"** — omit `observe` entirely; server derives from answerKey type
