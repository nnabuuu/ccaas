# Eval Report — live-lesson-reading-surfaces v2

## Service Verification

All 3 services confirmed live:
- Frontend `http://localhost:5283` — page loads, title "即见·动态教学 | Live Lesson"
- Backend `http://localhost:3007/api/lessons` — 200 OK, 1 lesson returned
- CCAAS core `http://localhost:3001/api/v1/health` — `{"status":"ok"}`

## Per-Dimension Scores

### D1 Design System + Build (Weight: 20/100)
**Score: 20/20**

| Check | Pts | Result |
|-------|-----|--------|
| `tsc --noEmit` | 3/3 | PASS — 0 errors, clean exit |
| `vite build` | 3/3 | PASS — built in 2.06s, 395 kB JS + 77 kB CSS |
| Light theme `#f4f3ef` | 2/2 | PASS — `reading-tokens.css:12: --bg: #f4f3ef` |
| Plus Jakarta Sans | 2/2 | PASS — `reading-tokens.css:69: --font-body: "Plus Jakarta Sans"` |
| Spacing tokens `--sp-*` | 2/2 | PASS — `--sp-1` through `--sp-12` defined in `reading-tokens.css:31-32`, used extensively in `board.css` |
| Type scale `--fs-*` | 2/2 | PASS — `--fs-hero`, `--fs-h1`, `--fs-h2`, `--fs-h3`, `--fs-body`, `--fs-body-sm`, `--fs-meta`, `--fs-badge`, `--fs-label` in `reading-tokens.css:46-54` |
| Radius tokens `--r-*` | 2/2 | PASS — `--r-pill`, `--r-input`, `--r-input-lg`, `--r-card`, `--r-card-lg` in `reading-tokens.css:35-39` |
| No dark remnants `#0a0a0b` | 2/2 | PASS — grep of BoardPage.tsx, StudentPage.tsx, TeacherPage.tsx, DemoPage.tsx returned 0 matches |
| Board dark scoped `data-surface` | 2/2 | PASS — `data-surface="board"` in `BoardPage.tsx:51` and `reading-tokens.css:74` defines dark overrides |

**Justification**: Every design-system check passes. Build toolchain clean. Token system comprehensive with spacing, type scale, radius, and surface-scoped dark theme defined.
**Suggestion**: None — D1 is solid.

### D2 Board Surface (Weight: 20/100)
**Score: 18/20**

| Check | Pts | Result |
|-------|-----|--------|
| Board route loads | 3/3 | PASS — `/board/ideal-beauty-reading` renders with content, scrubber, step labels |
| 8+ block types | 4/4 | PASS — 8 found: heading, quote, chip, flow, matrix, mindmap, compare, formula. Missing: annotation, student-work |
| Progressive reveal | 3/3 | PASS — Reset shows "1.1 (1/27)", click "下一" advances to "1.2 (2/27)", new ¶2 quote block appears |
| Scrubber navigation | 2/2 | PASS — Step dots per-step (1-5), sub-step dots, "‹ 上一", "下一 ›", "↺ 重置", "全部展示" buttons |
| Caveat handwriting | 2/2 | PASS — `reading-tokens.css:70: --font-hand: "Caveat", cursive`, used in `board.css:130,349,358,378` |
| Tone system | 2/2 | PASS — All 5 tones found in DOM: accent, cool, warm, muted, success |
| postMessage sync | 2/2 | PASS — `BoardPage.tsx:24: window.addEventListener('message', onMessage)`, `BoardPage.tsx:27: window.parent.postMessage({ type: 'ready', role: 'board' })` |
| Board dark theme | 0/2 | FAIL — `data-surface="board"` element has `background: var(--rd-bg)` in inline style, but `--rd-bg` is **undefined**. Tokens define `--bg: #1c1c1a` for `[data-surface="board"]` but inline style references wrong variable name. Computed bg = `rgba(0, 0, 0, 0)` (transparent). Board appears dark only because body has old dark bg `rgb(10, 10, 11)`. |

**Justification**: Board is feature-rich with progressive reveal, scrubber, 8 block types, tone system, and postMessage sync. The dark theme mechanism is architecturally correct (tokens defined, data-surface attribute present) but fails at the inline style level due to `--rd-bg` vs `--bg` naming mismatch.
**Suggestion**: In `BoardPage.tsx:51`, change `background: var(--rd-bg)` to `background: var(--bg)` (and `color: var(--rd-t1)` to `color: var(--t1)`). The `--rd-*` prefix variables are never defined.

### D3 Student Surface (Weight: 20/100)
**Score: 20/20**

| Check | Pts | Result |
|-------|-----|--------|
| Student route loads | 3/3 | PASS — `/student/ideal-beauty-reading` renders full student interface |
| Step tabs (5 labeled) | 2/2 | PASS — 5 step buttons (1-5), counter "1/5", Structure Map shows labels: 图式激活, 结构解码, 矩阵构建, 批判质疑, 复盘升华 |
| Task panel changes on tab click | 3/3 | PASS — Step 1: keyword extraction (2 textboxes, "提交"). Step 2: paragraph classification with ¶3-4/¶5-7/¶8 signal word tasks with History/Culture/Conclusion buttons. Counter changes "1/5" → "2/5" |
| Text panel with article | 3/3 | PASS — ¶1-8 all visible with full English text. Step-aware highlight labels ("聚焦 ¶1,2" on Step 1, "聚焦 ¶3,4,5,6,7,8" on Step 2) |
| Board drawer | 2/2 | PASS — "板书" button with "› ›" chevron, Structure Map drawer with "收起 ▲" toggle, step progress indicators with icons |
| AI panel toggle | 2/2 | PASS — "助教" button, AI 助教 panel with "收起 ▼" toggle, 4 suggested question buttons, free-text input with "↗" submit |
| Step 3 matrix | 2/2 | PASS — Matrix confirmed: `hasMatrix: true, inputCount: 9`. Table with Place×Practice×Reason columns visible in student iframe |
| postMessage sync | 3/3 | PASS — `StudentShell.tsx:39: window.addEventListener('message', onMessage)`, `StudentShell.tsx:41: window.parent?.postMessage({ type: 'ready', role: 'student' })` |

**Justification**: Student surface is comprehensive: three-panel layout (board/text/AI) with step-aware content, interactive tasks per step, article with paragraph-level focus indicators, and AI assistant with scaffolded prompts.
**Suggestion**: None — D3 is excellent.

### D4 Teacher Surface (Weight: 20/100)
**Score: 20/20**

| Check | Pts | Result |
|-------|-----|--------|
| Teacher route loads | 3/3 | PASS — `/teacher/ideal-beauty-reading` renders full teacher console |
| Ambient band | 2/2 | PASS — "课堂控制台", "高一(3)班 · Ideal Beauty — 阅读策略训练 · 42 人", Step 3/5 counter, time 12:48/45:00 |
| Step rail (5 buttons) | 2/2 | PASS — 5 buttons with Chinese labels and time estimates: "1 图式激活 5'", "2 结构解码 8'", "3 矩阵构建 15'", "4 批判质疑 12'", "5 复盘升华 5'" |
| Hero section | 3/3 | PASS — "STEP 3 现在进行中" banner, "矩阵构建 Matrix Building" title, full step description with group instructions |
| Matrix card | 2/2 | PASS — Full Place×Practice×Reason table with 5 rows (Egypt, Borneo, NZ Maori, Myanmar, Indonesia), live submission counter "12/42 提交", model row marked "示范" |
| Speech line | 2/2 | PASS — "你的下一句话 · say out loud" card with quoted teacher speech in English |
| Cue cards | 2/2 | PASS — 3 cards: "示范一行" (model answer walkthrough), "易错点" (common mistakes with ¶6 Maori and ¶7 specifics), "过渡到 Step 4" (transition script) |
| Overview sidebar | 2/2 | PASS — Right sidebar with tabs (待处理 14, 全部对话 38, 已解决 6), student progress counters (12已提交, 26填写中, 4未开始), priority-clustered question queue (高/中/低优先级), 班级视图 42人 with individual student cards |
| postMessage sync | 2/2 | PASS — `TeacherShell.tsx:56: window.addEventListener('message', onMessage)`, `TeacherShell.tsx:57: window.parent?.postMessage({ type: 'ready', role: 'teacher' })` |

**Justification**: Teacher surface is production-grade: ambient band with live metrics, step-aware hero with real-time submitted/total counts, data-rich matrix card, speech prompts, teaching cue cards, and a sophisticated sidebar with priority-clustered student questions and class overview. This goes well beyond the rubric requirements.
**Suggestion**: None — D4 is outstanding.

### D5 Orchestrator + Sync (Weight: 20/100)
**Score: 20/20**

| Check | Pts | Result |
|-------|-----|--------|
| Demo route loads | 3/3 | PASS — `/demo/ideal-beauty-reading` renders three-panel orchestrator with conductor bar |
| Conductor bar | 2/2 | PASS — 5 step buttons with labels/times, "←" and "下一步 →" buttons, timer "18:15/45:00", settings "⚙" |
| 3 iframes | 4/4 | PASS — 3 iframes confirmed: `teacher/ideal-beauty-reading?embed=1`, `student/ideal-beauty-reading?embed=1`, `board/ideal-beauty-reading?embed=1` |
| postMessage broadcast | 3/3 | PASS — `DemoShell.tsx:39: iframe.contentWindow?.postMessage(msg, '*')` broadcasts to all child iframes |
| Keyboard shortcuts | 2/2 | PASS — `DemoShell.tsx:67-68: ArrowRight/ArrowLeft` for step nav, `DemoShell.tsx:71-73: s/b/c` for surface switching |
| Layout toggle | 2/2 | PASS — `DemoShell.tsx:28: useState<'focus' | 'triptych'>('focus')`, buttons "主视图 + 缩略" and "三端并排" at `DemoShell.tsx:213-214` |
| Featured surface switch | 2/2 | PASS — `DemoShell.tsx:26: useState('teacher')` for featured surface, keyboard shortcuts s/b/c, clickable thumbnail panels labeled "学生端 Student · iPad" and "投屏黑板 Classroom Projector" |
| Legacy route | 2/2 | PASS — `/lesson/math-linear-eq-intro` loads successfully with 4-step math lesson UI (问题导入, 算术分析, 方程建立, 求解验证), "开始课程" button, AI supplement panel |

**Justification**: Orchestrator is complete: conductor bar with full step controls, 3 iframes with correct embed URLs, postMessage broadcasting, keyboard shortcuts for both step navigation and surface switching, two layout modes, and legacy route preserved.
**Suggestion**: None — D5 is solid.

## Penalties Applied

| Penalty | Frozen Directory | Committed Changes | Uncommitted Changes | Applied? |
|---------|-----------------|-------------------|---------------------|----------|
| P1 | `packages/` | None | None | NO |
| P1 | `solutions/business/edu-platform/` | None | None | NO |
| P1 | `solutions/business/recipe-book/` | None | None | NO |
| P2 | `solutions/business/live-lesson/mcp-server/src/` | None | None | NO |
| P2 | `solutions/business/live-lesson/backend/src/` | None | None | NO |

**All git diffs returned empty.** No frozen directories were modified. Zero penalties.

## Score Summary

| Dimension | Scored | Max | Notes |
|-----------|--------|-----|-------|
| D1 | 20 | 20 | All design system + build checks pass |
| D2 | 18 | 20 | Board dark bg uses undefined `--rd-bg` variable (−2) |
| D3 | 20 | 20 | Full marks — comprehensive student surface |
| D4 | 20 | 20 | Full marks — production-grade teacher console |
| D5 | 20 | 20 | Full marks — complete orchestrator with sync |

Penalties: -0

总分: 98/100

## Bug Classification

| Deduction | Category | Description |
|-----------|----------|-------------|
| D2.8 −2 | DESIGN | Board inline style uses undefined `--rd-bg` CSS variable instead of `--bg` from scoped `[data-surface="board"]` tokens |

## Actionable Fix Hints

1. **`BoardPage.tsx:51`** — Change `background: var(--rd-bg)` to `background: var(--bg)` and `color: var(--rd-t1)` to `color: var(--t1)`. The `--rd-*` prefix is used in `orchestrator.css` referencing these variables but they are never defined. The correct variables `--bg` and `--t1` are defined in `reading-tokens.css:74-78` under `[data-surface="board"]`.

2. **`orchestrator.css`** — All `var(--rd-*)` references (lines 10, 19, 26, 35-36, 44, 48, 51, 55, 81) should be updated to use `var(--bg)`, `var(--t1)`, `var(--surface)`, `var(--surface2)`, `var(--border)` etc. matching the token names defined in `reading-tokens.css`.

## Top 3 Priority Fixes

1. **[CRITICAL] Fix `--rd-bg` → `--bg` in BoardPage.tsx:51** — Board background is transparent instead of the intended `#1c1c1a`. One-line fix restores scoped dark theme.
2. **[LOW] Fix all `--rd-*` references in orchestrator.css** — Same variable naming inconsistency. The orchestrator currently inherits colors from body defaults rather than the reading design tokens.
3. **[COSMETIC] Consider adding annotation and student-work block types to board** — Currently 8/10 types render. Adding the remaining 2 would reach full block type coverage.

## What's Working Well

1. **Teacher surface is exceptional** — The priority-clustered student question queue, live matrix with submission tracking, speech prompts, and teaching cue cards create a genuinely useful classroom control console. This is production-quality UI design.
2. **Three-surface orchestrator sync architecture** — The postMessage-based sync with `useSurfaceSync` hook, per-surface `addEventListener`/`postMessage` setup, and conductor-driven broadcasting is clean and well-structured. All three surfaces (board, student, teacher) properly respond to sync messages and announce readiness on mount.
