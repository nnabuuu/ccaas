# manifest.json — high-level shape

`project/execution/manifest.json` is the Zod-validated lesson definition. The backend re-validates on every PUT.

## Top-level fields (required unless noted)

```json
{
  "id": "<projectId>",              // pinned at create-time, don't change
  "title": "Ideal Beauty",
  "subject": "English",             // free-text
  "gradeLevel": "高中一年级",        // free-text
  "lessonType": "reading",          // free-text convention (NOT enforced by Zod);
                                    // typical values: "reading" | "math" | "general"
  "emoji": "📖",                    // optional
  "description": "...",             // optional, free-text

  "article": {                      // optional — only when lessonType=reading
    "title": "Ideal Beauty",
    "source": "...",
    "paragraphs": [
      { "id": "p1", "num": 1, "text": "..." },
      ...
    ]
  },

  "readingSteps": [                 // required, at least 1
    {
      "id": "step-1",
      "idx": 1,                     // unique across array
      "label": "Predict",
      "labelEn": "Predict",         // optional
      "subtitle": "...",            // optional
      "type": "task",               // ENFORCED: "task" | "instruction" (Zod enum)
      "strategy": "predict",        // free-text pedagogy tag
      "duration": 5,                // minutes
      "description": "...",
      "focusParagraphs": ["p1","p2"],   // optional — paragraphs to dim others
      "studentView": {              // shown during the listen phase
        "title": "What is Predicting?",
        "body": "<p>Predicting means...</p>",  // HTML allowed; renders via renderHtmlWithMath
        "keyPoints": ["...", "..."]
      },
      "answerKey": {                // the actual exercise — discriminated union by `type`
        "type": "quiz",             // see answerkey-<type>.md per type
        ...
      },
      "exerciseLabel": "Quick check",  // optional label shown above exercise

      "discuss": { ... },           // optional — see discuss-config.md if you need to add one
      "summary": { ... },           // optional — what teacher should remember

      "observe": [...]              // optional — see observe-rules.md
    }
  ],

  "boardData": { ... },             // optional — math lessons' chalk-style hints per step
  "phaseConfig": { ... },           // optional — override phase progression rules
  "aiReferenceQA": { ... },         // optional — sample Q&A for the AI tutor
  "personalTouch": { ... },         // optional — per-student personalization hooks
  "observationIndicators": [...],   // optional — global metrics
  "bonusArticle": { ... },          // optional — extra reading for advanced students
  "bonusSteps": [...]               // optional — extra exercises for bonus path
}
```

## answerKey types (11)

The `answerKey.type` discriminator picks one of these shapes. **Look up each in `answerkey-<type>.md` ONLY when editing it**:

- `quiz`          — multi-choice (single correct)         → see `answerkey-quiz.md`
- `match`         — pair items left/right
- `matrix`        — fill grid with row/col practice + reason
- `stance`        — pick a position + supply evidence
- `order`         — drag-sort items
- `select-evidence` — pick supporting paragraph tokens   → see `answerkey-select-evidence.md`
- `map`           — drag items onto 2-axis coord plane
- `image-upload`  — upload solution photo, AI rubric grade
- `rich-content-quiz` — multi-part scaffolded math/physics → see `answerkey-rich-content-quiz.md`
- `fill-blank`    — vocabulary fill-in
- `guided-discovery` — math derivation w/ choices + blanks + verifications

When in doubt about a field, **read the schema source** by asking the user to `cat /Users/niex/.../backend/src/schemas/answer-key.schema.ts` — but only if a quick lookup doesn't suffice; large schema files burn context.

## sanitize awareness

The runtime sanitizes the manifest before serving it to students (strips `correct` from quiz, `hint` from match, etc.). **You don't need to do anything special** — your job is to write the full answerKey with answers; sanitize runs server-side. Don't try to write a "student-safe" version.
