# Edu Platform Design System (v2)

> Source of truth extracted from `reference/v2/` design package.
> All frontend styling MUST conform to this document.

---

## 0. Design Philosophy

> These principles explain the **why** behind the token values. Read this first.

### 0.1 Tinted Neutral (暖灰色调)

All neutral colors carry a warm olive/cream undertone — **not** Tailwind's default cool gray, and **not** pure white.

| Role | Our Token | Light Value | Dark Value | Difference |
|------|-----------|-------------|------------|------------|
| Page bg | `--bg` | `#f4f3ef` | `#1a1a18` | Warm cream, not white or cool gray |
| Card surface | `--surface` | `#fbfaf7` | `#242422` | Off-white with warm tint |
| Recessed fill | `--surface2` | `#edece7` | `#2c2c2a` | Section headers, hover fills |
| Primary text | `--t1` | `#1c1c1a` | `#e8e6dc` | Near-black with warm undertone |
| Secondary text | `--t2` | `#5c5b56` | `#9c9a92` | Warm olive mid-gray |
| Tertiary text | `--t3` | `#9c9a92` | `#8a8983` | Warm gray for placeholders |

If a color looks "cold" or "blue-ish" next to the prototypes, it's wrong.

### 0.2 No Accent Color (无品牌强调色)

- There is **no** `--accent` / `--primary` blue or purple token.
- Primary button: `bg=var(--t1), color=var(--surface)` — text/background inversion *is* the primary treatment.
- Semantic colors (`blue`, `green`, `amber`, `red`) are for **status indication only**, never brand identity.
- Purple (`--purple`) is reserved for AI-related elements only.

### 0.3 Zero Shadows (零阴影)

- All v2 prototypes use **zero** `box-shadow`.
- Elevation is expressed through borders + background color stepping (`--bg` → `--surface` → `--surface2`).
- Never add `shadow-sm`, `shadow-md`, or any `box-shadow` declaration.

### 0.4 Unified Borders (统一边框)

- Standard border: **`1px solid var(--border)`** where `--border` = `rgba(28,28,26,.07)`.
- Consistent 1px across all components (v1 used 0.5px — v2 standardizes to 1px).
- Hover: border-color changes (e.g., `rgba(28,28,26,.15)`), **never** add shadow.

### 0.5 System Theme Only (跟随系统主题)

- Dark mode switches via `@media (prefers-color-scheme: dark)` **only**.
- No manual toggle switch. No `.dark` class on `<html>`.
- All colors must go through CSS custom properties so the media query swap works.

### 0.6 Font

- Brand font: `"Plus Jakarta Sans", -apple-system, "PingFang SC", sans-serif`.
- All `<button>` and `<input>` must use `font-family: inherit`.

### 0.7 Component Colors — Token Only (组件禁止色值字面量)

This is a **hard rule**:
- Components must **NEVER** use raw color literals: `'white'`, `'#fff'`, `'#000'`, `'rgba(...)'`, `'#f4f3ef'`, etc.
- ALL colors in components go through `var(--token)` CSS custom properties.
- The **only** place raw color values appear is `design-tokens.css` `:root` and dark mode blocks.
- Exception: `rgba(58,49,133,.3)` for focus border (should ideally be a token too).

---

## 1. Design Tokens

All tokens are defined in `src/styles/design-tokens.css`. This is the **single source of truth** for theme colors.

### 1.1 Color Tokens

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--bg` | `#f4f3ef` | `#1a1a18` | Page background |
| `--surface` | `#fbfaf7` | `#242422` | Card surfaces, input fields, modal bg |
| `--surface2` | `#edece7` | `#2c2c2a` | Section headers, hover fills, recessed areas |
| `--t1` | `#1c1c1a` | `#e8e6dc` | Primary text, primary button bg |
| `--t2` | `#5c5b56` | `#9c9a92` | Secondary text, labels, meta |
| `--t3` | `#9c9a92` | `#8a8983` | Placeholder, disabled, hint text |
| `--border` | `rgba(28,28,26,.07)` | `rgba(255,255,255,.10)` | Borders |

**Semantic Colors (7 pairs — text + bg):**

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--blue` | `#1a5fa0` | `#85b7eb` | Info text, in-use badge |
| `--blue-bg` | `#e4eff8` | `#042c53` | Info badge bg |
| `--green` | `#2d6612` | `#c0dd97` | Published badge text |
| `--green-bg` | `#e6f2dc` | `#173404` | Published badge bg |
| `--amber` | `#7a4d0e` | `#fac775` | Warning text, unlinked requirement |
| `--amber-bg` | `#f6edda` | `#412402` | Warning badge bg |
| `--red` | `#942929` | `#f09595` | Danger text, urgent indicator |
| `--red-bg` | `#f8e6e6` | `#3d0c0c` | Danger bg |
| `--purple` | `#3a3185` | `#b3aff0` | AI elements, insert button |
| `--purple-bg` | `#eceafe` | `#1e1b3a` | AI section bg, chips |
| `--teal` | `#0d5245` | `#7ed4b8` | Requirement linked, "建议保留" badge |
| `--teal-bg` | `#ddf1eb` | `#0a2e25` | Requirement banner bg |
| `--coral` | `#6b2a14` | `#e8a68c` | File card (PDF) text |
| `--coral-bg` | `#f7ebe5` | `#2e1a12` | File card (PDF) bg |

**Overlay:**

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--overlay` | `rgba(0,0,0,0.4)` | `rgba(0,0,0,0.6)` | Modal backdrop |

**Layout:**

| Token | Value | Usage |
|-------|-------|-------|
| `--sidebar-w` | `232px` | Sidebar width |

### 1.2 Radius Values

| Value | Usage |
|-------|-------|
| `6px` | Buttons, form fields, pills, small elements |
| `8px` | Section block bg, input pill |
| `10px` | Cards, list items, modal inner sections |
| `12px` | Modal container |

### 1.3 Border

- **Standard**: `1px solid var(--border)`
- **Hover**: border-color 加深, never add shadow
- **Dashed**: `1px dashed var(--amber)` for unlinked requirement

---

## 2. Typography

### 2.1 Font Family

```css
font-family: "Plus Jakarta Sans", -apple-system, "PingFang SC", sans-serif;
```

Brand font is Plus Jakarta Sans.

### 2.2 Font Size Scale (v2)

| Size | Usage |
|------|-------|
| `9px` | WeekStrip 星期名, "建议保留" badge |
| `10px` | Section labels, status badges, timeline timestamps, block pills |
| `11px` | Chips, meta text, descriptions, form labels |
| `12px` | Body text, callout, action buttons, input fields |
| `13px` | Tab text, list item text, select fields, nav links |
| `14px` | Card titles, list item titles, block section title |
| `20-22px` | Page title, editor title input |
| `24-28px` | Hero greeting text |

### 2.3 Font Weight

| Weight | Usage |
|--------|-------|
| `400` (regular) | Body text, descriptions |
| `500` (medium) | Titles, active tabs, nav links |
| `600` (semibold) | Section labels, status badges |
| `700` (bold) | Logo, hero greeting, editor title |

---

## 3. Component Patterns (v2)

### 3.1 Navigation — Sidebar (≥1200px)

- Fixed left, 232px wide, `background: var(--surface)`
- Section labels: `10px 600 var(--t3) uppercase letter-spacing .5px`
- Nav item: 36px height, icon 20×20 + 12×12 SVG
- Active: left 3px `var(--t1)` bar + `var(--surface2)` bg + icon inverted
- Hover: `var(--surface2)` bg
- Badge (count): `var(--red-bg)` bg, `var(--red)` text, 9px, 4px radius
- Bottom user: avatar 28×28 6px radius + name + role (11px `var(--t3)`)

### 3.2 Navigation — TopNav (<1200px)

- 48px height, `background: var(--surface); border-bottom: 1px solid var(--border)`
- Logo: 14px 700
- Links: 13px 500, `var(--t2)` default, `var(--t1)` + `var(--surface2)` pill active

### 3.3 Card Pattern

- `background: var(--surface); border: 1px solid var(--border); border-radius: 10px`
- Hover: `border-color` 加深 (never shadow)
- Padding: `16px 20px`

### 3.4 Button Pattern

- Default: `border: 1px solid var(--border); background: var(--surface); color: var(--t2); border-radius: 6px`
- Primary: `background: var(--t1); color: var(--surface); border-radius: 6px`
- Font size: `12px`

### 3.5 Status Badge Pattern

- `font-size: 10px; padding: 2px 8px; border-radius: 4px; font-weight: 500`
- Draft: `var(--surface2)` bg, `var(--t3)` text
- Published: `var(--green-bg)` bg, `var(--green)` text
- In-use: `var(--blue-bg)` bg, `var(--blue)` text
- AI-generated: `var(--purple-bg)` bg, `var(--purple)` text

### 3.6 Form Input Pattern

- `padding: 8px 12px; border: 1px solid var(--border); border-radius: 6px; font-size: 12px; background: var(--surface)`
- Readonly: `background: var(--surface2); color: var(--t2)`
- Focus: `border-color: rgba(58,49,133,.3)`

### 3.7 Modal Pattern

- Overlay: `var(--overlay)`
- Container: `background: var(--surface); border: 1px solid var(--border); border-radius: 12px`

---

## 4. Dark Mode Rules

### 4.1 Switching Mechanism

```css
@media (prefers-color-scheme: dark) {
  :root { /* override all tokens */ }
}
```

Automatic via `prefers-color-scheme`. No manual toggle class.

### 4.2 Implementation Rules

1. ALL colors MUST go through CSS custom properties
2. Never use raw hex, `rgba()`, or Tailwind color utilities in components
3. Tailwind is allowed only for layout (`flex`, `grid`, `p-4`, `gap-2`, etc.)
4. Every new token MUST have both light and dark values
5. Update this document's token table when adding new tokens

---

## 5. Layout Patterns (v2)

| Page | Max Width | Alignment |
|------|-----------|-----------|
| HomePage | 800px | Left-aligned (not centered) |
| LessonPlanList / TemplateList | 860px | Left-aligned |
| LessonPlanEditor | 920px (grid 1fr + 200px) | Left-aligned |
| TemplateEditor | 640px | Left-aligned |
| Chat | inherited from chat-interface | — |

Content is left-aligned — flush with the sidebar's right edge. **No `margin: 0 auto`** centering.

Main area: `margin-left: var(--sidebar-w)` at ≥1200px; no margin at <1200px.

---

## 6. Anti-Patterns (Prohibited)

| Rule | Rationale |
|------|-----------|
| No hardcoded colors in components (`'white'`, `'#fff'`, `rgba()`, hex) | All colors via CSS variables for theme support |
| No `box-shadow` / `shadow-*` | v2 prototypes use zero shadows |
| No pure white `#fff` as surface | Use `var(--surface)` = `#fbfaf7` |
| No pure black `#000` | Use `var(--t1)` = `#1c1c1a` |
| No `margin: 0 auto` centering | Content left-aligned |
| No Tailwind color classes (`bg-blue-500`, etc.) | All colors via CSS variables |
| No gradients | v2 uses flat fills only |
| No icon fonts | Use inline SVG (Lucide-style) |
| No emoji as functional icons | Use SVG |
| No `> 12px` border-radius | Cards 10px, buttons 6px, modals 12px |
| No v1 variable names (`--bg1`, `--bg2`, `--b1`, `--info-t`, `--warn-t`) | Use v2 names (`--bg`, `--surface`, `--border`, `--blue`, `--amber`) |

---

## 7. v1 → v2 Migration Reference

For components being migrated from v1:

| v1 Token | v2 Token |
|----------|----------|
| `--bg1` | `--surface` (card bg) or `--bg` (page bg) |
| `--bg2` | `--surface2` or `--bg` depending on context |
| `--bg3` | `--surface2` |
| `--b1` | `--border` |
| `--b2` | `--border` (single border token in v2) |
| `--info-bg` | `--blue-bg` |
| `--info-t` | `--blue` |
| `--success-bg` | `--green-bg` |
| `--success-t` | `--green` |
| `--warn-bg` | `--amber-bg` |
| `--warn-t` | `--amber` |
| `--danger-bg` | `--red-bg` |
| `--danger-t` | `--red` |
| `--purple-bg` | `--purple-bg` (same) |
| `--purple-t` | `--purple` |
| `--teal-bg` | `--teal-bg` (same) |
| `--teal-t` | `--teal` |
| `--coral-bg` | `--coral-bg` (same) |
| `--coral-t` | `--coral` |
| `--r` (8px) | 6px (buttons), 10px (cards) |
| `--rl` (12px) | 10px (cards), 12px (modals) |
