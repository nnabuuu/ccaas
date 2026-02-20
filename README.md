# KedgeAgentic

**Chinese Name (中文名称):** 即见Agentic

A production-ready relay service for AgentEngine instances (Claude Code, OpenCode, custom engines), built with NestJS. This monorepo contains all packages needed to run and interact with the KedgeAgentic platform.

## Packages

| Package | Description | Port |
|---------|-------------|------|
| [`@kedge-agentic/backend`](./packages/backend) | NestJS API server, session management, skill routing | 3001 |
| [`@kedge-agentic/admin`](./packages/admin) | Vue 3 admin dashboard for skill/session management | 5174 |
| [`@kedge-agentic/vue-sdk`](./packages/vue-sdk) | Vue composables for agent integration | - |
| [`@kedge-agentic/common`](./packages/shared) | Shared TypeScript types and protocols | - |

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│   Frontend  │◄───►│  @kedge-agentic/backend  │◄───►│  AgentEngine        │
│ (Vue 3)     │     │  (NestJS)        │     │ (claude/opencode)   │
└─────────────┘     └──────────────────┘     └─────────────────────┘
      │                     │
      └──────@kedge-agentic/vue-sdk │
             │              │
             └──@kedge-agentic/common
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

### Backend (`@kedge-agentic/backend`)

- **AgentEngine Lifecycle Management**: Spawn and manage AgentEngine instances (Claude Code, OpenCode, custom)
- **Skill Routing**: Trigger-based routing (keyword, pattern, intent)
- **Multi-tenancy**: Tenant isolation with API key authentication
- **Standardized Error Handling**: Unified HTTP error responses with retry guidance
- **MCP Integration**: MCP server pool with REST adapter
- **Message Persistence**: SQLite/PostgreSQL storage
- **Real-time Streaming**: Socket.io event streaming

### Admin UI (`@kedge-agentic/admin`)

- **Dashboard**: Overview metrics and active sessions
- **Session Management**: View, monitor, and terminate sessions
- **Skill Management**: CRUD, versioning, and publishing workflow
- **Analytics**: Token usage and cost tracking

### Vue SDK (`@kedge-agentic/vue-sdk`)

- **useAgentState**: Centralized agent state management
- **useFormBridge**: Form synchronization with agent
- **useAIEditing**: AI-assisted editing mode
- **usePlanMode**: Plan proposal handling
- **useToolActivity**: Tool execution tracking
- **useTokenUsage**: Real-time token metrics

### Shared (`@kedge-agentic/common`)

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

KedgeAgentic uses a **modern API key system** with SHA-256 hashing, granular scopes, rate limiting, and audit logging.

### Two-Tier Key System

```
┌─────────────────────────────────────────────────┐
│ Bootstrap Admin Key (Platform Administrator)    │
│ sk-default-xxxxx                                │
│ Scopes: [admin, skills:*, mcp:*, chat]         │
│                                                 │
│ Purpose:                                        │
│ - Create/manage all tenants                     │
│ - Create API keys for any tenant                │
│ - Access admin APIs                             │
│ - Never share with solution builders            │
└─────────────────────────────────────────────────┘
                    │
                    │ creates
                    ▼
┌─────────────────────────────────────────────────┐
│ Tenant API Keys (Solution Builders)             │
│ sk-{tenant-slug}-xxxxx                          │
│ Scopes: [skills:*, mcp:*, chat] (customizable) │
│                                                 │
│ Purpose:                                        │
│ - Inject skills for specific tenant             │
│ - Register MCP servers for specific tenant      │
│ - Send chat messages (optional)                 │
│ - Isolated to single tenant                     │
└─────────────────────────────────────────────────┘
```

### On-Prem Deployment Workflow

#### 1. Platform Administrator Setup (One-Time)

**Get Bootstrap Admin Key:**

```bash
# Start backend
cd packages/backend
npm run start:dev

# Check logs for auto-generated key
[ApiKeyService] Created default API key: sk-default-xxxxxxxxxxxxx
Save this key - it won't be shown again!

# Save to environment
export CCAAS_BOOTSTRAP_KEY=sk-default-xxxxxxxxxxxxx
```

**Alternative: Create Bootstrap Key Manually (if needed):**

```bash
# If default key wasn't created or was lost, create one in database
cd packages/backend
RAW_KEY="sk-default-$(openssl rand -hex 16)"
KEY_HASH=$(echo -n "$RAW_KEY" | openssl dgst -sha256 -binary | xxd -p -c 256)
DEFAULT_TENANT_ID=$(sqlite3 .agent-workspace/data.db "SELECT id FROM tenants WHERE slug='default' LIMIT 1;")

sqlite3 .agent-workspace/data.db <<EOF
INSERT INTO api_keys (
  id, tenantId, name, keyHash, keyPrefix, scopes,
  rateLimitRpm, rateLimitRpd, status, createdAt, updatedAt
) VALUES (
  lower(hex(randomblob(16))), '$DEFAULT_TENANT_ID',
  'Bootstrap Admin Key', '$KEY_HASH', '${RAW_KEY:0:16}',
  '["admin","skills:write","skills:read","mcp:write","mcp:read","chat"]',
  1000, 100000, 'active', datetime('now'), datetime('now')
);
EOF

echo "Bootstrap Key: $RAW_KEY"
```

#### 2. Create Tenant and API Key for Solution Builder

**Option A: Using solution-lib.sh (Recommended)**

```bash
source tools/solution-lib.sh

# Create tenant
eval "$(create_or_get_tenant http://localhost:3001 solution-name 'Solution Name' 'Description')"
# Returns: TENANT_ID

# Create API key for this tenant
eval "$(create_solution_api_key http://localhost:3001 $TENANT_ID $CCAAS_BOOTSTRAP_KEY 'Solution Name')"
# Returns: API_KEY (sk-solution-name-xxxxx)

echo "Tenant ID: $TENANT_ID"
echo "API Key: $API_KEY"
# ⚠️ Save this API key - it's only shown once!
```

**Option B: Using Admin API Directly**

```bash
# 1. Create tenant
curl -X POST http://localhost:3001/api/v1/tenants \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Solution Name",
    "slug": "solution-name",
    "description": "Solution description"
  }'
# Response: { "id": "tenant-id-here", ... }

# 2. Create API key for tenant
curl -X POST http://localhost:3001/api/v1/admin/api-keys \
  -H "Authorization: Bearer $CCAAS_BOOTSTRAP_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "tenant-id-here",
    "name": "Solution Builder Key",
    "scopes": ["skills:write", "skills:read", "mcp:write", "mcp:read", "chat"],
    "rateLimitRpm": 1000,
    "rateLimitRpd": 100000
  }'
# Response: { "apiKey": {...}, "rawKey": "sk-solution-name-xxxxx" }
# ⚠️ rawKey is only shown once!
```

#### 3. Share with Solution Builder

**Provide to builder:**
- CCAAS Backend URL: `http://your-domain:3001`
- Tenant ID: `solution-name`
- API Key: `sk-solution-name-xxxxx`

**Builder can immediately:**

```bash
# Inject skills
curl -X POST http://your-domain:3001/api/v1/skills \
  -H "Authorization: Bearer sk-solution-name-xxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Skill",
    "slug": "my-skill",
    "content": "...",
    "type": "skill"
  }'

# Register MCP server
curl -X POST http://your-domain:3001/api/v1/mcp-servers \
  -H "Authorization: Bearer sk-solution-name-xxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My MCP Server",
    "type": "stdio",
    "config": {...}
  }'
```

**Frontend integration (no API key needed):**

```typescript
// React
import { useAgentChat } from '@kedge-agentic/react-sdk'

const chat = useAgentChat({
  serverUrl: 'http://your-domain:3001',
  tenantId: 'solution-name',
  // No API key needed for frontend
})

// Vue
import { useAgentState } from '@kedge-agentic/vue-sdk'

const agent = useAgentState({
  serverUrl: 'http://your-domain:3001',
  tenantId: 'solution-name',
})
```

### API Key Management

**List keys:**
```bash
GET /api/v1/admin/api-keys?tenantId={tenantId}
Authorization: Bearer {bootstrap-key}
```

**Revoke key:**
```bash
POST /api/v1/admin/api-keys/{id}/revoke
Authorization: Bearer {bootstrap-key}
```

**Delete key:**
```bash
DELETE /api/v1/admin/api-keys/{id}
Authorization: Bearer {bootstrap-key}
```

**Update key (scopes, rate limits):**
```bash
PUT /api/v1/admin/api-keys/{id}
Authorization: Bearer {bootstrap-key}
Content-Type: application/json

{
  "scopes": ["skills:read", "chat"],
  "rateLimitRpm": 500
}
```

### Available Scopes

| Scope | Description |
|-------|-------------|
| `skills:read` | Read skills |
| `skills:write` | Create/update skills |
| `skills:execute` | Execute skills |
| `skills:delete` | Delete skills |
| `mcp:read` | Read MCP servers |
| `mcp:write` | Create/update MCP servers |
| `chat` | Send chat messages |
| `analytics:read` | Read analytics |
| `admin` | Full admin access (create API keys, manage tenants) |

### Security Best Practices

1. **Bootstrap Key Protection**
   - Never commit to git
   - Store securely (secrets manager, encrypted vault)
   - Rotate periodically
   - Never share with solution builders

2. **Tenant Key Isolation**
   - One tenant = one solution builder
   - Each builder gets their own API key
   - Keys are isolated to single tenant
   - Revoke immediately if compromised

3. **Rate Limiting**
   - Set appropriate RPM (requests/minute) and RPD (requests/day)
   - Default: 1000 RPM, 100,000 RPD
   - Adjust based on solution needs

4. **Audit Logging**
   - All API key operations are logged
   - Track key creation, usage, revocation
   - Review logs regularly for suspicious activity

### Troubleshooting

**"Invalid API key format"**
- Modern keys use `sk-` prefix (hyphen), not `sk_` (underscore)
- Ensure you're using a key created via admin API

**"Bootstrap key required"**
- Check backend logs for auto-generated key on first startup
- Or create manually using the SQL script above

**"Insufficient permissions"**
- Verify key has required scopes
- Check key status (active vs revoked)
- Verify expiration date (if set)

## Documentation

### Architecture & Development
- [Backend Architecture](./packages/backend/CLAUDE.md)
- [Vue SDK Architecture](./packages/vue-sdk/docs/ARCHITECTURE.md)
- [React SDK](./packages/react-sdk/README.md)
- [Shared Package](./packages/shared/README.md)

### Authentication & Security
- [Authentication & Authorization Guide](./packages/backend/docs/AUTHENTICATION_AND_AUTHORIZATION.md)
- [API Key System Migration](./LEGACY_API_KEY_REMOVAL.md)

### Solution Development
- [Solution Development Toolkit](./tools/README.md)
- [Error Handling](./packages/backend/docs/ERROR_HANDLING.md)

## License

MIT
