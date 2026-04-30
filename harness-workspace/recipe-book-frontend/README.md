# recipe-book-frontend Harness Task

Build a React frontend for the recipe-book solution with dual-pane layout: recipe management (list + detail + block viewer) and AI chat integration via ChatInterface.

## Prerequisites

- Node.js 18+
- `npm install` at repo root
- `npm run build` to build shared packages
- CCAAS core backend buildable (`packages/backend/`)
- Recipe-book backend buildable (`solutions/business/recipe-book/backend/`)

## Run

```bash
# Dry run (no agent calls, just cost estimate)
cd harness-workspace/recipe-book-frontend && bash harness.sh --dry-run

# Full run
bash harness.sh

# Resume from last completed iteration
bash harness.sh --resume

# Custom cost cap
bash harness.sh --max-cost=100
```

## Dimensions (5 × 20 = 100)

| Dimension | Weight | Focus |
|-----------|--------|-------|
| D1 | 20 | App Shell + Navigation (Sidebar, TopNav, routes) |
| D2 | 20 | Recipe List Page (cards, search, status badges) |
| D3 | 20 | Recipe Detail + Block Viewer (7 block types) |
| D4 | 20 | Chat Integration (ChatInterface + ChatSidebar) |
| D5 | 20 | Build Quality + Design (tsc, build, tokens, font) |

## Services

| Service | Port | Purpose |
|---------|------|---------|
| CCAAS Core | :3001 | Chat/session API for ChatInterface |
| Recipe Backend | :3002 | Recipe CRUD + context-layer API |
| Frontend Dev | :5291 | Vite dev server |

## Post-Run Checklist

1. `cat harness-workspace/recipe-book-frontend/progress.md`
2. `cd solutions/business/recipe-book/frontend && npx tsc --noEmit`
3. `cd solutions/business/recipe-book/frontend && npx vite build`
4. `cd solutions/business/recipe-book/backend && npx vitest run`

## Files

```
harness-workspace/recipe-book-frontend/
├── EVAL_CRITERIA.md          # 5-dimension scoring rubric
├── SPEC.md                   # Design spec + constraints
├── README.md                 # This file
├── progress.md               # Score tracking (auto-populated)
├── harness.sh                # 3-service lifecycle + iteration loop
├── prompts/
│   ├── generator.md          # 7-phase implementation guide
│   └── evaluator.md          # Playwright-based UI verification
├── eval-reports/             # v{N}-eval.md files (auto-generated)
└── changelogs/               # v{N}-changelog.md files (auto-generated)
```
