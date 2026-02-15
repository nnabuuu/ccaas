# 3. Mapping User Journeys

## What You Will Learn

In this chapter, you will map out the end-to-end user journeys for the Task Manager Solution. A user journey traces every step a user takes to accomplish a goal -- from opening the app to seeing the final result. By mapping these journeys before writing code, you ensure that no interaction is overlooked and that the AI Agent, backend, and frontend are all designed to support the same workflows.

By the end of this chapter, you will be able to:

- Decompose a feature into a step-by-step user journey
- Identify where the AI Agent, backend, and frontend each play a role
- Map WebSocket events to specific moments in the journey
- Design journeys that account for both AI-generated and user-edited content
- Spot gaps and edge cases early in the design process

## Why Map Journeys Before Coding

In a traditional web application, the data flow is straightforward: user fills a form, submits it, backend saves it. In a LoopAI Solution, there is a third participant -- the AI Agent -- which introduces new interaction patterns:

- The user types a natural language request instead of filling a form
- The AI Agent interprets the request, generates structured data, and pushes it to the form
- The user reviews, edits, and confirms the AI-generated content
- The backend saves the final result

If you skip the journey mapping step, you will discover these interaction patterns during implementation, leading to rework.

## Journey 1: Create a Task with AI Assistance

This is the primary journey. The user asks the AI Agent to create a task, reviews the generated content, and saves it.

### Step-by-Step Flow

```
 User                    Frontend                Solution Backend        CCAAS Backend         AI Agent
  │                         │                         │                       │                    │
  │  1. "Create a task:     │                         │                       │                    │
  │   deploy new API"       │                         │                       │                    │
  │────────────────────────▶│                         │                       │                    │
  │                         │  2. emit('chat',{msg})  │                       │                    │
  │                         │────────────────────────▶│                       │                    │
  │                         │                         │  3. POST /completion  │                    │
  │                         │                         │──────────────────────▶│                    │
  │                         │                         │                       │  4. Launch Agent   │
  │                         │                         │                       │───────────────────▶│
  │                         │                         │                       │                    │
  │                         │                         │                       │  5. Agent calls    │
  │                         │                         │                       │◀───────────────────│
  │                         │                         │                       │  write_output      │
  │                         │                         │                       │  (field: "title",  │
  │                         │                         │                       │   value: "Deploy   │
  │                         │                         │                       │   new API")        │
  │                         │                         │                       │                    │
  │                         │  6. output_update event │                       │                    │
  │                         │◀────────────────────────│◀──────────────────────│                    │
  │                         │                         │                       │                    │
  │  7. Form field "title"  │                         │                       │                    │
  │     updates in real     │                         │                       │                    │
  │     time                │                         │                       │                    │
  │◀────────────────────────│                         │                       │                    │
  │                         │                         │                       │                    │
  │  (Steps 5-7 repeat for description, status, dueDate, tags)               │                    │
  │                         │                         │                       │                    │
  │  8. User reviews and    │                         │                       │                    │
  │     edits the form      │                         │                       │                    │
  │────────────────────────▶│                         │                       │                    │
  │                         │                         │                       │                    │
  │  9. User clicks "Save"  │                         │                       │                    │
  │────────────────────────▶│                         │                       │                    │
  │                         │  10. POST /tasks        │                       │                    │
  │                         │────────────────────────▶│                       │                    │
  │                         │                         │  11. Save to DB       │                    │
  │                         │                         │                       │                    │
  │                         │  12. 201 Created        │                       │                    │
  │                         │◀────────────────────────│                       │                    │
  │  13. "Task created"     │                         │                       │                    │
  │◀────────────────────────│                         │                       │                    │
```

### Key Moments in This Journey

| Step | Component | What Happens | Events |
|------|-----------|-------------|--------|
| 1 | User | Types a natural language request | -- |
| 2 | Frontend | Sends chat message via Socket.io | `chat` |
| 3 | Solution Backend | Forwards to CCAAS REST API | HTTP POST |
| 4 | CCAAS | Launches AI Agent with Skill context | -- |
| 5 | AI Agent | Calls `write_output` for each field | tool_activity |
| 6 | CCAAS | Pushes structured data via WebSocket | `output_update` |
| 7 | Frontend | Updates form fields in real time | -- |
| 8 | User | Reviews and optionally edits | -- |
| 9-12 | Frontend + Backend | Standard form submission | HTTP POST |
| 13 | Frontend | Shows confirmation | -- |

### WebSocket Events During This Journey

The frontend receives these events in order:

```typescript
// 1. Agent starts thinking
agent_status: { status: 'thinking' }

// 2. Agent decides to use write_output
tool_activity: { toolName: 'write_output', phase: 'start' }

// 3. Title field synced
output_update: { payload: { data: { field: 'title', value: 'Deploy new API' }}}

// 4. Tool call completed
tool_activity: { toolName: 'write_output', phase: 'end' }

// 5. More fields follow the same pattern...
output_update: { payload: { data: { field: 'description', value: '...' }}}
output_update: { payload: { data: { field: 'status', value: 'todo' }}}
output_update: { payload: { data: { field: 'dueDate', value: '2026-03-01' }}}
output_update: { payload: { data: { field: 'tags', value: ['backend', 'deployment'] }}}

// 6. Agent finishes
agent_status: { status: 'idle' }
```

### Design Decisions This Journey Reveals

1. **The form must handle partial updates.** Fields arrive one at a time, not all at once. The form needs to update incrementally.
2. **The user edits after the AI generates.** The form must be editable both during and after AI generation.
3. **Save is a separate action.** The AI Agent does not save -- it only fills the form. The user must explicitly save.
4. **The Solution backend owns the data.** The save request (step 10) goes to the Solution backend, not to CCAAS.

## Journey 2: Edit an Existing Task with AI

The user has a task and wants the AI to update specific fields.

### Step-by-Step Flow

```
 User                    Frontend                Solution Backend
  │                         │                         │
  │  1. Opens task #42      │                         │
  │────────────────────────▶│                         │
  │                         │  2. GET /tasks/42       │
  │                         │────────────────────────▶│
  │                         │  3. Task data           │
  │                         │◀────────────────────────│
  │  4. Form populated      │                         │
  │     with existing data  │                         │
  │◀────────────────────────│                         │
  │                         │                         │
  │  5. "Add more detail    │                         │
  │   to the description    │                         │
  │   and add testing tags" │                         │
  │────────────────────────▶│                         │
  │                         │                         │
  │  ... (AI generates, output_update events) ...     │
  │                         │                         │
  │  6. Only "description"  │                         │
  │     and "tags" fields   │                         │
  │     update; other       │                         │
  │     fields unchanged    │                         │
  │◀────────────────────────│                         │
  │                         │                         │
  │  7. User clicks "Save"  │                         │
  │────────────────────────▶│                         │
  │                         │  8. PATCH /tasks/42     │
  │                         │────────────────────────▶│
  │                         │  9. 200 OK              │
  │                         │◀────────────────────────│
```

### Design Decisions This Journey Reveals

1. **Context matters.** The AI Agent needs to know which task is currently open. The Skill instructions should specify how to read existing context (via `read_context` or by receiving the current form state in the chat message).
2. **Partial updates are essential.** The AI Agent should only update the fields the user asked about, leaving others untouched.
3. **The frontend must merge, not replace.** When an `output_update` arrives for the `description` field, the frontend replaces only that field, keeping `title`, `status`, etc. intact.

## Journey 3: Bulk Task Creation

The user wants to create multiple tasks at once from a project brief.

### Step-by-Step Flow

```
 User                    Frontend                AI Agent
  │                         │                       │
  │  1. "Break down this    │                       │
  │   project into tasks:   │                       │
  │   Build a user auth     │                       │
  │   system with login,    │                       │
  │   registration, and     │                       │
  │   password reset"       │                       │
  │────────────────────────▶│                       │
  │                         │  (chat event)         │
  │                         │──────────────────────▶│
  │                         │                       │
  │                         │  output_update:       │
  │                         │  field: "tasks"       │
  │                         │  value: [             │
  │                         │    { title: "...",    │
  │                         │      description: ... │
  │                         │      status: "todo"}, │
  │                         │    { title: "...",    │
  │                         │      ...},            │
  │                         │    { title: "...",    │
  │                         │      ...}             │
  │                         │  ]                    │
  │                         │◀──────────────────────│
  │                         │                       │
  │  2. Task list renders   │                       │
  │     with 3 new tasks    │                       │
  │◀────────────────────────│                       │
  │                         │                       │
  │  3. User reviews,       │                       │
  │     removes one,        │                       │
  │     edits another       │                       │
  │────────────────────────▶│                       │
  │                         │                       │
  │  4. User clicks         │                       │
  │     "Save All"          │                       │
  │────────────────────────▶│                       │
  │                         │  POST /tasks/bulk     │
  │                         │──────────────────────▶│
```

### Design Decisions This Journey Reveals

1. **Array fields need special handling.** When the AI generates multiple tasks, it sends them as an array. The frontend needs a list view, not a single-item form.
2. **The sync field contract expands.** You may need a `tasks` sync field that accepts an array of task objects, in addition to the per-field sync fields.
3. **Bulk save requires a separate endpoint.** A single POST to `/tasks` creates one task; you need a `/tasks/bulk` endpoint for batch creation.

## Journey 4: View and Filter Tasks

Not every journey involves the AI Agent. Some are purely CRUD operations.

### Step-by-Step Flow

```
 User                    Frontend                Solution Backend
  │                         │                         │
  │  1. Opens project       │                         │
  │     "API Backend"       │                         │
  │────────────────────────▶│                         │
  │                         │  2. GET /projects/abc   │
  │                         │     /tasks?status=todo  │
  │                         │────────────────────────▶│
  │                         │  3. Filtered task list  │
  │                         │◀────────────────────────│
  │  4. Displays task list  │                         │
  │◀────────────────────────│                         │
  │                         │                         │
  │  5. Clicks on a task    │                         │
  │────────────────────────▶│                         │
  │                         │  6. GET /tasks/42       │
  │                         │────────────────────────▶│
  │                         │  7. Full task detail    │
  │                         │◀────────────────────────│
  │  8. Task detail view    │                         │
  │◀────────────────────────│                         │
```

### Design Decisions This Journey Reveals

1. **The Solution backend needs list endpoints with filtering.** You need `GET /projects/:id/tasks` with query parameters for status, tags, and date range.
2. **Not everything goes through CCAAS.** Read operations for domain data go directly to the Solution backend -- CCAAS is only involved when the AI Agent is invoked.

## Journey Map Summary

Here is an overview of all journeys and the components involved:

| Journey | User Action | AI Agent | Solution Backend | CCAAS |
|---------|------------|----------|------------------|-------|
| Create Task | Sends chat message | Generates fields via write_output | Saves task | Routes message, manages session |
| Edit Task | Sends update request | Updates specific fields | Patches task | Routes message |
| Bulk Create | Sends project brief | Generates task list | Bulk saves | Routes message |
| View Tasks | Navigates UI | Not involved | Serves task list | Not involved |

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
    │    ↓            │      │    ↓            │
    │ Solution BE     │      │ Solution BE     │
    │    ↓            │      │ (direct CRUD)   │
    │ CCAAS BE        │      └─────────────────┘
    │    ↓            │
    │ AI Agent        │
    │    ↓            │
    │ MCP Server      │
    │    ↓            │
    │ output_update   │
    │    ↓            │
    │ Frontend (form) │
    └─────────────────┘
```

## Designing the Frontend Layout

User journeys also inform your UI layout. For the Task Manager, we need:

### Screen 1: Project List + Chat Panel

```
┌────────────────────────────────────────────────────────┐
│  Task Manager                                          │
├────────────────────────┬───────────────────────────────┤
│                        │                               │
│   Projects             │   Chat Panel                  │
│                        │                               │
│   ┌─────────────────┐  │   ┌───────────────────────┐   │
│   │ API Backend    ▶│  │   │ AI: How can I help?   │   │
│   ├─────────────────┤  │   │                       │   │
│   │ Mobile App     ▶│  │   │ User: Create a task   │   │
│   ├─────────────────┤  │   │ to deploy the API     │   │
│   │ Documentation  ▶│  │   │                       │   │
│   └─────────────────┘  │   │ AI: I'll create that  │   │
│                        │   │ task for you...        │   │
│   [+ New Project]      │   │                       │   │
│                        │   ├───────────────────────┤   │
│                        │   │ Type a message...     │   │
│                        │   └───────────────────────┘   │
└────────────────────────┴───────────────────────────────┘
```

### Screen 2: Task Detail + Chat Panel

```
┌────────────────────────────────────────────────────────┐
│  ← API Backend / Tasks                                 │
├────────────────────────┬───────────────────────────────┤
│                        │                               │
│   Task Form            │   Chat Panel                  │
│                        │                               │
│   Title:               │   (same chat, preserving      │
│   [Deploy new API    ] │    conversation context)      │
│                        │                               │
│   Description:         │                               │
│   [Set up CI/CD pipe ] │                               │
│   [line for the new ] │                               │
│   [API endpoint...   ] │                               │
│                        │                               │
│   Status: [todo ▼]     │                               │
│   Due: [2026-03-01]    │                               │
│   Tags: [backend]      │                               │
│         [deployment]   │                               │
│                        │                               │
│   [Save]  [Cancel]     │                               │
│                        │                               │
└────────────────────────┴───────────────────────────────┘
```

The key insight: the **Chat Panel is always visible alongside the form**. This is the human-in-the-loop pattern. The user can:

1. Ask the AI to fill in the form
2. See fields update in real time
3. Edit any field manually
4. Ask the AI for changes
5. Save when satisfied

## Edge Cases to Consider

Mapping journeys also helps you identify edge cases early:

### What If the User Edits While the AI Is Generating?

The AI sends `output_update` for the `description` field, but the user is currently typing in that field.

**Decision:** Show a visual indicator that the AI is updating this field. If the user has made edits, offer to keep the user's version or accept the AI's version.

### What If the AI Generates Invalid Data?

The AI sends `status: "completed"` but the valid values are `todo`, `in_progress`, and `done`.

**Decision:** Validate in the MCP Server. Reject invalid values with a clear error message so the AI can self-correct.

### What If the Network Drops During Generation?

The AI has sent `title` and `description` via `output_update`, but the connection drops before `status` and `tags` arrive.

**Decision:** Use session reconnection (`reconnect_session` event). The frontend should handle partial state gracefully -- display whatever fields have been received and let the user manually complete the rest.

### What If the User Cancels Mid-Generation?

The user clicks "Cancel" while the AI is still calling `write_output`.

**Decision:** Emit a `cancel` event via Socket.io. The frontend should stop updating form fields from subsequent `output_update` events. Fields already updated remain in the form for the user to discard or keep.

## Checkpoint

Before moving to the next chapter, verify that you can answer these questions:

- [ ] In the "Create Task" journey, which component saves the task to the database -- CCAAS or the Solution backend?
- [ ] How many `output_update` events does the AI Agent send when creating a single task?
- [ ] When is CCAAS involved in a user journey, and when is it not?
- [ ] What happens if the user edits a form field while the AI is generating content for that same field?
- [ ] Why is the Chat Panel always visible alongside the form?

## Exercise: Design a Bulk Task Creation Journey

Design the complete user journey for bulk task creation:

1. **Draw the sequence diagram** showing all participants (User, Frontend, AI Agent, Solution Backend, CCAAS).
2. **List the WebSocket events** the frontend receives in order.
3. **Identify the sync field** needed (hint: it is an array).
4. **Design the API endpoint** for bulk saving (method, path, request body).
5. **Identify two edge cases** specific to bulk creation.

<details>
<summary>Hints</summary>

- The AI Agent could send tasks one at a time (multiple `output_update` calls with `operation: "append"`) or all at once (one `output_update` call with `operation: "set"` and an array value).
- Consider: what if the AI generates 20 tasks but the user only wants 5?
- The bulk endpoint might need to accept a `projectId` to associate all tasks with a project.

</details>

## Summary

In this chapter you learned how to:

- **Trace complete user journeys** from initial action to final result
- **Identify the role of each component** (Frontend, Solution Backend, CCAAS, AI Agent) at each step
- **Map WebSocket events** to specific moments in the journey
- **Discover design decisions** that journeys reveal (partial updates, merge vs. replace, save vs. generate)
- **Design UI layouts** informed by interaction patterns
- **Identify edge cases** before writing any code

These journeys serve as the specification for your implementation. In the next chapter, we will dive into **data flow and state management** -- how data moves between components and how state is synchronized.

---

**Next:** [4. Data Flow and State Management](04-data-flow.md)
**Previous:** [2. Designing the Domain Model](02-domain-model.md)
