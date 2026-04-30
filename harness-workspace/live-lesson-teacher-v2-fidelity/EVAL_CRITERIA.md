# Evaluation Criteria — live-lesson-teacher-v2-fidelity

**Total: 100 points** across 5 dimensions (20 each).

---

## Scoring Anchors

| Score | Meaning |
|-------|---------|
| 5/5 (20/20) | All checks pass, layout matches reference, data is real |
| 3/5 (12/20) | Core structure present but some checks fail or details missing |
| 1/5 (4/20) | Dimension attempted but mostly broken or placeholder |

---

## D1: Layout Fidelity (20/100)

| # | Check | Pts | Detection |
|---|-------|-----|-----------|
| 1 | Band rendered: mark + title + mode badge + self badge | 3 | Playwright snapshot: `.band` or `[class*=band]` visible with "课堂观察台" text |
| 2 | Band live indicator: green pulse dot + "实时同步中" text | 2 | Playwright: live indicator element with green dot + text |
| 3 | Timeline component rendered (visual only OK) | 3 | Playwright: `.timeline` or `[class*=timeline]` visible with track/markers |
| 4 | Health Cards 4-grid rendered with correct labels | 4 | Playwright: 4 health card elements with labels: 最快进度/中位进度/卡点学生/AI对话 |
| 5 | Body grid: left focus column + right overview (≈340px) | 4 | Playwright: two-column layout, right column ≈330-350px width |
| 6 | Step Cards structure (NOT swim-row) with sc-header + sc-metrics + sc-dots | 4 | Playwright: `.step-card` or `[class*=step-card]` elements with header/metrics/dots sub-elements |

**Detection flow**: Navigate to teacher URL → snapshot → verify structural elements.

---

## D2: Step Cards + Data Binding (20/100)

| # | Check | Pts | Detection |
|---|-------|-----|-----------|
| 1 | 5 step cards rendered (one per task) | 3 | Playwright: 5 step-card elements |
| 2 | Each card has header: step number + name + type badge | 3 | Playwright: each card has sn (01-05) + name text + type label (quiz/match/matrix/stance/order) |
| 3 | Metrics strip: accuracy bar + AI rounds + student count | 3 | Playwright: bar element with width based on data + metric text |
| 4 | Student dots with color coding (done=green, prog=blue, stuck=amber, grey=not-reached) | 3 | Playwright: dot elements visible after students join, color varies by status |
| 5 | Click step card → right column step detail updates | 4 | Playwright: click step card → step detail panel shows corresponding step data |
| 6 | Step detail shows quality bars with real avgScore data | 4 | Playwright: quality/accuracy bars visible with non-zero width when submissions exist |

**Detection flow**: Create test data via curl → navigate teacher page → verify step cards + click interactions.

---

## D3: Student Modal + Journey (20/100)

| # | Check | Pts | Detection |
|---|-------|-----|-----------|
| 1 | Click student dot → modal opens with student name | 3 | Playwright: click dot → modal/overlay visible with matching student name |
| 2 | Journey Strip: 5-step timeline in modal header | 4 | Playwright: 5 journey nodes visible in modal, each with step indicator |
| 3 | Journey nodes show status: ✓完成/△部分正确/●进行中/⚠卡住/○未到达 | 3 | Playwright: node status indicators vary based on student's progress |
| 4 | Click journey node → switches modal content to that step | 2 | Playwright: click different journey node → modal body content changes |
| 5 | Left column: submission detail (quiz ✓/✗, matrix table, match pairs) | 4 | Playwright: structured data display showing answers + correctness marks |
| 6 | Right column: Class Compare bars (time, accuracy, AI rounds) | 4 | Playwright: 3 comparison bars showing student vs class average values |

**Detection flow**: Submit test data → open modal → verify journey + detail + compare.

---

## D4: Real Data Only — Zero Mock (20/100)

| # | Check | Pts | Detection |
|---|-------|-----|-----------|
| 1 | `grep -c "DEMO_STUDENTS\|MOCK_QUEUE\|MOCK_.*_SUB" TeacherShell.tsx` = 0 | 5 | Bash: grep returns 0 matches |
| 2 | No other hardcoded student arrays (grep for `const.*\[.*name.*陈\|王\|张\|李`) | 3 | Bash: no hardcoded Chinese name arrays in TeacherShell.tsx or sub-components |
| 3 | Empty state shown when no students (contains session code + waiting message) | 4 | Playwright: load teacher page with fresh session → "等待学生加入" visible + session code displayed |
| 4 | After curl join 3 students → health cards + dots render correctly | 4 | Playwright: after student join, health cards show non-zero, dots appear |
| 5 | After curl submit → scores in modal display correctly | 4 | Playwright: after submit, open modal → score/submission data visible |

**Detection flow**:
1. Fresh session → verify empty state
2. curl join 3 students → verify live data
3. curl submit answers → verify score display
4. curl ai/ask → verify question queue

---

## D5: Polish + Build (20/100)

| # | Check | Pts | Detection |
|---|-------|-----|-----------|
| 1 | `tsc --noEmit` passes | 3 | `cd frontend && npx tsc --noEmit` exits 0 |
| 2 | `vite build` passes | 3 | `cd frontend && npx vite build` exits 0 |
| 3 | Patterns section rendered (empty state OK: "暂无观察模式") | 2 | Playwright: patterns area visible with placeholder text |
| 4 | Coaching section collapsible (toggle expand/collapse) | 3 | Playwright: click coaching toggle → body height changes (expand/collapse) |
| 5 | Question queue renders after ai/ask curl (grouped by step, priority) | 3 | Playwright: queue section shows question row with student name + text after ai/ask |
| 6 | CSS tokens match reference (--bg, --surface, --t1, --border, etc.) | 3 | Bash: grep teacher.css for var(--bg), var(--surface), var(--t1) — at least 5 token usages |
| 7 | No frozen files modified | 3 | Bash: `git diff --name-only` shows no frozen files changed |

---

## Penalties

| ID | Trigger | Impact |
|----|---------|--------|
| P1 | Any file in `packages/` modified | Total = 0 |
| P2 | Any file in `backend/src/` modified | Total = 0 |
| P3 | Any file in `frontend/src/hooks/` modified | D2 + D4 = 0 |
| P4 | Any file in `frontend/src/pages/` modified | D1 = 0 |
| P5 | Any file in `frontend/src/components/student/` modified | D5 = 0 |

---

## What's Working Well

List dimensions or checks that scored full marks. Tell the generator:
> "These dimensions are solid — do NOT touch them unless absolutely necessary."

---

## Score Format

```
## Score Summary

| Dimension | Score |
|-----------|-------|
| D1: Layout Fidelity | X/20 |
| D2: Step Cards + Data Binding | X/20 |
| D3: Student Modal + Journey | X/20 |
| D4: Real Data Only — Zero Mock | X/20 |
| D5: Polish + Build | X/20 |
| **Penalties** | -X |
| **Total** | **X/100** |

总分: X/100
```

The last line `总分: X/100` is machine-parsed by the harness script. It MUST appear exactly in this format.
