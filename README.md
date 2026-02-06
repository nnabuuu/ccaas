# Claude Code as a Service (CCAAS)

A production-ready relay service for AgentEngine instances (Claude Code, OpenCode, custom engines), built with NestJS. This monorepo contains all packages needed to run and interact with the service.

## Packages

| Package | Description | Port |
|---------|-------------|------|
| [`@ccaas/backend`](./packages/backend) | NestJS API server, session management, skill routing | 3001 |
| [`@ccaas/admin`](./packages/admin) | Vue 3 admin dashboard for skill/session management | 5174 |
| [`@ccaas/vue-sdk`](./packages/vue-sdk) | Vue composables for agent integration | - |
| [`@ccaas/common`](./packages/shared) | Shared TypeScript types and protocols | - |

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│   Frontend  │◄───►│  @ccaas/backend  │◄───►│  AgentEngine        │
│ (Vue 3)     │     │  (NestJS)        │     │ (claude/opencode)   │
└─────────────┘     └──────────────────┘     └─────────────────────┘
      │                     │
      └──────@ccaas/vue-sdk │
             │              │
             └──@ccaas/common
```

**Supported AgentEngine Types:**
- **Claude Code** - Anthropic's official CLI (default)
- **OpenCode** - Open-source alternative
- **Custom Engines** - Your own implementation

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0

### Installation

```bash
# Clone and install
cd ccaas
npm install

# Build shared package first (required for other packages)
npm run build:shared
```

### Development

```bash
# Start backend (port 3001)
npm run dev:backend

# Start admin UI (port 5174)
npm run dev:admin

# Build all packages
npm run build
```

## Package Scripts

### Root-level Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start all packages in dev mode |
| `npm run build` | Build all packages |
| `npm run test` | Run all tests |
| `npm run typecheck` | Type-check all packages |
| `npm run lint` | Lint all packages |
| `npm run clean` | Clean all build artifacts |

### Per-package Commands

```bash
# Backend
npm run dev:backend       # Start dev server
npm run build:backend     # Build for production

# Admin UI
npm run dev:admin         # Start dev server
npm run build:admin       # Build for production

# Vue SDK
npm run build:vue-sdk     # Build library

# Shared
npm run build:shared      # Build types/protocols
```

## Features

### Backend (`@ccaas/backend`)

- **AgentEngine Lifecycle Management**: Spawn and manage AgentEngine instances (Claude Code, OpenCode, custom)
- **Skill Routing**: Trigger-based routing (keyword, pattern, intent)
- **Multi-tenancy**: Tenant isolation with API key authentication
- **MCP Integration**: MCP server pool with REST adapter
- **Message Persistence**: SQLite/PostgreSQL storage
- **Real-time Streaming**: Socket.io event streaming

### Admin UI (`@ccaas/admin`)

- **Dashboard**: Overview metrics and active sessions
- **Session Management**: View, monitor, and terminate sessions
- **Skill Management**: CRUD, versioning, and publishing workflow
- **Analytics**: Token usage and cost tracking

### Vue SDK (`@ccaas/vue-sdk`)

- **useAgentState**: Centralized agent state management
- **useFormBridge**: Form synchronization with agent
- **useAIEditing**: AI-assisted editing mode
- **usePlanMode**: Plan proposal handling
- **useToolActivity**: Tool execution tracking
- **useTokenUsage**: Real-time token metrics

### Shared (`@ccaas/common`)

- **Types**: Session, Message, Skill, Tenant, ApiKey interfaces
- **Protocols**: Output update event definitions
- **Validators**: Zod-based runtime validation

## Environment Variables

### Backend

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3001 | Server port |
| `DATABASE_PATH` | .agent-workspace/data.db | SQLite database |
| `AUTH_ALLOW_ANONYMOUS` | true | Allow unauthenticated requests |

### Admin UI

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | http://localhost:3001 | Backend API URL |
| `VITE_DEMO_API_KEY` | - | Demo API key for quick access |

## API Authentication

The backend uses API key authentication with scope-based authorization:

```bash
# Create API key via REST
POST /api/v1/tenants/:tenantId/api-keys
{
  "name": "My API Key",
  "scopes": ["skills:read", "skills:execute", "chat"]
}
```

**Available Scopes:**
- `skills:read`, `skills:write`, `skills:execute`, `skills:delete`
- `mcp:read`, `mcp:write`
- `chat`
- `analytics:read`
- `admin`

## Documentation

- [Backend Architecture](./packages/backend/CLAUDE.md)
- [Vue SDK Architecture](./packages/vue-sdk/docs/ARCHITECTURE.md)
- [Shared Package](./packages/shared/README.md)

## License

MIT
