# Harness Task: recipe-book-at-picker

Integrate the @Picker (AtPicker) system into the recipe-book solution so users can `@` reference recipes and their sections in chat.

## Scope

- **Backend**: Extend recipe-book referenceable to expose `recipe_section` entity type with parent-child hierarchy
- **Frontend**: Integrate `MentionPicker` from chat-interface into split view and chat page

## Services

| Service | Port | Source |
|---------|------|--------|
| CCAAS Core | 3001 | packages/backend |
| Recipe Backend | 3002 | solutions/business/recipe-book/backend |
| Frontend | 5291 | solutions/business/recipe-book/frontend |

## Prerequisites

```bash
# From repo root
npm install
npm run build
```

## Usage

```bash
# Full run
bash harness-workspace/recipe-book-at-picker/harness.sh

# Dry run (estimate cost)
bash harness-workspace/recipe-book-at-picker/harness.sh --dry-run

# Resume from last iteration
bash harness-workspace/recipe-book-at-picker/harness.sh --resume

# Set cost cap
bash harness-workspace/recipe-book-at-picker/harness.sh --max-cost=150
```

## Evaluation

5 dimensions x 20 points = 100 total:
- D1: Backend Entity Hierarchy (recipe_section registration, relations, browse/search/resolve)
- D2: Frontend @Picker Integration (MentionPicker with contextEntity + autoRef, pinned "当前上下文")
- D3: Context Injection (sessionContext, autoRef auto-pill, ref pills, @ trigger)
- D4: UX Quality (context-aware picker home, search, breadcrumb, drill-down, multi-ref)
- D5: Build Quality (tsc, vite build, backend tests, frozen constraints)

Target: 90/100. Max 6 iterations.

## Post-Run Checklist

1. `cat harness-workspace/recipe-book-at-picker/progress.md`
2. `cd solutions/business/recipe-book/backend && npx tsc --noEmit`
3. `cd solutions/business/recipe-book/backend && npx vitest run`
4. `cd solutions/business/recipe-book/frontend && npx tsc --noEmit`
5. `cd solutions/business/recipe-book/frontend && npx vite build`
