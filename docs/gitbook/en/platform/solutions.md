# Solution Showcase

Solutions are vertical applications built on the KedgeAgentic platform. Each Solution includes a dedicated frontend interface, business backend, MCP tools, and AI Skills, demonstrating the platform's capabilities across different domains.

## Smart Agri Service

### Overview

An AI-powered agricultural advisory platform with dual-persona design. One dataset powers two completely different user experiences -- a warm farmer advisor and a formal credit analyst -- through separate Skills and session templates.

### Key Features

- **Dual-Mode Design** -- Farmer advisor (7 output fields) and bank credit assessor (8 output fields) from the same data
- **11 MCP Tools** -- Data fetchers, computed summaries, policy/product search, and output sync
- **Policy Citation** -- AI cites specific policy clauses with verifiable links to original documents
- **Progressive Output** -- `write_output` + SSE renders structured fields in real time as analysis progresses
- **50 Demo Farmers** -- SQLite database with complete profiles, land, crops, equipment, and loan history

### Technical Highlights

- React 18 frontend + NestJS solution backend + SQLite (WAL mode)
- MCP server with stdio transport, 11 tools across 3 categories
- Session persistence enables instant resume from `output_update` events

---

## McKinsey CLI

### Overview

A structured business analysis tool following McKinsey's consulting methodology. Demonstrates the pure-Skill, zero-MCP architecture -- a single powerful Skill replaces all MCP tools by leveraging built-in capabilities (web search, file generation).

### Key Features

- **Zero MCP** -- No tool server needed; built-in WebSearch + Write + Read tools are sufficient
- **9-Step Workflow** -- Problem definition, MECE issue tree, page design, incremental PPTX generation
- **Progressive Disclosure** -- 300-line core SKILL.md + 7 on-demand reference files, loaded and released per phase
- **Incremental Generation** -- One page at a time with self-check protocol, supporting 20-25 page decks
- **Dual Client** -- Vue 3 web frontend and Node.js CLI client share the same session API

### Technical Highlights

- Single Skill with 1400 total lines split across navigation core + reference files
- Page dependency management (independent, forward, backward) for generation ordering
- 7 McKinsey page layout templates with strict design system

---

## Demo Examples

The platform includes **12 progressive demo examples**, each demonstrating a single platform feature. These serve as learning resources and starting points for new Solutions.

| Demo | Feature |
|------|---------|
| 01-pure-chat | Basic AI chat |
| 02-multi-template | Multiple session templates |
| 03-sse-events | SSE event streaming |
| 04-write-output | Structured output sync |
| 05-skill-frontmatter | Skill metadata |
| 06-skill-routing | Multi-skill routing |
| 07-workflow-skill | Workflow Skills |
| 08-output-operations | Output operations |
| 09-skill-prompt-mode | Prompt mode config |
| 10-append-prompt | System prompt appending |
| 11-tool-event-triggers | Tool event hooks |
| 12-sync-fields | Real-time field sync |

Source code: [kedge-agentic/examples](https://github.com/kedge-agentic/examples)

---

## Build Your Own Solution

The KedgeAgentic platform provides a complete Solution development framework, enabling developers to quickly build applications for specific use cases.

For details, see the [Solution Development Guide](../guide/solution-dev.md).

### Standard Solution Structure

```
my-solution/
├── frontend/        # Frontend application
├── backend/         # Business backend (optional)
├── mcp-server/      # MCP tool services
├── skills/          # AI Skill definitions
├── solution.json    # Solution configuration
├── setup.sh         # One-click startup script
└── inject-skills.sh # Skill injection script
```

### Key Configuration -- solution.json

```json
{
  "name": "My Solution",
  "slug": "my-solution",
  "version": "1.0.0",
  "description": "Solution description",
  "mcpServers": {
    "my-tools": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"],
      "description": "Custom tool services"
    }
  },
  "skills": [
    {
      "name": "My Skill",
      "slug": "my-skill",
      "description": "Skill description",
      "triggers": [{ "type": "keyword", "value": "keyword" }],
      "allowedTools": ["write_output", "my_tool"],
      "skillFile": "skills/my-skill/SKILL.md"
    }
  ]
}
```
