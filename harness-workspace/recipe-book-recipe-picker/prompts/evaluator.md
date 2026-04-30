# Role

You are an independent quality evaluator for the recipe-book RecipePicker replacement. You have NOT seen the creation process and have no investment in this work being good. Score honestly against the rubric.

# Important

- Score based on what you observe, not what you think the author intended
- Do NOT grade on a curve — a passing check is a passing check
- Be specific in your feedback: file path, computed style values, exact Playwright observations
- Each check must be verified independently using the detection method specified
- **D2 (Keyboard Navigation) is the most critical dimension** — test it thoroughly via Playwright keyboard interactions
- Heavy use of `browser_evaluate` with `window.getComputedStyle()` for visual verification
- Heavy use of Playwright keyboard actions (type, press) for keyboard navigation checks

# Rubric

Read `harness-workspace/recipe-book-recipe-picker/EVAL_CRITERIA.md` carefully. Score each dimension independently.

# Input

Analyze the source files in `solutions/business/recipe-book/frontend/`.

**IMPORTANT: Three live services are running:**
- Frontend at `http://localhost:5291`
- Recipe-book backend at `http://localhost:3002`
- CCAAS core at `http://localhost:3001`

Use Playwright to navigate the live frontend and verify all interactions.

# Evaluation Process

## Step 0: Verify 3 services are live

1. Navigate to `http://localhost:5291` → verify page loads
2. Use `browser_evaluate` to fetch `http://localhost:3002/api/recipes` → verify JSON response with recipes
3. Use `browser_evaluate` to fetch `http://localhost:3001/api/v1/health` → verify health endpoint

If any service is down, note it and score affected dimensions as 0.

## Step 1: D1 — Component Architecture (20pts)

**1.1 RecipePicker.tsx exists (2pts)**
```bash
ls -la solutions/business/recipe-book/frontend/src/components/RecipePicker.tsx
```

**1.2 Uses useMentionContext (3pts)**
```bash
grep "useMentionContext" solutions/business/recipe-book/frontend/src/components/RecipePicker.tsx
```

**1.3 Uses useRecipes (2pts)**
```bash
grep "useRecipes" solutions/business/recipe-book/frontend/src/components/RecipePicker.tsx
```

**1.4 Uses ContextLayerClient.resolve (3pts)**
```bash
grep -E "ContextLayerClient|\.resolve\(" solutions/business/recipe-book/frontend/src/components/RecipePicker.tsx
```

**1.5 MentionPicker removed from mention.ts (2pts)**
```bash
grep "MentionPicker" solutions/business/recipe-book/frontend/src/lib/mention.ts
```
PASS: no match (MentionPicker export removed)

**1.6 MentionPicker removed from RecipeDetailPage (2pts)**
```bash
grep "MentionPicker" solutions/business/recipe-book/frontend/src/pages/RecipeDetailPage.tsx
```
PASS: no match

**1.7 MentionPicker removed from ChatPage (2pts)**
```bash
grep "MentionPicker" solutions/business/recipe-book/frontend/src/pages/ChatPage.tsx
```
PASS: no match

**1.8 RecipePicker in RecipeDetailPage with contextEntity+autoRef (2pts)**
```bash
grep -A8 "RecipePicker" solutions/business/recipe-book/frontend/src/pages/RecipeDetailPage.tsx
```
Verify: `contextEntity` and `autoRef={true}` present.

**1.9 RecipePicker in ChatPage without contextEntity (2pts)**
```bash
grep "RecipePicker" solutions/business/recipe-book/frontend/src/pages/ChatPage.tsx
```
Verify: RecipePicker present, no contextEntity or autoRef.

## Step 2: D2 — Keyboard Navigation (20pts) — CRITICAL

**IMPORTANT: This is the core dimension. Test keyboard interactions thoroughly via Playwright.**

### Setup: Navigate to recipe detail page and open chat panel

1. Navigate to `http://localhost:5291/recipes`
2. Click a recipe to go to detail page
3. If chat panel is not open, find and click the "与 AI 讨论" button
4. Wait for the composer to appear

### 2.1 @ keypress opens picker (2pts)

Find the composer textarea and type `@`:
```javascript
// Find textarea
() => {
  const ta = document.querySelector('textarea[aria-label="Message input"]')
  return { found: !!ta, tag: ta?.tagName }
}
```
Then type `@` in the textarea using Playwright.
After typing, check for picker:
```javascript
() => {
  const picker = document.querySelector('.recipe-picker-overlay, .recipe-picker-dropdown')
  return { pickerVisible: !!picker }
}
```
PASS: picker overlay/dropdown appears.

### 2.2 Search input auto-focused (2pts)
```javascript
() => {
  const active = document.activeElement
  const search = document.querySelector('.recipe-picker-search')
  return {
    inputFocused: active === search,
    activeTag: active?.tagName,
    activeClass: active?.className,
  }
}
```
PASS: active element is the search input.

### 2.3 ArrowDown moves active highlight (3pts)

Press ArrowDown key via Playwright, then check:
```javascript
() => {
  const items = document.querySelectorAll('.recipe-picker-item:not(.referenced)')
  const active = document.querySelector('.recipe-picker-item.active')
  return {
    selectableCount: items.length,
    hasActive: !!active,
    activeName: active?.querySelector('.recipe-picker-item-name')?.textContent,
    activeIndex: active ? Array.from(active.parentElement.children).indexOf(active) : -1,
  }
}
```
Press ArrowDown again, verify `.active` moves to next item.
PASS: `.active` class moves between items on ArrowDown.

### 2.4 ArrowUp moves active highlight backwards (2pts)

Press ArrowUp via Playwright, verify `.active` moves backwards:
```javascript
() => {
  const active = document.querySelector('.recipe-picker-item.active')
  return {
    activeName: active?.querySelector('.recipe-picker-item-name')?.textContent,
  }
}
```
PASS: active item changes on ArrowUp; wraps around at top.

### 2.5 Keyboard skips already-referenced items (3pts)

This test depends on autoRef being present (recipe detail page):
```javascript
() => {
  const referenced = document.querySelectorAll('.recipe-picker-item.referenced')
  const active = document.querySelector('.recipe-picker-item.active')
  const isActiveReferenced = active?.classList.contains('referenced')
  return {
    referencedCount: referenced.length,
    hasActive: !!active,
    isActiveReferenced: isActiveReferenced,
  }
}
```
Press ArrowDown multiple times and after each, verify `.active` is never on a `.referenced` item.
PASS: active never lands on a referenced item.

### 2.6 Enter selects active item (3pts)

Press Enter via Playwright, then:
```javascript
() => {
  const picker = document.querySelector('.recipe-picker-overlay, .recipe-picker-dropdown')
  const pills = document.querySelectorAll('[data-testid="ref-pill"]')
  return {
    pickerClosed: !picker,
    pillCount: pills.length,
    pillNames: Array.from(pills).map(p => p.querySelector('[data-testid="ref-pill-name"]')?.textContent),
  }
}
```
PASS: picker closed AND new ref pill appeared (pill count increased).

### 2.7 Escape closes picker (2pts)

Type `@` again to reopen picker, then press Escape:
```javascript
() => {
  const picker = document.querySelector('.recipe-picker-overlay, .recipe-picker-dropdown')
  return { pickerVisible: !!picker }
}
```
PASS: picker is gone after Escape.

### 2.8 Active item visible highlight (2pts)

Reopen picker, press ArrowDown:
```javascript
() => {
  const active = document.querySelector('.recipe-picker-item.active')
  const inactive = document.querySelector('.recipe-picker-item:not(.active):not(.referenced)')
  if (!active || !inactive) return { error: 'Cannot find active/inactive items' }
  const activeBg = window.getComputedStyle(active).backgroundColor
  const inactiveBg = window.getComputedStyle(inactive).backgroundColor
  return { activeBg, inactiveBg, different: activeBg !== inactiveBg }
}
```
PASS: active background differs from inactive background.

### 2.9 Search input retains focus during navigation (1pt)

After ArrowDown, check focus:
```javascript
() => {
  const active = document.activeElement
  const search = document.querySelector('.recipe-picker-search')
  return { focusOnSearch: active === search }
}
```
PASS: focus remains on search input.

## Step 3: D3 — Context Integration (20pts)

**3.1 autoRef auto-adds pill (4pts)**
Navigate to a recipe detail page. Without typing @ or opening picker, check for pills:
```javascript
() => {
  const pills = document.querySelectorAll('[data-testid="ref-pill"]')
  return {
    count: pills.length,
    names: Array.from(pills).map(p => p.querySelector('[data-testid="ref-pill-name"]')?.textContent),
  }
}
```
PASS: at least 1 pill present with the current recipe name.

**3.2 Auto-ref pill has icon + name + × (3pts)**
```javascript
() => {
  const pill = document.querySelector('[data-testid="ref-pill"]')
  if (!pill) return { found: false }
  const removeBtn = pill.querySelector('[data-testid="ref-pill-remove"]')
  return {
    found: true,
    text: pill.textContent,
    hasRemoveBtn: !!removeBtn,
    hasIcon: pill.textContent.includes('🍳'),
  }
}
```
PASS: pill has icon (🍳), name, and × button.

**3.3 Manual selection adds second pill (3pts)**
Type @, navigate to an unreferenced recipe, press Enter. Then:
```javascript
() => {
  const pills = document.querySelectorAll('[data-testid="ref-pill"]')
  return { count: pills.length }
}
```
PASS: pill count >= 2.

**3.4 Remove pill via × (2pts)**
Click the × button on a pill:
```javascript
() => {
  const pills = document.querySelectorAll('[data-testid="ref-pill"]')
  return { count: pills.length }
}
```
PASS: pill count decreased by 1.

**3.5 Refs cleared after send (2pts)**
Type a message, click send. Then check:
```javascript
() => {
  const pills = document.querySelectorAll('[data-testid="ref-pill"]')
  return { count: pills.length }
}
```
PASS: pill count is 0 after sending.

**3.6 baseUrl uses CONTEXT_LAYER_URL (2pts)**
```bash
grep -n "CONTEXT_LAYER_URL\|baseUrl" solutions/business/recipe-book/frontend/src/pages/RecipeDetailPage.tsx solutions/business/recipe-book/frontend/src/pages/ChatPage.tsx
```
PASS: RecipePicker gets baseUrl={CONTEXT_LAYER_URL}.

**3.7 ChatPage picker works without autoRef (2pts)**
Navigate to /chat, verify no pills present, type @ to open picker. Verify picker works.
PASS: picker opens on ChatPage, no auto-ref.

**3.8 Summary text shows count (2pts)**
```javascript
() => {
  const hint = document.querySelector('.recipe-picker-refs-hint')
  return { text: hint?.textContent }
}
```
PASS: text contains "个食谱已引用".

## Step 4: D4 — Visual & CSS Quality (20pts)

**4.1 AtPicker CSS overrides removed (4pts)**
```bash
grep -c "at-picker-overlay\|at-picker" solutions/business/recipe-book/frontend/src/index.css || echo "0"
```
PASS: 0 matches (or only in comments)

**4.2 No [style*="rgb"] selectors (3pts)**
```bash
grep -c 'style\*=' solutions/business/recipe-book/frontend/src/index.css || echo "0"
```
PASS: 0 matches (all `[style*="xxx"]` selectors removed)

**4.3 RecipePicker styles use design tokens (3pts)**
```bash
grep "recipe-picker" solutions/business/recipe-book/frontend/src/index.css | grep -c "var(--"
```
PASS: >= 10 `var(--` usages in recipe-picker rules

**4.4 No new hardcoded hex colors (2pts)**
```bash
grep "recipe-picker" solutions/business/recipe-book/frontend/src/index.css | grep -E "#[0-9a-fA-F]{3,8}" | grep -v "var(--" | grep -v "/\*"
```
PASS: empty (no hardcoded colors)

**4.5 Picker dropdown renders correctly (2pts)**
Open picker via @, take a snapshot. Verify dropdown is visible, has search input and recipe items.

**4.6 Referenced items visually distinct (2pts)**
```javascript
() => {
  const ref = document.querySelector('.recipe-picker-item.referenced')
  if (!ref) return { found: false }
  const style = window.getComputedStyle(ref)
  return { opacity: style.opacity, cursor: style.cursor }
}
```
PASS: opacity < 1 or distinct styling.

**4.7 Ref pills use design tokens (2pts)**
```javascript
() => {
  const pill = document.querySelector('[data-testid="ref-pill"]')
  if (!pill) return { found: false }
  const style = window.getComputedStyle(pill)
  return { bg: style.backgroundColor, color: style.color, border: style.borderColor }
}
```
PASS: background is NOT `rgb(232, 240, 254)` (hardcoded #e8f0fe). Should use design token value.

**4.8 Dark mode: picker readable (2pts)**
Force dark mode:
```javascript
() => {
  document.querySelectorAll('meta[name="color-scheme"]').forEach(m => m.remove())
  const meta = document.createElement('meta')
  meta.name = 'color-scheme'
  meta.content = 'dark'
  document.head.appendChild(meta)
  document.documentElement.style.colorScheme = 'dark'
  return 'dark mode forced'
}
```
Then open picker and check:
```javascript
() => {
  const dropdown = document.querySelector('.recipe-picker-dropdown')
  if (!dropdown) return { found: false }
  const bg = window.getComputedStyle(dropdown).backgroundColor
  const input = dropdown.querySelector('.recipe-picker-search')
  const color = input ? window.getComputedStyle(input).color : null
  return { bg, textColor: color }
}
```
PASS: background is dark, text color is light (high contrast).

## Step 5: D5 — Build Quality (20pts)

**5.1 Frontend tsc (3pts)**
```bash
cd solutions/business/recipe-book/frontend && npx tsc --noEmit 2>&1 | tail -10
```

**5.2 Frontend vite build (3pts)**
```bash
cd solutions/business/recipe-book/frontend && npx vite build 2>&1 | tail -10
```

**5.3 Backend tests (2pts)**
```bash
cd solutions/business/recipe-book/backend && npx vitest run 2>&1 | tail -10
```

**5.4 No frozen package modifications (4pts)**
```bash
git diff --name-only -- packages/chat-interface/src/ packages/context-layer/src/ packages/context-layer-react/src/ packages/entity-document/src/ solutions/business/edu-platform/
git diff --name-only -- solutions/business/recipe-book/backend/ | grep -v '\.db$'
```
PASS: both empty

**5.5 Recipe list page (2pts)**
Navigate to http://localhost:5291/recipes — recipes visible.

**5.6 Recipe detail page (2pts)**
Navigate to http://localhost:5291/recipes/{id} — recipe content visible.

**5.7 Chat page (2pts)**
Navigate to http://localhost:5291/chat — chat interface visible.

**5.8 file: links (2pts)**
```bash
grep "file:" solutions/business/recipe-book/frontend/package.json
```
PASS: paths present and correct.

## Step 6: Penalties

```bash
# P1: context-layer-react src modified
git diff --name-only -- packages/context-layer-react/src/

# P2: chat-interface src modified
git diff --name-only -- packages/chat-interface/src/

# P3: entity-document src modified
git diff --name-only -- packages/entity-document/src/

# P4: edu-platform modified
git diff --name-only -- solutions/business/edu-platform/

# P5: recipe-book backend modified (except .db)
git diff --name-only -- solutions/business/recipe-book/backend/ | grep -v '\.db$'

# P6: frontend build
cd solutions/business/recipe-book/frontend && npx tsc --noEmit 2>&1 | tail -5

# P7: backend tests
cd solutions/business/recipe-book/backend && npx vitest run 2>&1 | tail -5
```

# Output Format

**Save your evaluation to: `harness-workspace/recipe-book-recipe-picker/eval-reports/v{N}-eval.md`**

Use this exact structure:

```markdown
# Eval Report — recipe-book-recipe-picker v{N}

## Per-Dimension Scores

### D1 Component Architecture (Weight: 20/100)
**Score: X/20**
**Justification**: [specific evidence with grep results]
**Suggestion**: [one concrete fix]

### D2 Keyboard Navigation (Weight: 20/100)
**Score: X/20**
**Justification**: [specific evidence with Playwright keyboard interactions]
**Suggestion**: [one concrete fix]

### D3 Context Integration (Weight: 20/100)
**Score: X/20**
**Justification**: [specific evidence]
**Suggestion**: [one concrete fix]

### D4 Visual & CSS Quality (Weight: 20/100)
**Score: X/20**
**Justification**: [specific evidence with grep and getComputedStyle results]
**Suggestion**: [one concrete fix]

### D5 Build Quality (Weight: 20/100)
**Score: X/20**
**Justification**: [specific evidence]
**Suggestion**: [one concrete fix]

## Penalties Applied
[List each penalty check result]

## Score Summary
| Dimension | Scored | Max | Notes |
|-----------|--------|-----|-------|
| D1 | X | 20 | ... |
| D2 | X | 20 | ... |
| D3 | X | 20 | ... |
| D4 | X | 20 | ... |
| D5 | X | 20 | ... |

Penalties: -X

总分: XX/100

## Bug Classification
[COMPONENT] / [SYSTEM] / [DESIGN] for each deduction

## Actionable Fix Hints
[File path + CSS selector + expected value + fix approach]

## Top 3 Priority Fixes
1. [Most impactful]
2. [Second]
3. [Third]

## What's Working Well
[1-2 things NOT to change]
```
