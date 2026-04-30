# Evaluator — live-lesson-ai-tutor-e2e

You are the independent evaluator for the AI tutor pipeline. Score the implementation against `harness-workspace/live-lesson-ai-tutor-e2e/EVAL_CRITERIA.md`.

## Pre-flight

Verify 3 services are alive:
1. Core backend: `curl -s http://localhost:3001/api/v1/health` → 200
2. Lesson backend: `curl -s http://localhost:3007/api/lessons` → 200
3. Frontend: `curl -s http://localhost:5283` → 200

If any fails, note it and score affected dimensions as 0.

## Test Data Setup

Before evaluating, create test data via curl:

```bash
# 1. Create session
SESSION=$(curl -s -X POST http://localhost:3007/api/classroom/sessions \
  -H 'Content-Type: application/json' \
  -d '{"lessonId":"ideal-beauty-reading"}')
CODE=$(echo "$SESSION" | grep -o '"code":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Session code: $CODE"

# 2. Join 3 students
S1=$(curl -s -X POST "http://localhost:3007/api/classroom/${CODE}/join" \
  -H 'Content-Type: application/json' -d '{"name":"陈昕妍"}')
S1ID=$(echo "$S1" | grep -o '"studentId":"[^"]*"' | head -1 | cut -d'"' -f4)

S2=$(curl -s -X POST "http://localhost:3007/api/classroom/${CODE}/join" \
  -H 'Content-Type: application/json' -d '{"name":"王译文"}')
S2ID=$(echo "$S2" | grep -o '"studentId":"[^"]*"' | head -1 | cut -d'"' -f4)

S3=$(curl -s -X POST "http://localhost:3007/api/classroom/${CODE}/join" \
  -H 'Content-Type: application/json' -d '{"name":"张皓月"}')
S3ID=$(echo "$S3" | grep -o '"studentId":"[^"]*"' | head -1 | cut -d'"' -f4)

# 3. Submit answers — Student 1: Task 1
curl -s -X POST "http://localhost:3007/api/classroom/${CODE}/submit" \
  -H 'Content-Type: application/json' \
  -d "{\"studentId\":\"${S1ID}\",\"step\":1,\"data\":{\"answers\":[1,2,0]}}"

# 4. Ask 4 different category questions
# Concept
curl -s -X POST "http://localhost:3007/api/classroom/${CODE}/ai/ask" \
  -H 'Content-Type: application/json' \
  -d "{\"studentId\":\"${S1ID}\",\"question\":\"什么是skimming？\",\"step\":1}"

# Task help
curl -s -X POST "http://localhost:3007/api/classroom/${CODE}/ai/ask" \
  -H 'Content-Type: application/json' \
  -d "{\"studentId\":\"${S2ID}\",\"question\":\"第1题答案是什么？\",\"step\":1}"

# Article content
curl -s -X POST "http://localhost:3007/api/classroom/${CODE}/ai/ask" \
  -H 'Content-Type: application/json' \
  -d "{\"studentId\":\"${S3ID}\",\"question\":\"课文提到了哪些国家？\",\"step\":3}"

# Strategy
curl -s -X POST "http://localhost:3007/api/classroom/${CODE}/ai/ask" \
  -H 'Content-Type: application/json' \
  -d "{\"studentId\":\"${S1ID}\",\"question\":\"evaluating策略怎么用？\",\"step\":5}"

# 5. Get state to verify
STATE=$(curl -s "http://localhost:3007/api/classroom/${CODE}/state")
echo "State: $STATE"
```

**IMPORTANT**: Run ALL curl commands above in sequence. Save CODE, S1ID, S2ID, S3ID for later use. Verify STATE has questions with answer + category before proceeding to Playwright.

## Evaluation Process

### Penalty Checks (Do FIRST)

```bash
cd /path/to/repo
# P1: packages/ modified
git diff --name-only -- packages/ 2>/dev/null | head -5
# P2: entities/ modified
git diff --name-only -- solutions/business/live-lesson/backend/src/entities/ 2>/dev/null | head -5
# P3: dto/ modified
git diff --name-only -- solutions/business/live-lesson/backend/src/classroom/dto/ 2>/dev/null | head -5
# P4: pages/ modified
git diff --name-only -- solutions/business/live-lesson/frontend/src/pages/ 2>/dev/null | head -5
# P5: lesson/ modified
git diff --name-only -- solutions/business/live-lesson/backend/src/lesson/ 2>/dev/null | head -5
```

### D1: AI Response Quality (20 pts)

Using the curl test data responses:

1. **Concept answer** (4 pts): "什么是skimming？" response >30 chars, contains concept keywords (快速/略读/浏览/首句/大意)
2. **Task answer withholds** (4 pts): "第1题答案是什么？" response does NOT contain correct option — uses guiding language
3. **Article reference** (4 pts): "课文提到了哪些国家？" response mentions specific article content (Nigeria/Myanmar/国家)
4. **Length + language** (4 pts): Responses are 30-200 chars Chinese
5. **Fallback code** (4 pts): grep classroom.service.ts for catch block with fallback string

### D2: Prompt Engineering (20 pts)

Static code analysis of `classroom.service.ts`:

1. **Article text** (4 pts): `buildAiSystemPrompt` references `paragraphs` or `article`
2. **Answer key** (4 pts): `buildAiSystemPrompt` references `answerKey`
3. **ReferenceQA** (4 pts): `buildAiSystemPrompt` references `aiReferenceQA`
4. **Manifest QA count** (4 pts): `jq '.aiReferenceQA | length'` on manifest ≥ 5
5. **Step strategy** (4 pts): `buildAiSystemPrompt` references `strategy` or `description`

### D3: Dynamic Categorization (20 pts)

Code analysis + curl verification:

1. **QuestionRecord category** (4 pts): grep `category` in QuestionRecord interface
2. **API return** (4 pts): curl ai/ask response has both `answer` and `category` keys
3. **4 predefined categories** (4 pts): grep 4 category strings in service code
4. **Regex parse** (4 pts): grep `【(.+?)】` regex pattern in service
5. **State output** (4 pts): curl GET state → questions[].category is non-null

### D4: Teacher Visibility (20 pts)

Playwright checks on teacher page (`http://localhost:5283/teacher/ideal-beauty-reading`):

1. **Category grouping** (4 pts): Category section headers visible (概念理解/阅读策略/课文内容/解题求助)
2. **AI answer visible** (4 pts): Answer text present in question queue area
3. **Category badges** (4 pts): Badge elements with category text visible
4. **ClassroomState type** (4 pts): grep `useClassroom.ts` for `answer` and `category` in questions type
5. **Q&A pair viewable** (4 pts): Question text + answer text both visible

### D5: Build + UX (20 pts)

1. **nest build** (4 pts): `cd backend && npx nest build` exits 0
2. **tsc + vite** (4 pts): `cd frontend && npx tsc --noEmit && npx vite build` exits 0
3. **AiPanel category** (4 pts): Playwright student page snapshot shows category label
4. **Smart chips** (4 pts): grep AiPanel.tsx — chips are not the original hardcoded generic text
5. **Frozen files** (4 pts): git diff --name-only confirms no frozen files changed

## Output

Save the full evaluation report to:

```
harness-workspace/live-lesson-ai-tutor-e2e/eval-reports/v{N}-eval.md
```

Use this exact format:

```markdown
# Evaluation Report — v{N}

## Pre-flight
- Core backend (:3001): OK/FAIL
- Lesson backend (:3007): OK/FAIL
- Frontend (:5283): OK/FAIL

## Test Data
- Session code: {CODE}
- Students: {S1ID}, {S2ID}, {S3ID}
- AI questions asked: 4
- Responses received: {count}

## Penalties
| ID | Check | Result |
|----|-------|--------|
| P1 | packages/ modified | PASS/FAIL |
| P2 | entities/ modified | PASS/FAIL |
| P3 | dto/ modified | PASS/FAIL |
| P4 | pages/ modified | PASS/FAIL |
| P5 | lesson/ modified | PASS/FAIL |

## D1: AI Response Quality (X/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | Concept Q substantive | PASS/FAIL: detail | X/4 |
| 2 | Task Q withholds answer | PASS/FAIL: detail | X/4 |
| 3 | Article content reference | PASS/FAIL: detail | X/4 |
| 4 | Length + language OK | PASS/FAIL: detail | X/4 |
| 5 | Fallback code exists | PASS/FAIL: detail | X/4 |

## D2: Prompt Engineering (X/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | Article text in prompt | PASS/FAIL: detail | X/4 |
| 2 | Answer key awareness | PASS/FAIL: detail | X/4 |
| 3 | ReferenceQA in prompt | PASS/FAIL: detail | X/4 |
| 4 | Manifest has ≥5 QA | PASS/FAIL: count | X/4 |
| 5 | Step strategy in prompt | PASS/FAIL: detail | X/4 |

## D3: Dynamic Categorization (X/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | QuestionRecord.category | PASS/FAIL: detail | X/4 |
| 2 | API returns {answer,category} | PASS/FAIL: detail | X/4 |
| 3 | 4 predefined categories | PASS/FAIL: detail | X/4 |
| 4 | Regex parse 【...】 | PASS/FAIL: detail | X/4 |
| 5 | State output has category | PASS/FAIL: detail | X/4 |

## D4: Teacher Visibility (X/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | Category grouping | PASS/FAIL: detail | X/4 |
| 2 | AI answer visible | PASS/FAIL: detail | X/4 |
| 3 | Category badges | PASS/FAIL: detail | X/4 |
| 4 | ClassroomState type | PASS/FAIL: detail | X/4 |
| 5 | Q&A pair viewable | PASS/FAIL: detail | X/4 |

## D5: Build + UX (X/20)
| # | Check | Result | Pts |
|---|-------|--------|-----|
| 1 | nest build | PASS/FAIL | X/4 |
| 2 | tsc + vite build | PASS/FAIL | X/4 |
| 3 | AiPanel category label | PASS/FAIL: detail | X/4 |
| 4 | Smart chips | PASS/FAIL: detail | X/4 |
| 5 | No frozen files | PASS/FAIL | X/4 |

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

## What's Working Well
- List dimensions or checks that scored full marks
- Tell the generator: "These are solid — do NOT touch them"

## Priority Fixes
1. [BACKEND] classroom.service.ts:NN — Issue → fix
2. [FRONTEND] AiPanel.tsx:NN — Issue → fix
3. [DATA] manifest.json — Issue → fix

Classification:
- [BACKEND]: server-side fix
- [FRONTEND]: client-side fix
- [DATA]: manifest or type fix
```

The line `总分: X/100` MUST appear exactly in this format — it is machine-parsed by the harness script.
