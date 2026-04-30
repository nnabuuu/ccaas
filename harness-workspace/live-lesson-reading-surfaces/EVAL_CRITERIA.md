# Eval Criteria — live-lesson-reading-surfaces

## 评分体系

5 个维度 x 20 分 = 100 分。每个 Check 有明确的检测方法（Playwright / grep / bash）。

---

### D1: Design System + Build (Weight: 20/100)

验证设计系统迁移、token 使用、构建通过。

| Check | Points | Detection |
|-------|--------|-----------|
| `tsc --noEmit` passes (0 errors) | 3 | `cd solutions/business/live-lesson/frontend && npx tsc --noEmit` |
| `vite build` succeeds | 3 | `cd solutions/business/live-lesson/frontend && npx vite build` |
| Light theme tokens present (`--bg: #f4f3ef`) in new CSS | 2 | grep reading-tokens.css or new CSS for `#f4f3ef` |
| Plus Jakarta Sans font in new pages | 2 | grep for `Plus Jakarta Sans` in new CSS/components |
| Spacing tokens (`--sp-*`) defined and used in new components | 2 | grep for `--sp-` in CSS files (defined) + `.tsx` files (used) |
| Type scale tokens (`--fs-*`) defined and used | 2 | grep for `--fs-` in CSS + components |
| Radius tokens (`--r-*`) defined and used | 2 | grep for `--r-` in CSS + components |
| No dark theme remnants (`#0a0a0b`) in new pages | 2 | grep new page files for `#0a0a0b` or old dark colors — should find 0 |
| Board dark scoped correctly via `[data-surface="board"]` | 2 | grep for `data-surface` in board components |

**Penalty P1**: If `packages/` or `solutions/business/edu-platform/` or `solutions/business/recipe-book/` has new changes → D1 = 0

---

### D2: Board Surface (Weight: 20/100)

验证投屏黑板面：block 渲染、progressive reveal、scrubber、postMessage。

| Check | Points | Detection |
|-------|--------|-----------|
| `/board/ideal-beauty-reading` route loads and renders board | 3 | Playwright navigate + snapshot |
| At least 8 of 10 primary block types render (heading, quote, chip-row, flow, matrix, mindmap, compare, annotation, student-work, formula) | 4 | Playwright snapshot board at full reveal, check for block variety |
| Progressive reveal works (blocks appear incrementally) | 3 | Playwright: scrubber "Next" click → new blocks appear |
| Scrubber navigation visible and functional (step dots, prev/next) | 2 | Playwright snapshot scrubber bar, click controls |
| Columns with Caveat handwriting headers | 2 | grep board components for `Caveat` or `--font-hand` |
| Tone system applies (accent, cool, warm, muted, success colors on blocks) | 2 | Playwright evaluate: check DOM for tone-related classes or styles |
| postMessage sync: board responds to `{type:'sync', step:N}` | 2 | Playwright evaluate: postMessage to iframe, verify board updates |
| Board uses dark theme scoped via `data-surface="board"` | 2 | Playwright evaluate: check computed background color is dark |

**Penalty P2**: If `solutions/business/live-lesson/mcp-server/src/` or `solutions/business/live-lesson/backend/src/` has new changes → D2 = 0

---

### D3: Student Surface (Weight: 20/100)

验证学生端：step tabs、任务面板、课文面板、AI 面板。

| Check | Points | Detection |
|-------|--------|-----------|
| `/student/ideal-beauty-reading` route loads | 3 | Playwright navigate + snapshot |
| Step tabs visible (5 steps labeled) | 2 | Playwright snapshot: verify 5 step tabs with labels |
| Task panel changes when step tab clicked | 3 | Playwright: click step 2 tab, verify task content changes |
| Text panel shows article paragraphs (¶1-8) | 3 | Playwright snapshot: verify paragraph text visible |
| Board preview/drawer (collapsible structure map) | 2 | Playwright: find board drawer toggle, verify it opens/closes |
| AI panel toggle (collapsible) | 2 | Playwright: find AI panel toggle, verify it opens/closes |
| Step 3 shows matrix input table | 2 | Playwright: navigate to step 3, verify matrix/table UI |
| postMessage sync: student responds to `{type:'sync', step:N}` | 3 | Playwright evaluate: postMessage to iframe, verify step changes |

**Penalty P3**: If frozen dirs modified → D3 = 0

---

### D4: Teacher Surface (Weight: 20/100)

验证教师控制台：ambient band、step rail、hero、矩阵、发言提词。

| Check | Points | Detection |
|-------|--------|-----------|
| `/teacher/ideal-beauty-reading` route loads | 3 | Playwright navigate + snapshot |
| Ambient band visible (lesson title, class info, step counter) | 2 | Playwright snapshot: verify top band with lesson info |
| Step rail with 5 step buttons | 2 | Playwright snapshot: verify 5 step buttons |
| Hero section shows current step description | 3 | Playwright snapshot: verify hero text changes per step |
| Matrix card (class progress or data table) | 2 | Playwright snapshot: verify matrix/table component |
| Speech line / say-out-loud card | 2 | Playwright snapshot: verify speech/prompt card |
| Cue cards (teaching prompts) | 2 | Playwright snapshot: verify cue card elements |
| Overview sidebar or student queue section | 2 | Playwright snapshot: verify sidebar with student info |
| postMessage sync: teacher responds to `{type:'sync', step:N}` | 2 | Playwright evaluate: postMessage to iframe, verify updates |

**Penalty P4**: If frozen dirs modified → D4 = 0

---

### D5: Orchestrator + Sync (Weight: 20/100)

验证指挥官编排器：conductor bar、iframe 加载、postMessage 同步。

| Check | Points | Detection |
|-------|--------|-----------|
| `/demo/ideal-beauty-reading` route loads | 3 | Playwright navigate + snapshot |
| Conductor bar with step rail (5 steps) | 2 | Playwright snapshot: verify conductor bar with step controls |
| 3 iframes load (board + student + teacher) | 4 | Playwright evaluate: count iframes, verify 3 present |
| postMessage broadcast syncs all surfaces on step change | 3 | Playwright: click next step in conductor, verify all iframes updated |
| Keyboard shortcuts work (arrow keys for step navigation) | 2 | Playwright: press ArrowRight key, verify step advances |
| Layout toggle (featured+filmstrip vs triptych) | 2 | Playwright: find layout toggle, verify it changes layout |
| Featured surface switching (focus different iframe) | 2 | Playwright: find surface switch control, verify featured changes |
| Legacy route `/lesson/math-linear-eq-intro` still works | 2 | Playwright: navigate to legacy route, verify page loads |

**Penalty P5**: If frozen dirs modified → D5 = 0

---

## Penalties

| ID | Trigger | Impact |
|----|---------|--------|
| P1 | `packages/` or `solutions/business/edu-platform/` or `solutions/business/recipe-book/` has new changes | D1 = 0 |
| P2 | `solutions/business/live-lesson/mcp-server/src/` or `solutions/business/live-lesson/backend/src/` has new changes | D2 = 0 |
| P3 | Any frozen dir has new changes | D3 = 0 |
| P4 | Any frozen dir has new changes | D4 = 0 |
| P5 | Any frozen dir has new changes | D5 = 0 |

Frozen directories:
- `solutions/business/live-lesson/mcp-server/src/`
- `solutions/business/live-lesson/backend/src/`
- `packages/`
- `solutions/business/edu-platform/`
- `solutions/business/recipe-book/`

---

## Score Format

评分报告必须以如下格式结尾（用于 harness.sh 正则提取）：

```
总分: XX/100
```
