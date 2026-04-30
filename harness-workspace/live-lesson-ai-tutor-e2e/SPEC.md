# SPEC — live-lesson-ai-tutor-e2e

## Objective

Implement a complete AI tutor pipeline with:
1. **Rich prompts**: System prompt includes article text, step context, answer key awareness, and reference Q&A
2. **Dynamic categorization**: Questions auto-classified into predefined + dynamic categories
3. **Teacher visibility**: Question queue grouped by category with AI answers visible
4. **Context-aware student UX**: Category labels on answers, step-aware quick chips

## Design Documents (Truth Sources)

| Document | Path |
|----------|------|
| Categorization System | `solutions/business/live-lesson/docs/ai-tutor-categorization.md` |
| Prompt Engineering | `solutions/business/live-lesson/docs/ai-tutor-prompt-design.md` |
| Teacher Visibility | `solutions/business/live-lesson/docs/ai-tutor-teacher-visibility.md` |

Read these documents — they define the data models, API contracts, and UI designs.

## Artifact Scope

| File | What to Change |
|------|---------------|
| `backend/src/classroom/classroom.service.ts` | Enhanced prompt builder, category parsing, categoriesMap |
| `backend/src/classroom/classroom.controller.ts` | Return `{ answer, category }` from aiAsk |
| `frontend/src/hooks/useClassroom.ts` | ClassroomState type add `answer` + `category` to questions |
| `frontend/src/components/student/AiPanel.tsx` | Category label on answers, context-aware chips |
| `frontend/src/components/teacher/TeacherShell.tsx` | Category-grouped question queue, answer display |
| `frontend/src/styles/teacher.css` | Category badge styles |
| `frontend/src/styles/student.css` | Category label styles |
| `data/lessons/ideal-beauty-reading/manifest.json` | Add `aiReferenceQA` field (≥5 entries) |

## Frozen Constraints

```
packages/                                          # DO NOT MODIFY — penalty: total=0
solutions/business/edu-platform/                   # DO NOT MODIFY
solutions/business/recipe-book/                    # DO NOT MODIFY
solutions/business/live-lesson/mcp-server/         # DO NOT MODIFY
solutions/business/live-lesson/backend/src/entities/ # DO NOT MODIFY
solutions/business/live-lesson/backend/src/lesson/ # DO NOT MODIFY
solutions/business/live-lesson/backend/src/classroom/dto/ # DO NOT MODIFY — penalty: D3=0
solutions/business/live-lesson/backend/src/classroom/classroom.module.ts # DO NOT MODIFY
solutions/business/live-lesson/backend/src/main.ts # DO NOT MODIFY
solutions/business/live-lesson/frontend/src/pages/ # DO NOT MODIFY — penalty: D4=0
solutions/business/live-lesson/frontend/src/components/orchestrator/ # DO NOT MODIFY
solutions/business/live-lesson/frontend/src/types/ # DO NOT MODIFY
```

## Existing System (Read-Only Context)

### ClassroomState Type (current, from useClassroom.ts)

```typescript
export interface ClassroomState {
  currentStep: number
  students: Array<{
    id: string; name: string; currentTask: number; currentPhase: string; stepStartedAt: string
    submissions: Record<number, { step: number; data: any; score: any; submittedAt: string }>
  }>
  metrics: { total: number; submitted: number; inProgress: number }
  stepMetrics: Record<number, { currentCount: number; completedCount: number; completionRate: number; avgScore: number }>
  questions: Array<{ studentId: string; studentName: string; step: number; question: string; timestamp: string }>
}
```

After implementation, `questions` items gain `answer?: string` and `category?: string`.

### Backend API (Existing)

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/classroom/sessions` | Create session |
| POST | `/api/classroom/:code/join` | Student joins |
| POST | `/api/classroom/:code/submit` | Submit answer |
| GET | `/api/classroom/:code/state` | Full state snapshot |
| GET | `/api/classroom/:code/stream` | SSE real-time push |
| POST | `/api/classroom/:code/ai/ask` | AI question (currently returns `{ answer }`) |

After implementation, `ai/ask` returns `{ answer, category }`.

### DTO Constraint

`AiAskDto` (in frozen `dto/` directory) restricts `step: 1-5`. The `buildAiSystemPrompt` uses `readingSteps.find(s => s.idx === step)` to find step definition. Step indices map: `{ 1→1, 3→2, 5→3, 7→4, 9→5 }` (manifest idx → task number).

Non-task steps have no `answerKey` — prompt builder must handle gracefully (only include answer key context when `stepDef?.answerKey` exists).

## Implementation Plan (6 Phases)

### Phase 1: Data Layer
1. Add `aiReferenceQA` to `manifest.json` (≥5 entries covering 4 categories)
2. Add `category` field to `QuestionRecord` interface
3. Add `categoriesMap: Map<string, Set<string>>` for per-session categories

### Phase 2: Backend Logic
4. Rewrite `buildAiSystemPrompt()` — 6-layer structured prompt (see prompt design doc)
5. Add `parseCategoryFromResponse()` — regex `^【(.+?)】`, fallback to `其他`
6. Update `aiAsk()` — call parse, store category, add to categoriesMap
7. Update `getState()` — questions output includes `answer` + `category`

### Phase 3: API Layer
8. Controller returns `{ answer, category }` instead of just `{ answer }`

### Phase 4: Frontend Types
9. `ClassroomState.questions` type adds `answer?: string` + `category?: string`
10. `useAiAsk` returns `{ answer, category }` object

### Phase 5: Student UX
11. AiPanel shows category label above AI answers (e.g., `[概念理解]`)
12. Quick chips become step-context-aware (derived from manifest step info)

### Phase 6: Teacher UX
13. Question queue: group by category instead of by step
14. Category section headers + colored badges
15. Expandable AI answer under each question
16. Student modal AI chat shows category + answer

## Exit Conditions

- **Target score**: 98/100
- **Max iterations**: 10
- **Diminishing returns**: < 3 points improvement for 2 consecutive iterations
- **Regression**: > 5 points drop triggers auto-revert
