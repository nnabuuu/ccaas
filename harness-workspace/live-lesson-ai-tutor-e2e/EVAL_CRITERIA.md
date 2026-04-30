# Evaluation Criteria — live-lesson-ai-tutor-e2e

**Total: 100 points** across 5 dimensions (20 each).

---

## Scoring Anchors

| Score | Meaning |
|-------|---------|
| 5/5 (20/20) | All checks pass, feature complete and working |
| 3/5 (12/20) | Core structure present but some checks fail |
| 1/5 (4/20) | Dimension attempted but mostly broken |

---

## D1: AI Response Quality (20/100)

| # | Check | Pts | Detection |
|---|-------|-----|-----------|
| 1 | Concept Q gets substantive answer (contains skimming/signal words/策略 keywords) | 4 | curl ask "什么是skimming？" → response >30 chars with concept keywords |
| 2 | Task Q only gives hints, not answers | 4 | curl ask "第1题答案是什么？" → response does NOT contain correct option letter/text |
| 3 | Answer references article content | 4 | curl ask article Q → response mentions specific article content |
| 4 | Chinese, 2-3 sentences, 30-200 chars | 4 | Response length 30-200 chars, Chinese text |
| 5 | API failure fallback works | 4 | Code check: catch block returns fallback string |

**Detection flow**: Create session → join → ask 3 types of questions → verify responses.

---

## D2: Prompt Engineering (20/100)

| # | Check | Pts | Detection |
|---|-------|-----|-----------|
| 1 | Prompt contains article paragraph text | 4 | grep `paragraphs` or `article` in `buildAiSystemPrompt` method |
| 2 | Prompt contains answer key awareness | 4 | grep `answerKey` in prompt builder |
| 3 | Prompt contains aiReferenceQA | 4 | grep `aiReferenceQA` in prompt builder |
| 4 | Manifest has ≥5 referenceQA entries | 4 | `jq '.aiReferenceQA | length >= 5'` on manifest.json |
| 5 | Prompt contains step strategy/description | 4 | grep `strategy` or `description` in prompt builder |

**Detection flow**: Static code analysis + manifest JSON check.

---

## D3: Dynamic Categorization (20/100)

| # | Check | Pts | Detection |
|---|-------|-----|-----------|
| 1 | QuestionRecord has category field | 4 | grep interface/type definition in classroom.service.ts |
| 2 | API returns `{ answer, category }` | 4 | curl ai/ask → JSON response has both `answer` and `category` keys |
| 3 | 4 predefined categories exist in code | 4 | grep 4 category strings: 概念理解, 阅读策略, 课文内容, 解题求助 |
| 4 | Regex parses `【...】` prefix | 4 | grep regex pattern `/^【(.+?)】/` in service |
| 5 | getState output contains category | 4 | curl GET state → questions[].category exists |

**Detection flow**: Code grep + curl API verification.

---

## D4: Teacher Visibility (20/100)

| # | Check | Pts | Detection |
|---|-------|-----|-----------|
| 1 | Question queue grouped by category | 4 | Playwright: category section headers visible |
| 2 | AI answer text visible/expandable | 4 | Playwright: answer text present in question area |
| 3 | Category badges with colored styles | 4 | Playwright: badge elements visible with category text |
| 4 | ClassroomState type has answer + category | 4 | grep useClassroom.ts for answer/category in questions type |
| 5 | Full Q&A pair viewable | 4 | Playwright: question + answer both visible |

**Detection flow**: Create test data → navigate teacher page → Playwright snapshot verification.

---

## D5: Build + UX (20/100)

| # | Check | Pts | Detection |
|---|-------|-----|-----------|
| 1 | `npx nest build` passes | 4 | cd backend && npx nest build exits 0 |
| 2 | `tsc --noEmit` + `vite build` passes | 4 | cd frontend && npx tsc --noEmit && npx vite build exits 0 |
| 3 | AiPanel shows category label | 4 | Playwright: student page snapshot has category label text |
| 4 | Quick chips not hardcoded generic text | 4 | grep AiPanel.tsx — chips differ from original 3 generic sentences |
| 5 | No frozen files modified | 4 | git diff --name-only shows no frozen file changes |

**Detection flow**: Build commands + Playwright student page + git diff check.

---

## Penalties

| ID | Trigger | Impact |
|----|---------|--------|
| P1 | Any file in `packages/` modified | Total = 0 |
| P2 | Any file in `backend/src/entities/` modified | Total = 0 |
| P3 | Any file in `backend/src/classroom/dto/` modified | D3 = 0 |
| P4 | Any file in `frontend/src/pages/` modified | D4 = 0 |
| P5 | Any file in `backend/src/lesson/` modified | D2 = 0 |

---

## What's Working Well

List dimensions or checks that scored full marks. Tell the generator:
> "These dimensions are solid — do NOT touch them unless absolutely necessary."

---

## Score Format

```
## Score Summary

| Dimension | Score |
|-----------|-------|
| D1: AI Response Quality | X/20 |
| D2: Prompt Engineering | X/20 |
| D3: Dynamic Categorization | X/20 |
| D4: Teacher Visibility | X/20 |
| D5: Build + UX | X/20 |
| **Penalties** | -X |
| **Total** | **X/100** |

总分: X/100
```

The last line `总分: X/100` is machine-parsed by the harness script. It MUST appear exactly in this format.
