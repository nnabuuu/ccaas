# recipe-book-recipe-picker

Replace AtPicker with a keyboard-first RecipePicker for the recipe-book frontend.

## Problem

AtPicker is a 645-line generic enterprise entity browser. For recipe-book's 3 flat recipes it's overkill: two mystery buttons per item, developer jargon, ~170 lines of brittle CSS overrides, and no keyboard navigation.

## Solution

A ~120-line RecipePicker component with:
- Flat recipe list via `useRecipes()` hook
- Full keyboard navigation: `↑↓` to navigate, `Enter` to select, `Escape` to close
- `ContextLayerClient.resolve()` for entity data injection (same LLM context as before)
- Design-token-only CSS (no hardcoded colors)

## Usage

```bash
# Full run (5 iterations max, $150 cost cap)
bash harness.sh

# Dry run — estimate cost
bash harness.sh --dry-run

# Resume from last completed iteration
bash harness.sh --resume

# Custom cost cap
bash harness.sh --max-cost=100
```

## Evaluation Dimensions

| Dimension | Weight | Focus |
|-----------|--------|-------|
| D1: Component Architecture | 20 | RecipePicker created, MentionPicker removed |
| D2: Keyboard Navigation | 20 | **Core dimension** — ↑↓ Enter Escape, active highlight, skip referenced |
| D3: Context Integration | 20 | autoRef, resolve, pills, @trigger, clearRefs |
| D4: Visual & CSS Quality | 20 | AtPicker CSS removed, design tokens, dark mode |
| D5: Build Quality | 20 | tsc, build, tests, frozen packages |

## Services

- CCAAS core: `:3001`
- Recipe backend: `:3002`
- Frontend: `:5291`

## Files

```
harness-workspace/recipe-book-recipe-picker/
├── SPEC.md             # Full specification
├── EVAL_CRITERIA.md    # Scoring rubric (5×20=100)
├── README.md           # This file
├── harness.sh          # Orchestration script
├── prompts/
│   ├── generator.md    # Code generation prompt
│   └── evaluator.md    # Evaluation prompt (Playwright-heavy)
├── progress.md         # Score history (auto-generated)
├── changelogs/         # Per-iteration changelogs
└── eval-reports/       # Per-iteration eval reports
```
