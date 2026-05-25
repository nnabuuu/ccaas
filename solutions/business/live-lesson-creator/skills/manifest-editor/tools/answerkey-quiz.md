# answerKey · quiz

Multi-choice question with exactly one correct answer per question. The most common type.

## Shape

```json
{
  "type": "quiz",
  "answers": [
    {
      "questionIdx": 0,                          // 0-indexed, unique
      "questionText": "What did Edem do?",       // required, ≥1 char
      "questionTranslate": "Edem 做了什么？",     // optional, ≥1 char (Chinese gloss)
      "options": [                                // ≥2 strings, all non-empty
        "Went on a diet",
        "Gained weight in a fattening room",
        "Got cosmetic surgery",
        "Started a fashion brand"
      ],
      "correct": 1,                              // 0-based index into options[]; MUST be < options.length
      "label": "",                                // optional, free-text label shown above q
      "hint": "Look at ¶1 — what happened to her weight?",         // optional
      "hintZh": "看 ¶1 — 她的体重发生了什么？",                       // optional
      "walkthrough": "...",                       // optional, long explanation after submit
      "walkthroughZh": "...",                     // optional
      "paraRef": [1]                              // optional, paragraph num references
    }
  ]
}
```

## Validation rules (enforced by backend Zod)

- `answers` is **non-empty array**
- Each item must have `questionIdx`, `questionText`, `options[≥2]`, `correct`
- `correct` must be `< options.length` (off-by-one is a common bug)
- `questionIdx` should be unique (not enforced by Zod but expected by UI)

## Common gotchas

- `correct` is a **number**, NOT a letter ('B'). Index into options[].
- Submitted data shape on student side: `{ answers: [1, 2, 0] }` — array of selected indices, ordered by questionIdx.
- A quiz with 0 questions will fail Zod validation — always include at least 1 answer item.

## Example: 3-question reading comprehension

```json
{
  "type": "quiz",
  "answers": [
    {
      "questionIdx": 0,
      "questionText": "Who is the main subject?",
      "options": ["Edem", "Her sister", "The teacher", "The author"],
      "correct": 0
    },
    {
      "questionIdx": 1,
      "questionText": "Where did the practice take place?",
      "options": ["Egypt", "Brazil", "Nigeria", "India"],
      "correct": 2
    },
    {
      "questionIdx": 2,
      "questionText": "How long did it last?",
      "options": ["Six weeks", "Six months", "One year", "Two years"],
      "correct": 1
    }
  ]
}
```
