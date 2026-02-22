# Form Protocol & SYNC\_FIELDS

The `write_output` / `output_update` protocol is KedgeAgentic's mechanism for AI-assisted form filling with human approval. This page explains why the protocol is designed the way it is — the reasoning behind the two-step separation, the field selection criteria, and when to apply this pattern in your own solutions.

---

## 1. Why Not Stream Directly to the Form?

The simplest approach to AI-assisted form filling is to stream the agent's output directly into form fields as it arrives. This creates three problems:

**Intermediate output is not ready.** When an agent generates "Learning Objectives", it reasons through the topic before producing the final list. Mid-generation output like "- Students will" or "1. Understand" is incomplete and misleading if written to the form immediately.

**The user loses control.** If AI output writes directly to form state, the teacher cannot see what changed or revert easily. The form becomes the agent's output buffer, not the teacher's document.

**Partial failures corrupt state.** If the agent writes 7 of 14 fields before hitting a context limit, the form is left in a partially-AI-modified state with no clear record of which fields came from the AI.

The `write_output` protocol solves all three by buffering AI suggestions in `pendingUpdates` — a separate state that only merges into the form when the user explicitly clicks "Sync".

---

## 2. The write\_output Decoupling Logic

```
Agent calls write_output(field, value, preview)
        │
        ▼
MCP server validates with Zod
Returns: { data: { field, value, preview }, status: 'success' }
        │
        ▼ (stdio → CCAAS EventMapper)
output_update WebSocket event → payload.data.{ field, value, preview }
        │
        ▼ (onOutputUpdate callback in react-sdk)
pendingUpdates Map<SyncField, OutputUpdate>
        │
        ▼
SyncCard UI: "Sync to Form" | "Discard"
        │                │
        ▼                ▼
form state           deleted from pendingUpdates
```

The agent and the teacher write to **separate state machines** that only merge at one explicit point. The agent never directly modifies `lessonPlan` state. The teacher never needs to watch for unexpected changes mid-conversation.

### The nested payload.data structure

The most common implementation mistake is accessing `event.payload.field` instead of `event.payload.data.field`. The CCAAS EventMapper wraps the tool result one level deeper than expected:

```
write_output returns → { data: { field, value, preview }, status }
EventMapper emits → payload.data = { field, value, preview }
Frontend reads → event.payload.data.field  ← correct
                 event.payload.field        ← undefined (wrong)
```

This was a real production bug in the lesson-plan-designer. The react-sdk's `parseOutputUpdate` handles all format variants automatically — use the `onOutputUpdate` callback rather than parsing raw WebSocket events.

---

## 3. SYNC\_FIELDS Selection Criteria

Not every form field should be a sync field. The lesson-plan-designer selected 14 fields using three criteria:

**1. The AI can meaningfully change it.** Fields like session ID, created-at timestamp, or database primary key are not sync fields — the AI has no business logic for them. Every sync field is one where a capable AI can generate a useful value from the lesson context.

**2. The value has structure the frontend cares about.** Pure text fields (title, notes) are always sync fields. Structured fields (curriculumRequirements as `string[]`, extraProperties as `object`) are sync fields because the frontend renders them differently — they need type-safe handling in the normalize step.

**3. The user needs to verify it.** If the AI gets it wrong, does it matter? For lesson objectives, teaching methods, and assessment criteria, a wrong value has real impact on the teacher's work. These fields warrant the user's attention. For low-stakes metadata that can be corrected in a second, you might skip the sync step and write directly.

### Value normalization is mandatory

The AI may return values in unexpected types: a string `"3"` for a numeric grade level, or `"[\"math\", \"science\"]"` for a string array. The sync hook must normalize before writing to form state:

```typescript
function normalizeFieldValue(field: SyncField, value: unknown): unknown {
  value = parseJsonIfString(value)  // "[\...]" → actual array

  if (field === 'gradeLevel' || field === 'durationMinutes') {
    return Number(value) || defaultFor(field)
  }

  if (field === 'curriculumRequirements') {
    return Array.isArray(value) ? value : []
  }

  return value == null ? null : String(value)
}
```

This normalization belongs in the **frontend sync hook**, not in the MCP server. The MCP server validates that the value is structurally correct (Zod). The frontend normalizes for its own type system.

---

## 4. Transferable Scenarios

Use the `write_output` / `output_update` / SyncCard pattern when:

- **AI output requires human verification** — Medical summaries, legal drafts, financial projections, educational plans. Any context where a wrong AI-generated value has meaningful consequences.
- **Multiple fields are updated in sequence** — The agent writes field-by-field; the user can sync immediately or review all at the end ("Sync All"). This is more natural than waiting for the full output.
- **The form has mixed types** — Text, arrays, numbers, and objects in the same form. The MCP server enforces types with Zod; the frontend normalizes with per-field rules.
- **You need undo after sync** — The sync hook stores the previous value and exposes an undo action with a timeout (30 seconds in the lesson-plan-designer). This is simple to add because sync is a discrete event with a known "before" state.

**This pattern does NOT apply when:**
- The form is read-only output (display only, no user editing).
- The AI generates a single field (simpler to use a direct API call).
- Real-time streaming is the UX expectation (e.g., a chat message or live transcript).
