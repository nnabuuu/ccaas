# 3. Mapping User Journeys

## What You Will Learn

In this chapter, you will map out the end-to-end user journeys for the Lesson Plan Designer Solution. A user journey traces every step a user takes to accomplish a goal -- from opening the app to seeing the final result. By mapping these journeys before writing code, you ensure that no interaction is overlooked and that the AI Agent, backend, and frontend are all designed to support the same workflows.

By the end of this chapter, you will be able to:

- Decompose a feature into a step-by-step user journey
- Identify where the AI Agent, Solution backend, and frontend each play a role
- Map WebSocket events to specific moments in the journey
- Design journeys that account for both AI-generated and user-edited content
- Spot gaps and edge cases early in the design process

## Why Map Journeys Before Coding

In a traditional web application, the data flow is straightforward: user fills a form, submits it, backend saves it. In a CCAAS Solution, there is a third participant -- the AI Agent -- which introduces new interaction patterns:

- The user types a natural language request instead of filling a form
- The AI Agent interprets the request, generates structured data, and pushes it to the form
- The user reviews, edits, and confirms the AI-generated content
- The backend saves the final result

If you skip the journey mapping step, you will discover these interaction patterns during implementation, leading to rework.

## Architecture Recap: Direct Connection

Before mapping journeys, recall the CCAAS architecture from [Chapter 1](01-architecture.md). The frontend connects **directly** to CCAAS via WebSocket for all AI interactions. The Solution backend is only involved for domain data (CRUD operations on lesson plans, textbooks, etc.):

```
┌──────────────┐         ┌──────────────────┐         ┌──────────────┐
│   Solution   │  WS     │  CCAAS Backend   │  stdin/  │   AI Agent   │
│   Frontend   │◄───────►│  (NestJS)        │  stdout  │   Process    │
└──────────────┘         └──────────────────┘◄────────►└──────────────┘
  Vue + SDK                Session Mgmt                  Claude Code
  @ccaas/vue-sdk           Skill Router
                           Event Streaming

┌──────────────┐         ┌──────────────────┐
│   Solution   │  REST   │  Solution        │
│   Frontend   │◄───────►│  Backend         │
└──────────────┘         └──────────────────┘
                           Domain CRUD
                           (Lesson Plans, Textbooks)
```

Two separate channels:
- **AI channel**: Frontend ↔ CCAAS (WebSocket + REST)
- **Domain data channel**: Frontend ↔ Solution Backend (REST)

## Journey 1: Create a Lesson Plan with AI Assistance

This is the primary journey. A teacher selects a textbook chapter, asks the AI Agent to generate a lesson plan, reviews the generated content, and saves it.

### Step-by-Step Flow

```
 User                    Frontend                CCAAS Backend          AI Agent          Solution Backend
  │                         │                         │                    │                    │
  │  1. Opens "New          │                         │                    │                    │
  │     Lesson Plan" page   │                         │                    │                    │
  │────────────────────────▶│                         │                    │                    │
  │                         │                         │                    │                    │
  │  2. Selects subject     │                         │                    │                    │
  │     (Math), grade (3),  │                         │                    │                    │
  │     textbook chapter    │                         │                    │                    │
  │────────────────────────▶│                         │                    │                    │
  │                         │                         │                    │                    │
  │  3. Clicks "Create"     │                         │                    │                    │
  │────────────────────────▶│                         │                    │                    │
  │                         │  4. POST /lesson-plans  │                    │                    │
  │                         │────────────────────────────────────────────────────────────────────▶
  │                         │  5. 201 Created (id:7)  │                    │                    │
  │                         │◀───────────────────────────────────────────────────────────────────│
  │                         │                         │                    │                    │
  │  6. Navigates to        │                         │                    │                    │
  │     lesson plan editor  │                         │                    │                    │
  │     (plan #7)           │                         │                    │                    │
  │◀────────────────────────│                         │                    │                    │
  │                         │                         │                    │                    │
  │  7. "Generate learning  │                         │                    │                    │
  │   objectives for this   │                         │                    │                    │
  │   chapter"              │                         │                    │                    │
  │────────────────────────▶│                         │                    │                    │
  │                         │  8. POST /sessions/     │                    │                    │
  │                         │     :id/completion      │                    │                    │
  │                         │────────────────────────▶│                    │                    │
  │                         │                         │  9. Launch Agent   │                    │
  │                         │                         │───────────────────▶│                    │
  │                         │                         │                    │                    │
  │                         │                         │  10. Agent calls   │                    │
  │                         │                         │◀───────────────────│                    │
  │                         │                         │  write_output      │                    │
  │                         │                         │  (field:           │                    │
  │                         │                         │   "learningObjs",  │                    │
  │                         │                         │   value: [...])    │                    │
  │                         │                         │                    │                    │
  │                         │  11. output_update      │                    │                    │
  │                         │      event via WS       │                    │                    │
  │                         │◀────────────────────────│                    │                    │
  │                         │                         │                    │                    │
  │  12. Editor section     │                         │                    │                    │
  │      "Learning Objs"    │                         │                    │                    │
  │      updates in real    │                         │                    │                    │
  │      time with AI       │                         │                    │                    │
  │      highlight          │                         │                    │                    │
  │◀────────────────────────│                         │                    │                    │
  │                         │                         │                    │                    │
  │  (Steps 10-12 repeat for textbookAnalysis,        │                    │                    │
  │   studentAnalysis, learningTasks, etc.)            │                    │                    │
  │                         │                         │                    │                    │
  │  13. User reviews and   │                         │                    │                    │
  │      edits sections     │                         │                    │                    │
  │────────────────────────▶│                         │                    │                    │
  │                         │                         │                    │                    │
  │  14. User clicks "Save" │                         │                    │                    │
  │────────────────────────▶│                         │                    │                    │
  │                         │  15. PATCH              │                    │                    │
  │                         │  /lesson-plans/7        │                    │                    │
  │                         │────────────────────────────────────────────────────────────────────▶
  │                         │  16. 200 OK             │                    │                    │
  │                         │◀───────────────────────────────────────────────────────────────────│
  │  17. "Saved"            │                         │                    │                    │
  │◀────────────────────────│                         │                    │                    │
```

### Key Moments in This Journey

| Step | Component | What Happens | Channel |
|------|-----------|-------------|---------|
| 1-3 | User + Frontend | Selects subject, grade, textbook chapter | -- |
| 4-5 | Frontend → Solution Backend | Creates empty lesson plan (REST) | Domain REST |
| 6 | Frontend | Navigates to the lesson plan editor | -- |
| 7 | User | Types a natural language request in the chat panel | -- |
| 8 | Frontend → CCAAS | Sends message via REST (POST /completion) | AI REST |
| 9 | CCAAS | Launches AI Agent with Skill context | -- |
| 10 | AI Agent → CCAAS | Calls `write_output` for each section | -- |
| 11 | CCAAS → Frontend | Pushes structured data via WebSocket | AI WebSocket |
| 12 | Frontend | Updates editor section in real time, highlights AI changes | -- |
| 13 | User | Reviews and optionally edits sections | -- |
| 14-16 | Frontend → Solution Backend | Standard PATCH to save content | Domain REST |
| 17 | Frontend | Shows confirmation | -- |

### WebSocket Events During This Journey

The frontend receives these events via the direct CCAAS WebSocket connection:

```typescript
// 1. Agent starts thinking
agent_status: { status: 'thinking' }

// 2. Agent decides to use write_output
tool_activity: { toolName: 'write_output', phase: 'start' }

// 3. Learning objectives section synced
output_update: {
  payload: {
    data: {
      field: 'learningObjectives',
      value: [
        { description: 'Understand addition within 100', type: 'knowledge', bloomLevel: 'understand' },
        { description: 'Apply vertical addition method', type: 'skill', bloomLevel: 'apply' }
      ]
    }
  }
}

// 4. Tool call completed
tool_activity: { toolName: 'write_output', phase: 'end' }

// 5. More sections follow the same pattern...
output_update: { payload: { data: { field: 'textbookAnalysis', value: { ... } }}}
output_update: { payload: { data: { field: 'studentAnalysis', value: '...' }}}
output_update: { payload: { data: { field: 'learningTasks', value: [...] }}}
output_update: { payload: { data: { field: 'homeworkTasks', value: [...] }}}

// 6. Agent finishes
agent_status: { status: 'idle' }
```

### Design Decisions This Journey Reveals

1. **The editor must handle partial updates.** Sections arrive one at a time, not all at once. The `LessonPlanEditor` needs to update each section incrementally as `output_update` events arrive.
2. **The user edits after the AI generates.** Each editor section (e.g., `LearningObjectivesEditor`, `LearningTasksEditor`) must be editable both during and after AI generation.
3. **Save is a separate action.** The AI Agent does not save -- it only fills the form. The user must explicitly click "Save" to persist changes.
4. **The Solution backend owns the data.** The save request (step 15) goes to the Solution backend, not to CCAAS. CCAAS handles only AI relay.
5. **Two separate connections.** The frontend maintains a WebSocket to CCAAS for AI events and REST calls to the Solution backend for domain data. These are independent channels.

## Journey 2: Edit an Existing Lesson Plan Section with AI

The teacher has an existing lesson plan and wants the AI to improve a specific section -- for example, regenerating the learning tasks.

### Step-by-Step Flow

```
 User                    Frontend                CCAAS Backend          AI Agent          Solution Backend
  │                         │                         │                    │                    │
  │  1. Opens lesson        │                         │                    │                    │
  │     plan #7             │                         │                    │                    │
  │────────────────────────▶│                         │                    │                    │
  │                         │  2. GET                 │                    │                    │
  │                         │  /lesson-plans/7        │                    │                    │
  │                         │────────────────────────────────────────────────────────────────────▶
  │                         │  3. Lesson plan data    │                    │                    │
  │                         │◀───────────────────────────────────────────────────────────────────│
  │  4. Editor populated    │                         │                    │                    │
  │     with existing data  │                         │                    │                    │
  │◀────────────────────────│                         │                    │                    │
  │                         │                         │                    │                    │
  │  5. "Redesign the       │                         │                    │                    │
  │   learning tasks to     │                         │                    │                    │
  │   include more group    │                         │                    │                    │
  │   activities"           │                         │                    │                    │
  │────────────────────────▶│                         │                    │                    │
  │                         │  6. POST /sessions/     │                    │                    │
  │                         │     :id/completion      │                    │                    │
  │                         │────────────────────────▶│                    │                    │
  │                         │                         │  7. Launch Agent   │                    │
  │                         │                         │  (receives current │                    │
  │                         │                         │   form state as    │                    │
  │                         │                         │   context)         │                    │
  │                         │                         │───────────────────▶│                    │
  │                         │                         │                    │                    │
  │                         │  8. output_update       │                    │                    │
  │                         │  (only learningTasks    │                    │                    │
  │                         │   section updated)      │                    │                    │
  │                         │◀────────────────────────│◀───────────────────│                    │
  │                         │                         │                    │                    │
  │  9. Only "Learning      │                         │                    │                    │
  │     Tasks" section      │                         │                    │                    │
  │     updates; other      │                         │                    │                    │
  │     sections unchanged  │                         │                    │                    │
  │◀────────────────────────│                         │                    │                    │
  │                         │                         │                    │                    │
  │  10. User clicks "Save" │                         │                    │                    │
  │────────────────────────▶│                         │                    │                    │
  │                         │  11. PATCH              │                    │                    │
  │                         │  /lesson-plans/7        │                    │                    │
  │                         │────────────────────────────────────────────────────────────────────▶
  │                         │  12. 200 OK             │                    │                    │
  │                         │◀───────────────────────────────────────────────────────────────────│
```

### Design Decisions This Journey Reveals

1. **Context matters.** The AI Agent needs to know the current state of the lesson plan. The `FormStateSynchronizer` sends the current form state to CCAAS, so the Agent receives it as context when launched.
2. **Partial updates are essential.** The AI Agent should only update the sections the user asked about (`learningTasks`), leaving `learningObjectives`, `textbookAnalysis`, etc. unchanged.
3. **The frontend must merge, not replace.** When an `output_update` arrives for the `learningTasks` field, the frontend replaces only that section, keeping all other sections intact.

## Journey 3: Review and Approve AI Suggestions

The teacher generates content and uses the inline editing workflow to review, modify, and approve each section before saving.

### Step-by-Step Flow

```
 User                    Frontend                CCAAS Backend          AI Agent
  │                         │                         │                    │
  │  1. "Generate a         │                         │                    │
  │   complete lesson plan  │                         │                    │
  │   for Chapter 3:        │                         │                    │
  │   Addition within 100"  │                         │                    │
  │────────────────────────▶│                         │                    │
  │                         │  2. POST /sessions/     │                    │
  │                         │     :id/completion      │                    │
  │                         │────────────────────────▶│                    │
  │                         │                         │  3. Launch Agent   │
  │                         │                         │───────────────────▶│
  │                         │                         │                    │
  │                         │  4. output_update:      │                    │
  │                         │  textbookAnalysis       │                    │
  │                         │◀────────────────────────│◀───────────────────│
  │  5. Section highlights  │                         │                    │
  │     with blue glow      │                         │                    │
  │     (AI-modified)       │                         │                    │
  │◀────────────────────────│                         │                    │
  │                         │                         │                    │
  │                         │  6. output_update:      │                    │
  │                         │  learningObjectives     │                    │
  │                         │◀────────────────────────│◀───────────────────│
  │  7. Second section      │                         │                    │
  │     highlights          │                         │                    │
  │◀────────────────────────│                         │                    │
  │                         │                         │                    │
  │  ... (more sections arrive)                       │                    │
  │                         │                         │                    │
  │  8. Agent finishes      │                         │                    │
  │     (agent_status:idle) │                         │                    │
  │◀────────────────────────│◀────────────────────────│                    │
  │                         │                         │                    │
  │  9. User scrolls to     │                         │                    │
  │     "Learning Tasks"    │                         │                    │
  │     section, clicks     │                         │                    │
  │     "Edit"              │                         │                    │
  │────────────────────────▶│                         │                    │
  │                         │                         │                    │
  │  10. Section enters     │                         │                    │
  │      edit mode          │                         │                    │
  │◀────────────────────────│                         │                    │
  │                         │                         │                    │
  │  11. User modifies a    │                         │                    │
  │      learning task,     │                         │                    │
  │      clicks section     │                         │                    │
  │      "Save"             │                         │                    │
  │────────────────────────▶│                         │                    │
  │                         │                         │                    │
  │  12. Section saved      │                         │                    │
  │      (per-section       │                         │                    │
  │      save via store)    │                         │                    │
  │◀────────────────────────│                         │                    │
```

### Design Decisions This Journey Reveals

1. **AI-modified sections need visual feedback.** When an `output_update` arrives, the affected section should show a highlight (e.g., blue glow animation) so the teacher knows which sections the AI changed. The `aiModifiedFields` mechanism in the `LessonPlanNewView` handles this with a 3-second fade animation.
2. **Per-section editing is essential.** The `LessonPlanEditor` supports inline editing where each section (Course Requirements, Textbook Analysis, Learning Objectives, etc.) can be individually edited, saved, or cancelled. This lets the teacher approve sections one at a time.
3. **The outline panel aids navigation.** With many sections in a lesson plan (9+ sections), the `OutlinePanel` component lets the teacher quickly navigate to any section using scroll-spy tracking.
4. **Draft persistence protects work.** The `useDraftPersistence` composable automatically saves unsaved edits to localStorage, preventing data loss if the browser is closed accidentally.

## Journey 4: Browse and Filter Lesson Plans

Not every journey involves the AI Agent. Browsing and filtering lesson plans are purely CRUD operations.

### Step-by-Step Flow

```
 User                    Frontend                Solution Backend
  │                         │                         │
  │  1. Opens "Lesson       │                         │
  │     Plans" page         │                         │
  │────────────────────────▶│                         │
  │                         │  2. GET /lesson-plans   │
  │                         │     ?subject=math       │
  │                         │     &gradeLevel=3       │
  │                         │────────────────────────▶│
  │                         │  3. Filtered list       │
  │                         │◀────────────────────────│
  │  4. Displays lesson     │                         │
  │     plan list           │                         │
  │◀────────────────────────│                         │
  │                         │                         │
  │  5. Clicks on plan #7   │                         │
  │────────────────────────▶│                         │
  │                         │  6. GET                 │
  │                         │  /lesson-plans/7        │
  │                         │────────────────────────▶│
  │                         │  7. Full plan data      │
  │                         │◀────────────────────────│
  │  8. Lesson plan editor  │                         │
  │◀────────────────────────│                         │
```

### Design Decisions This Journey Reveals

1. **The Solution backend needs list endpoints with filtering.** You need `GET /lesson-plans` with query parameters for `subject`, `gradeLevel`, `status`, and `schoolId`.
2. **Not everything goes through CCAAS.** Read operations for domain data go directly to the Solution backend -- CCAAS is only involved when the AI Agent is invoked.

## Journey Map Summary

Here is an overview of all journeys and the components involved:

| Journey | User Action | AI Agent | Solution Backend | CCAAS |
|---------|------------|----------|------------------|-------|
| Create Lesson Plan | Selects chapter, chats with AI | Generates sections via write_output | Creates/saves lesson plan | Routes message, manages session |
| Edit Section | Asks AI to improve a section | Updates specific section | Patches lesson plan | Routes message |
| Review & Approve | Reviews AI output, edits per-section | Not involved (post-generation) | Saves per-section edits | Not involved |
| Browse Plans | Navigates UI, filters | Not involved | Serves lesson plan list | Not involved |

### When Is CCAAS Involved?

```
                    ┌─────────────┐
                    │ User Action │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │ Involves    │
                    │ AI Agent?   │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │ YES                     │ NO
              ▼                         ▼
    ┌─────────────────┐      ┌─────────────────┐
    │ Frontend        │      │ Frontend        │
    │    ↓ (WS+REST)  │      │    ↓ (REST)     │
    │ CCAAS Backend   │      │ Solution Backend│
    │    ↓            │      │ (direct CRUD)   │
    │ AI Agent        │      └─────────────────┘
    │    ↓            │
    │ write_output    │
    │    ↓            │
    │ output_update   │
    │    ↓ (WS)       │
    │ Frontend (form) │
    └─────────────────┘
```

Note: in the "YES" path, the frontend connects **directly** to CCAAS. There is no Solution backend relay for AI interactions.

## Designing the Frontend Layout

User journeys also inform your UI layout. For the Lesson Plan Designer, we need:

### Screen 1: New Lesson Plan Form

```
┌────────────────────────────────────────────────────────┐
│  ← Lesson Plans / New                                  │
├────────────────────────────────────────────────────────┤
│                                                        │
│   Create New Lesson Plan                               │
│                                                        │
│   Textbook Chapter: [Select chapter...]                │
│                                                        │
│   Subject:  [Math ▼]     (auto-set from chapter)       │
│   Grade:    [Grade 3 ▼]  (auto-set from chapter)       │
│   Title:    [optional, auto-generated if blank]        │
│                                                        │
│   [Cancel]  [Create]                                   │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### Screen 2: Lesson Plan Editor + AI Side Panel

```
┌────────────────────────────────────────────────────────────────────┐
│  ← Lesson Plans / Math Grade 3 - Addition            [AI] [Save] │
├──────┬─────────────────────────────┬──────────────────────────────┤
│      │                             │                              │
│ Out- │  Lesson Plan Editor         │   AI Side Panel              │
│ line │                             │                              │
│      │  ┌─ Course Requirements ──┐ │   ┌────────────────────────┐ │
│ ● CR │  │ Content Standards: ... │ │   │ AI: How can I help     │ │
│ ○ TA │  │ Academic Standards: ...│ │   │ with this lesson plan? │ │
│ ○ LO │  └───────────────────────┘ │   │                        │ │
│ ○ SA │                             │   │ User: Generate the     │ │
│ ○ PP │  ┌─ Textbook Analysis ────┐ │   │ learning objectives    │ │
│ ○ LP │  │ Key points: ...       │ │   │ for this chapter       │ │
│ ○ HA │  │ Difficulty: ...       │ │   │                        │ │
│      │  └───────[Edit]──────────┘ │   │ AI: I'll generate      │ │
│      │                             │   │ objectives based on    │ │
│      │  ┌─ Learning Objectives ──┐ │   │ the curriculum...      │ │
│      │  │ ✦ Understand addition  │ │   │                        │ │
│      │  │ ✦ Apply vertical method│ │   ├────────────────────────┤ │
│      │  └───────[Edit]──────────┘ │   │ Type a message...      │ │
│      │                             │   └────────────────────────┘ │
│      │  ... (more sections)        │                              │
│      │                             │                              │
└──────┴─────────────────────────────┴──────────────────────────────┘
```

The key insight: the **AI Side Panel is always available alongside the editor**. This is the propose-review-apply pattern. The teacher can:

1. Ask the AI to generate content for any section
2. See sections update in real time with visual highlights
3. Navigate to any section using the outline panel
4. Edit any section manually using inline edit mode
5. Ask the AI for changes to specific sections
6. Save when satisfied

## Edge Cases to Consider

Mapping journeys also helps you identify edge cases early:

### What If the User Edits While the AI Is Generating?

The AI sends `output_update` for the `learningObjectives` section, but the user is currently editing that section.

**Decision:** Show a visual indicator (blue glow animation via `AIEditingOverlay`) that the AI is updating this section. The `FormStateSynchronizer` tracks the source of each update (`'agent'` vs `'manual'`), so the frontend can differentiate between AI-generated and user-edited content.

### What If the AI Generates Invalid Data?

The AI sends a `learningObjective` with `bloomLevel: "mastery"`, but the valid values are `remember`, `understand`, `apply`, `analyze`, `evaluate`, and `create`.

**Decision:** Validate in the MCP Server's `write_output` handler. Reject invalid values with a clear error message so the AI can self-correct.

### What If the Network Drops During Generation?

The AI has sent `textbookAnalysis` and `learningObjectives` via `output_update`, but the connection drops before `learningTasks` arrives.

**Decision:** Use session reconnection (`reconnect_session` event). The frontend should handle partial state gracefully -- display whatever sections have been received and let the user manually complete the rest or ask the AI to regenerate.

### What If the User Cancels Mid-Generation?

The user clicks "Cancel" while the AI is still calling `write_output`.

**Decision:** Emit a `cancel` event via Socket.io to CCAAS. The frontend should stop updating editor sections from subsequent `output_update` events. Sections already updated remain in the editor for the user to discard or keep.

### What If the Teacher Wants to Revert a Section?

The AI updated the `learningTasks` section but the teacher prefers the original version.

**Decision:** The `useDraftPersistence` composable keeps a draft copy. Combined with per-section edit/cancel, the teacher can cancel section edits to revert to the last saved version.

## Checkpoint

Before moving to the next chapter, verify that you can answer these questions:

- [ ] In the "Create Lesson Plan" journey, which component saves the lesson plan to the database -- CCAAS or the Solution backend?
- [ ] What are the two separate channels the frontend uses, and what does each handle?
- [ ] When is CCAAS involved in a user journey, and when is it not?
- [ ] What happens if the user edits a section while the AI is generating content for that same section?
- [ ] Why is the AI Side Panel always available alongside the editor?

## Exercise: Design a Bulk Section Generation Journey

Design the complete user journey for generating all sections of a lesson plan at once:

1. **Draw the sequence diagram** showing all participants (User, Frontend, AI Agent, CCAAS, Solution Backend).
2. **List the WebSocket events** the frontend receives in order.
3. **Identify the output_update fields** the AI sends (hint: there are 6+ sections).
4. **Design the save mechanism** -- should all sections save together or per-section?
5. **Identify two edge cases** specific to bulk generation.

<details>
<summary>Hints</summary>

- The AI Agent could send sections one at a time (multiple `write_output` calls, each triggering an `output_update`) or batch several fields in one call.
- Consider: what if the AI generates 7 sections but the teacher only wants to keep 3? Per-section edit/cancel handles this.
- The save request goes to the Solution backend via `PATCH /lesson-plans/:id`, not to CCAAS.

</details>

## Summary

In this chapter you learned how to:

- **Trace complete user journeys** from initial action to final result
- **Identify the role of each component** (Frontend, Solution Backend, CCAAS, AI Agent) at each step
- **Distinguish the two channels** -- AI interactions go through CCAAS (direct WebSocket), domain data goes through the Solution backend (REST)
- **Map WebSocket events** to specific moments in the journey
- **Discover design decisions** that journeys reveal (partial updates, merge vs. replace, per-section editing, AI-modified highlights)
- **Design UI layouts** informed by interaction patterns
- **Identify edge cases** before writing any code

These journeys serve as the specification for your implementation. In the next chapter, we will dive into **data flow and state management** -- how data moves between components and how state is synchronized.

---

**Next:** [4. Data Flow and State Management](04-data-flow.md)
**Previous:** [2. Designing the Domain Model](02-domain-model.md)
