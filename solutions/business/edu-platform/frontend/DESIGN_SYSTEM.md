# Edu Platform Design System

> Source of truth extracted from `docs/reference/` prototypes.
> All frontend styling MUST conform to this document.

---

## 0. Design Philosophy

> These principles explain the **why** behind the token values. Read this first.

### 0.1 Warm Neutral (暖灰色调)

All neutral colors carry an olive/warm-yellow undertone — **not** Tailwind's default cool gray.

| Role | Our Token | Value | Tailwind Equivalent | Difference |
|------|-----------|-------|---------------------|------------|
| Surface bg | `--bg2` | `#f5f5f0` | `gray-100` `#f3f4f6` | Warm cream vs cool blue-gray |
| Dark bg | `--bg1` dark | `#1a1a18` | `zinc-900` `#18181b` | Warm green-black vs cool zinc |
| Secondary text | `--t2` | `#6b6b65` | `gray-500` `#6b7280` | Warm olive vs cool slate |

If a color looks "cold" or "blue-ish" next to the prototypes, it's wrong.

### 0.2 No Accent Color (无品牌强调色)

- There is **no** `--accent` / `--primary` blue or purple token.
- Primary button: `bg=var(--t1), color=var(--bg1)` — text/background inversion *is* the primary treatment.
- Semantic colors (`info`, `success`, `warn`, `danger`) are for **status indication only**, never brand identity.

### 0.3 Zero Shadows (零阴影)

- All three prototypes use **zero** `box-shadow`.
- Elevation is expressed through `0.5px` borders + background color stepping (`bg1` → `bg2` → `bg3`).
- Never add `shadow-sm`, `shadow-md`, or any `box-shadow` declaration.

### 0.4 Hairline Borders (极细边框)

- Standard border thickness: **`0.5px`**, not `1px`.
- This creates a lighter, more modern feel than standard 1px borders.
- Only exceptions: checkbox (`1px` — HTML constraint), step indicator active (`2px`), mini-tree left border (`2px`).

### 0.5 System Theme Only (跟随系统主题)

- Dark mode switches via `@media (prefers-color-scheme: dark)` **only**.
- No manual toggle switch. No `.dark` class on `<html>`.
- All colors must go through CSS custom properties so the media query swap works.

### 0.6 Other Details

- Message max-width: **`88%`** (not 70% or 80%).
- `--danger-bg` intentionally does not exist — danger uses text color only.
- `--bg3` is used only by the chat prototype (outermost canvas).
- All `<button>` and `<input>` must use `font-family: inherit`.

---

## 1. Design Tokens

### 1.1 Color Tokens

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--bg1` | `#fff` | `#1a1a18` | Card surfaces, input fields, top bar |
| `--bg2` | `#f5f5f0` | `#242422` | Page background, stat blocks, subtle fills |
| `--bg3` | `#eeeee8` | `#2c2c2a` | Outermost canvas (chat only) |
| `--t1` | `#1a1a1a` | `#e8e6dc` | Primary text, user bubble bg, primary buttons |
| `--t2` | `#6b6b65` | `#9c9a92` | Secondary text, labels, meta |
| `--t3` | `#9c9a92` | `#73726c` | Placeholder, disabled, hint text |
| `--b1` | `rgba(0,0,0,.15)` | `rgba(255,255,255,.12)` | Primary border |
| `--b2` | `rgba(0,0,0,.08)` | `rgba(255,255,255,.06)` | Subtle border, progress bar track |

**Semantic Colors:**

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--info-bg` | `#E6F1FB` | `#042C53` | Info badge bg, doc icon bg |
| `--info-t` | `#0C447C` | `#85B7EB` | Info text, input focus border |
| `--success-bg` | `#EAF3DE` | `#173404` | Skill tag bg, published badge bg |
| `--success-t` | `#27500A` | `#C0DD97` | Skill tag text, step done, published badge |
| `--warn-bg` | `#FAEEDA` | `#412402` | Review badge bg, emphasis tag bg |
| `--warn-t` | `#854F0B` | `#FAC775` | Review badge text, medium gap bar |
| `--danger-t` | `#A32D2D` | `#F09595` | High error rate bar and text |

### 1.2 Radius Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--r` | `8px` | Buttons, form fields, stat blocks, small cards |
| `--rl` | `12px` | Frame containers, widget cards, tree selector, large cards |

Special radii (hardcoded per component):
- User bubble: `16px 16px 4px 16px` (asymmetric — bottom-left pinched)
- Suggestion chips: `12px`
- Badge pills: `10px`
- Input field (pill): `20px`
- Send button: `50%` (circle)
- Role toggle pills: `14px`
- Checkbox: `3px`

### 1.3 Border

- **Standard thickness**: `0.5px` (NOT `1px`)
- **Border style**: `0.5px solid var(--b1)`
- **Exceptions**:
  - Step indicator active/done bottom border: `2px solid`
  - Mini-tree left border: `2px solid var(--b1)`
  - Checkbox border: `1px solid var(--b1)` (HTML constraint)
  - Checked checkbox border: `1px solid var(--t1)`

---

## 2. Typography

### 2.1 Font Family

```css
font-family: -apple-system, system-ui, "Segoe UI", sans-serif;
```

No custom fonts. System stack only.

### 2.2 Font Size Scale

| Size | Usage |
|------|-------|
| `10px` | Prototype labels, bottom captions |
| `11px` | Chips, badges, suggestion buttons, meta text, gap percentages |
| `12px` | Form labels, card descriptions, tree nodes, secondary actions, step names, stat labels |
| `13px` | Tab buttons, form selects, summary rows, card titles (small), gap names |
| `14px` | Chat bubbles (user + AI), card titles (skill panel) |
| `16px` | Login page title (special case) |
| `18px` | Page titles (wizard) |
| `20px` | Stat values (large numeric display) |
| `22px` | Landing greeting (emotional/welcome text) |

### 2.3 Font Weight

| Weight | Usage |
|--------|-------|
| `400` (regular) | Body text, descriptions, labels |
| `500` (medium) | Titles, active tabs, selected tree nodes, summary values, widget titles |
| `bold` / `700` | Not used standalone; only stat values use `font-weight: 500` |

### 2.4 Line Height

- Chat bubbles: `1.5`
- Card descriptions: `1.5`
- Code blocks: `1.5`
- Default: browser default (no explicit `line-height` on most elements)

---

## 3. Component Patterns

### 3.1 Chat Interface (`chat-interface.html`)

**Top Bar**
- Background: `var(--bg1)`
- Bottom border: `0.5px solid var(--b1)`
- Padding: `10px 16px`
- Contains context chips in a flex row with `gap: 6px`

**Context Chip**
- Font size: `11px`, padding: `3px 10px`, radius: `12px`
- Default: `bg=bg2, color=t2, border=0.5px b1`
- Active: `bg=info-bg, color=info-t, border=transparent`

**User Bubble**
- Background: `var(--t1)` (dark in light mode, light in dark mode)
- Text color: `var(--bg1)` (inverted)
- Padding: `10px 14px`
- Border radius: `16px 16px 4px 16px` (asymmetric)
- Font size: `14px`
- Aligned: `flex-end`

**AI Bubble**
- **No background, no border** — plain text only
- Padding: `2px 0`
- Font size: `14px`, color: `var(--t1)`
- Aligned: `flex-start`

**Skill Tag**
- Green dot (`6px` circle, `bg=success-t`) + text
- Font size: `11px`, padding: `2px 8px`, radius: `10px`
- Background: `var(--success-bg)`, color: `var(--success-t)`
- Placed above AI message content

**Widget Card** (embedded interactive component)
- Background: `var(--bg1)`
- Border: `0.5px solid var(--b1)`
- Border radius: `var(--rl)` (12px)
- Padding: `14px`
- Header: title (13px medium) + badge (info style)

**Document Card**
- Flex row, padding: `10px 12px`
- Border: `0.5px solid var(--b1)`, radius: `var(--r)` (8px)
- Icon: 32x32, radius `6px`, `bg=info-bg, color=info-t`

**Suggestion Chips**
- Bottom of chat frame (not inside message flow)
- Background: `transparent`, border: `0.5px solid var(--b1)`
- Font size: `11px`, padding: `4px 10px`, radius: `12px`
- Hover: `bg=bg2`

**Input Bar**
- Background: `var(--bg1)`, top border: `0.5px solid var(--b1)`
- Input: pill shape `border-radius: 20px`, focus border: `var(--info-t)`
- Send button: `32x32` circle, `bg=t1, color=bg1`

**Action Buttons**
- Default: `bg=transparent, border=0.5px b1, color=t2, radius=r`
- Primary: `bg=t1, color=bg1, border-color=t1`
- Font size: `12px`, padding: `5px 12px`

### 3.2 Lesson Plan Wizard (`lesson-plan-wizard.html`)

**Step Indicator**
- Flex row, each step `flex: 1`, centered text
- Font size: `12px`
- Bottom border: `2px solid`
- Default: `color=t3, border=b1`
- Active: `color=t1, font-weight=500, border=t1`
- Done: `color=success-t, border=success-t`, prefix `✓`

**Form Fields**
- Label: `12px`, color: `var(--t2)`, margin-bottom: `4px`
- Select: padding `7px 10px`, border `0.5px solid var(--b1)`, radius `var(--r)`
- Font size: `13px`

**Tree Selector**
- Container: border `0.5px solid var(--b1)`, radius `var(--rl)`, padding `10px 14px`
- Max height: `240px`, overflow-y: auto
- Node: font size `13px`, hover bg: `var(--bg2)`
- Caret: `14x14`, font size `11px`, color `var(--t3)`, rotates 90deg when open
- Checkbox: `14x14`, radius `3px`, border `1px solid var(--b1)`
- Checked: `bg=t1, border=t1`, checkmark via CSS pseudo-element

**Gap Analysis Bar**
- Row: padding `8px 12px`, radius `var(--r)`, border `0.5px solid var(--b1)`
- Bar track: height `6px`, bg `var(--bg2)`, radius `3px`
- Fill color by severity:
  - `>= 35%`: `var(--danger-t)` (red)
  - `>= 25%`: `var(--warn-t)` (amber)
  - `< 25%`: `var(--success-t)` (green)
- Emphasis toggle: `16x16`, radius `3px`, on state: `bg=warn-bg, border=warn-t, color=warn-t`

**Summary Panel**
- Background: `var(--bg2)`, radius `var(--rl)`, padding `14px 16px`
- Key-value rows: flex, space-between, font size `13px`
- Key: `color=t2`, value: `font-weight=500`

**Emphasis Tags**
- Font size: `11px`, padding `2px 8px`, radius `10px`
- Background: `var(--warn-bg)`, color: `var(--warn-t)`

**Navigation Buttons**
- Same as chat action buttons
- Primary: `bg=t1, color=bg1, border=t1`
- Font size: `13px`, padding `7px 16px`, radius `var(--r)`

### 3.3 Skill Management Panel (`skill-management-panel.html`)

**Tab Bar**
- Background: `transparent`, no outer border
- Tab default: `bg=transparent, color=t2, border=transparent`
- Tab active: `bg=bg2, color=t1, font-weight=500, border=0.5px b1`
- Font size: `13px`, padding `6px 14px`, radius `var(--r)`

**Role Toggle**
- Pill buttons: padding `4px 10px`, radius `14px`, font size `12px`
- Default: `bg=transparent, border=0.5px b1, color=t2`
- Active: `bg=t1, color=bg1, border=t1`

**Stats Grid**
- 4-column grid: `grid-template-columns: repeat(4, minmax(0, 1fr))`, gap `10px`
- Background: `var(--bg2)`, radius `var(--r)`, padding `10px 12px`
- Label: `12px`, color `var(--t2)`
- Value: `20px`, font-weight `500`, margin-top `2px`

**Card Grid**
- 2-column grid, gap `12px`
- Card: `bg=bg1, border=0.5px b1, radius=rl`, padding `14px 16px`
- Title: `14px`, font-weight `500`
- Description: `12px`, color `var(--t2)`, line-height `1.5`
- Meta: `11px`, color `var(--t3)`, gap `12px`

**Badge System**

| Status | Class | Background | Color |
|--------|-------|------------|-------|
| Published | `badge-pub` | `var(--success-bg)` | `var(--success-t)` |
| Review | `badge-rev` | `var(--warn-bg)` | `var(--warn-t)` |
| Draft | `badge-dra` | `var(--bg2)` | `var(--t2)` |
| Fork | `badge-fork` | `var(--info-bg)` | `var(--info-t)` |

All badges: font size `11px`, padding `2px 8px`, radius `10px`.

**Card Actions**
- Font size: `12px`, padding `4px 10px`, radius `var(--r)`
- Default: `bg=transparent, border=0.5px b1, color=t2`
- Primary (first action): `bg=t1, color=bg1, border=t1`

**Empty State**
- Centered, padding `32px`, color `var(--t3)`, font size `13px`

---

## 4. Dark Mode Rules

### 4.1 Switching Mechanism

```css
@media (prefers-color-scheme: dark) {
  :root { /* override all tokens */ }
}
```

Automatic via `prefers-color-scheme`. No manual toggle class (e.g., no `.dark` on `<html>`).

### 4.2 Inversion Principles

- Backgrounds get darker: `#fff` → `#1a1a18`
- Text gets lighter: `#1a1a1a` → `#e8e6dc`
- Borders flip opacity: `rgba(0,0,0,.15)` → `rgba(255,255,255,.12)`
- Semantic colors shift to darker bg + lighter foreground
- User bubble remains inverted (bg=t1 naturally adapts)

### 4.3 Implementation

ALL colors MUST go through CSS custom properties. Never use raw hex or Tailwind color utilities for theme colors. Tailwind is allowed only for layout (`flex`, `grid`, `p-4`, `gap-2`, etc.).

---

## 5. Layout Patterns

- Max widths: `720px` (chat), `680px` (wizard), `760px` (skill panel)
- Page centering: `display: flex; justify-content: center; padding: 20px`
- Frame containers: `bg=bg1, border=0.5px b1, radius=rl, padding=20px`
- Chat frame uses `bg=bg2` as its surface (content area)
- Body/canvas background: `var(--bg2)` or `var(--bg3)`

---

## 6. Anti-Patterns (Prohibited)

| Rule | Rationale |
|------|-----------|
| No Tailwind color classes (`bg-blue-500`, `text-gray-600`, etc.) | All colors via CSS variables for theme support |
| No background or border on AI bubbles | Reference: AI text is plain, unstyled |
| No symmetric border-radius on user bubbles | Must be `16px 16px 4px 16px` |
| No `box-shadow` / `shadow-*` | Reference prototypes use zero shadows |
| No `1px` borders (except checkbox) | Reference uses `0.5px` consistently |
| No custom fonts or Google Fonts | System font stack only |
| No hardcoded dark mode colors | All via `prefers-color-scheme` + CSS vars |
| No `rgba()` colors in components | Use token variables `var(--b1)` etc. |
