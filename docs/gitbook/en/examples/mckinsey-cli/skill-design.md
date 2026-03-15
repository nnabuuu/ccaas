# Pure Skill Design: Zero-MCP Architecture

This page examines how McKinsey CLI replaces MCP tools entirely with a single well-structured Skill, and when this pattern is appropriate for your own Solutions.

## The Progressive Disclosure Pattern

### Problem: Context Window Exhaustion

A naive approach loads all instructions at once:

```
SKILL.md (1130 lines)
├── Methodology rules
├── Design specifications
├── Page templates
├── Data collection format
├── Troubleshooting guide
└── Examples
```

At 1130 lines, the Skill consumes significant context before any work begins. With 15-30 web searches and page generation, context exhaustion limits output to ~15 pages.

### Solution: Navigation Core + Reference Files

The V3.0 architecture separates the Skill into a navigation core and on-demand reference files:

```
SKILL.md (300 lines)         ← Always loaded
├── Persona definition
├── Workflow overview (9 steps)
├── Step-by-step navigation
│   ├── STEP 1: Direct execution
│   ├── STEP 2-3: "Load methodology.md" → execute → release
│   ├── STEP 4-5: "Load layouts.md, design-specs.md" → execute → release
│   ├── STEP 6-7: "Load excel-data-spec.md" → execute → release
│   ├── STEP 8: "Load delivery-summary.md" (if requested)
│   └── STEP 9: "Load troubleshooting.md" (if issues)
└── Behavior rules
```

Each `Load → Execute → Release` cycle keeps active context bounded.

## When to Use Skills vs. MCP

### Choose Pure Skill When:

- **LLM-native thinking**: The core value is analysis, synthesis, or creative generation
- **Built-in tools suffice**: WebSearch for data, Write for files, Read for references
- **No external integrations**: No databases, APIs, or authenticated services needed
- **Single cohesive workflow**: One logical flow from input to output
- **Domain = instructions**: Business logic can be expressed as natural language rules

### Choose MCP When:

- **External data sources**: Databases, CRMs, proprietary APIs
- **Specialized computation**: Algorithms the LLM cannot reliably perform
- **Authentication required**: API keys, OAuth tokens, service credentials
- **Multiple independent tools**: Capabilities that don't share a workflow
- **Real-time data**: Live data feeds that change between calls

### Hybrid Approach

Many Solutions combine both: MCP for data access + Skill for analysis logic. Smart Agri Service is an example -- MCP tools fetch structured data, while the Skill controls the analysis workflow and output format.

## Incremental Generation: Managing Unbounded Work

### The Problem

A 25-page McKinsey deck requires ~125 web searches (5 per page). Loading all search results into context simultaneously is impractical.

### The Solution: Page-Level Context Boundaries

```
┌─────────────────────────────┐
│  Page N Context             │
│  ├── Dummy.md page spec     │
│  ├── 5 search results       │
│  ├── Excel data row         │  ← Context for ONE page
│  └── PPTX generation        │
├─────────────────────────────┤
│  Clear context              │  ← Release after user confirms
├─────────────────────────────┤
│  Page N+1 Context           │
│  ├── Dummy.md next page     │
│  ├── 5 new search results   │  ← Fresh context
│  └── ...                    │
└─────────────────────────────┘
```

Key mechanisms:
- **User confirmation gate**: Each page requires explicit approval before proceeding
- **Context cleanup**: Search results from page N are not carried to page N+1
- **Page dependencies**: The Skill checks if prerequisite pages exist before generating dependent ones

## Page Dependency Management

Pages are categorized by dependency type:

| Type | Symbol | Meaning | Example |
|------|--------|---------|---------|
| Independent | `✅` | Can generate in any order | Cover page, individual analysis pages |
| Forward | `⏩` | Depends on earlier pages | Trend summary (needs data pages) |
| Backward | `⏪` | Generate last | Executive summary (needs all analysis) |

The Skill generates pages in three rounds:
1. **Round 1**: All independent pages (any order)
2. **Round 2**: Forward-dependent pages (after prerequisites complete)
3. **Round 3**: Backward-dependent pages (executive summary last)

## The 7 McKinsey Page Templates

The `layouts.md` reference file defines standardized page templates:

1. **Title + Single Chart** -- Single data story (trend charts, pie charts)
2. **Title + Left-Right Split** -- Comparison layout (chart + explanation)
3. **Title + 2x2 Matrix** -- Strategic positioning (BCG matrix, opportunity map)
4. **Title + Table** -- Multi-dimensional comparison
5. **Title + Waterfall** -- Growth decomposition (revenue drivers)
6. **Title + Timeline** -- Historical evolution
7. **Insight Summary** -- Chapter summary (3-5 key insights)

Each template specifies exact sizing, positioning, and styling rules, ensuring consistent output quality.

## Self-Check Protocol

After generating each page, the Skill runs 6 verification checks:

1. Layout matches the dummy page design
2. Chart type is correct
3. Real data used (not placeholder)
4. Design elements complete (colors, fonts, spacing)
5. Excel data row populated with sources
6. Source URLs recorded for traceability

If any check fails, the Skill reports the issue and waits for user guidance.

## Transferable Patterns

### Pattern 1: Navigation Core + Reference Files

For any Skill with >500 lines of instructions, split into:
- Core Skill (workflow navigation, ~300 lines)
- Reference files (loaded on-demand, released after use)

This pattern works for: report generators, code generators, curriculum builders, design systems.

### Pattern 2: Incremental Bounded Work

When output is unbounded (N pages, N chapters, N analyses), process one unit at a time:
- Load unit-specific context
- Execute with user confirmation gate
- Clear context before next unit

### Pattern 3: Dependency-Aware Generation

When output units have dependencies, classify and sort:
- Independent units first (parallel-safe)
- Forward-dependent units second
- Backward-dependent units last

### Pattern 4: Built-in Tools as MCP Substitutes

Before building an MCP server, check if built-in tools cover your needs:
- `WebSearch` replaces external search APIs
- `Write` replaces document generation services
- `Read` replaces configuration file servers
