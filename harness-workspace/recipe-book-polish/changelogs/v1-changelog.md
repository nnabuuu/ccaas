# v1 Changelog

## 改动文件
- `src/index.css` — Added 211 lines: Dark mode input fix, AtPicker theme overrides (container/items/text/borders/RefPill), dark mode variants for all AtPicker rules
- `src/pages/RecipeDetailPage.tsx` — Ingredient amount color --t3→--t2, loading/empty state --t3→--t2, h2 heading 18px→17px with lineHeight 1.3, table border-separate + rounded corners + alternating row bg + better padding, ingredient list unified border container with dividers, callout padding 12px→14px
- `src/pages/RecipeListPage.tsx` — Loading/empty state --t3→--t2, recipe-tag-text --t3→--t2, card-meta --t3→--t2 + 11px→12px, draft badge #fff→var(--surface) + --t3→--t2

## 对应维度
- D1 (AtPicker Warm-Palette): Container bg→var(--surface), border→var(--border), shadow→var(--menu-shadow). Accent #1a73e8→var(--blue). Section headers/subtitles→var(--t3). Hover/focus→var(--surface2). Context entity→var(--blue-bg). RefPill→var(--blue-bg)/var(--blue). Drill buttons→var(--blue).
- D2 (Text Contrast): All ingredient amounts, loading states, empty states upgraded from --t3 to --t2 (2.9:1→5.2:1 ratio). Card meta text upgraded. Difficulty tag text upgraded. Draft badge text upgraded.
- D3 (Table & Component): Tables now use border-separate, rounded corners (var(--radius-md)), alternating row backgrounds (var(--surface) on even), better th background (var(--surface2)), increased padding (10px 14px). Ingredient list: unified container border with radius, separator lines between items. Callout padding increased (14px 18px).
- D4 (Dark Mode): Composer textarea gets explicit color: var(--t1) !important. All form inputs get color: var(--t1) in dark mode. Placeholder gets color: var(--t3). Search input gets dark-mode-safe background and color. All AtPicker overrides duplicated in @media (prefers-color-scheme: dark) block.
- D5 (Typography): H2 sections → 17px/600/1.3 (was 18px). Card meta font-size → 12px (was 11px). Ingredient amount font-size → 13px (was 12px). Body text line-height verified at 1.7.

## 本轮重点
First pass covering all 5 eval dimensions: dark mode input readability (highest priority), AtPicker warm-palette alignment, WCAG-compliant text contrast upgrades, table/ingredient polish, and typography scale consistency. Zero new hex colors — all values use CSS variables from design-tokens.css.
