# Rehab Motion Renderer

From a medical examination report, AI generates a personalized rehabilitation training plan and renders it as an interactive page with SVG skeleton animations.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Patient / Clinician (Frontend)                  │
│                                                  │
│  Describes symptoms or uploads report            │
│  Sees "Sync" cards per field                     │
│  Clicks Sync → TrainingPagePreview renders       │
│               SVG skeleton animations            │
└───────────────────┬─────────────────────────────┘
                    │ output_update events
                    ▼
┌─────────────────────────────────────────────────┐
│  CCAAS + exercise-planner Skill                  │
│                                                  │
│  Agent calls get_exercise_library first          │
│  Agent calls write_output × 10 fields            │
└───────────────────┬─────────────────────────────┘
                    │ stdio MCP
                    ▼
┌─────────────────────────────────────────────────┐
│  rehab-tools MCP Server                          │
│                                                  │
│  get_exercise_library → metadata only            │
│    (no keyframes — those stay in frontend)       │
│  write_output → Zod validates each field         │
│    exercises field: JSON string of ExerciseSpec[]│
└──────────────────────────────────────────────────┘

When user syncs the exercises field:
┌──────────────────────────────────────────────────┐
│  Frontend: applyField('exercises')               │
│                                                  │
│  1. Parse ExerciseSpec[] from JSON string         │
│  2. For each spec: look up exercise-library.json │
│     → add keyframes, visualHints, phaseNames    │
│  3. TrainingPagePreview renders SVG animation    │
└──────────────────────────────────────────────────┘
```

**Key design principle**: The AI decides *what* to do (exercise type, sets, reps, instructions). The frontend decides *how* to show it (keyframe animation, SVG figure, phase labels). These are explicitly separated so animation updates never require re-prompting the AI.

---

## 10 Sync Fields

| Field | Type | Content |
|-------|------|---------|
| `title` | string | Training plan title |
| `subtitle` | string | Subtitle |
| `medicalSummary` | string | Medical context summary |
| `contraindications` | string | What to avoid |
| `principlesDo` | string | Recommended principles |
| `principlesAvoid` | string | Principles to avoid |
| `frequency` | string | Training frequency |
| `exercises` | **JSON string** | `ExerciseSpec[]` — the structured field |
| `progressionPlan` | string | Progression roadmap |
| `medicalReminder` | string | Medical disclaimer |

Nine fields are plain strings. One field (`exercises`) is a JSON string encoding a typed array. This split is the core architectural decision in this solution.

---

## What Makes This Solution Interesting

The `exercises` field demonstrates a pattern that goes beyond form filling: **the AI produces a content specification, and the frontend enriches it with presentation data**. The AI does not know about SVG keyframes, animation phases, or visual hints — nor should it. That knowledge lives in `exercise-library.json` and evolves independently of the AI's decisions.

See the full analysis in the sub-page below.

---

## Sub-page

[**Dual Output Design**](dual-output.md) — why exercises is a JSON string, the AI-spec → frontend-enrichment pattern, and transferable scenarios.
