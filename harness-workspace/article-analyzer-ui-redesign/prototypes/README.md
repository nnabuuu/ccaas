# Stitch Prototypes

## Stitch Project

- **Project ID**: `11812547165647480374`
- **URL**: View in Stitch web UI

## Downloaded Prototypes

| File | Screen | Device | Size |
|------|--------|--------|------|
| `s1-empty-list.html` | Article List — Empty State | Desktop | 9.5KB |
| `s2-article-list.html` | Article List — Grid View with Data | Desktop | 17KB |
| `s3-article-detail.html` | Article Detail — AI Trends 2025 | Desktop | 22KB |
| `s4-run-progress.html` | Live Run Progress Dashboard | Desktop | 18KB |
| `s5-run-completed.html` | Article Analysis Results — Run #3 | Desktop | 20KB |
| `s6-article-form.html` | Create New Article Form | Desktop | 17KB |
| `s7-mobile-list.html` | Mobile Article List | Mobile | 14KB |
| `s8-dark-mode.html` | Dark Run Progress Dashboard | Desktop | 19KB |

## Screen-to-Dimension Mapping

| Screen | Primary Dimension | Reference For |
|--------|-------------------|---------------|
| S1 | D2 (Empty State) | EmptyState component, CTA design |
| S2 | D1, D5 | Card grid, filter chips, status badges, scores |
| S3 | D1, D3 | Breadcrumb, info card, run history table |
| S4 | D4 | Hero score, progress bar, pipeline, charts |
| S5 | D3, D4 | Charts, scorecard, timeline, version diff |
| S6 | D5 | Form layout, validation, word count |
| S7 | D6 | Mobile breakpoints, responsive layout |
| S8 | D6 | Dark mode colors, contrast, readability |

## Usage by Generator

The Generator agent should:
1. Read these HTML files for visual reference on layout, spacing, and component design
2. Refer to `reference/design-tokens.md` for the canonical color, typography, and spacing values
3. The HTML prototypes are reference only — implement using React + Tailwind, not copy HTML
