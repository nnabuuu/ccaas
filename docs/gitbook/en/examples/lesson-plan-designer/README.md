# Lesson Plan Designer

AI assists teachers in designing structured lesson plans across 14 fields — from title and objectives to teaching methods and assessment criteria. The agent writes field values one at a time; the teacher reviews and approves each change before it is applied to the form.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Teacher (Frontend)                              │
│                                                  │
│  1. Describes lesson context in chat             │
│  2. Sees "Sync to Form" card per field           │
│  3. Clicks Sync → value applied to form          │
│     or Discard → suggestion removed              │
└───────────────────┬─────────────────────────────┘
                    │ WebSocket (output_update events)
                    ▼
┌─────────────────────────────────────────────────┐
│  CCAAS Backend + Agent                           │
│                                                  │
│  Agent calls write_output per field              │
│  EventMapper detects { data: {field, value} }    │
│  Emits output_update to frontend                 │
└───────────────────┬─────────────────────────────┘
                    │ stdio MCP
                    ▼
┌─────────────────────────────────────────────────┐
│  lesson-plan-designer MCP Server                 │
│                                                  │
│  write_output → validates with Zod               │
│  Returns: { data: { field, value, preview },     │
│             status: 'success' }                  │
└─────────────────────────────────────────────────┘
```

**Key design principle**: AI output and form state are decoupled. The agent writes to a buffer (`pendingUpdates`); the teacher writes to the form. These are two separate state machines that only connect when the teacher clicks "Sync".

---

## 14 Sync Fields

| # | Field | Type |
|---|-------|------|
| 1 | `title` | string |
| 2 | `subject` | string |
| 3 | `gradeLevel` | number (1–12) |
| 4 | `durationMinutes` | number |
| 5 | `objectives` | string (Markdown) |
| 6 | `content` | string (Markdown) |
| 7 | `teachingMethods` | string |
| 8 | `materialsNeeded` | string |
| 9 | `assessmentMethods` | string |
| 10 | `homeworkAssignment` | string |
| 11 | `differentiatedInstruction` | string |
| 12 | `curriculumRequirements` | string[] |
| 13 | `extraProperties` | object |
| 14 | `teacherNotes` | string |

---

## What Makes This Solution Interesting

The `write_output` protocol is not specific to lesson plans — it is a general-purpose mechanism for any AI-assisted form. The lesson-plan-designer is the reference implementation because it handles the complete set of edge cases: numeric fields that the AI returns as strings, array fields that arrive as JSON strings, and undo support after sync.

See the full analysis in the sub-page below.

---

## Sub-page

[**Form Protocol & SYNC\_FIELDS**](form-protocol.md) — why not stream directly to the form, how `write_output` decouples agent output from form state, and when to use this pattern.
