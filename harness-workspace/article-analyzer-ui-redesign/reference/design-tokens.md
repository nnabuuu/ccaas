# Design Tokens — Article Analyzer UI/UX Redesign

## Color Palette

### Primary (Blue)
| Token | Hex | Usage |
|-------|-----|-------|
| primary-50 | `#eff6ff` | Light background tint |
| primary-100 | `#dbeafe` | Hover state bg |
| primary-200 | `#bfdbfe` | Active state bg |
| primary-500 | `#3b82f6` | Dark mode primary |
| primary-600 | `#2563eb` | **Primary action** (light mode) |
| primary-700 | `#1d4ed8` | Hover on primary |
| primary-800 | `#1e40af` | Active on primary |

### Neutral (Slate)
| Token | Hex | Usage |
|-------|-----|-------|
| slate-50 | `#f8fafc` | Page background (light) |
| slate-100 | `#f1f5f9` | Card background alt |
| slate-200 | `#e2e8f0` | Border (light) |
| slate-300 | `#cbd5e1` | Disabled text |
| slate-400 | `#94a3b8` | Placeholder text |
| slate-500 | `#64748b` | Secondary text |
| slate-600 | `#475569` | Body text (light) |
| slate-700 | `#334155` | Border (dark) |
| slate-800 | `#1e293b` | Surface (dark) |
| slate-900 | `#0f172a` | Primary text (light) / Page bg (dark) |
| slate-950 | `#020617` | Deepest dark |

### Semantic Status
| Token | Light Hex | Dark Hex | Usage |
|-------|-----------|----------|-------|
| success | `#16a34a` (green-600) | `#22c55e` (green-500) | Completed, score ≥80 |
| warning | `#ca8a04` (yellow-600) | `#eab308` (yellow-500) | Running, score 60-80 |
| error | `#dc2626` (red-600) | `#ef4444` (red-500) | Failed, score <60 |
| info | `#2563eb` (blue-600) | `#3b82f6` (blue-500) | Links, active states |

### Score Color Coding
| Range | Color | Token |
|-------|-------|-------|
| ≥80 | Green | `text-green-600 dark:text-green-400` |
| 60-79 | Yellow | `text-yellow-600 dark:text-yellow-400` |
| <60 | Red | `text-red-600 dark:text-red-400` |

## Typography

Font Family: **Inter** (via Google Fonts or system fallback)

| Level | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| Display | 48px (text-5xl) | 700 (bold) | 1 | Hero score number |
| H1 | 30px (text-3xl) | 600 (semibold) | 1.25 | Page title |
| H2 | 24px (text-2xl) | 600 | 1.33 | Section title |
| H3 | 20px (text-xl) | 500 (medium) | 1.4 | Card title |
| H4 | 16px (text-base) | 500 | 1.5 | Subsection |
| Body | 14px (text-sm) | 400 (normal) | 1.5 | Body text |
| Caption | 12px (text-xs) | 400 | 1.33 | Labels, timestamps |
| Overline | 12px (text-xs) | 600 (semibold) | 1.33 | All-caps labels |

## Spacing

Base unit: 4px

| Token | Value | Usage |
|-------|-------|-------|
| space-1 | 4px | Icon gap |
| space-2 | 8px | Inline element gap |
| space-3 | 12px | Compact padding |
| space-4 | 16px | Standard padding |
| space-5 | 20px | Section gap |
| space-6 | 24px | Card padding |
| space-8 | 32px | Section spacing |
| space-10 | 40px | Major section gap |
| space-12 | 48px | Page top padding |

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| rounded-md | 6px | Buttons, inputs |
| rounded-lg | 8px | **Cards, panels** (primary) |
| rounded-xl | 12px | Modal, large cards |
| rounded-full | 9999px | Pills, avatars, badges |

## Shadows

| Token | Value | Usage |
|-------|-------|-------|
| shadow-sm | `0 1px 2px rgba(0,0,0,0.05)` | Subtle elevation |
| shadow | `0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)` | Cards (light) |
| shadow-md | `0 4px 6px rgba(0,0,0,0.1)` | Dropdowns, popovers |
| shadow-lg | `0 10px 15px rgba(0,0,0,0.1)` | Modals |

Note: In dark mode, reduce shadow opacity or use border instead.

## Breakpoints

| Name | Min Width | Layout |
|------|-----------|--------|
| sm | 640px | — |
| md | 768px | Two-column grid |
| lg | 1024px | Full desktop layout |
| xl | 1280px | Max content width |

## Animations

| Name | Duration | Easing | Usage |
|------|----------|--------|-------|
| fadeIn | 200ms | ease-out | Component mount |
| slideUp | 300ms | ease-out | Card appear, timeline expand |
| pulse | 2s | ease-in-out | Running indicator |
| spin | 1s | linear | Loading spinner |

## CSS Custom Properties (index.css)

```css
:root {
  --color-primary: #2563eb;
  --color-primary-light: #dbeafe;
  --color-surface: #ffffff;
  --color-surface-alt: #f8fafc;
  --color-text-primary: #0f172a;
  --color-text-secondary: #475569;
  --color-text-muted: #94a3b8;
  --color-border: #e2e8f0;
  --color-success: #16a34a;
  --color-warning: #ca8a04;
  --color-error: #dc2626;
}

.dark {
  --color-primary: #3b82f6;
  --color-primary-light: #1e3a5f;
  --color-surface: #1e293b;
  --color-surface-alt: #0f172a;
  --color-text-primary: #f1f5f9;
  --color-text-secondary: #94a3b8;
  --color-text-muted: #64748b;
  --color-border: #334155;
  --color-success: #22c55e;
  --color-warning: #eab308;
  --color-error: #ef4444;
}
```

## Recharts Theme

```typescript
// Light mode
const CHART_COLORS = {
  primary: '#2563eb',
  primaryLight: '#93c5fd',
  grid: '#e2e8f0',
  text: '#64748b',
  target: '#dc2626',
};

// Dark mode
const CHART_COLORS_DARK = {
  primary: '#3b82f6',
  primaryLight: '#60a5fa',
  grid: '#334155',
  text: '#94a3b8',
  target: '#ef4444',
};
```

## Status Badge Mapping

| Status | Light BG | Light Text | Dark BG | Dark Text | Icon |
|--------|----------|------------|---------|-----------|------|
| draft | gray-100 | gray-700 | gray-800 | gray-300 | ○ |
| running | blue-100 | blue-700 | blue-900 | blue-300 | ● (pulse) |
| completed | green-100 | green-700 | green-900 | green-300 | ✓ |
| failed | red-100 | red-700 | red-900 | red-300 | ✕ |
