# v1 Changelog — live-lesson-ai-tutor-e2e

## Summary

First iteration implementing the full AI tutor pipeline: structured 6-layer system prompt, category classification via response prefix parsing, and category-aware UI for both student and teacher views.

## Changes

### Phase 1: Data Layer
- Added `aiReferenceQA` (5 entries, 4 categories) to lesson manifest for few-shot prompting
- Added `category?: string` to `QuestionRecord` interface in ClassroomService
- Added `categoriesMap` (per-session `Map<string, Set<string>>`) with cleanup on session end

### Phase 2: Backend Logic
- Rewrote `buildAiSystemPrompt()` with 6-layer structure: Role → Article → Step → AnswerKey → ReferenceQA → Classification
- Added `parseCategoryFromResponse()` — regex `^【(.+?)】` extracts category prefix from AI response
- Changed `aiAsk()` return type from `Promise<string>` to `Promise<{ answer: string; category: string }>`
- Default categories: 概念理解, 阅读策略, 课文内容, 解题求助; dynamically grows via categoriesMap
- Added `buildFallbackPrompt()` helper for error-case responses

### Phase 3: API Layer
- Updated controller `aiAsk` endpoint to return `{ answer, category }` from service result

### Phase 4: Frontend Types
- Updated `ClassroomState.questions` to include `answer?: string` and `category?: string`
- Updated `useAiAsk` hook to return `{ answer: string; category: string } | null`

### Phase 5: Student UX (AiPanel)
- Added `category` field to `ChatMsg` interface
- Added step-context-aware `STEP_CHIPS` map (keys 1–5) with Chinese quick-ask chips
- Added `getCategoryClass()` helper mapping category names to CSS classes
- Category badge displayed above each AI response
- CSS: `.ai-category` with 5 color variants (concept, strategy, content, task-help, other)

### Phase 6: Teacher UX (TeacherShell)
- Replaced `queueByStep` grouping with `queueByCategory` grouping
- Added `getCatBadgeClass()` and `formatRelative()` helpers
- Added `expandedQ` state for collapsible AI answer display
- Question queue shows category badge headers, student name, timestamp, expandable answer
- StudentModal AI chat shows category badges and AI answers
- CSS: `.cat-badge` with 5 color variants, `.q-answer`, `.q-student` styles

## Files Modified

| File | Change |
|------|--------|
| `data/lessons/ideal-beauty-reading/manifest.json` | Added `aiReferenceQA` array |
| `backend/src/classroom/classroom.service.ts` | QuestionRecord category, categoriesMap, rewritten buildAiSystemPrompt, parseCategoryFromResponse, updated aiAsk |
| `backend/src/classroom/classroom.controller.ts` | Destructured `{ answer, category }` from service |
| `frontend/src/hooks/useClassroom.ts` | ClassroomState.questions types, useAiAsk return type |
| `frontend/src/components/student/AiPanel.tsx` | Category badges, step-aware chips, updated sendQuestion |
| `frontend/src/components/teacher/TeacherShell.tsx` | Category-grouped queue, expandable answers, badges |
| `frontend/src/styles/student.css` | `.ai-category` and variant classes |
| `frontend/src/styles/teacher.css` | `.cat-badge`, `.q-answer`, `.q-student` styles |

## Validation

- `npx nest build` — clean
- `npx tsc --noEmit` — clean
- `npx vite build` — success (2.48s, 415.73 kB JS, 87.46 kB CSS)

## Known Issues

- No live E2E testing yet (requires running backend + GLM API key)
- Category classification depends on GLM-4-Flash reliably emitting `【Category】` prefix — may need prompt tuning if model compliance is low
- `categoriesMap` is in-memory only; categories reset on server restart
- `formatRelative()` in TeacherShell is a simple implementation — may want a proper date library for edge cases
