# AI Tutor — Dynamic Categorization System

## Problem

All student questions are listed flat without categorization. Teachers cannot:
- Quickly identify high-frequency question types
- Allocate teaching resources by category
- See patterns in student confusion

## Solution: Predefined + Dynamic Categories

### Default Categories (initialized per session)

| Category | Meaning | AI Response Strategy |
|----------|---------|---------------------|
| 概念理解 | Reading strategies/methodology concepts | Direct explanation with clear definitions |
| 阅读策略 | How to apply reading strategies | Step-by-step guidance with text examples |
| 课文内容 | Specific article information | Quote original text paragraphs |
| 解题求助 | Task answers/techniques | Socratic guidance, never give answers |

### Dynamic Growth

GLM may return a new category name (e.g., "词汇理解") not in the predefined set. The system automatically adds it to the session's category set.

## Data Model

### QuestionRecord (service layer)

```typescript
interface QuestionRecord {
  studentId: string;
  studentName: string;
  step: number;
  question: string;
  answer: string;
  category: string;
  timestamp: string;
}
```

### Categories Storage

```typescript
// Per-session category set — in-memory, initialized on first AI ask
private categoriesMap = new Map<string, Set<string>>()  // sessionId → categories

// Default initialization
const DEFAULT_CATEGORIES = ['概念理解', '阅读策略', '课文内容', '解题求助'];
```

## Classification Mechanism

**Single GLM call** — the system prompt instructs GLM to prefix its response with `【CategoryName】`:

```
回答时，在开头用【分类名】标注问题类型。可用分类：概念理解、阅读策略、课文内容、解题求助。
如果问题不属于以上分类，可以创建新的分类名。
```

**Backend regex parsing**:

```typescript
private parseCategoryFromResponse(response: string): { category: string; answer: string } {
  const match = response.match(/^【(.+?)】/);
  if (match) {
    return { category: match[1], answer: response.slice(match[0].length).trim() };
  }
  return { category: '其他', answer: response };
}
```

Parse failure falls back to `其他`.

## API Contract

### POST `/api/classroom/:code/ai/ask`

**Request** (unchanged):
```json
{ "studentId": "...", "question": "...", "step": 1 }
```

**Response** (enhanced):
```json
{ "answer": "Skimming 是快速阅读策略...", "category": "概念理解" }
```

### GET `/api/classroom/:code/state`

```json
{
  "questions": [
    {
      "studentId": "...",
      "studentName": "陈昕妍",
      "step": 1,
      "question": "什么是skimming？",
      "answer": "Skimming 是快速阅读策略...",
      "category": "概念理解",
      "timestamp": "2026-04-22T10:00:00Z"
    }
  ]
}
```

## Test Strategy

See `harness-workspace/live-lesson-ai-tutor-e2e/tests/test-categorization.sh` for independent smoke tests:

1. Create session → verify default 4 categories exist (via state questions after asks)
2. Send concept question → verify `category: "概念理解"`
3. Send task-help question → verify `category: "解题求助"`
4. GET state → verify every question has a `category` field
5. Send ambiguous question → verify fallback to `其他` or new category accepted
