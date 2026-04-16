# v1 Changelog

## 改动文件
- `src/components/RecipePicker.tsx` — Fixed ARIA structure: moved `role="listbox"` to list container, added `role="combobox"` + `aria-expanded` + `aria-controls` to search input, added `type="button"` to item buttons, guarded `aria-activedescendant` against undefined id
- `src/lib/mention.ts` — Already correct: MentionPicker re-export removed, keeps MentionProvider/useMentionContext/MentionRef/MentionTrigger
- `src/pages/RecipeDetailPage.tsx` — Already correct: uses RecipePicker with baseUrl/contextEntity/autoRef
- `src/pages/ChatPage.tsx` — Already correct: uses RecipePicker with baseUrl only
- `src/index.css` — Already correct: AtPicker overrides removed, RecipePicker styles use design tokens

## 对应维度
- D1 (Keyboard Navigation): Full ArrowDown/Up cycling, Enter select, Escape close, activeIndex via selectableIndices skipping referenced items
- D2 (ARIA): Fixed role="listbox" placement to list container, added combobox pattern to input, aria-selected on options, aria-activedescendant on input
- D3 (Visual Design): CSS uses design tokens (var(--surface), var(--border), etc.), .active/.referenced states styled
- D4 (AutoRef): Ref guard prevents duplicate resolution, fallback on resolve failure
- D5 (Integration): RecipeDetailPage and ChatPage both use RecipePicker, MentionPicker fully removed

## 本轮重点
v1 baseline: RecipePicker with keyboard-first navigation, correct ARIA combobox/listbox pattern, and clean CSS using design tokens.
