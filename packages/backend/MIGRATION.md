# Claude Code as a Service - NestJS Migration

This document describes the complete migration from the custom Node.js implementation to NestJS.

## Migration Status: COMPLETE

All advanced features have been migrated to NestJS. The legacy `src/` directory can be safely deleted.

## Directory Structure

```
claude-code-as-a-service/
├── src/                          # LEGACY (can be deleted)
│   ├── server.ts                 # Old Socket.io server
│   ├── session-manager.ts        # Old session management
│   ├── event-mapper.ts           # Old event mapping
│   ├── skills/                   # Old skill management
│   ├── mcp/                      # Old MCP pool
│   ├── gateway/                  # Old auth middleware
│   └── types/                    # Old platform types
│
├── src-nestjs/                   # NEW NestJS implementation
│   ├── main.ts                   # Bootstrap
│   ├── app.module.ts             # Root module
│   │
│   ├── protocol/                 # Event types, errors, validation
│   │   ├── protocol.module.ts
│   │   ├── events.ts             # Frontend event types
│   │   ├── errors.ts             # Error codes & recovery
│   │   ├── metrics.ts            # Token/latency tracking
│   │   ├── output-schema.ts      # JSON Schema registry
│   │   ├── output-transformer.service.ts
│   │   ├── validation.service.ts # Ajv validation
│   │   └── index.ts
│   │
│   ├── auth/                     # Authentication & authorization
│   │   ├── auth.module.ts
│   │   ├── api-key.service.ts    # API key management
│   │   ├── types.ts              # Auth types & errors
│   │   ├── guards/
│   │   │   ├── api-key.guard.ts  # API key validation
│   │   │   └── scopes.guard.ts   # Scope authorization
│   │   ├── decorators/
│   │   │   └── index.ts          # @Auth, @Public, @TenantId, etc.
│   │   ├── dto/
│   │   │   └── api-key.dto.ts
│   │   ├── entities/
│   │   │   └── api-key.entity.ts
│   │   └── index.ts
│   │
│   ├── mcp/                      # MCP server management
│   │   ├── mcp.module.ts
│   │   ├── mcp-pool.service.ts   # Server lifecycle & health
│   │   ├── rest-adapter.service.ts # REST→MCP adapter
│   │   ├── types.ts              # MCP types
│   │   ├── entities/
│   │   │   └── mcp-server.entity.ts
│   │   └── index.ts
│   │
│   ├── chat/                     # Core relay module
│   │   ├── chat.module.ts
│   │   ├── chat.gateway.ts       # Socket.io WebSocket gateway
│   │   ├── chat.controller.ts    # REST endpoints
│   │   ├── session.service.ts    # CLI process management
│   │   ├── event-mapper.service.ts
│   │   └── dto/
│   │       └── chat-message.dto.ts
│   │
│   ├── skills/                   # Skill management
│   │   ├── skills.module.ts
│   │   ├── skills.controller.ts
│   │   ├── skills.service.ts
│   │   ├── skill-sync.service.ts
│   │   ├── skill-router.service.ts # NEW: Skill routing
│   │   ├── dto/
│   │   │   └── skill.dto.ts
│   │   └── entities/
│   │       ├── skill.entity.ts
│   │       └── skill-version.entity.ts
│   │
│   ├── tenants/                  # Multi-tenancy
│   │   ├── tenants.module.ts
│   │   ├── tenants.controller.ts
│   │   ├── tenants.service.ts
│   │   ├── tenant.guard.ts
│   │   ├── dto/
│   │   │   └── tenant.dto.ts
│   │   └── entities/
│   │       └── tenant.entity.ts
│   │
│   ├── messages/                 # Message persistence
│   │   ├── messages.module.ts
│   │   ├── messages.controller.ts
│   │   ├── messages.service.ts
│   │   ├── dto/
│   │   │   └── message.dto.ts
│   │   └── entities/
│   │       └── message.entity.ts
│   │
│   ├── files/                    # File management
│   │   ├── files.module.ts
│   │   ├── files.controller.ts
│   │   ├── files.service.ts
│   │   └── entities/
│   │       └── agent-file.entity.ts
│   │
│   ├── hooks/                    # Tool hooks
│   │   ├── types.ts
│   │   └── write-file-tracker.hook.ts
│   │
│   ├── common/                   # Shared utilities
│   │   ├── interfaces/
│   │   │   ├── cli-event.interface.ts
│   │   │   ├── frontend-event.interface.ts
│   │   │   ├── session.interface.ts
│   │   │   └── index.ts
│   │   ├── decorators/
│   │   │   └── current-tenant.decorator.ts
│   │   ├── filters/
│   │   │   └── ws-exception.filter.ts
│   │   └── pipes/
│   │       └── validation.pipe.ts
│   │
│   └── config/
│       └── configuration.ts
│
├── package.json                  # NestJS dependencies
├── tsconfig.json                 # TypeScript config
├── nest-cli.json                 # NestJS CLI config
└── .env.example                  # Environment variables
```

## Migration Summary

| Legacy Module | NestJS Equivalent | Description |
|---------------|-------------------|-------------|
| `src/server.ts` | `src-nestjs/main.ts` + `chat/` | Server bootstrap & WebSocket |
| `src/session-manager.ts` | `src-nestjs/chat/session.service.ts` | CLI process lifecycle |
| `src/event-mapper.ts` | `src-nestjs/chat/event-mapper.service.ts` | CLI→frontend events |
| `src/skills/` | `src-nestjs/skills/` | Skill CRUD + routing |
| `src/skills/router.ts` | `src-nestjs/skills/skill-router.service.ts` | Skill routing |
| `src/mcp/pool.ts` | `src-nestjs/mcp/mcp-pool.service.ts` | MCP server management |
| `src/mcp/adapters/rest-adapter.ts` | `src-nestjs/mcp/rest-adapter.service.ts` | REST→MCP adapter |
| `src/gateway/auth.middleware.ts` | `src-nestjs/auth/` | API key + scopes |
| `src/types/platform.types.ts` | `src-nestjs/auth/types.ts` + `mcp/types.ts` | Platform types |
| `src/protocol/` | `src-nestjs/protocol/` | Events, errors, metrics |
| N/A (NEW) | `src-nestjs/messages/` | Message persistence |
| N/A (NEW) | `src-nestjs/files/` | File tracking |
| N/A (NEW) | `src-nestjs/hooks/` | Tool hooks |

## New Features in NestJS

### 1. Protocol Module (`protocol/`)

Provides frontend-backend integration:

- **Event Types** (`events.ts`): Strongly-typed frontend events
- **Error Handling** (`errors.ts`): Error codes, retry policies
- **Metrics** (`metrics.ts`): Token accumulator, latency tracking
- **Output Schema** (`output-schema.ts`): JSON Schema registry for skill outputs
- **Validation** (`validation.service.ts`): Ajv-based schema validation
- **Transformation** (`output-transformer.service.ts`): Field mapping

### 2. Auth Module (`auth/`)

Complete API key authentication with scopes:

```typescript
// Decorators
@Public()           // Skip authentication
@OptionalAuth()     // Auth optional, context attached if provided
@Auth('skills:write') // Require specific scope
@RequireScopes('skills:read', 'skills:execute') // Multiple scopes
@TenantId()         // Get tenant ID from request
@Ctx()              // Get full request context
```

API Key features:
- SHA-256 hashed storage
- Scope-based permissions (9 scopes)
- Rate limiting per key
- Expiration support
- Usage tracking

### 3. MCP Module (`mcp/`)

MCP server pool with REST adapter:

- **McpPoolService**: Server lifecycle, health checks, tool execution
- **RestAdapterService**: Convert REST APIs to MCP tools
- **Health Monitoring**: Automatic health checks with configurable interval

### 4. Skill Router (`skills/skill-router.service.ts`)

Intelligent skill routing:

- Trigger-based matching (keyword, pattern, intent, context)
- System prompt generation
- Session context preparation
- CLI args generation
- Caching for performance

### 5. Message Persistence (`messages/`)

Store conversation history:

- User and assistant messages
- Token usage metadata
- File associations

### 6. File Tracking (`files/`)

Track files written by Claude:

- PostHook for Write tool
- Copy to persistent storage
- Download API

## Database Schema

```sql
-- Tenants
CREATE TABLE tenants (
  id UUID PRIMARY KEY,
  name VARCHAR,
  slug VARCHAR UNIQUE,
  config JSON,
  status VARCHAR,
  ...
);

-- API Keys
CREATE TABLE api_keys (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  name VARCHAR,
  key_hash VARCHAR(64) UNIQUE,
  key_prefix VARCHAR(16),
  scopes JSON,
  rate_limit_rpm INTEGER,
  status VARCHAR,
  ...
);

-- Skills
CREATE TABLE skills (
  id UUID PRIMARY KEY,
  tenant_id UUID,
  name VARCHAR,
  slug VARCHAR,
  content TEXT,
  type VARCHAR,
  config JSON,
  triggers JSON,
  status VARCHAR,
  ...
);

-- MCP Servers
CREATE TABLE mcp_servers (
  id UUID PRIMARY KEY,
  tenant_id UUID,
  name VARCHAR,
  slug VARCHAR,
  type VARCHAR,
  config JSON,
  tools JSON,
  health_status VARCHAR,
  ...
);

-- Messages
CREATE TABLE messages (
  id UUID PRIMARY KEY,
  session_id VARCHAR,
  tenant_id VARCHAR,
  role VARCHAR,
  content TEXT,
  metadata JSON,
  ...
);

-- Files
CREATE TABLE agent_files (
  id UUID PRIMARY KEY,
  message_id UUID REFERENCES messages(id),
  session_id VARCHAR,
  original_path VARCHAR,
  stored_path VARCHAR,
  filename VARCHAR,
  mime_type VARCHAR,
  size INTEGER,
  ...
);
```

## API Endpoints

### Authentication

```
# API Keys (admin scope)
GET    /api/v1/tenants/:tenantId/api-keys      # List keys
POST   /api/v1/tenants/:tenantId/api-keys      # Create key
PUT    /api/v1/api-keys/:id                     # Update key
DELETE /api/v1/api-keys/:id                     # Revoke key
```

### Skills

```
# CRUD
GET    /api/v1/skills              # List skills
POST   /api/v1/skills              # Create skill
GET    /api/v1/skills/:id          # Get skill
PUT    /api/v1/skills/:id          # Update skill
DELETE /api/v1/skills/:id          # Archive skill

# Lifecycle
POST   /api/v1/skills/:id/publish  # Publish
GET    /api/v1/skills/:id/versions # List versions
POST   /api/v1/skills/:id/versions # Create version
POST   /api/v1/skills/:id/rollback/:version # Rollback
```

### MCP Servers

```
GET    /api/v1/mcp-servers         # List servers
POST   /api/v1/mcp-servers         # Create server
GET    /api/v1/mcp-servers/:id     # Get server
PUT    /api/v1/mcp-servers/:id     # Update server
DELETE /api/v1/mcp-servers/:id     # Delete server
POST   /api/v1/mcp-servers/:id/health # Check health
```

### Messages & Files

```
GET    /api/v1/sessions/:id/messages    # List messages
GET    /api/v1/messages/:id             # Get message
GET    /api/v1/messages/:id/files       # List files
GET    /api/v1/files/:id/download       # Download file
```

## Running the Application

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod

# Type check
npm run typecheck
```

## Cleanup Instructions

After verifying the NestJS implementation works correctly:

```bash
# Remove legacy directories
rm -rf src/

# Remove backup files (if any)
rm -f package.original.json
rm -f tsconfig.original.json

# Update package.json scripts to remove legacy references
```

## Environment Variables

```bash
# Server
PORT=3001
NODE_ENV=development

# Database
DATABASE_PATH=.agent-workspace/data.db

# Workspace
WORKSPACE_DIR=.agent-workspace

# Auth
AUTH_ALLOW_ANONYMOUS=true
AUTH_ENABLE_RATE_LIMITING=true

# MCP
MCP_HEALTH_CHECK_INTERVAL_MS=60000

# Debug
DEBUG=false
```
