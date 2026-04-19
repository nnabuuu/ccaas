# v1 Changelog — Live Lesson Reading Surfaces

## Summary

Added 4 new page routes for the three-surface English reading classroom:
- `/board/:lessonId` — Projected blackboard (dark theme, progressive reveal)
- `/student/:lessonId` — Student task surface (text-primary layout)
- `/teacher/:lessonId` — Teacher console (Shneiderman VISM layout)
- `/demo/:lessonId` — Orchestrator with conductor bar + 3 iframe sync

All routes are additive — the existing `/lesson/:lessonId` math lesson route is untouched.

## Build Verification

- `npx tsc --noEmit` — **PASS** (0 errors)
- `npx vite build` — **PASS** (built in ~2s, 392 KB JS gzip 122 KB)

## Files Created

### Phase 1: Design Tokens
- `src/styles/reading-tokens.css` — CSS custom properties for warm neutral palette, spacing (4px grid), radii, type scale, font families (Plus Jakarta Sans + Caveat), board dark scoped variant via `[data-surface="board"]`

### Phase 2: TypeScript Types
- `src/types/reading.ts` — All interfaces: Paragraph, Article, ReadingStep, BlockKind (12 types), RevealPointer, BlockGeometry, BlockStyle, 12 block data types, BoardBlock, Column, BoardStep, BoardData, ReadingManifest

### Phase 3: Board Components
- `src/components/board/blocks/HeadingBlock.tsx` — Eyebrow + text + accent
- `src/components/board/blocks/QuoteBlock.tsx` — Paragraph label + highlight rendering
- `src/components/board/blocks/ChipRowBlock.tsx` — Horizontal tag chips
- `src/components/board/blocks/FlowBlock.tsx` — Arrow flow cards
- `src/components/board/blocks/MatrixBlock.tsx` — Table with tone rows
- `src/components/board/blocks/MindmapBlock.tsx` — Center + 3 branches grid
- `src/components/board/blocks/CompareBlock.tsx` — Asymmetric claim vs evidence
- `src/components/board/blocks/AnnotationBlock.tsx` — Icon + handwriting text
- `src/components/board/blocks/StudentWorkBlock.tsx` — Author + status + quoted text
- `src/components/board/blocks/FormulaBlock.tsx` — Expression + caption
- `src/components/board/blocks/ImageBlock.tsx` — Image with placeholder
- `src/components/board/blocks/DividerBlock.tsx` — HR with optional label
- `src/components/board/BoardBlock.tsx` — Router dispatch by block.kind
- `src/components/board/ColumnHeader.tsx` — Caveat column headers
- `src/components/board/BoardScrubber.tsx` — Timeline dots + prev/next/reset/all
- `src/components/board/BoardStage.tsx` — Main board renderer with progressive reveal
- `src/styles/board.css` — Full board CSS (~400 lines)

### Phase 4: Student Components
- `src/components/student/StudentShell.tsx` — Main layout: top bar + dock + board drawer + lower (text + task) + AI panel
- `src/components/student/StepTabs.tsx` — 5-step tab bar
- `src/components/student/TaskPanel.tsx` — Per-step task UIs (5 steps: schema, decode, matrix, critique, recap)
- `src/components/student/TextPanel.tsx` — Article text with paragraph focus + signal highlights
- `src/components/student/BoardDrawer.tsx` — Collapsible board flow preview
- `src/components/student/AiPanel.tsx` — AI assistant with preset chips, chat, feedback buttons
- `src/styles/student.css` — Student surface CSS

### Phase 5: Teacher Components
- `src/components/teacher/TeacherShell.tsx` — Full teacher console: ambient band, step rail, hero, matrix card, speech line, cue cards, overview sidebar with pulse/queue/student list
- `src/styles/teacher.css` — Teacher surface CSS

### Phase 6: Orchestrator Components
- `src/components/orchestrator/DemoShell.tsx` — Conductor bar + featured iframe + filmstrip + tweaks panel + keyboard shortcuts
- `src/hooks/useSurfaceSync.ts` — postMessage broadcast hook
- `src/styles/orchestrator.css` — Orchestrator surface CSS

### Phase 7: Pages & Routes
- `src/pages/BoardPage.tsx` — Board page with `data-surface="board"` attribute
- `src/pages/StudentPage.tsx` — Student page
- `src/pages/TeacherPage.tsx` — Teacher page
- `src/pages/DemoPage.tsx` — Demo orchestrator page
- `src/hooks/useReadingLesson.ts` — Fetches manifest.json, reads `?embed=1`
- `public/lessons/ideal-beauty-reading/manifest.json` — Copied from data dir

### Files Modified
- `src/App.tsx` — Added 4 new routes
- `src/main.tsx` — Added `import './styles/reading-tokens.css'`
- `src/pages/CourseSelectionPage.tsx` — Routes reading lessons to `/demo/:id`
- `public/lessons/index.json` — Added `lessonType: "reading"` to ideal-beauty entry

## Design Decisions

1. **CSS Custom Properties over Tailwind** for reading surfaces — follows the design system's token-based approach; board dark variant scoped via `[data-surface="board"]` attribute selector.
2. **Text-primary layout** for student surface — article text gets flex:1.4 (primary), tasks are the gutter (flex:1), matching Newsela/CommonLit reading-comprehension UX patterns.
3. **postMessage sync protocol** — `{type:'sync', step}` broadcast from demo to all iframes; each surface listens and updates its step state.
4. **Static manifest fetch** — Reading lesson manifests served from `/lessons/:id/manifest.json` via Vite's public directory (no backend dependency for v1).
5. **iframe isolation** for demo page — Each surface runs in its own iframe for true isolation, matching the original HTML design.

## Not Yet Implemented (deferred to v2+)

- Real-time WebSocket data for teacher queue/matrix
- Student work submission persistence
- AI tutor backend integration
- Timer functionality (currently static display)
- Auto-advance in orchestrator tweaks
- Student drill-down modal in teacher view
- Board progressive reveal sync with postMessage
