# CLAUDE.md - EduAgent Solution

## Overview

EduAgent is a unified AI education assistant solution that combines lesson plan design and problem explanation into a single application with a hub-based navigation architecture.

## Architecture

```
edu-agent/
├── frontend/          # React 18 + Router v6 + Tailwind (port 5284)
├── backend/           # NestJS (port 3010)
├── mcp-server/        # Unified stdio MCP server (11 tools)
├── data/              # Textbooks, curriculum standards, knowledge points
└── skills/edu-agent/  # SKILL.md
```

## Key Patterns

### SSE Transport

Frontend uses `@kedge-agentic/react-sdk` with SSE transport to communicate with CCAAS backend.

```typescript
const connection = useAgentConnection({
  serverUrl: 'http://localhost:3001',  // Absolute URL to CCAAS
  sessionPrefix: 'edu',
  transport: 'sse',
  autoConnect: true,
})
```

### Navigation via output_update

The `navigate_to` MCP tool returns data in output_update format with `field: "__navigation__"`. The frontend `NavigationHandler` component intercepts this and uses react-router to navigate.

### Session Continuity

`SessionContext` wraps the entire app, so the SSE connection and chat messages persist across page navigations.

### Output Update Handlers

Each page registers its own output update handler via `registerOutputHandler()`. The lesson plan page handles LP fields, the problem page handles problem fields. Both ignore `__navigation__` events.

## Ports

| Service | Port |
|---------|------|
| Frontend | 5284 |
| Backend | 3010 |
| CCAAS Backend | 3001 (required) |

## Build & Run

```bash
# Install and build MCP server
cd mcp-server && npm install && npm run build

# Start backend
cd backend && npm install && npm run start:dev

# Start frontend
cd frontend && npm install && npm run dev
```

## Dependencies

- `@kedge-agentic/react-sdk` — React hooks for SSE + session management
- `@kedge-agentic/common` — Shared types and Zod schemas
- CCAAS Backend must be running on port 3001
