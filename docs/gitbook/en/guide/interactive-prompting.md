# Interactive Prompting

## What is Interactive Prompting

Interactive Prompting allows the Agent Engine to **pause mid-workflow and ask the user structured questions**. The user answers via single-select or multi-select cards (or a custom wizard), and the Agent resumes with the structured answers.

This is useful when the Agent needs clarification, confirmation, or user decisions before proceeding — for example, selecting a topic scope, choosing from generated options, or confirming parameters.

## How It Works

```
Agent Engine calls AskUserQuestion → pauses
  → Backend emits tool_activity(start) SSE event with question payload
  → Frontend renders question UI (default cards or custom wizard)
  → User answers
  → Frontend calls POST /sessions/:sessionId/control-response
  → Backend resumes Agent Engine with structured answers
  → Agent continues execution with JSON answers
```

### Event Flow

1. **Agent pauses** — The Agent Engine invokes `AskUserQuestion` with a `questions` array. Execution pauses automatically.
2. **SSE event delivered** — The backend emits a `tool_activity` event with `phase: 'start'` and `toolName: 'AskUserQuestion'`. The `toolInput` contains the question payload (questions, options, metadata) and a `requestId`.
3. **Frontend renders UI** — If the Solution has registered an `AskUserQuestion` ToolRenderer, it renders the interactive question cards. If a custom wizard is registered for the matching Skill, the wizard takes over.
4. **User submits answers** — The frontend calls `POST /sessions/:sessionId/control-response` with the `requestId` and the user's answers.
5. **Agent resumes** — The Agent Engine receives the answers as structured JSON and continues its workflow.

### Integration Layers

| Layer | Package | Audience | What You Get |
|-------|---------|----------|--------------|
| **Core Protocol** | `@kedge-agentic/backend` | Custom frontend developers (native app, mini-program, etc.) | SSE events + REST endpoint — build any UI |
| **Chat Interface** | `@kedge-agentic/chat-interface` | Solution developers using the platform chat UI | Default question cards + custom wizard framework |
| **Skill Definition** | SKILL.md | Skill authors | Instruct the Agent when/how to ask questions |

---

## Core Protocol

> **Audience**: Developers building a custom frontend (native app, WeChat mini-program, embedded WebView, etc.) who need to handle AskUserQuestion without `@kedge-agentic/chat-interface`.

The core protocol is transport-level: SSE events carry the question payload, and a REST endpoint accepts the user's answer. You can build any UI on top of this contract.

### SSE Event: `tool_activity`

When the Agent calls `AskUserQuestion`, the backend emits:

```
event: tool_activity
data: {
  "toolName": "AskUserQuestion",
  "toolId": "req_abc123",        // ← use as requestId when submitting
  "phase": "start",
  "toolInput": {
    "questions": [ ... ]          // ← question payload (see below)
  }
}
```

After the user submits answers and the Agent resumes, a second event is emitted:

```
event: tool_activity
data: {
  "toolName": "AskUserQuestion",
  "toolId": "req_abc123",
  "phase": "end",
  "toolOutput": {
    "answers": { "question text": "selected value" }
  }
}
```

### Question Payload Structure

```typescript
interface Question {
  question: string           // Full question text (also used as answer key)
  header?: string            // Short chip label (max 12 chars)
  hint?: string              // Hint text shown below the question
  options: QuestionOption[]  // 2-4 choices
  multiSelect?: boolean      // false = single-select, true = multi-select
  preview?: boolean          // true = include preview content alongside options
}

interface QuestionOption {
  label: string              // Display text
  description?: string       // Explanation subtext
  recommended?: boolean      // Mark as recommended / pre-select
  value?: string             // Answer value (defaults to label if omitted)
  previewContent?: string    // Content shown in preview pane when selected
}
```

#### Field Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `question` | `string` | Yes | Full question text; also used as the answer key |
| `header` | `string` | No | Short chip label (max 12 chars) |
| `hint` | `string` | No | Hint text shown below the question (e.g., "可多选") |
| `options` | `QuestionOption[]` | Yes | 2–4 choices |
| `multiSelect` | `boolean` | No | `false` = single-select (default), `true` = multi-select |
| `preview` | `boolean` | No | `true` = options include `previewContent` for side-by-side display |

| Option Field | Type | Required | Description |
|--------------|------|----------|-------------|
| `label` | `string` | Yes | Display text for the option |
| `description` | `string` | No | Explanation subtext |
| `recommended` | `boolean` | No | Pre-selects this option and marks it as recommended |
| `value` | `string` | No | Answer value submitted; defaults to `label` |
| `previewContent` | `string` | No | Content shown when this option is focused (requires `preview: true` on question) |

### Example Payload

```json
{
  "questions": [
    {
      "question": "Which question type should the quiz use?",
      "header": "Type",
      "multiSelect": false,
      "options": [
        { "label": "Mixed", "description": "Multiple choice + fill-in + essay", "recommended": true, "value": "Mixed" },
        { "label": "Multiple Choice", "description": "All single-choice, easy to grade", "value": "Multiple Choice" },
        { "label": "Fill-in-the-Blank", "description": "Tests calculation and reasoning", "value": "Fill-in-the-Blank" }
      ]
    },
    {
      "question": "How many questions?",
      "header": "Count",
      "multiSelect": false,
      "options": [
        { "label": "5 questions", "description": "Quick quiz, ~15 min", "recommended": true, "value": "5 questions" },
        { "label": "10 questions", "description": "Unit practice, ~30 min", "value": "10 questions" },
        { "label": "20 questions", "description": "Full test, ~45 min", "value": "20 questions" }
      ]
    }
  ]
}
```

### REST Endpoint: Submit Answer

```
POST /api/v1/sessions/:sessionId/control-response
Content-Type: application/json

{
  "requestId": "req_abc123",
  "answers": {
    "Which question type should the quiz use?": "Mixed",
    "How many questions?": "5 questions"
  }
}
```

**`ControlResponseDto`**:

| Field | Type | Description |
|-------|------|-------------|
| `requestId` | `string` | The `toolId` from the `tool_activity(start)` event |
| `answers` | `Record<string, string>` | Map of question text → selected answer value |

After submission, the Agent Engine resumes and emits `tool_activity(end)` with the answers in `toolOutput`.

### Building a Custom Frontend

With the core protocol, you can build any question UI:

1. **Listen** for `tool_activity` SSE events where `toolName === 'AskUserQuestion'` and `phase === 'start'`
2. **Parse** `toolInput.questions` and render your own UI (native controls, form, chat bubble, etc.)
3. **Collect** the user's selections
4. **POST** to `/api/v1/sessions/:sessionId/control-response` with `requestId` + `answers`
5. **Listen** for `tool_activity` with `phase === 'end'` to confirm the Agent has resumed

No dependency on `@kedge-agentic/chat-interface` or `@kedge-agentic/react-sdk` is needed.

---

## Chat Interface Integration

> **Audience**: Solution developers using `@kedge-agentic/chat-interface` as the chat UI layer.

The chat-interface package provides pre-built rendering for AskUserQuestion: default question cards and a custom wizard framework. You integrate by registering a `ToolRenderer`.

### Default Question Cards

The built-in question card UI supports:

- **Single-select questions** — Radio-style option cards; user picks one
- **Multi-select questions** — Checkbox-style option cards; user picks one or more
- **Up to 4 questions per prompt** — Each with 2–4 options
- **"Other" option** — Automatically appended, allowing the user to type a custom answer
- **Preview pane** — Side-by-side layout with content preview when `preview: true`
- **Recommended badge** — Pre-selects an option and shows a badge when `recommended: true`

### Implementing a ToolRenderer

Your Solution frontend must provide a `ToolRenderer` function for AskUserQuestion.
The renderer receives a `ToolUseBlock` and returns JSX based on the `phase`:

```tsx
import type { ToolRenderer } from '@kedge-agentic/chat-interface'

export const askUserQuestionRenderer: ToolRenderer = (block) => {
  const questions = block.toolInput?.questions

  if (block.phase === 'end') {
    // Show read-only submitted view with answers from block.toolOutput
    return <SubmittedView questions={questions} answers={block.toolOutput.answers} />
  }

  if (block.phase === 'start') {
    // Agent is paused — render interactive UI, collect answers,
    // then POST to /sessions/:sessionId/control-response
    return <QuestionUI questions={questions} requestId={block.toolId} />
  }

  return null
}
```

### Registering the Renderer

```tsx
<ChatInterfaceProvider value={{ toolRenderers: { AskUserQuestion: askUserQuestionRenderer } }}>
  {children}
</ChatInterfaceProvider>
```

Without this registration, AskUserQuestion events render as a generic tool activity card (collapsible row showing tool name and input/output).

### Custom Wizard Framework

For multi-step or complex input flows, you can register a **custom wizard** that replaces the default card UI.

The wizard framework provides:

- **Multi-step navigation** — Progress indicator, back/next buttons
- **4 step types** — `form`, `tree-select`, `data-review`, `summary`
- **Dependent steps** — Steps can declare `dependsOn` to gate progression
- **Automatic answer collection** — Answers from all steps are aggregated and submitted as a single response
- **Registration via `registerWizard()`** — Associates a `WizardConfig` with a Skill slug, with optional header-based fallback matching

#### Step Types

| Type | Description | Use Case |
|------|-------------|----------|
| `form` | Text/select/number input fields | Entering parameters, selecting from dropdowns |
| `tree-select` | Multi-select tree loaded from API | Selecting chapters, topics, or hierarchical items |
| `data-review` | Data table with emphasis toggles | Reviewing student data, gap analysis |
| `summary` | Read-only review of all answers | Final confirmation before submission |

#### Registering a Wizard

```tsx
import { registerWizard } from '@kedge-agentic/chat-interface'

registerWizard('lesson-plan-designer', {
  id: 'lesson-plan',
  title: 'Lesson Plan Wizard',
  steps: [
    { id: 'scope', type: 'form', title: 'Scope', fields: [
      { key: 'subject', label: 'Subject', type: 'select', options: [...], contextKey: 'subject' },
      { key: 'grade', label: 'Grade', type: 'select', options: [...], contextKey: 'grade' },
    ]},
    { id: 'chapters', type: 'tree-select', title: 'Chapters', dependsOn: ['scope'] },
    { id: 'gaps', type: 'data-review', title: 'Student Gaps', dependsOn: ['scope', 'chapters'] },
    { id: 'confirm', type: 'summary', title: 'Confirm', dependsOn: ['scope', 'chapters', 'gaps'] },
  ],
}, {
  triggerHeaders: ['Subject', 'Lesson'],  // Fallback matching via question headers
})
```

When the Agent triggers `AskUserQuestion` during a session, the renderer checks:
1. **Direct slug match** — The first question's `header` matches a registered wizard slug
2. **Trigger header match** — Any question `header` appears in a wizard's `triggerHeaders` list

If a match is found, the `WizardRenderer` takes over instead of the default question cards.

#### Type Definitions

```typescript
interface WizardConfig {
  id: string
  title: string
  steps: WizardStep[]
}

interface WizardStep {
  id: string
  title: string
  type: 'form' | 'tree-select' | 'data-review' | 'summary'
  fields?: FormFieldConfig[]       // For 'form' type
  dataEndpoint?: string            // API URL for dynamic data (tree-select, data-review)
  dependsOn?: string[]             // Step IDs that must complete first
}

interface FormFieldConfig {
  key: string
  label: string
  type: 'select' | 'text' | 'number'
  options?: { label: string; value: string }[]
  defaultValue?: string
  contextKey?: string              // Auto-fill from sessionContext[contextKey]
}

interface RegisterWizardOptions {
  triggerHeaders?: string[]        // Additional question header values that trigger this wizard
}
```

---

## Skill Writing: Using AskUserQuestion

> **Audience**: Skill authors defining Agent behavior in SKILL.md.

To enable interactive prompting in your Skill, instruct the Agent to use `AskUserQuestion` at the appropriate workflow step. No frontend code is needed from the Skill author — the Skill only defines **when** and **what** to ask.

### Example in SKILL.md

```markdown
# Workflow

## Step 1: Understand Requirements
Ask the user to clarify their needs using AskUserQuestion:

- Question 1: "Which subject area?" (options: Math, Science, Language Arts, Social Studies)
- Question 2: "Which grade level?" (options: Grade 1-3, Grade 4-6, Grade 7-9)

Use the AskUserQuestion tool with a `questions` array. Each question should have:
- `question`: The full question text
- `header`: A short label (max 12 chars)
- `options`: 2-4 choices, each with `label` and `description`
- `multiSelect`: true/false

Wait for the user's answers before proceeding to Step 2.
```

### Questions Array Format

```json
{
  "questions": [
    {
      "question": "Which subject area should the lesson cover?",
      "header": "Subject",
      "multiSelect": false,
      "options": [
        { "label": "Math", "description": "Arithmetic, algebra, geometry" },
        { "label": "Science", "description": "Physics, chemistry, biology" },
        { "label": "Language Arts", "description": "Reading, writing, grammar" }
      ]
    }
  ]
}
```

The Agent receives answers as a JSON object mapping question text to the selected option value(s).

---

## API Reference

- **SSE event**: `tool_activity` with `toolName: 'AskUserQuestion'` — see [SSE Transport](../api/sse.md#tool_activity)
- **Submit answers**: `POST /sessions/:sessionId/control-response` — see [SSE Transport](../api/sse.md#post-control-response--submit-wizard-answer)
- **REST endpoint**: `POST /sessions/:sessionId/control-response` — see [REST API](../api/rest.md#post-sessionssessionidcontrol-response)

## Example: Lesson Plan Wizard

A 4-step wizard for creating a lesson plan:

| Step | Type | Purpose |
|------|------|---------|
| 1. Scope | `form` | Select subject, grade, class, lesson type via form fields |
| 2. Chapters | `tree-select` | Pick chapters from API-loaded textbook tree |
| 3. Student Gaps | `data-review` | Review gap analysis data, toggle emphasis |
| 4. Confirm | `summary` | Review all selections and submit |

After the user completes all 4 steps and confirms, the wizard submits the aggregated answers via `POST /control-response`. The Agent then has all the context needed to generate the lesson plan.

```tsx
import { registerWizard } from '@kedge-agentic/chat-interface'

registerWizard('备课向导', {
  id: 'lesson-plan',
  title: '备课向导',
  steps: [
    {
      id: 'scope',
      title: '选择范围',
      type: 'form',
      fields: [
        { key: 'subject', label: '学科', type: 'select', options: [...], contextKey: 'subject' },
        { key: 'grade', label: '年级学期', type: 'select', options: [...], contextKey: 'grade' },
        { key: 'class_id', label: '班级', type: 'select', options: [...], contextKey: 'classId' },
        { key: 'lessonType', label: '课型', type: 'select', options: [...] },
        { key: 'duration', label: '课时', type: 'select', options: [...] },
      ],
    },
    { id: 'chapters', title: '选择章节', type: 'tree-select', dependsOn: ['scope'] },
    { id: 'gaps', title: '学情分析', type: 'data-review', dependsOn: ['scope', 'chapters'] },
    { id: 'confirm', title: '确认生成', type: 'summary', dependsOn: ['scope', 'chapters', 'gaps'] },
  ],
}, {
  triggerHeaders: ['学科', '备课', '备课参数', '科目'],
})
```
