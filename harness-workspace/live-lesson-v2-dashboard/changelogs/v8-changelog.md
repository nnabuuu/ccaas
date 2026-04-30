# Changelog v8

## Focus
Fix D2 (Teacher Layout + Swimlane) and D5 (E2E Integration) — the two highest-impact dimensions from v7 eval (11/20 and 7/20 respectively).

## Root Cause Analysis
- D2.2 (1/3): Health cards showed 3 stat blocks (已提交/填写中/未开始) instead of 4 cards (最快进度/中位进度/卡点学生/AI对话) → **A (Missing)**: redesigned as 4-card grid with real labels
- D2.3 (2/4): No swimlane rows, only tab buttons → **A (Missing)**: added `.swimlane` with `.swim-row` elements containing `.sdot` student dots
- D2.4 (1/3): Student dots lacked color-coded status → **B (Wrong)**: dots now use `.done` (green), `.prog` (blue), `.stuck` (amber), `.reading` (lecture brown)
- D2.6 (0/3): No quality/accuracy bar elements → **A (Missing)**: added `StepDetailPanel` with `.sd-bar-row`, `.sd-bar-track`, `.sd-bar-seg` elements
- D3.6 (0/2): No patterns section → **A (Missing)**: added `.patterns` grid with empty state text
- D5.2 (0/3): Health cards showed static demo data → **B (Wrong)**: TeacherPage now uses `useTeacherStream` SSE hook, health cards bind to real `stepMetrics`
- D5.3 (0/3): StepDetail didn't update real-time → **B (Wrong)**: StepDetail quality bars now derive from live `stepMetrics[step].avgScore`

## Changes
- [D2 Fix] Rewrote TeacherShell.tsx — replaced hero/matrix/speech-line layout with:
  - 4-card `.health` grid (最快进度/中位进度/卡点学生/AI对话) bound to computed `stepMetrics` data
  - `.swimlane` component with 5 `.swim-row` elements, each containing `.sdot` student dots color-coded by status
  - `.swim-stats` with per-step count and accuracy percentage
  - `.swim-legend` showing color legend
- [D2 Fix] Added `StepDetailPanel` component with quality bars (`.sd-bar-row`, `.sd-bar-track`, `.sd-bar-seg.good/partial/wrong`) in the overview column
- [D3 Fix] Added `.patterns` section with 2-column empty state grid
- [D5 Fix] Connected TeacherPage to real-time data: `useSessionCreate` + `useTeacherStream` → passes `ClassroomState` to TeacherShell
- [D5 Fix] Health cards, swimlane dots, step detail panel all derive from live SSE state with demo fallback
- [D5 Fix] Fixed `useSessionCreate` hook: skip creation when `lessonId` is empty (prevents wasted first call)
- [CSS] Rewrote teacher.css with swimlane, health card, patterns, step-detail-panel, and modal styles from reference design
- [CSS] Added design token variables (--rd-green-dot, --rd-amber-dot, --rd-ai-dot, etc.)
- Preserved all working components: question queue with priority grouping, student detail modal, coaching toggle

## Files Modified
- `frontend/src/pages/TeacherPage.tsx` — added useSessionCreate + useTeacherStream hooks
- `frontend/src/components/teacher/TeacherShell.tsx` — major rewrite: swimlane, health cards, quality bars, patterns, real data binding
- `frontend/src/styles/teacher.css` — full rewrite: added swimlane/health/patterns/step-detail/modal CSS
- `frontend/src/hooks/useClassroom.ts` — fixed useSessionCreate guard for empty lessonId

## Validation
- `npx tsc --noEmit` — PASS
- `npx vite build` — PASS (404.19 kB JS + 79.89 kB CSS)
- `npx nest build` (backend) — PASS

## Known Issues
- Health card computation for "stuck" students uses 3-min threshold; may not match eval expectations if backend clock differs
- Demo fallback data is used when no real students have joined; evaluator needs active session for real-time testing
- Patterns section shows empty state placeholders (per spec: "empty state for V2")
