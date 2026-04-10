# Article Analyzer UI/UX Redesign

A harness-driven UI/UX overhaul of the Article Analyzer frontend, achieving 100/100 in 4 iterations (~62 minutes).

## Problem

The Article Analyzer frontend was functionally complete (create article, start run, iterative write/analyze, score/exit) but had poor UX:

- No loading states, error handling, or empty state guidance
- No responsive design or dark mode
- Crude data visualizations (no legends, tooltips, or animations)
- No form validation or interaction polish

## Approach

We used the [Harness Engineering](../guide/harness-engineering.md) pattern with Stitch-generated design prototypes as visual targets.

### Design System

Before running the harness, we created a design system in Stitch:

- **Font**: Inter
- **Primary Color**: `#2563eb` (blue-600)
- **Roundness**: ROUND_EIGHT
- **Color Variant**: TONAL_SPOT
- **Mode**: Light (with full dark mode support)

8 screens were generated as prototypes covering empty states, data views, forms, mobile, and dark mode.

### Evaluation Dimensions

| # | Dimension | Weight | Focus |
|---|-----------|--------|-------|
| D1 | Visual Hierarchy + Layout | 20/100 | Design tokens, app shell, breadcrumb, typography |
| D2 | Loading/Error/Empty States | 15/100 | Skeleton, ErrorState, EmptyState across all pages |
| D3 | Data Visualization | 20/100 | Chart legends, tooltips, table sorting, word-level diff |
| D4 | Real-time Feedback | 20/100 | Hero score card, progress bar, pipeline indicator, SSE status |
| D5 | Forms + Interaction | 10/100 | Validation, word count, filter chips |
| D6 | Responsive + Dark Mode | 15/100 | Dark mode toggle, mobile breakpoints, CSS variables |

**Pre-gate**: `npx tsc --noEmit` must pass (0 score on failure).

### Frozen Constraints

- Entire backend (`article-analyzer/backend/`) frozen
- All core packages (`packages/`) frozen
- `api.ts` existing exports immutable (new utility types allowed)

## Results

| Version | Score | Duration | Focus |
|---------|-------|----------|-------|
| v1 | 63/100 | ~13 min | Infrastructure: design tokens, app shell, shared UI components, state handling |
| v2 | 75/100 | ~13 min | Data visualization: chart enhancements, table sorting, word-level diff |
| v3 | 94/100 | ~13 min | Real-time feedback: hero score, progress bar, pipeline indicator, tabs |
| v4 | 100/100 | ~16 min | Forms polish, breadcrumb integration, dark mode completeness |

**Total**: 4 iterations, ~62 minutes, 100/100 final score.

## What Was Built

### New Files (17)

- **UI Components**: `Card`, `StatusBadge`, `Skeleton`, `EmptyState`, `ErrorState`, `SectionHeader`, `Breadcrumb`, `FilterChips`, `ProgressBar`, `Tabs`
- **Feature Components**: `PipelineStep`, `CompletionSummary`
- **Infrastructure**: `ThemeContext`, `useTheme`, `useFetch`, `formatters`, `diff`

### Modified Files (12)

- `tailwind.config.js` — Custom theme with primary color scale and dark mode
- `index.css` — CSS custom properties and animation keyframes
- `App.tsx` — App shell with navbar, breadcrumb, and dark mode toggle
- All 3 pages — Complete redesign with state handling
- All 6 existing components — Enhanced with legends, tooltips, animations

### Key Technical Decisions

1. **LCS-based word-level diff**: Custom algorithm in `utils/diff.ts` for the version comparison view
2. **CSS custom properties**: Design tokens as CSS variables for runtime theme switching
3. **Segmented progress bar**: Visual progress indicator with per-iteration segments
4. **SSE connection status**: Green/yellow/red indicator with automatic polling fallback

## Post-Harness Code Review

After the harness completed, a code review identified 4 HIGH and 9 MEDIUM issues. All were fixed:

- **H-1**: Removed dead `DimensionBreakdown.tsx` component
- **H-2**: Consolidated duplicated `scoreColor`/`barColor` into `utils/colors.ts`
- **H-3**: Fixed `useFetch` race condition with cleanup pattern
- **H-4**: Added error display for swallowed API errors
- **M-2**: Added `status` prop to `ProgressBar` for completed/failed states
- **M-5/M-6**: Added `useMemo` for expensive diff computation
- **M-9**: Added conditional red/green styling to `CompletionSummary`

## Lessons Learned

1. **Stitch prototypes accelerate convergence**: Having visual targets reduced iterations from the budgeted 15 to just 4.
2. **Pre-gate is essential**: The `tsc --noEmit` gate prevents the evaluator from wasting time on broken builds.
3. **Phase strategy works**: The generator prompt specified infrastructure → visualization → interaction → polish, which produced steady score progression.
4. **Code review after harness**: AI-generated code benefits from a structured review pass to catch patterns like dead code and duplicated utilities.

## Workspace

Full harness workspace: `harness-workspace/article-analyzer-ui-redesign/`
