# Evaluation Report — v2

## Pre-flight
- Core backend (:3001): OK
- Lesson backend (:3007): **FAIL** — NestJS DI error: `ClassroomModule` does not import `Lesson` entity but `ClassroomService` injects `LessonRepository`. Backend crashes at startup.
- Frontend (:5283): OK

**Root cause**: `classroom.module.ts` line 10 imports `[Student, Submission, ClassroomSession]` but `classroom.service.ts` line 51 injects `@InjectRepository(Lesson)`. The `Lesson` entity was never added to `TypeOrmModule.forFeature()` in the module.

## Test Data
- Session code: N/A (backend down)
- Students: N/A
- AI questions asked: 0
- Responses received: 0

Test data could not be created because the lesson backend fails to start.

## Penalties
| ID | Check | Result |
|----|-------|--------|
| P1 | packages/ modified | PASS |
| P2 | entities/ modified | PASS |
| P3 | dto/ modified | PASS |
| P4 | pages/ modified | PASS |
| P5 | lesson/ modified | PASS |

## D1: AI Response Quality (4/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | Concept Q substantive | FAIL: Backend down, can't curl ai/ask | 0/4 |
| 2 | Task Q withholds answer | FAIL: Backend down, can't curl ai/ask | 0/4 |
| 3 | Article content reference | FAIL: Backend down, can't curl ai/ask | 0/4 |
| 4 | Length + language OK | FAIL: Backend down, can't curl ai/ask | 0/4 |
| 5 | Fallback code exists | PASS: `classroom.service.ts:366` — catch block returns `'【其他】AI 助教暂时无法回答，请稍后再试。'` | 4/4 |

## D2: Prompt Engineering (20/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | Article text in prompt | PASS: `classroom.service.ts:415` — `manifest.article?.paragraphs` extracted and joined into `articleText` at line 427 | 4/4 |
| 2 | Answer key awareness | PASS: `classroom.service.ts:438` — `stepDef?.answerKey` checked, prompt includes "严禁直接告诉学生" guard | 4/4 |
| 3 | ReferenceQA in prompt | PASS: `classroom.service.ts:416` — `manifest.aiReferenceQA` loaded, few-shot examples built at lines 443-445 | 4/4 |
| 4 | Manifest has ≥5 QA | PASS: `aiReferenceQA` count = 5 (概念理解, 阅读策略, 课文内容, 解题求助, 阅读策略) | 4/4 |
| 5 | Step strategy in prompt | PASS: `classroom.service.ts:434` — Layer 3 includes `stepDef.strategy` and `stepDef.description` | 4/4 |

## D3: Dynamic Categorization (12/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | QuestionRecord.category | PASS: `classroom.service.ts:26` — `category?: string` in interface | 4/4 |
| 2 | API returns {answer,category} | FAIL: Backend down. Code at line 394 does `return { answer: parsed.answer, category: parsed.category }` but cannot verify at runtime | 0/4 |
| 3 | 4 predefined categories | PASS: `classroom.service.ts:373` — `new Set(['概念理解', '阅读策略', '课文内容', '解题求助'])` | 4/4 |
| 4 | Regex parse 【...】 | PASS: `classroom.service.ts:398` — `response.match(/^【(.+?)】/)` | 4/4 |
| 5 | State output has category | FAIL: Backend down, cannot curl GET state to verify questions[].category | 0/4 |

## D4: Teacher Visibility (4/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | Category grouping | FAIL: Backend down → teacher page shows "Error:" — code in TeacherShell.tsx:143 has `queueByCategory` grouping logic but cannot verify via Playwright | 0/4 |
| 2 | AI answer visible | FAIL: Backend down → no data on teacher page. Code at TeacherShell.tsx:354-358 shows expandable answer but cannot verify | 0/4 |
| 3 | Category badges | FAIL: Backend down → no data. Code at TeacherShell.tsx:341 has `<span className="cat-badge ...">` but cannot verify | 0/4 |
| 4 | ClassroomState type | PASS: `useClassroom.ts:169` — `questions: Array<{ ... answer?: string; category?: string; ... }>` | 4/4 |
| 5 | Q&A pair viewable | FAIL: Backend down → no data on teacher page | 0/4 |

## D5: Build + UX (12/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | nest build | PASS: `npx nest build` exits 0 (compile-time OK, runtime DI fails) | 4/4 |
| 2 | tsc + vite build | PASS: `tsc --noEmit` + `vite build` both exit 0 | 4/4 |
| 3 | AiPanel category label | FAIL: Backend down → student page cannot render with data. Code at AiPanel.tsx:104-106 has `<span className="ai-category ...">[{m.category}]</span>` but cannot verify via Playwright | 0/4 |
| 4 | Smart chips | PASS: AiPanel.tsx:18-24 — per-step `STEP_CHIPS` with context-aware questions (e.g., "标题 Ideal Beauty 是什么意思？", "什么是 skimming？") instead of generic text | 4/4 |
| 5 | No frozen files | PASS: git diff shows no changes in packages/, entities/, dto/, pages/, lesson/ | 4/4 |

## Score Summary

| Dimension | Score |
|-----------|-------|
| D1: AI Response Quality | 4/20 |
| D2: Prompt Engineering | 20/20 |
| D3: Dynamic Categorization | 12/20 |
| D4: Teacher Visibility | 4/20 |
| D5: Build + UX | 12/20 |
| **Penalties** | -0 |
| **Total** | **52/100** |

总分: 52/100

## What's Working Well
- **D2 is perfect (20/20)** — prompt engineering is solid: article text, answer key awareness, referenceQA few-shot examples, step strategy, classification instructions all present. These are solid — do NOT touch them.
- **D3 categorization code is correct** — QuestionRecord interface, 4 predefined categories, regex parsing all implemented correctly.
- **D5 builds pass** — both TypeScript and Vite builds succeed. Smart chips are step-specific and well-crafted.
- **No frozen files touched** — penalty checks all pass.

## Priority Fixes
1. **[BACKEND] classroom.module.ts:10 — CRITICAL: Add `Lesson` entity to module imports** → Change `TypeOrmModule.forFeature([Student, Submission, ClassroomSession])` to `TypeOrmModule.forFeature([Student, Submission, ClassroomSession, Lesson])`. This single fix will likely restore 30-40 points because it unblocks the entire backend, enabling D1 runtime checks, D3 curl checks, D4 teacher page rendering, and D5 AiPanel rendering.
2. **[BACKEND] classroom.module.ts:3 — Add missing import** → Add `import { Lesson } from '../entities/lesson.entity';` to the module file.
3. **[FRONTEND] Verify after backend fix** — Once the backend starts, re-run the full eval to capture actual AI response quality (D1), API return shape (D3.2/D3.5), and Playwright checks (D4, D5.3).

Classification:
- [BACKEND]: classroom.module.ts — missing Lesson entity import (root cause of 48-point loss)
