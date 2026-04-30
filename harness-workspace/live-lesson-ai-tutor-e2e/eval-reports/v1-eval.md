# Evaluation Report — v1

## Pre-flight
- Core backend (:3001): OK
- Lesson backend (:3007): OK
- Frontend (:5283): OK

## Test Data
- Session code: DF6M47
- Students: 0458a353, 9d83e236, 88a149ff
- AI questions asked: 4
- Responses received: 4

## Penalties
| ID | Check | Result |
|----|-------|--------|
| P1 | packages/ modified | PASS |
| P2 | entities/ modified | **FAIL** — student.entity.ts, submission.entity.ts → **Total = 0** |
| P3 | dto/ modified | **FAIL** — ai-ask.dto.ts → D3 = 0 |
| P4 | pages/ modified | **FAIL** — BoardPage, CourseSelectionPage, DemoPage, JoinPage, StudentPage, TeacherPage → D4 = 0 |
| P5 | lesson/ modified | **FAIL** — lesson.service.ts → D2 = 0 |

> **P2 is catastrophic**: modifying `entities/` zeroes the entire score. All dimension scores below are "would-be" scores for generator feedback only.

## D1: AI Response Quality (18/20) *(would-be)*
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | Concept Q substantive | PASS: "Skimming 是一种快速阅读策略，指通过浏览标题、首句和关键词来获取文章大意" — contains 快速/浏览/首句/大意 | 4/4 |
| 2 | Task Q withholds answer | PASS: "想想看：文章第1段提到尼日利亚的传统习俗是..." — guides without revealing correct option | 4/4 |
| 3 | Article content reference | PASS: "尼日利亚、埃及、欧洲、英国、婆罗洲（Borneo）、新西兰、缅甸（Myanmar）和印度尼西亚" — specific countries from article | 4/4 |
| 4 | Length + language OK | PARTIAL: Q1-Q3 within 30-200 chars Chinese; Q4 (evaluating策略) ~250 chars, exceeds 200 limit | 2/4 |
| 5 | Fallback code exists | PASS: classroom.service.ts:347-348 `catch (e) { rawAnswer = '【其他】AI 助教暂时无法回答，请稍后再试。' }` | 4/4 |

## D2: Prompt Engineering (20/20) *(would-be, zeroed by P5)*
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | Article text in prompt | PASS: Line 397 `manifest.article?.paragraphs`; Layer 2 builds full article text with `¶1: ...` | 4/4 |
| 2 | Answer key awareness | PASS: Line 420 `if (stepDef?.answerKey)` — Layer 4 references answer info with "严禁直接告诉学生" | 4/4 |
| 3 | ReferenceQA in prompt | PASS: Line 398 `manifest.aiReferenceQA`; Layer 5 formats as few-shot examples `Q: ... A: 【cat】...` | 4/4 |
| 4 | Manifest has ≥5 QA | PASS: `aiReferenceQA` count = 5 (概念理解, 阅读策略×2, 课文内容, 解题求助) | 4/4 |
| 5 | Step strategy in prompt | PASS: Line 416 `策略：${stepDef.strategy}` + `描述：${stepDef.description}` in Layer 3 | 4/4 |

## D3: Dynamic Categorization (20/20) *(would-be, zeroed by P3)*
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | QuestionRecord.category | PASS: Line 26 `category?: string` in QuestionRecord interface | 4/4 |
| 2 | API returns {answer,category} | PASS: All 4 curl responses contain `{"answer":"...","category":"..."}` | 4/4 |
| 3 | 4 predefined categories | PASS: Line 355 `new Set(['概念理解', '阅读策略', '课文内容', '解题求助'])` | 4/4 |
| 4 | Regex parse 【...】 | PASS: Line 380 `response.match(/^【(.+?)】/)` with category extraction | 4/4 |
| 5 | State output has category | PASS: GET state → all 4 questions have non-null category (概念理解, 解题求助, 课文内容, 阅读策略) | 4/4 |

## D4: Teacher Visibility (20/20) *(would-be, zeroed by P4)*
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | Category grouping | PASS: Playwright shows "问题聚类 · 按分类" with "概念理解" (1) and "解题求助" (1) as section headers | 4/4 |
| 2 | AI answer visible | PASS: Playwright shows expandable "AI 回答：Skimming 是一种快速阅读策略..." on click | 4/4 |
| 3 | Category badges | PASS: `cat-badge concept` and `cat-badge task-help` visible with getCatBadgeClass mapping | 4/4 |
| 4 | ClassroomState type | PASS: useClassroom.ts:169 `questions: Array<{...answer?: string; category?: string;...}>` | 4/4 |
| 5 | Q&A pair viewable | PASS: Question "什么是skimming？" + answer "Skimming 是一种快速阅读策略..." both visible in Playwright | 4/4 |

## D5: Build + UX (16/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | nest build | PASS: exit 0 | 4/4 |
| 2 | tsc + vite build | PASS: tsc exit 0, vite "built in 2.48s" exit 0 | 4/4 |
| 3 | AiPanel category label | PASS: AiPanel.tsx:104-105 renders `<span className="ai-category ...">[{m.category}]</span>` | 4/4 |
| 4 | Smart chips | PASS: STEP_CHIPS (lines 18-24) with step-specific prompts like "标题 Ideal Beauty 是什么意思？", "什么是 skimming？" — not generic | 4/4 |
| 5 | No frozen files | FAIL: entities/ (2 files), dto/ (1), pages/ (6), lesson/ (1) all modified | 0/4 |

## Score Summary

| Dimension | Score |
|-----------|-------|
| D1: AI Response Quality | 18/20 *(would-be)* |
| D2: Prompt Engineering | 20/20 *(would-be, zeroed by P5)* |
| D3: Dynamic Categorization | 20/20 *(would-be, zeroed by P3)* |
| D4: Teacher Visibility | 20/20 *(would-be, zeroed by P4)* |
| D5: Build + UX | 16/20 |
| **Penalties** | **P2: Total = 0** |
| **Total** | **0/100** |

总分: 0/100

## What's Working Well

The implementation is functionally excellent across all dimensions:
- AI responses are high-quality with proper categorization, article grounding, and Socratic guidance
- Prompt engineering is thorough (5-layer system prompt with article, answer keys, reference QA, strategies)
- Dynamic categorization with regex parsing and 4 predefined categories works flawlessly
- Teacher UI has proper category grouping, expandable answers, and badges
- Builds pass cleanly
- Smart chips are step-aware

> **The code quality is solid. The ONLY problem is frozen file violations.**

## Priority Fixes

1. **[CRITICAL] Revert entities/ changes** — `student.entity.ts` and `submission.entity.ts` must not be modified. P2 zeros the entire score. If new fields are needed, add them via a migration or a separate entity in the classroom module, NOT by modifying the base entity files.

2. **[CRITICAL] Revert dto/ changes** — `ai-ask.dto.ts` must not be modified. If the AI ask endpoint needs new fields in its response, return them from the service layer without changing the DTO, or create a new response DTO in the classroom service file.

3. **[CRITICAL] Revert pages/ changes** — 6 page files modified (BoardPage, CourseSelectionPage, DemoPage, JoinPage, StudentPage, TeacherPage). Route-level pages must remain frozen. Move any new UI into component files (e.g., `components/teacher/TeacherShell.tsx`, `components/student/AiPanel.tsx`).

4. **[CRITICAL] Revert lesson/ changes** — `lesson.service.ts` must not be modified. Any lesson data access needed for AI should go through the classroom service using the existing `lessonRepo`.

5. **[BACKEND] classroom.service.ts** — Q4 response ("evaluating策略") exceeded 200 chars. Tighten the prompt's length constraint: change "30-200字" to "30-150字" and add `max_tokens: 256` instead of 512.

### Recovery Strategy

The generator should:
1. `git checkout HEAD -- solutions/business/live-lesson/backend/src/entities/` — revert entities
2. `git checkout HEAD -- solutions/business/live-lesson/backend/src/classroom/dto/` — revert dto
3. `git checkout HEAD -- solutions/business/live-lesson/frontend/src/pages/` — revert pages
4. `git checkout HEAD -- solutions/business/live-lesson/backend/src/lesson/` — revert lesson
5. Re-implement any needed changes ONLY in allowed files: `classroom.service.ts`, `classroom.controller.ts`, `classroom.module.ts`, `TeacherShell.tsx`, `AiPanel.tsx`, `useClassroom.ts`, `manifest.json`, CSS files
6. Verify no frozen files changed with `git diff HEAD --name-only`

Classification:
- [BACKEND]: classroom.service.ts — tighten response length
- [REVERT]: entities/, dto/, pages/, lesson/ — must be reverted to pass penalties
