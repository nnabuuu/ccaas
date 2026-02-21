# Solution Development Guide

## Overview

A Solution is a vertical application built on the KedgeAgentic platform. Each Solution consists of a frontend, backend (optional), MCP Server, and Skills, working together to deliver an end-to-end user experience.

## Architecture

```
User ──→ Solution Frontend
            │                │
            │ WebSocket      │ REST
            │ (AI Chat)      │ (Domain Data)
            ▼                ▼
      CCAAS Backend    Solution Backend
            │                │
            ▼                ▼
      AI Agent         Business Data Store
            │
            ▼
      MCP Server
      (Tool Invocations)
```

**Key Principle**: The Solution frontend connects **directly** to the CCAAS backend via WebSocket for AI interactions. The Solution backend is only responsible for domain-specific CRUD operations (e.g., saving lesson plans). There is no relay layer between the frontend and CCAAS.

## Directory Structure

```
my-solution/
├── solution.json           # Solution configuration (required)
├── setup.sh                # One-click startup script
├── inject-skills.sh        # Skill injection script
│
├── frontend/               # Frontend application
│   ├── package.json
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── hooks/          # Custom hooks (Socket.io, sync, etc.)
│   │   └── types/          # TypeScript types
│   └── ...
│
├── backend/                # Domain backend (optional)
│   ├── package.json
│   ├── src/
│   │   ├── domain/         # Domain entities and logic
│   │   └── api/            # REST endpoints for domain CRUD
│   └── ...
│
├── mcp-server/             # MCP tool service
│   ├── package.json
│   ├── src/
│   │   └── index.ts        # Tool definitions and implementation
│   └── ...
│
└── skills/                 # AI Skill definitions
    └── my-skill/
        └── SKILL.md        # Skill Markdown file
```

## solution.json Configuration (v3.0)

**Recommended:** Use the simplified v3.0 schema with convention over configuration.

**Minimal Configuration (Most Common):**

```json
{
  "schemaVersion": "3.0",
  "tenant": {
    "name": "My Solution",
    "slug": "my-solution",
    "description": "Solution description"
  },
  "mcpServers": {
    "my-tools": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"],
      "description": "Tool service description"
    }
  }
}
```

**That's it!** Skills are auto-discovered from `skills/*/SKILL.md`. All skill metadata lives in SKILL.md frontmatter.

**With Solution-Specific Config:**

```json
{
  "schemaVersion": "3.0",
  "tenant": {
    "name": "My Solution",
    "slug": "my-solution",
    "description": "Solution description"
  },
  "mcpServers": {
    "my-tools": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"]
    }
  },
  "backend": {
    "port": 3002,
    "database": {
      "type": "sqlite",
      "path": "data/my-solution.db"
    }
  },
  "frontend": {
    "port": 5280
  }
}
```

**Key Changes from v2.0:**
- ✅ Flat structure (no `ccaas`/`internal` nesting)
- ✅ Skills auto-discovered (default: `["skills/*"]`)
- ✅ Skill metadata in SKILL.md frontmatter only
- ✅ 70-80% configuration reduction

**See:** [solution.json Reference](../reference/solution-json.md) for complete schema documentation.

### SKILL.md Frontmatter

v3.0 requires complete frontmatter in all SKILL.md files:

```markdown
---
name: Main Skill
slug: main-skill
description: Main skill description
scope: tenant
triggers:
  - type: keyword
    value: "design"
    priority: 10
allowedTools:
  - write_output
  - custom_tool
---

# Main Skill

Instructions for the AI agent...
```

### Trigger Types

| Type | Description | Example |
|------|-------------|---------|
| `keyword` | Message contains keyword | `"design"`, `"generate"` |
| `pattern` | Regex pattern match | `"(please )?(help me )?design.*lesson plan"` |
| `intent` | Semantic intent recognition | `"create_lesson_plan"` |
| `context` | Context condition match | `"page:lesson-plan-editor"` |

## Installing the SDK

SDK packages are published to the npm public registry and can be installed directly:

```bash
# React frontend
npm install @kedge-agentic/react-sdk@0.1.0

# Vue frontend
npm install @kedge-agentic/vue-sdk@0.1.0

# Shared types only (for MCP Server / backend use)
npm install @kedge-agentic/common@0.1.0
```

If developing inside the monorepo, the local source in `packages/*` is used automatically — no separate install needed.

## Direct Connection with React SDK

The Solution frontend connects directly to the CCAAS backend using the `@kedge-agentic/react-sdk`. No relay layer is needed:

```typescript
import {
  useAgentConnection,
  useAgentChat,
  useAgentStatus,
  usePageContext,
  useFiles,
} from '@kedge-agentic/react-sdk'

export function useMySession() {
  // 1. Connect directly to CCAAS backend
  const connection = useAgentConnection({
    serverUrl: 'http://localhost:3001',  // CCAAS backend directly
    tenantId: 'my-solution',
    autoConnect: true,
  })

  // 2. Page context (sends current form state with every message)
  const { context, updateContext } = usePageContext()

  // 3. Chat messaging (REST send + WebSocket receive)
  const chat = useAgentChat({
    connection,
    tenantId: 'my-solution',
    mcpServers: solutionConfig?.mcpServers,
    skillPath: solutionConfig?.skillPath,
    enabledSkillSlugs: ['my-skill'],
    context,
    onOutputUpdate: (update) => {
      // Handle structured field updates from the AI Agent
      const { field, value, preview } = update
      // Apply to your form state...
    },
  })

  // 4. Agent status tracking
  const status = useAgentStatus({ connection })

  // 5. File management
  const files = useFiles({
    connection,
    sessionId: connection.sessionId,
    enabled: connection.connected,
  })
}
```

## Data Flow in Detail

A complete user interaction follows this sequence:

1. User enters a message in the frontend
2. Frontend sends a REST request to CCAAS (`POST /api/v1/sessions/:id/completion`)
3. CCAAS resolves the tenant, synchronizes Skills, and creates a session
4. CCAAS launches the AI Agent process
5. AI Agent reads Skill instructions and page context
6. AI Agent invokes MCP tools (e.g., write\_output)
7. CCAAS streams events back to the frontend via WebSocket (`text_delta`, `output_update`, `agent_status`, etc.)
8. SDK hooks process events into React state automatically
9. Frontend renders results in real time
10. User reviews and edits

## One-Click Startup Script

`setup.sh` should include:

```bash
#!/bin/bash

# Ensure CCAAS backend is running
echo "Checking CCAAS backend..."
curl -s http://localhost:3001/api/v1/chat/health > /dev/null || {
  echo "Please start the CCAAS backend first: npm run dev:backend"
  exit 1
}

# Install dependencies
npm install --prefix backend
npm install --prefix frontend
npm install --prefix mcp-server

# Build MCP Server
npm run build --prefix mcp-server

# Note: Skills are auto-registered by the CCAAS backend at startup.
# No manual skill injection needed.

# Start services
npm run dev --prefix backend &
npm run dev --prefix frontend &

echo "Solution startup complete!"
```

## Automatic Skill Registration

Skills and MCP servers defined in `solution.json` are **automatically registered** when the CCAAS backend starts. No manual registration step is required.

**How it works:**
1. On startup, the CCAAS backend scans the `solutions/` directory
2. For each solution with `discovery.enabled: true` (the default), it reads `solution.json`
3. Skills are loaded from each folder matching the `skills` pattern (default: `skills/*/SKILL.md`)
4. MCP servers from `mcpServers` are registered automatically
5. Existing registrations are updated (upsert logic)

**Startup log output:**
```
[SolutionLoader] Starting auto-discovery of solutions...
[SolutionLoader] Loaded "My Solution": 2 skills created, 1 MCP servers created
[SolutionLoader] Auto-discovery complete: 1 solution(s) loaded, 0 failed, 2 skill(s), 1 MCP server(s)
```

**To disable auto-registration for a solution**, set `discovery.enabled: false` in `solution.json`:

```json
{
  "schemaVersion": "3.0",
  "tenant": { ... },
  "discovery": { "enabled": false }
}
```

Solutions with `discovery.enabled: false` are completely skipped on startup — no skills or MCP servers are loaded. This is useful for work-in-progress solutions you want to keep in the repo but not expose yet.

**To activate a disabled solution:** set `enabled: true` (or remove the `discovery` block entirely) and restart the backend. Skills and MCP servers are registered automatically on the next startup.

**Prefer manual control?** You can import any solution on-demand regardless of its `enabled` flag:

```bash
# Import a specific solution manually (bypasses discovery.enabled)
npm run skill:import -- <solution-name>
npm run skill:import -- quiz-analyzer --verbose
```

This is useful when you want fine-grained control over which solutions are loaded and when — without restarting the backend.


## Best Practices

### 1. Use Direct Connection Architecture

- Connect the frontend **directly** to CCAAS via `@kedge-agentic/react-sdk` -- do not relay through the Solution backend
- Use the Solution backend only for domain-specific CRUD (e.g., saving lesson plans, listing textbooks)
- Use CCAAS session management instead of implementing your own
- Manage Skills through the CCAAS API instead of directly accessing the database

### 2. Test Before You Code

```
Before modifying any code:
□ Run npm test to confirm all current tests pass
□ If changing APIs or interfaces, review frontend type definitions and existing tests first

After modifying code:
□ Run related tests immediately -- don't wait until the end
□ Test failure = stop and analyze, don't push forward
```

### 3. Handle output\_update via SDK Callback

```typescript
// The SDK parses output_update events for you.
// Use the onOutputUpdate callback in useAgentChat:
const chat = useAgentChat({
  connection,
  // ...
  onOutputUpdate: (update) => {
    // update is already parsed: { field, value, preview }
    const { field, value, preview } = update
    // Apply to your form state...
  },
})
```

### 4. Comprehensive Error Handling

```typescript
// The SDK exposes connection errors via the connection object:
const connection = useAgentConnection({ serverUrl, tenantId })

useEffect(() => {
  if (connection.error) {
    console.error('Connection error:', connection.error)
    // Notify user or attempt reconnect
  }
}, [connection.error])
```
