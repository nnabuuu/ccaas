# Pattern: add a quiz step

User asks: "Add a 3-question quiz after step 2 about paragraph 3."

## Walkthrough

1. **Read current state**
   ```bash
   cat project/execution/manifest.json | jq '.readingSteps | map({idx, label, type})'
   ```
   Note the highest `idx`. New step's idx = max + 1.

2. **Read the article ¶3** so the questions are grounded in real content. Paragraphs
   are keyed by `id` (e.g. `"p3"`); `num` is not in the schema (some manifests have
   it as a passthrough field but don't rely on it):
   ```bash
   cat project/execution/manifest.json | jq '.article.paragraphs[] | select(.id == "p3")'
   ```

3. **Draft the step object** (don't write yet — show user first if uncertain). Use
   `<max+1>` as the new `idx`. `type` must be `"task"` or `"instruction"` (any other
   value fails Zod validation — see `tools/manifest-overview.md`):
   ```json
   {
     "id": "step-quiz-p3",
     "idx": "<max+1>",
     "label": "Comprehension ¶3",
     "type": "task",
     "strategy": "comprehension",
     "duration": 5,
     "focusParagraphs": ["p3"],
     "answerKey": {
       "type": "quiz",
       "answers": [
         { "questionIdx": 0, "questionText": "...", "options": ["A","B","C","D"], "correct": 0 },
         { "questionIdx": 1, "questionText": "...", "options": ["A","B","C","D"], "correct": 2 },
         { "questionIdx": 2, "questionText": "...", "options": ["A","B","C","D"], "correct": 1 }
       ]
     }
   }
   ```

4. **Insert at the right position** — splice into `readingSteps` after the current step-2 (don't append blindly; the order matters for the step strip UI).

5. **Validate idx uniqueness** before writing:
   ```bash
   cat project/execution/manifest.json | jq '[.readingSteps[].idx] | length, (length - (unique | length))'
   ```
   Second number must be 0.

6. **Write back** — full manifest, not just the new step. **Splice into the right
   position**, do NOT just append (the step strip UI renders in array order, so
   appending puts the new step at the end regardless of `idx`):

   ```bash
   NEW='<the new step JSON>'
   # Insert after the step whose idx is INSERT_AFTER_IDX:
   jq --argjson s "$NEW" --argjson after "$INSERT_AFTER_IDX" \
      '.readingSteps |= (
        (map(select(.idx <= $after))) + [$s] + (map(select(.idx > $after)))
      )' \
     project/execution/manifest.json > /tmp/m.json \
     && mv /tmp/m.json project/execution/manifest.json
   ```

   Or read → mutate → write in JS (often clearer for non-trivial edits):
   ```bash
   node -e '
     const fs = require("fs");
     const m = JSON.parse(fs.readFileSync("project/execution/manifest.json"));
     const newStep = { /* ... */ };
     const after = 2;
     const at = m.readingSteps.findIndex(s => s.idx > after);
     m.readingSteps.splice(at < 0 ? m.readingSteps.length : at, 0, newStep);
     fs.writeFileSync("project/execution/manifest.json", JSON.stringify(m, null, 2));
   '
   ```

7. **Tell the user what you did** — diff summary, not full manifest dump.
