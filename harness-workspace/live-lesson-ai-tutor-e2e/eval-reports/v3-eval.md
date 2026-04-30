# Evaluation Report — v3

## Pre-flight
- Core backend (:3001): OK
- Lesson backend (:3007): OK
- Frontend (:5283): OK

## Test Data
- Session code: T4DRX9
- Students: a0aa60dc (陈昕妍), 9bfb3dff (王译文), 5a27944b (张皓月)
- AI questions asked: 4
- Responses received: 4 (Q4 step=5 returned 400; retried with step=3 — succeeded)

## Penalties
| ID | Check | Result |
|----|-------|--------|
| P1 | packages/ modified | PASS |
| P2 | entities/ modified | PASS |
| P3 | dto/ modified | PASS |
| P4 | pages/ modified | PASS |
| P5 | lesson/ modified | PASS |

## D1: AI Response Quality (20/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | Concept Q substantive | PASS: "Skimming 是一种快速阅读策略，指通过浏览标题、首句和关键词来获取文章大意…" — contains 快速/浏览/首句/大意, >30 chars | 4/4 |
| 2 | Task Q withholds answer | PASS: "让我们来分析一下这个问题…你能从课文中找到相关的句子来支持这个观点吗？" — guiding language, no direct answer | 4/4 |
| 3 | Article content reference | PASS: "课文提到了尼日利亚、埃及、欧洲、伯恩、新西兰、缅甸和印度尼西亚。" — specific countries from article | 4/4 |
| 4 | Length + language OK | PASS: All 4 responses are 30–200 chars Chinese | 4/4 |
| 5 | Fallback code exists | PASS: classroom.service.ts:366-368 catch block sets `rawAnswer = '【其他】AI 助教暂时无法回答，请稍后再试。'` | 4/4 |

## D2: Prompt Engineering (20/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | Article text in prompt | PASS: Line 417 reads `paragraphs` from `manifest.article.paragraphs`; lines 427-431 inject full article text | 4/4 |
| 2 | Answer key awareness | PASS: Lines 440-441 check `stepDef?.answerKey` and inject with "严禁直接告诉学生" guard | 4/4 |
| 3 | ReferenceQA in prompt | PASS: Line 418 reads `manifest.aiReferenceQA`; lines 445-448 inject as few-shot examples | 4/4 |
| 4 | Manifest has ≥5 QA | PASS: count=5 (概念理解, 阅读策略×2, 课文内容, 解题求助) | 4/4 |
| 5 | Step strategy in prompt | PASS: Line 436 injects `策略：${stepDef.strategy}` and `描述：${stepDef.description}` | 4/4 |

## D3: Dynamic Categorization (20/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | QuestionRecord.category | PASS: Line 26 `category?: string` in QuestionRecord interface | 4/4 |
| 2 | API returns {answer,category} | PASS: `{"answer":"Skimming 是…","category":"概念理解"}` — both keys present | 4/4 |
| 3 | 4 predefined categories | PASS: Line 375 `new Set(['概念理解', '阅读策略', '课文内容', '解题求助'])` | 4/4 |
| 4 | Regex parse 【...】 | PASS: Line 400 `response.match(/^【(.+?)】/)` | 4/4 |
| 5 | State output has category | PASS: GET state shows cat=概念理解, cat=解题求助, cat=课文内容, cat=阅读策略 — all non-null | 4/4 |

## D4: Teacher Visibility (4/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | Category grouping | FAIL: Teacher page renders "Error:" — `useReadingLesson()` does not return `lessonId`, so `!lessonId` is true and error branch executes. Code in TeacherShell.tsx:338-364 has correct `queueByCategory` grouping but page never mounts. | 0/4 |
| 2 | AI answer visible | FAIL: Same root cause — page doesn't render. Code at TeacherShell.tsx:354-359 correctly shows answer in expandable `q-answer` div. | 0/4 |
| 3 | Category badges | FAIL: Same root cause. Code at TeacherShell.tsx:341 renders `<span className="cat-badge ...">` with getCatBadgeClass(). | 0/4 |
| 4 | ClassroomState type | PASS: useClassroom.ts:169 — `questions: Array<{...answer?: string; category?: string; ...}>` | 4/4 |
| 5 | Q&A pair viewable | FAIL: Same root cause. Code shows question text (line 351) + answer text (line 355-358). | 0/4 |

**Root cause**: `useReadingLesson()` returns `{ manifest, loading, error, embed }` but `TeacherPage.tsx` destructures `lessonId` and `sessionParam` from it. Both are `undefined`. The guard `!lessonId` fires, showing the error div. Secondary issue: even if fixed, TeacherPage doesn't call `useTeacherStream` or pass `classroomState` to TeacherShell, so the component would show empty state instead of live data.

## D5: Build + UX (16/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | nest build | PASS: exit 0 | 4/4 |
| 2 | tsc + vite build | PASS: both exit 0 | 4/4 |
| 3 | AiPanel category label | FAIL: Student page at `/student/ideal-beauty-reading` redirects to non-existent `/join` route — empty render. Cannot verify via Playwright. Code at AiPanel.tsx:104-105 correctly renders `<span className="ai-category ...">` with category. | 0/4 |
| 4 | Smart chips | PASS: AiPanel.tsx:18-24 — STEP_CHIPS has 5 step-specific chip arrays (e.g. step 1: "标题 Ideal Beauty 是什么意思？", step 2: "什么是 skimming？"). Not hardcoded generic text. | 4/4 |
| 5 | No frozen files | PASS: git diff shows zero changes to packages/, entities/, dto/, pages/, lesson/ | 4/4 |

## Score Summary

| Dimension | Score |
|-----------|-------|
| D1: AI Response Quality | 20/20 |
| D2: Prompt Engineering | 20/20 |
| D3: Dynamic Categorization | 20/20 |
| D4: Teacher Visibility | 4/20 |
| D5: Build + UX | 16/20 |
| **Penalties** | -0 |
| **Total** | **80/100** |

总分: 80/100

## What's Working Well
- D1-D3 are solid and scored full marks — do NOT touch them
- Backend AI integration is excellent: prompt layering (role → article → step → answer key → reference QA → classification), category regex parsing, fallback handling
- Manifest has exactly 5 reference QAs covering all 4 categories
- State API correctly returns questions with answer + category
- Builds are clean (nest + tsc + vite all pass)
- Smart chips are step-aware, not generic
- No frozen files touched

## Priority Fixes
1. [FRONTEND] useReadingLesson.ts — Hook must also return `lessonId` (from `useParams`) and `sessionParam` (from `searchParams.get('session')`). Without this, TeacherPage always shows "Error:" because `!lessonId` is true.
2. [FRONTEND] TeacherPage.tsx — After fixing #1, must also call `useTeacherStream(sessionCode)` and pass resulting `state` as `classroomState` prop to `<TeacherShell>`. Currently classroomState is never passed, so teacher would show empty state even if page rendered.
3. [FRONTEND] StudentPage.tsx — Redirects to `/join` which has no matching route in App.tsx. Either add a `/join` route or fix the student entry point so Playwright can verify AiPanel category labels.
4. [BACKEND] classroom.controller.ts — Step validation rejects step=5 (`@Max(4)`), but the manifest has 5 tasks (steps 1,3,5,7,9). The AI ask endpoint should accept step values matching readingSteps idx range, not hardcoded max.

Classification:
- [FRONTEND]: useReadingLesson.ts — return lessonId + sessionParam
- [FRONTEND]: TeacherPage.tsx — wire useTeacherStream → classroomState
- [FRONTEND]: StudentPage.tsx / App.tsx — fix /join route
- [BACKEND]: classroom.controller.ts — fix step @Max validation
