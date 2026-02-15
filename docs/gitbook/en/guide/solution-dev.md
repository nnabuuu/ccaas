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

## solution.json Configuration

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
      "description": "Tool service description"
    }
  },
  "skills": [
    {
      "name": "Main Skill",
      "slug": "main-skill",
      "description": "Main skill description",
      "type": "prompt",
      "triggers": [
        {
          "type": "keyword",
          "value": "design",
          "priority": 1
        }
      ],
      "allowedTools": ["write_output", "custom_tool"],
      "skillFile": "skills/main-skill/SKILL.md"
    }
  ],
  "ports": {
    "backend": 3002,
    "frontend": 5280
  }
}
```

### Trigger Types

| Type | Description | Example |
|------|-------------|---------|
| `keyword` | Message contains keyword | `"design"`, `"generate"` |
| `pattern` | Regex pattern match | `"(please )?(help me )?design.*lesson plan"` |
| `intent` | Semantic intent recognition | `"create_lesson_plan"` |
| `context` | Context condition match | `"page:lesson-plan-editor"` |

## Direct Connection with React SDK

The Solution frontend connects directly to the CCAAS backend using the `@ccaas/react-sdk`. No relay layer is needed:

```typescript
import {
  useAgentConnection,
  useAgentChat,
  useAgentStatus,
  usePageContext,
  useFiles,
} from '@ccaas/react-sdk'

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

# Inject Skills
./inject-skills.sh

# Start services
npm run dev --prefix backend &
npm run dev --prefix frontend &

echo "Solution startup complete!"
```

## Skill Injection

`inject-skills.sh` is responsible for registering Skills with CCAAS:

```bash
#!/bin/bash
CCAAS_URL="http://localhost:3001"

# Read Skill configuration from solution.json
# Call the CCAAS API to register Skills
curl -X POST "$CCAAS_URL/api/v1/skills" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Skill",
    "slug": "my-skill",
    "description": "Skill description",
    "type": "prompt",
    "content": "'"$(cat skills/my-skill/SKILL.md)"'",
    "triggers": [{"type": "keyword", "value": "keyword"}],
    "allowedTools": ["write_output"]
  }'

# Register MCP Server
curl -X POST "$CCAAS_URL/api/v1/mcp-servers" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-tools",
    "url": "http://localhost:3004",
    "description": "Tool service"
  }'
```

## Best Practices

### 1. Use Direct Connection Architecture

- Connect the frontend **directly** to CCAAS via `@ccaas/react-sdk` -- do not relay through the Solution backend
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
