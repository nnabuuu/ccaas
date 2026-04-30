# AI Tutor — Teacher Question Visibility

## Problem

Teachers can only see questions grouped by step, with no AI answers and no categorization:
- Cannot identify question patterns or clusters
- Cannot see how AI responded to students
- Cannot prioritize teaching interventions by topic

## Solution: Category-Grouped Question Queue

### Layout Redesign

Replace "group by step" with **"group by category"**:

```
┌─ 概念理解 (3) ──────────────────────┐
│ [蓝] 陈昕妍: 什么是skimming？       │
│      → Skimming 是快速阅读策略...    │
│ [蓝] 王译文: scanning是什么意思？    │
│      → Scanning 是定位阅读策略...    │
│ [蓝] 张皓月: 什么是main idea？       │
│      → Main idea 是文章的中心思想... │
├─ 解题求助 (2) ──────────────────────┤
│ [橙] 陈昕妍: 第1题选什么？           │
│      → 想想看：¶2 的首句在说什么？   │
│ [橙] 王译文: 第3题怎么做？           │
│      → 试试先找出每段的关键词...     │
├─ 课文内容 (1) ──────────────────────┤
│ [紫] 张皓月: Nigeria在哪个段落？     │
│      → 在 ¶4，文中提到...           │
└─────────────────────────────────────┘
```

### Category Badges

| Category | Color | CSS Variable |
|----------|-------|-------------|
| 概念理解 | Blue | `--blue` / `--blue-bg` |
| 阅读策略 | Green | `--green` / `--green-bg` |
| 课文内容 | Purple | `--purple` / `--purple-bg` |
| 解题求助 | Amber | `--amber` / `--amber-bg` |
| 其他 | Grey | `--t3` / `--surface2` |

Badge CSS:
```css
.cat-badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}
.cat-badge.concept { background: var(--blue-bg); color: var(--blue); }
.cat-badge.strategy { background: var(--green-bg); color: var(--green); }
.cat-badge.content { background: var(--purple-bg); color: var(--purple); }
.cat-badge.task-help { background: var(--amber-bg); color: var(--amber); }
.cat-badge.other { background: var(--surface2); color: var(--t3); }
```

### Answer Display

Each question row shows:
- **Default**: Student name + question text (one line) + category badge
- **Expandable**: Click to reveal full AI answer below the question

```tsx
<div className="q-row" onClick={() => toggle(q)}>
  <span className={`cat-badge ${catClass}`}>{q.category}</span>
  <span className="q-student">{q.studentName}</span>
  <span className="q-text">{q.question}</span>
  <span className="q-time">{relative(q.timestamp)}</span>
</div>
{expanded && (
  <div className="q-answer">
    <span className="q-answer-label">AI 回答：</span>
    {q.answer}
  </div>
)}
```

### Frequency Aggregation

Questions with same category + similar text (first 40 chars match) are merged:

```
[概念理解] "什么是skimming？" × 3
    → Skimming 是快速阅读策略...
```

### Dynamic Category Sections

When a new category appears (e.g., "词汇理解"), a new section is automatically added to the queue.

## Data Requirements

### ClassroomState.questions Type

```typescript
questions: Array<{
  studentId: string
  studentName: string
  step: number
  question: string
  answer?: string     // NEW: AI response text
  category?: string   // NEW: question category
  timestamp: string
}>
```

### SSE Push

The broadcast already sends the full state including questions. Adding `answer` and `category` to `QuestionRecord` automatically includes them in SSE push.

## Test Strategy

See `harness-workspace/live-lesson-ai-tutor-e2e/tests/test-teacher-api.sh`:

1. Create session + join student + send 4 different category questions
2. GET state → verify `questions[].answer` present
3. GET state → verify `questions[].category` present
4. Verify different questions have different categories
5. Playwright: verify category section headers visible on teacher page
6. Playwright: verify AI answer text is visible/expandable
