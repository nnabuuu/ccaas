---
name: lesson-plan-editor
description: Edit `plan/lesson-plan.md` (the lesson plan markdown) — add/modify teaching requirements, sections, modules. Use this skill when the user asks to write or revise the lesson plan, add curriculum standards, or restructure the plan document.
triggers:
  keywords: [教案, lesson plan, 教学要求, 教学目标, plan/lesson-plan.md]
---

# lesson-plan-editor

Workflow for editing the project's lesson plan markdown.

## What you're editing

**File**: `plan/lesson-plan.md`

This is a Notion-style markdown document. Format details:
[`docs/lesson-plan-format-design.md`](../../docs/lesson-plan-format-design.md)

Key contract from the file's HTML comment header:

```
教学要求引用语法: [文本](req://r-X.Y.Z "课标 X.Y · 分类")
查 id:   Grep "<关键词>" artifacts/_lib/teaching-requirements.md
查解读:  Grep "r-X.Y.Z" artifacts/_lib/my-interpretations.md
```

## Reference layers

The lesson plan sits at the intersection of three layers — understand them
before editing:

- **L0** — the markdown file you `Read` / `Edit`. Plain text on disk. The
  source of truth.
- **L1** — the teaching-requirements library at `artifacts/_lib/teaching-requirements.md`.
  Platform-shipped, read-only. Use `Grep` to find ids.
- **L2** — the user's interpretations at `artifacts/_lib/my-interpretations.md`.
  Per-user notes about each req. **Never write L2 content into the lesson
  plan file** — that's personal context, not lesson content. Use it as
  reading context when authoring the plan.

## Common tasks

### Add a teaching requirement

1. Find the right req id:

   ```
   Grep "推断生词" artifacts/_lib/teaching-requirements.md
   ```

   The result shows entries like:

   ```
   ### r-1.2.3 — 课标 2.1.3
   在课文中推断生词含义
   ```

2. Read the user's interpretation if any:

   ```
   Grep -A 6 "r-1.2.3" artifacts/_lib/my-interpretations.md
   ```

3. Insert the canonical link in the `## 教学要求` section:

   ```markdown
   - [在课文中推断生词含义](req://r-1.2.3 "课标 2.1.3 · 语言能力")
   ```

   Copy the canonical text + title verbatim from the library — the
   editor's canonicalizer will refresh them on save anyway, but
   starting from canonical avoids confusing diffs.

### Validate before claiming done

After non-trivial edits, sanity-check structure:

```
Read plan/lesson-plan.md
```

Make sure:
- The HTML comment header at the top is intact (agents downstream need it)
- All `req://` links you added use valid ids from `artifacts/_lib/teaching-requirements.md`
- Headings use `## / ###` consistently for sections / modules

### Restructure modules

The `## 模块概要` section uses `### 模块 N: 标题 (时长)` for each module.
When restructuring:
- Keep heading hierarchy stable (`##` for top section, `###` for modules)
- One blank line between modules
- Use `- bullet` (not `* bullet`) for consistency with the project's
  normalization rules

### Handle stale `req://` references

If the user reports a "stale chip" in the editor or you see a ref to an
id not in `artifacts/_lib/teaching-requirements.md`:
- Don't delete the line silently. The text after the chip may carry the
  user's intent (e.g. `—— 本课重点`).
- Either look up a replacement id (`Grep` on the text fragment) or ask
  the user.

## Anti-patterns

- **Don't** put L2 interpretations into the lesson plan file. Interpretations
  are sidecar data; embedding them duplicates state and creates conflicts
  on subsequent canonicalize.
- **Don't** invent `req://` ids. If you can't find a match in
  `artifacts/_lib/teaching-requirements.md`, the requirement isn't in the library
  — ask the user before adding.
- **Don't** remove the HTML comment header. It's the agent contract for
  this file's format; future agents (including yourself in another
  session) need it.
- **Don't** use raw HTML (other than `<details>` toggles for foldable
  sections). The parser preserves arbitrary HTML but the editor renders
  it as a non-editable block — not what the teacher wants.

## Where to find more

- `docs/lesson-plan-format-design.md` — full format spec
- `artifacts/_lib/teaching-requirements.md` — current library (subject-scoped)
- `artifacts/_lib/my-interpretations.md` — current user's notes
- `scripts/find-req.sh` (when bash is available) — convenience: search
  library + interpretation in one shot
