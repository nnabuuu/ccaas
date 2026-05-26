---
name: manifest-editor
description: Edit a live-lesson course project's lesson plan + execution manifest in collaboration with a teacher. Operates on files within the project workspace; the runtime syncs writes back to the live-lesson backend.
---

# manifest-editor

You're collaborating with a teacher who's authoring a **live-lesson course project**. The project workspace holds:

```
artifacts/
├── plan/
│   └── lesson-plan.md          ← Markdown narrative: goals, audience, pedagogy
└── execution/
    └── manifest.json           ← Structured lesson definition (Zod-validated)
```

Your job: **read these files, propose changes, write them back**. The runtime syncs your writes back to the live-lesson backend at the end of each turn — you don't call any HTTP API yourself; you just edit files.

## How to work — progressive disclosure

This file is short on purpose. **Drill into sub-files only when you need them**:

1. **Always start** with `ls artifacts/` then `cat artifacts/plan/lesson-plan.md` + `cat artifacts/execution/manifest.json` to anchor on current state.
2. **For the high-level manifest schema** (top-level fields, readingSteps shape): `cat skills/manifest-editor/tools/manifest-overview.md`
3. **For exercise type `answerKey` shape** (one of 11 types — quiz / match / matrix / etc.): `cat skills/manifest-editor/tools/answerkey-<type>.md`. Don't read all of them upfront.
4. **For observe rules** (metric thresholds, alert actions per block): `cat skills/manifest-editor/tools/observe-rules.md`
5. **For scaffold config** (rich-content-quiz multi-part hints): `cat skills/manifest-editor/tools/scaffold.md`
6. **For task patterns** (e.g. "add a quiz step", "split a step", "convert manual completion to AI-eval"): `cat skills/manifest-editor/examples/<pattern>.md`

## Validate before you save

The live-lesson backend re-validates every PUT against the production `ManifestSchema` (Zod discriminated union). If you write an invalid file, the sync will reject it and the user sees nothing changed. **Before writing**, sanity-check:

- `manifest.id` matches the project id (do NOT change it)
- Every `readingSteps[].idx` is unique
- Every `answerKey.type` matches one of the 11 known types
- Per-type required fields are present (drill into the corresponding `answerkey-<type>.md`)

If unsure, write a short validation snippet using `node -e "..."` to round-trip the JSON through `JSON.parse` and check structure before committing the write.

## Self-check via the live backend's validator

After **every** edit to `artifacts/execution/manifest.json`, run:

```bash
bash skills/manifest-editor/scripts/validate-manifest.sh
```

This calls the live-lesson backend's `POST /api/projects/validate-manifest` endpoint — the **same `ManifestSchema`** the publish flow uses. So a green result here guarantees publish will accept; a red one means publish would 400.

The output is one line of JSON, parse with `jq`:

```json
{ "valid": true,  "stepCount": 5 }
{ "valid": false, "issues": [{ "path": "readingSteps.2.answerKey.answers.0.correct", "message": "..." }, ...] }
```

**If `valid: false`**: don't claim "done". Each issue carries the exact JSON path (`readingSteps.N.answerKey...`) and the Zod message — re-edit the file to fix those specific paths, then re-run the script. Iterate until `valid: true`.

**Why this exists**: the teacher's "发布" button validates with the same schema. Catching the issue here, in your turn, with structured feedback you can act on, is **much** faster than failing publish and bouncing the error back through the teacher.

The script is **low-cost**: no LLM call, no DB write, just one HTTP round-trip + Zod. Call it as often as you need. The creator UI also renders the result as a dedicated card in the chat, so the teacher can see at a glance whether your last edit is publish-ready.

## How publish + classroom hangs off your work

What you edit in `artifacts/execution/manifest.json` becomes a runnable lesson via two teacher-driven steps in the creator UI:

1. **Publish** — teacher clicks the "发布" button → `POST /api/projects/:id/publish`. The backend re-validates the manifest with the production `ManifestSchema` (Zod, same one used at lesson load time). If validation fails the publish 400s and the teacher comes back to you with the error.
2. **Classroom** — once published, teacher creates a session with `POST /api/classroom/sessions { lessonId: <projectId> }` which generates a 6-char join code. Students go to `/join`, enter the code, and see the exercises you wrote.

So your output has a **hard validation gate**. After every meaningful edit, run a quick self-check:

```bash
node -e "
const m = JSON.parse(require('fs').readFileSync('artifacts/execution/manifest.json', 'utf8'));
const valid = ['quiz','match','matrix','stance','order','select-evidence','image-upload','rich-content-quiz','fill-blank','guided-discovery','map'];
const seen = new Set();
m.readingSteps.forEach((s, i) => {
  if (seen.has(s.idx)) throw new Error('step idx ' + s.idx + ' duplicated');
  seen.add(s.idx);
  if (s.answerKey && !valid.includes(s.answerKey.type)) {
    throw new Error('step ' + s.idx + ' invalid answerKey.type: ' + s.answerKey.type);
  }
});
if (m.id !== process.env.PROJECT_ID && m.id) console.log('note: manifest.id is ' + m.id);
console.log('ok, ' + m.readingSteps.length + ' steps');
"
```

This catches the most common publish-blockers (duplicate `idx`, unknown `answerKey.type`) before the teacher discovers them. For full per-type validation, drill into the corresponding `tools/answerkey-<type>.md`.

## Output rules

- **Always cite the file you read or changed** (e.g. "updated `execution/manifest.json:readingSteps[2].answerKey.answers[0].correct = 1`").
- **Don't echo entire manifest** back to the user in the response — summarize the diff.
- **Don't touch `plan/lesson-plan.md` when the user asks about exercises**, and vice versa. The two files have distinct purposes; teachers shouldn't get unrelated changes.
- **Don't add new top-level files** unless the user explicitly asks. The live-lesson backend has a fixed `plan/` + `execution/` layout.
- **Refuse to publish.** If the user says "ship this lesson" or "publish to students", explain that publication is a backend action (`POST /api/projects/:id/publish`) the teacher must trigger from the creator UI — you only edit files.

## What you CAN'T do

- Call the live-lesson HTTP API directly — sync handles it for you
- Modify `manifest.id` (it's pinned to the project id at create-time)
- Create/delete projects (the teacher does this in the creator UI)
- Run the lesson (that's the classroom flow; out of scope here)
- Touch files outside `artifacts/plan/` and `artifacts/execution/`

When in doubt, read first, ask the user before writing.
