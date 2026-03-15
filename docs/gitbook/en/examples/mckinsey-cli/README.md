# McKinsey CLI

McKinsey CLI is a structured business analysis tool that demonstrates the **Pure Skill, Zero MCP** architecture pattern. A single powerful Skill replaces all MCP tools by leveraging built-in capabilities (web search, file generation) combined with comprehensive domain instructions.

## Architecture

```
┌───────────────────────────────────────────────────────┐
│  Client Layer                                         │
│  ┌─────────────────┐  ┌───────────────────────────┐   │
│  │  Vue 3 Frontend  │  │  Node.js CLI Client       │   │
│  │  (Chat + Files)  │  │  (Terminal interface)      │   │
│  └────────┬─────────┘  └──────────┬────────────────┘   │
├───────────┴───────────────────────┴────────────────────┤
│  CCAAS Core Backend (:3001)                           │
│  Session management, Skill routing, file management   │
├────────────────────────────────────────────────────────┤
│  mckinsey-consultant Skill                            │
│  ┌──────────────────────────────────────────────────┐  │
│  │  SKILL.md (300 lines) — Navigation + workflow    │  │
│  │  references/  (7+ files) — On-demand loading     │  │
│  │  Built-in tools: WebSearch, Write, Read           │  │
│  │  NO MCP servers needed                            │  │
│  └──────────────────────────────────────────────────┘  │
├────────────────────────────────────────────────────────┤
│  Generated Artifacts                                  │
│  PPTX (15-25 pages) + XLSX (data sources) + DOCX     │
└───────────────────────────────────────────────────────┘
```

## Why Zero MCP?

Not every Solution needs MCP tools. McKinsey CLI demonstrates when Skills alone are sufficient:

| Need | MCP Tool? | Skill Solution |
|------|-----------|---------------|
| Data collection | No | Built-in `WebSearch` (15-30 searches per session) |
| Document generation | No | Built-in `Write` tool (Python for PPTX/XLSX) |
| Reference loading | No | Built-in `Read` tool for on-demand reference files |
| Business logic | No | Domain instructions in SKILL.md + reference files |
| External APIs | Not needed | All analysis uses public web data |

**Rule of thumb**: If your Solution's logic is primarily LLM-native thinking + public data + file generation, consider the pure Skill pattern before adding MCP complexity.

## The 9-Step Workflow

The Skill implements a structured consulting methodology:

| Phase | Steps | Activities |
|-------|-------|-----------|
| **Analysis** | 1-3 | Define problem boundary, build issue tree (MECE), form hypotheses |
| **Design** | 4-5 | Design dummy page layouts, annotate page dependencies |
| **Generation** | 6-7 | Collect data via web search, generate PPTX page by page |
| **Delivery** | 8-9 | Optional Word report, iteration and optimization |

Each step loads reference files on-demand and releases them after use, managing context efficiently.

## Progressive Disclosure Architecture

The key innovation is how the Skill manages context:

```
V2.0 (Old): 1130-line SKILL.md loaded once
  → 70% of lines unused per session
  → Only ~15 pages before context exhaustion

V3.0 (Current): 300-line SKILL.md + on-demand reference files
  → Load methodology.md only in STEP 2-3
  → Load design files only in STEP 4-5
  → Load excel specs only in STEP 6-7
  → Release each after use
  → 20-25 pages stable
```

### Reference File Map

| File | Lines | Loaded When |
|------|-------|-------------|
| `SKILL.md` | 300 | Always (core navigation) |
| `methodology.md` | 150 | STEP 2-3 (MECE + Issue Tree) |
| `layouts.md` | 120 | STEP 4-5 (7 page templates) |
| `design-specs.md` | 180 | STEP 4-5 (colors, fonts, spacing) |
| `page-dependencies.md` | 80 | STEP 4-5 (generation ordering) |
| `excel-data-spec.md` | 100 | STEP 6 (data collection format) |
| `delivery-summary.md` | 100 | STEP 8 (Word report, on-demand) |
| `troubleshooting.md` | 120 | STEP 9 (issue resolution only) |

## Incremental Page Generation

Rather than generating all pages at once (which would exhaust context), the Skill generates one page at a time:

```
For each page:
  1. Check page dependencies (can this page be generated now?)
  2. Execute 5 web searches for real data
  3. Record data in Excel (source URLs + values)
  4. Generate PPTX page (strict design compliance)
  5. Self-check 6 criteria
  6. Wait for user confirmation
  7. Clear page context
  8. Move to next page
```

This pattern keeps context usage bounded regardless of total page count.

## Dual Client Support

The same Skill powers both a web frontend and a CLI:

- **Vue 3 Frontend**: Split-panel UI (chat 40% + deliverables 60%), file download cards, token usage display
- **CLI Client**: Socket.IO terminal interface with `/files`, `/download`, `/new` commands, persistent session storage

Both clients connect to CCAAS Core via the same session API -- the Skill is client-agnostic.

## What Makes This Architecture Interesting

1. **Zero MCP overhead** -- No tool server to build, deploy, or maintain
2. **Context efficiency** -- Progressive disclosure keeps Skill instructions under 300 lines active at any time
3. **Bounded generation** -- Per-page workflow prevents context exhaustion even for 25-page decks
4. **Domain as instructions** -- McKinsey methodology lives in reference files, not code

## Deep Dive

- [Pure Skill Design: Zero-MCP Architecture](skill-design.md) -- How to replace MCP tools with well-structured Skill instructions
