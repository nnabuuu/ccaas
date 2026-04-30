# recipe-book-multi-select

Add multi-select (Add & Stay) to the RecipePicker using Space key, inspired by the @ Picker reference design.

## Problem

RecipePicker v1 is single-select: Enter picks one recipe and closes. To reference multiple recipes for comparison (e.g., "compare 提拉米苏 and 番茄炒蛋"), the user must type `@`, select, `@` again, select again. The reference design identifies this as "不必反复触发 @".

## Solution

Add a staging mechanism to RecipePicker:
- **Space** = Add & Stay (toggle item in/out of staging, picker stays open)
- **Enter** = Commit all staged + close
- **Escape** = Commit all staged + close (never discard selections)
- Staging area with pills shown within picker dropdown
- Flash-green animation on Space-add
- All CSS uses design tokens

## Reference Design

The @ Picker reference (`solutions/business/recipe-book/.harness-workspace/use-at-picker-reference/reference/`) defines a rich "三操作模型":
- **Select & Close** (Enter) — shopping cart "checkout"
- **Add & Stay** (Space) — shopping cart "add to cart"
- **Drill In** (→) — not applicable for flat recipes

This harness implements the first two operations. Drill In is omitted since recipe-book has flat (non-hierarchical) recipes.

## Usage

```bash
# Full run (5 iterations max, $150 cost cap)
bash harness-workspace/recipe-book-multi-select/harness.sh

# Dry run — estimate cost
bash harness-workspace/recipe-book-multi-select/harness.sh --dry-run

# Resume from last completed iteration
bash harness-workspace/recipe-book-multi-select/harness.sh --resume

# Custom cost cap
bash harness-workspace/recipe-book-multi-select/harness.sh --max-cost=100
```

## Evaluation Dimensions

| Dimension | Weight | Focus |
|-----------|--------|-------|
| D1: Multi-Select Core Flow | 25 | Space stages, Enter/Esc commits, toggle, reset |
| D2: Staging Area UI | 20 | Pills in picker, × remove, count, design tokens |
| D3: Keyboard & Interaction | 20 | Space blocks typing, nav works, flash animation |
| D4: CSS & Design Token | 15 | No hex, tokens, dark mode, @keyframes |
| D5: Build & Regression | 20 | tsc, build, tests, frozen packages, page function |

## Services

- CCAAS core: `:3001`
- Recipe backend: `:3002`
- Frontend: `:5291`

## Files

```
harness-workspace/recipe-book-multi-select/
├── SPEC.md             # Full specification
├── EVAL_CRITERIA.md    # Scoring rubric (5 dimensions, 100 pts)
├── README.md           # This file
├── harness.sh          # Orchestration script
├── prompts/
│   ├── generator.md    # Code generation prompt
│   └── evaluator.md    # Evaluation prompt (Playwright-heavy)
├── progress.md         # Score history (auto-generated)
├── changelogs/         # Per-iteration changelogs
└── eval-reports/       # Per-iteration eval reports
```

## Key Design Decisions

1. **Space blocks typing in search** — Chinese recipe names don't use spaces. Acceptable trade-off for consistent Space = toggle behavior.
2. **Esc commits staging** — From reference: "Esc 永不丢弃已选". User's work is never lost.
3. **Staging is local** — Lives in RecipePicker state, not MentionContext. Only committed refs go through `addRef()`.
4. **Resolve at commit time** — Staging stores just `{id, title}`. `ContextLayerClient.resolve()` called in parallel at Enter/Esc, keeping staging lightweight.
5. **Mouse click = single-select** — Clicking a list item still uses the original single-select path (select + close). Space multi-select is keyboard-only.
