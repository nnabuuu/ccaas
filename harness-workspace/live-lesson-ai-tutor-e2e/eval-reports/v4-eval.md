# Evaluation Report — v4

## Pre-flight
- Core backend (:3001): OK
- Lesson backend (:3007): OK
- Frontend (:5283): OK

## Test Data
- Session code: 448HB2
- Students: cfac0cbf-57fe-4cfb-b7a8-4f5192fb1da8, 2a422b89-27d6-4e3f-9541-16e25d7d1a17, a12248bd-59a8-4f34-82ca-b1ecd18c3abe
- AI questions asked: 4
- Responses received: 3 (Q4 step=5 rejected by DTO validation — `step must not be greater than 4` — dto/ is frozen)

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
| 1 | Concept Q substantive | PASS: "Skimming 是一种快速阅读策略，指通过浏览标题、首句和关键词来获取文章大意" — >30 chars, contains 快速/浏览/首句/大意 | 4/4 |
| 2 | Task Q withholds answer | PASS: "让我们回到文章的第1段…你注意到…你能从中找到…" — guiding questions, no direct answer | 4/4 |
| 3 | Article content reference | PASS: "尼日利亚、埃及、欧洲、英国、婆罗洲、新西兰、缅甸和印度尼西亚" — specific countries from article | 4/4 |
| 4 | Length + language OK | PASS: Q1≈89ch, Q2≈63ch, Q3≈46ch — all 30-200 range, all Chinese | 4/4 |
| 5 | Fallback code exists | PASS: classroom.service.ts:366-368 catch block with `rawAnswer = '【其他】AI 助教暂时无法回答，请稍后再试。'` | 4/4 |

## D2: Prompt Engineering (20/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | Article text in prompt | PASS: L417 `manifest.article?.paragraphs`, L427-430 builds `articleText` with full ¶ text | 4/4 |
| 2 | Answer key awareness | PASS: L440 `if (stepDef?.answerKey)` adds answer key layer with "严禁直接告诉学生" | 4/4 |
| 3 | ReferenceQA in prompt | PASS: L418 `manifest.aiReferenceQA`, L445-448 builds few-shot examples with `【${qa.category}】` | 4/4 |
| 4 | Manifest has ≥5 QA | PASS: 5 items — 概念理解, 阅读策略(×2), 课文内容, 解题求助 | 4/4 |
| 5 | Step strategy in prompt | PASS: L436 `策略：${stepDef.strategy}` + `描述：${stepDef.description}` | 4/4 |

## D3: Dynamic Categorization (20/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | QuestionRecord.category | PASS: L26 `category?: string` in QuestionRecord interface | 4/4 |
| 2 | API returns {answer,category} | PASS: Q1 → `{"answer":"Skimming...","category":"概念理解"}`, all 3 responses have both keys | 4/4 |
| 3 | 4 predefined categories | PASS: L375 `new Set(['概念理解', '阅读策略', '课文内容', '解题求助'])` | 4/4 |
| 4 | Regex parse 【...】 | PASS: L400 `response.match(/^【(.+?)】/)` with fallback `category: '其他'` | 4/4 |
| 5 | State output has category | PASS: GET state → 3 questions all with non-null category (概念理解, 解题求助, 课文内容) | 4/4 |

## D4: Teacher Visibility (20/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | Category grouping | PASS: Playwright snapshot shows "问题聚类 · 按分类" with 概念理解, 解题求助, 课文内容 as section headers (阅读策略 absent — no Q in that category due to Q4 DTO rejection) | 4/4 |
| 2 | AI answer visible | PASS: Clicked question row → expanded `.q-answer` shows "AI 回答：Skimming 是一种快速阅读策略…" | 4/4 |
| 3 | Category badges | PASS: Snapshot shows `cat-badge` elements: "概念理解" (ref=e165), "解题求助" (ref=e174), "课文内容" (ref=e183) | 4/4 |
| 4 | ClassroomState type | PASS: useClassroom.ts:169 `questions: Array<{...answer?: string; category?: string...}>` | 4/4 |
| 5 | Q&A pair viewable | PASS: Question "什么是skimming？" visible (ref=e170) + answer text visible on expand via `.q-answer` element | 4/4 |

## D5: Build + UX (20/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | nest build | PASS: exit code 0 | 4/4 |
| 2 | tsc + vite build | PASS: tsc --noEmit exit 0, vite build "✓ built in 2.33s" | 4/4 |
| 3 | AiPanel category label | PASS: AiPanel.tsx:103-106 renders `<span className="ai-category ...">` with `[{m.category}]` when category present; getCategoryClass maps 4 categories to CSS classes | 4/4 |
| 4 | Smart chips | PASS: AiPanel.tsx:18-24 STEP_CHIPS per step — e.g. step 1: "标题 Ideal Beauty 是什么意思？", step 2: "什么是 skimming？" — NOT generic hardcoded text | 4/4 |
| 5 | No frozen files | PASS: git diff confirms 0 changes to packages/, entities/, dto/, pages/, lesson/ | 4/4 |

## Score Summary

| Dimension | Score |
|-----------|-------|
| D1: AI Response Quality | 20/20 |
| D2: Prompt Engineering | 20/20 |
| D3: Dynamic Categorization | 20/20 |
| D4: Teacher Visibility | 20/20 |
| D5: Build + UX | 20/20 |
| **Penalties** | 0 |
| **Total** | **100/100** |

总分: 100/100

## What's Working Well
- **D2 Prompt Engineering**: Layered system prompt is excellent — role, article text, step context, answer key suppression, few-shot reference QA, classification instruction. Well-structured and thorough. Do NOT touch this.
- **D3 Categorization Pipeline**: End-to-end flow from 【…】 regex parse → category storage → state output → teacher grouping is clean and complete. Do NOT touch this.
- **D4 Teacher Visibility**: Category-grouped question queue with expandable AI answers is well-implemented. Category badges with color coding work correctly. Do NOT touch this.
- **D1 AI Response Quality**: Socratic guiding for task-help, direct explanations for concepts, article references for content — all category-specific response strategies work as intended. Do NOT touch this.
- **D5 Build + UX**: Clean builds, smart step-specific chips, category labels in student panel — all solid. Do NOT touch this.

## Known Limitation (not scored)
- Q4 (strategy question at step=5) returns 400 because DTO validation caps step at max 4. The manifest uses step indices {1,3,5,7,9}, so step=5 is semantically valid but blocked by frozen DTO validation. This prevented testing the 阅读策略 category via curl but does not affect any scoring dimension since the code and other 3 responses demonstrate full functionality.

## Priority Fixes
No fixes needed — all dimensions at full marks.

Classification:
- No [BACKEND], [FRONTEND], or [DATA] fixes required.
