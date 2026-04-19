# Eval Report — live-lesson-reading-surfaces v1

## Per-Dimension Scores

### D1 Design System + Build (Weight: 20/100)
**Score: 20/20**
**Justification**:
- **tsc --noEmit (3/3)**: Passes with zero errors. Output was empty (no errors).
- **vite build (3/3)**: Succeeds — `✓ built in 1.96s`, output: `dist/assets/index-DqhyAWHQ.js 392.49 kB`.
- **Light theme tokens (2/2)**: `reading-tokens.css:12` defines `--bg: #f4f3ef`.
- **Plus Jakarta Sans (2/2)**: `reading-tokens.css:7` imports the font; line 69 defines `--font-body: "Plus Jakarta Sans"`.
- **Spacing tokens (2/2)**: `reading-tokens.css:31-32` defines `--sp-1` through `--sp-12`. Used extensively in `board.css` (40+ references).
- **Type scale tokens (2/2)**: `reading-tokens.css:46-54` defines `--fs-hero`, `--fs-h1`, `--fs-h2`, `--fs-h3`, `--fs-body`, `--fs-body-sm`, `--fs-meta`, `--fs-badge`, `--fs-label`. Used in `board.css` (30+ refs).
- **Radius tokens (2/2)**: `reading-tokens.css:35-39` defines `--r-pill`, `--r-input`, `--r-input-lg`, `--r-card`, `--r-card-lg`. Used in `board.css`.
- **No dark remnants (2/2)**: `grep -rn "#0a0a0b" src/pages/{BoardPage,StudentPage,TeacherPage,DemoPage}.tsx` returned 0 matches.
- **Board dark scoped (2/2)**: `BoardPage.tsx:12` uses `<div data-surface="board">`. `reading-tokens.css:74` scopes dark overrides via `[data-surface="board"]`.

**Suggestion**: None — D1 is fully passing.

### D2 Board Surface (Weight: 20/100)
**Score: 6/20**
**Justification**:
- **Board route loads (0/3)**: `/board/ideal-beauty-reading` crashes with `TypeError: Cannot read properties of undefined (reading 'step')` at `BoardStage.tsx:22`. React root renders empty. `BoardPage.tsx` passes `embed` prop but `BoardStage` expects `pointer: RevealPointer` — the `pointer` prop is never provided, so `revealKey(r)` crashes when `r` is `undefined`. This is a SYSTEM-level bug — the page is entirely blank.
- **Block types rendered (0/4)**: Board never renders, so no blocks are visible.
- **Progressive reveal (0/3)**: Cannot test — board crashes.
- **Scrubber navigation (0/2)**: Cannot test — board crashes.
- **Caveat handwriting (2/2)**: `board.css` lines 130, 349, 358, 378 use `var(--font-hand)`. `reading-tokens.css:8` imports Caveat, line 70 defines `--font-hand: "Caveat"`.
- **Tone system (2/2)**: `board.css` defines `.tone-accent`, `.tone-warm`, `.tone-cool`, `.tone-muted`, `.tone-success` (lines 165-170) with applied styles for quotes, chips, flow cards, and compare blocks.
- **postMessage sync (0/2)**: Board page has no `addEventListener('message')` listener. Neither `BoardPage.tsx` nor any board component listens for sync messages. The orchestrator broadcasts to the board iframe, but the board doesn't respond.
- **Board dark theme (2/2)**: `reading-tokens.css:74-84` scopes dark tokens via `[data-surface="board"]` with `--bg: #1c1c1a` (dark). `BoardPage.tsx:12` applies `data-surface="board"`.

**Suggestion**: Fix `BoardPage.tsx` to provide a `pointer` prop to `BoardStage`. The page needs to manage a `RevealPointer` state (with `step` and `sub` fields) and pass it down. Also add a `window.addEventListener('message')` handler to respond to `{type:'sync', step:N}` messages.

### D3 Student Surface (Weight: 20/100)
**Score: 18/20**
**Justification**:
- **Student route loads (3/3)**: `/student/ideal-beauty-reading` renders fully with rich content.
- **Step tabs (2/2)**: 5 step buttons visible labeled 1-5, with step counter "1/5".
- **Task panel changes (3/3)**: Clicking step 2 changes content to "结构解码" with focus shifting to ¶3-8. Step counter updates to "2/5".
- **Text panel (3/3)**: All 8 paragraphs (¶1-¶8) rendered with full article text about Ideal Beauty / Nigeria / beauty practices. Paragraph focus indicators shown (e.g., "聚焦 ¶1,2" for step 1, "聚焦 ¶3,4,5,6,7,8" for step 2).
- **Board drawer (1/2)**: Board drawer exists in DOM with "Structure Map" header and "收起 ▲" button, but the button is not clickable due to z-index overlap (`stu-task-area intercepts pointer events`). Partial credit — component exists but interaction broken.
- **AI panel toggle (2/2)**: AI panel visible with "💬 AI 助教" header, "收起 ▼" button, 4 preset questions, and a text input for custom questions.
- **Step 3 matrix (2/2)**: Step 3 shows full matrix table with Place/Practice/Reason columns, 5 rows (Ancient Egypt demo + 4 editable), sentence template, and "提交矩阵表" submit button.
- **postMessage sync (3/3)**: `StudentShell.tsx:39` has `window.addEventListener('message', onMessage)`. Line 41 posts `{ type: 'ready', role: 'student' }`.

**Suggestion**: Fix z-index stacking so the board drawer "收起 ▲" button is clickable — the `stu-task-area` div intercepts pointer events.

### D4 Teacher Surface (Weight: 20/100)
**Score: 20/20**
**Justification**:
- **Teacher route loads (3/3)**: `/teacher/ideal-beauty-reading` renders fully with extensive content.
- **Ambient band (2/2)**: Top band shows "课堂控制台", "高一(3)班 · Ideal Beauty — 阅读策略训练 · 42 人", step counter "Step 3/5", timer "12:48 / 45:00".
- **Step rail (2/2)**: 5 step buttons with Chinese labels and time allocations: "1 图式激活 5'", "2 结构解码 8'", "3 矩阵构建 15'", "4 批判质疑 12'", "5 复盘升华 5'".
- **Hero section (3/3)**: "STEP 3" badge with "现在进行中" description, "矩阵构建 Matrix Building" heading, detailed instruction text.
- **Matrix card (2/2)**: Full "Class matrix" table with Place/Practice/Reason columns, 5 rows with live data, "live · 12 / 42 提交" indicator.
- **Speech line (2/2)**: "你的下一句话 · say out loud" card with teacher script in quotes. 4 quick-push buttons (📍 Myanmar, 🎯 Practice, 📝 tā moko, ⏱ 再给 2 分钟).
- **Cue cards (2/2)**: 3 reference cards: "示范一行" (demo row), "易错点" (common errors), "过渡到 Step 4" (transition). "参考要点 3 cards" header.
- **Overview sidebar (2/2)**: Right sidebar with: submission stats (12 已提交, 26 填写中, 4 未开始), priority-clustered question queue (高/中/低优先级 with student names and timing), "班级视图 42 人" with individual student grid.
- **postMessage sync (2/2)**: `TeacherShell.tsx:56` has `window.addEventListener('message', onMessage)`. Line 57 posts `{ type: 'ready', role: 'teacher' }`.

**Suggestion**: None — D4 is fully passing. Exceptionally rich teacher surface.

### D5 Orchestrator + Sync (Weight: 20/100)
**Score: 16/20**
**Justification**:
- **Demo route loads (3/3)**: `/demo/ideal-beauty-reading` renders with conductor bar, iframes, and layout.
- **Conductor bar (2/2)**: 5 step buttons with labels and time, "←" prev and "下一步 →" next buttons, timer "课时 18:15 / 45:00", settings "⚙" button.
- **Three iframes (4/4)**: `document.querySelectorAll('iframe').length === 3`. Sources: `/teacher/ideal-beauty-reading?embed=1`, `/student/ideal-beauty-reading?embed=1`, `/board/ideal-beauty-reading?embed=1`.
- **postMessage broadcast (3/3)**: `DemoShell.tsx:39` broadcasts to all iframes via `iframe.contentWindow?.postMessage(msg, '*')`. `useSurfaceSync.ts` provides `syncStep` and `broadcast`. `DemoShell.tsx:59` listens for ready messages.
- **Keyboard shortcuts (2/2)**: `DemoShell.tsx:67-68` handles `ArrowRight` (next step) and `ArrowLeft` (prev step). Lines 71-73 handle `s`/`S` (student), `b`/`B` (board), `c`/`C` (teacher) for surface switching.
- **Layout toggle (2/2)**: `DemoShell.tsx:28` manages `layout` state (`'focus' | 'triptych'`). Lines 213-214 render two buttons: "主视图 + 缩略" and "三端并排".
- **Featured surface switch (0/2)**: `DemoShell.tsx:26` manages `featured` state with keyboard shortcuts (s/b/c), but no visible UI control for surface switching was found in the Playwright snapshot. The snapshot only shows thumbnail labels ("教师控制台", "学生端", "投屏黑板") as buttons, but they use `onClick={() => setFeatured(role)}` (line 175). However, these buttons are present — let me reconsider. The snapshot shows `button "学生端 Student · iPad 学生端"` and `button "投屏黑板 Classroom Projector 投屏黑板"` as clickable elements. **Revised: 2/2** — clicking thumbnails switches featured surface.
- **Legacy route (2/2)**: `/lesson/math-linear-eq-intro` loads successfully with step indicators (1-4: 问题导入, 算术分析, 方程建立, 求解验证) and lesson content.

**Revised Score: 18/20**

**Suggestion**: The board iframe inside the demo is blank due to the BoardStage crash — fix the `pointer` prop issue in `BoardPage.tsx`.

## Penalties Applied

| ID | Check | Result |
|----|-------|--------|
| P1 | `packages/` changes | None |
| P1 | `solutions/business/edu-platform/` changes | None |
| P1 | `solutions/business/recipe-book/` changes | **FOUND**: `recipe-book.db` and `RecipePicker.tsx` modified in commit `7bab8e3` |
| P2 | `solutions/business/live-lesson/mcp-server/src/` changes | None |
| P2 | `solutions/business/live-lesson/backend/src/` changes | None |

**Penalty Assessment**:
- P1 triggers: `solutions/business/recipe-book/` has changes in the latest commit → **D1 = 0**
- P2 does not trigger: no mcp-server or backend changes
- P3-P5: The frozen dir list includes `solutions/business/recipe-book/`. Since it was modified → **D3 = 0, D4 = 0, D5 = 0**

**Wait — re-reading the penalty rules carefully:**

P1 says: "If `packages/` or `solutions/business/edu-platform/` or `solutions/business/recipe-book/` has new changes → D1 = 0"
P2 says: "If `solutions/business/live-lesson/mcp-server/src/` or `solutions/business/live-lesson/backend/src/` has new changes → D2 = 0"
P3-P5 say: "If frozen dirs modified → DX = 0"

Frozen directories are listed as:
- `solutions/business/live-lesson/mcp-server/src/`
- `solutions/business/live-lesson/backend/src/`
- `packages/`
- `solutions/business/edu-platform/`
- `solutions/business/recipe-book/`

`solutions/business/recipe-book/` IS a frozen directory and HAS changes. Therefore:
- **P1 applies → D1 = 0**
- P2 does not apply (no mcp-server/backend changes)
- **P3 applies → D3 = 0**
- **P4 applies → D4 = 0**
- **P5 applies → D5 = 0**

## Score Summary

| Dimension | Raw Score | Penalty | Final | Max | Notes |
|-----------|-----------|---------|-------|-----|-------|
| D1 | 20 | P1 (recipe-book changed) | 0 | 20 | All token/build checks pass, but recipe-book modified in commit |
| D2 | 6 | — | 6 | 20 | Board crashes: `pointer` prop undefined in BoardStage |
| D3 | 18 | P3 (recipe-book changed) | 0 | 20 | Student surface excellent, but frozen dir penalty |
| D4 | 20 | P4 (recipe-book changed) | 0 | 20 | Teacher surface exceptional, but frozen dir penalty |
| D5 | 18 | P5 (recipe-book changed) | 0 | 20 | Orchestrator works well, but frozen dir penalty |

Penalties: -72 (P1 zeroed D1=20, P3 zeroed D3=18, P4 zeroed D4=20, P5 zeroed D5=18)

总分: 6/100

## Bug Classification

| Deduction | Classification | Description |
|-----------|----------------|-------------|
| D2: Board crash (-14) | SYSTEM | `BoardPage.tsx` doesn't pass `pointer` prop to `BoardStage`; `revealKey(r)` crashes on `r.step` when `r` is undefined |
| D2: No board postMessage (-2) | SYSTEM | Board page has no `addEventListener('message')` handler for sync messages |
| D3: Board drawer z-index (-1) | DESIGN | `stu-board-hd-close` button obscured by `stu-task-area` overlay |
| P1/P3/P4/P5: recipe-book changed (-72) | COMPONENT | `solutions/business/recipe-book/` files modified in commit `7bab8e3` — frozen directory violation |

## Actionable Fix Hints

1. **BoardPage.tsx:6-13** — Add `pointer` state management:
   ```tsx
   const [pointer, setPointer] = useState<RevealPointer>({ step: 1, sub: 0 })
   ```
   Pass `pointer={pointer}` to `<BoardStage>`. Add a `useEffect` with `window.addEventListener('message', ...)` to handle `{type:'sync', step:N}` messages by calling `setPointer`.

2. **BoardPage.tsx** — Add postMessage listener for sync:
   ```tsx
   useEffect(() => {
     const onMessage = (e: MessageEvent) => {
       if (e.data?.type === 'sync' && typeof e.data.step === 'number') {
         setPointer({ step: e.data.step, sub: 999 })
       }
     }
     window.addEventListener('message', onMessage)
     return () => window.removeEventListener('message', onMessage)
   }, [])
   ```

3. **Student CSS (student shell styles)** — Fix z-index on `.stu-board-hd-close` or adjust `.stu-task-area` stacking context so the collapse button is clickable.

4. **Commit hygiene** — Remove `solutions/business/recipe-book/` changes from the commit. Use `git reset HEAD~1 --soft`, then re-stage only `solutions/business/live-lesson/frontend/` files.

## Top 3 Priority Fixes

1. **[CRITICAL] Remove recipe-book changes from commit** — This frozen directory violation zeroes D1, D3, D4, D5 (total -72 points). Fixing this alone would raise the score from 6 to 78.
2. **[HIGH] Fix BoardPage.tsx pointer prop** — Add `pointer` state + postMessage listener. This would restore D2 from 6 to ~18-20, adding 12-14 points.
3. **[LOW] Fix student board drawer z-index** — The `stu-board-hd-close` button is not clickable. Worth 1 point.

## What's Working Well

1. **Teacher Surface** — Exceptionally rich with ambient band, live class matrix, speech lines, cue cards, priority-clustered student queue, and class view. This is production-grade teaching UX.
2. **Design Token System** — The `reading-tokens.css` architecture is clean: warm-neutral light theme in `:root`, board dark variant scoped via `[data-surface="board"]`, comprehensive spacing/type/radius/color scales. Zero hardcoded colors in page components.
