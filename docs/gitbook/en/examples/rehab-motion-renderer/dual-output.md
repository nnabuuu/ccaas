# Dual Output Design

The Rehab Motion Renderer separates AI-generated content from frontend presentation data. The AI produces a typed specification; the frontend looks up and attaches all rendering details. This page explains why the `exercises` field is a JSON string, how the two-layer enrichment works, and when to apply this pattern.

---

## 1. Two Categories of Fields

The 10 sync fields divide cleanly into two categories:

**Category A: Text fields (9 fields)**

```
title, subtitle, medicalSummary, contraindications,
principlesDo, principlesAvoid, frequency,
progressionPlan, medicalReminder
```

All are `z.string().min(1)`. The AI generates Markdown or plain text; the frontend renders it directly. No transformation needed.

**Category B: Structured field (1 field)**

```
exercises: JSON string of ExerciseSpec[]
```

```typescript
interface ExerciseSpec {
  type: 'pelvic-tilt' | 'dead-bug' | 'cat-cow' | 'seated-boxing'
  sets: number
  reps: number
  restSec: number
  tempo: string
  howTo: string[]
  safety: string[]
}
```

The AI decides *what the patient should do*. The frontend decides *how to animate it*.

---

## 2. Why exercises is a JSON String, Not a Nested Object

The `write_output` MCP tool accepts a single `value: string` parameter — all fields are strings at the protocol level. For text fields this is natural. For `exercises`, the AI must serialize the array to a JSON string.

The MCP server's Zod schema validates the string is well-formed:

```typescript
exercises: z.string().refine(
  (val) => {
    try {
      const parsed = JSON.parse(val)
      return Array.isArray(parsed) &&
             parsed.length > 0 &&
             parsed.every(item => ExerciseSpecSchema.safeParse(item).success)
    } catch { return false }
  },
  { message: 'exercises must be a JSON string of valid ExerciseSpec[]' }
)
```

**Validation happens at the server boundary.** If the AI produces malformed JSON or omits required fields, the MCP server rejects it with a structured error before the frontend ever sees it. The frontend can assume that any `exercises` value that arrives via `output_update` is a valid `ExerciseSpec[]`.

**Deserialization happens at the frontend boundary.** When the user clicks "Sync" on the exercises field, `applyField('exercises')` parses the JSON string and immediately enriches it.

---

## 3. AI Spec → Frontend Enrichment Pattern

The AI's `exercises` output contains *semantic intent*: what exercise, how many sets, how many reps, what tempo, instructions, and safety notes. It does not contain visual data.

```json
// What the AI produces (ExerciseSpec):
{
  "type": "pelvic-tilt",
  "sets": 3,
  "reps": 12,
  "restSec": 20,
  "tempo": "5秒保持",
  "howTo": ["仰卧，膝盖弯曲", "收紧腹部..."],
  "safety": ["如感到腰痛立即停止"]
}
```

When the user syncs the exercises field, the frontend looks up each exercise in `exercise-library.json`:

```json
// What exercise-library.json adds (presentation data):
{
  "pelvic-tilt": {
    "name": "Pelvic Tilt",
    "nameZh": "骨盆前倾",
    "figure": "lying",
    "muscles": "腹横肌 · 骨盆底肌 · 臀肌",
    "phases": ["仰卧放松", "收紧腹部", "骨盆后倾", "HOLD 保持", "缓慢放松"],
    "keyframes": [ ... ],     // SVG animation data
    "visualHints": [ ... ]    // On-screen overlays
  }
}
```

The merge produces a `RenderableExercise` that the SVG animation engine can consume directly. The AI never needed to know about keyframes, figure types, or visual hints.

### Why this matters for iteration speed

Animation data changes independently of medical knowledge. If the design team improves the SVG skeleton for "pelvic-tilt", they update `exercise-library.json`. No re-prompting, no AI output changes, no migration. The AI's `ExerciseSpec` remains valid because `type: "pelvic-tilt"` is the stable interface between the two layers.

---

## 4. The get_exercise_library Tool

The MCP server exposes `get_exercise_library` so the AI knows what exercise types exist **before** writing the `exercises` field. It returns metadata only — no keyframes:

```typescript
// MCP server strips keyframes intentionally:
return Object.entries(library).map(([id, entry]) => ({
  id,
  name: e.name,
  nameZh: e.nameZh,
  muscles: e.muscles,
  figure: e.figure,    // 'lying' | 'cat' | 'seated' — tells AI what position
  phases: e.phases,    // Phase names for howTo instructions
  // keyframes: omitted — not needed by AI
  // visualHints: omitted — not needed by AI
}))
```

The AI gets enough context to choose appropriate exercises and write good `howTo` instructions. It does not receive keyframe data that it cannot meaningfully use.

---

## 5. Transferable Scenarios

Apply the AI-spec → frontend-enrichment pattern when:

- **AI decides content; frontend decides presentation.** The AI should own semantic decisions (what exercise, what medication, what product) but not rendering decisions (animations, colors, image assets, layout).
- **Presentation data changes independently.** Design improvements, asset updates, or localization changes should not require re-running AI or changing AI output schemas.
- **The specification is a stable interface.** Exercise types like `"pelvic-tilt"` are stable identifiers. As long as both sides agree on the identifier, the two layers evolve independently.
- **Validation at the boundary matters.** When structured data crosses from AI to frontend via a text protocol, server-side Zod validation provides a type-safe guarantee that bad AI output is caught early.

**Examples of this pattern in other domains:**

| Domain | AI produces | Frontend enriches with |
|--------|-------------|----------------------|
| E-commerce | Product IDs + quantities | Images, prices, stock status from catalog |
| Music | Chord progressions + tempo | Audio samples, score notation, MIDI |
| Architecture | Room dimensions + materials | 3D models, textures, rendering settings |
| Education | Lesson activity types + duration | Interactive templates, media assets |
