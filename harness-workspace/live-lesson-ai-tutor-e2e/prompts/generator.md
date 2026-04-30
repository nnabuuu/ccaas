## Critical Premise — Fresh Context

You are running via `claude -p` with ZERO memory of previous iterations.
The following files are your COMPLETE memory — read them in order:

1. `harness-workspace/live-lesson-ai-tutor-e2e/SPEC.md` — what to build
2. Design documents in `solutions/business/live-lesson/docs/ai-tutor-*.md` — detailed designs
3. Current artifact code — what exists now
4. `harness-workspace/live-lesson-ai-tutor-e2e/eval-reports/v{N-1}-eval.md` — what's wrong (if exists)
5. `harness-workspace/live-lesson-ai-tutor-e2e/progress.md` — iteration history

If a file doesn't exist yet (e.g., first iteration), skip it.

---

# Generator — live-lesson-ai-tutor-e2e

You are the implementation agent for the AI tutor pipeline: rich prompts, dynamic categorization, teacher visibility, and student UX.

## Step 0: Read Context

1. Read `harness-workspace/live-lesson-ai-tutor-e2e/SPEC.md` — full specification
2. Read `harness-workspace/live-lesson-ai-tutor-e2e/progress.md` — iteration history
3. Read the latest eval report in `harness-workspace/live-lesson-ai-tutor-e2e/eval-reports/` (if exists)
4. Read these design documents:
   - `solutions/business/live-lesson/docs/ai-tutor-categorization.md`
   - `solutions/business/live-lesson/docs/ai-tutor-prompt-design.md`
   - `solutions/business/live-lesson/docs/ai-tutor-teacher-visibility.md`

## Step 1: Read Current Code

Read ALL artifact files:

```
solutions/business/live-lesson/backend/src/classroom/classroom.service.ts
solutions/business/live-lesson/backend/src/classroom/classroom.controller.ts
solutions/business/live-lesson/frontend/src/hooks/useClassroom.ts
solutions/business/live-lesson/frontend/src/components/student/AiPanel.tsx
solutions/business/live-lesson/frontend/src/components/teacher/TeacherShell.tsx
solutions/business/live-lesson/frontend/src/styles/teacher.css
solutions/business/live-lesson/frontend/src/styles/student.css
solutions/business/live-lesson/data/lessons/ideal-beauty-reading/manifest.json
```

Also read (READ ONLY — understand types/props):
```
solutions/business/live-lesson/frontend/src/pages/TeacherPage.tsx
solutions/business/live-lesson/frontend/src/pages/StudentPage.tsx
solutions/business/live-lesson/backend/src/classroom/dto/ai-ask.dto.ts
```

## Step 2: Implementation (6 Phases)

### Phase 1: Data Layer

**manifest.json** — Add `aiReferenceQA` field with ≥5 entries:
```json
"aiReferenceQA": [
  { "q": "什么是 skimming？", "a": "Skimming 是快速阅读策略，指通过浏览标题、首句和关键词来获取文章大意。", "category": "概念理解" },
  { "q": "signal words 有什么用？", "a": "信号词帮你判断段落功能和结构，比如 however 表转折，for example 表举例。", "category": "阅读策略" },
  { "q": "Nigeria 的审美观是什么？", "a": "根据课文，在尼日利亚，肥胖被视为财富和地位的象征。", "category": "课文内容" },
  { "q": "第3题的结构怎么分？", "a": "想想看：¶5-7 讲不同国家的例子，试着找出每段的主题。", "category": "解题求助" },
  { "q": "evaluating 策略怎么用？", "a": "Evaluating 是批判性思考策略，读完后问自己：我同意作者观点吗？证据充分吗？", "category": "阅读策略" }
]
```

**QuestionRecord** — Add `category` field to the interface in classroom.service.ts.

**categoriesMap** — Add `private categoriesMap = new Map<string, Set<string>>()` to service class.

### Phase 2: Backend Logic

**Rewrite `buildAiSystemPrompt()`** — 6-layer structured prompt:
1. Role: 教学助教 + 苏格拉底引导
2. Article: `manifest.article.paragraphs[].text` full text
3. Step: `step.label + strategy + description`
4. Answer key (when `stepDef?.answerKey` exists): know but don't reveal
5. ReferenceQA: `manifest.aiReferenceQA` as few-shot examples
6. Classification: output format with `【分类名】` prefix

**Add `parseCategoryFromResponse()`**:
```typescript
private parseCategoryFromResponse(response: string): { category: string; answer: string } {
  const match = response.match(/^【(.+?)】/);
  if (match) return { category: match[1], answer: response.slice(match[0].length).trim() };
  return { category: '其他', answer: response };
}
```

**Update `aiAsk()`**:
- Call `parseCategoryFromResponse(answer)` on the raw GLM response
- Store `category` in QuestionRecord
- Add category to `categoriesMap` for the session
- Return `{ answer: parsed.answer, category: parsed.category }`

**Update `getState()`**: Questions already output answer — ensure category is also included.

### Phase 3: API Layer

**classroom.controller.ts**: The `aiAsk` endpoint currently returns `{ answer }`. Update to return `{ answer, category }`.

### Phase 4: Frontend Types

**useClassroom.ts**: Update `ClassroomState` interface:
```typescript
questions: Array<{
  studentId: string; studentName: string; step: number; question: string;
  answer?: string; category?: string; timestamp: string
}>
```

**useAiAsk**: Update to return `{ answer, category }` from the response.

### Phase 5: Student UX

**AiPanel.tsx**:
- Show category label above AI response: `<span className="ai-category">[{category}]</span>`
- Replace hardcoded quick chips with step-context-aware suggestions

### Phase 6: Teacher UX

**TeacherShell.tsx** question queue:
- Group questions by category instead of by step
- Each category section has a header with colored badge
- Each question row shows student name, question text, timestamp
- AI answer is visible/expandable below each question
- Use category badge colors from design doc

**teacher.css**: Add category badge styles:
```css
.cat-badge { display:inline-block; padding:1px 6px; border-radius:4px; font-size:11px; font-weight:500 }
.cat-concept { background:var(--blue-bg); color:var(--blue) }
.cat-strategy { background:var(--green-bg); color:var(--green) }
.cat-content { background:var(--purple-bg); color:var(--purple) }
.cat-task-help { background:var(--amber-bg); color:var(--amber) }
.cat-other { background:var(--surface2); color:var(--t3) }
```

## Step 3: Validation

After completing changes, run:
```bash
cd solutions/business/live-lesson/backend && npx nest build
cd solutions/business/live-lesson/frontend && npx tsc --noEmit
cd solutions/business/live-lesson/frontend && npx vite build
```

ALL three MUST pass. If they fail, fix the errors before writing the changelog.

## Frozen Directories — DO NOT MODIFY

```
packages/
solutions/business/edu-platform/
solutions/business/recipe-book/
solutions/business/live-lesson/mcp-server/
solutions/business/live-lesson/backend/src/entities/
solutions/business/live-lesson/backend/src/lesson/
solutions/business/live-lesson/backend/src/classroom/dto/
solutions/business/live-lesson/backend/src/classroom/classroom.module.ts
solutions/business/live-lesson/backend/src/main.ts
solutions/business/live-lesson/frontend/src/pages/
solutions/business/live-lesson/frontend/src/components/orchestrator/
solutions/business/live-lesson/frontend/src/types/
```

You CAN ONLY modify:
- `backend/src/classroom/classroom.service.ts`
- `backend/src/classroom/classroom.controller.ts`
- `frontend/src/hooks/useClassroom.ts`
- `frontend/src/components/student/AiPanel.tsx`
- `frontend/src/components/teacher/TeacherShell.tsx`
- `frontend/src/styles/teacher.css`
- `frontend/src/styles/student.css`
- `data/lessons/ideal-beauty-reading/manifest.json`

## DTO Constraint

`AiAskDto` is frozen with `step: 1-5`. The prompt builder uses `readingSteps.find(s => s.idx === step)`. Step mapping: `{ 1→task1, 3→task2, 5→task3, 7→task4, 9→task5 }`. Non-task steps (2,4,6,8,10) have no `answerKey` — handle gracefully.

## Manifest Re-seed

If you modify `manifest.json`, the harness will re-seed the DB before starting the backend. You don't need to worry about DB seeding — just edit the file.

## Changelog

After completing all changes, write a changelog to the path specified in the injected iteration context. Format:

```markdown
# Changelog v{N}

## Changes
- Added aiReferenceQA to manifest (5 entries)
- Rewrote buildAiSystemPrompt with 6-layer structure
- ...

## Files Modified
- `backend/src/classroom/classroom.service.ts`
- `frontend/src/hooks/useClassroom.ts`
- ...

## Known Issues
- ...
```
