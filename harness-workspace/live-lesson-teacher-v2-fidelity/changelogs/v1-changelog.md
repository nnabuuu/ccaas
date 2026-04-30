# Changelog v1

## Changes

### Mock Data Deletion
- Deleted `DEMO_STUDENTS` constant (26 fake students)
- Deleted `MOCK_QUEUE` constant (7 mock questions)
- Deleted `MOCK_QUIZ_SUB`, `MOCK_QUIZ_SUB_PARTIAL`, `MOCK_MATCH_SUB`, `MOCK_MATRIX_SUB`, `MOCK_MATRIX_SUB_LOW`, `MOCK_STANCE_SUB` constants
- Removed all fallback logic that used `DEMO_STUDENTS` or `MOCK_QUEUE`
- All displayed data now 100% from `classroomState` prop

### Layout Rewrite — Step Card Structure (from teacher.html)
- **Band** (44px): mark + "课堂观察台" + mode-badge("观察模式") + self-badge("学生自主推进") + class-info + live-indicator with green pulse animation
- **Timeline** (40px): visual-only with prev/next buttons + track with step markers + LIVE label
- **Health Cards** (4-column grid): 最快进度, 中位进度, 卡点学生, AI 对话 — all computed from classroomState
- **Step Cards** (vertical stack): replaced swimlane rows with `.step-card` components matching teacher.html structure
  - Header: step number + name + type + badges (student count, AI rounds, alert)
  - Metrics strip: accuracy + AI people count
  - Student dots: colored by status (done/prog/stuck/reading) with AI pip indicator
  - Click step card → opens Step Detail Modal
- **Patterns**: 2×2 grid with empty state cards
- **Coaching**: collapsible panel with arrow rotation animation
- **Question Queue** (right column): grouped by step with sticky headers, high-frequency tags
- **Body**: CSS grid `1fr 340px` matching reference

### Student Modal with Journey Strip
- Header: avatar + student name + current step
- Journey Strip: 5 horizontal step nodes connected by lines
  - Status icons: ✓ (done/correct), △ (partial), ● (in-progress), ⚠ (stuck), ○ (future)
  - Attention badge with pulse animation for problematic steps
  - Future steps: dashed border + reduced opacity
  - Click node → switch step detail
- Left column: submission detail with result badges (✓/✗)
- Right column: AI chat history (if questions exist) or Class Compare bars (time, accuracy, AI rounds)

### Step Detail Modal
- Header: step number + name + description
- Stats grid (4 columns): student count, preset duration, AI rounds, AI people
- Quality bars: accuracy visualization
- Issues list: stuck students, low accuracy warnings
- Students-in-step: clickable dots → open student modal

### Empty State
- When classroomState is null or students.length === 0
- Shows "等待学生加入…" with session code prominently displayed

### CSS Rewrite
- Complete rewrite of teacher.css matching teacher.html CSS
- Uses design tokens from colors_and_type.css (--bg, --surface, --t1/t2/t3, semantic color pairs)
- New classes: `.band`, `.timeline`, `.step-card`, `.sc-*`, `.journey-*`, `.overlay`, `.modal`, `.overlay2`, `.modal2`, `.class-compare`, `.cc-*`
- Animations: `pulse-dot` for live indicator, `attn-pulse` for attention badges
- Removed old swimlane styles (`.swim-row`, `.swim-label`, `.swim-stats`, `.tch-*` prefix)

## Files Modified
- `frontend/src/components/teacher/TeacherShell.tsx` — complete rewrite
- `frontend/src/styles/teacher.css` — complete rewrite

## Verification
- `grep -c "DEMO_STUDENTS\|MOCK_QUEUE\|MOCK_.*_SUB" TeacherShell.tsx` returns 0
- `npx tsc --noEmit` passes
- `npx vite build` passes

## Known Issues
- Timeline is visual-only (no real time scrubbing), as specified
- Patterns section shows static empty state cards (no AI-generated insights yet)
- Coaching section shows generic placeholder (no lesson-specific cues)
- Class compare bars in student modal use available data; time comparison not available (no per-student time tracking in ClassroomState)
