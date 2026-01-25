# Claude Code as a Service

A business platform that enables customers to build customized AI skills, integrate with legacy systems via REST API adapters, and manage skills through a comprehensive API.

## Features

- **Skill Management API** - Full CRUD operations with semantic versioning
- **Multi-tenant Support** - API key authentication with scoped permissions
- **REST API Adapter** - Connect legacy REST APIs as MCP tools
- **MCP Server Pool** - Manage MCP server lifecycle and health
- **Skill-aware Routing** - Route chat requests to appropriate skills
- **Backward Compatible** - Basic relay server still available

## Quick Start

```bash
# Install dependencies
npm install

# Start the platform server (v2)
npm run dev:platform

# Or start the basic relay server (v1 - backward compatible)
npm run dev
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CLAUDE CODE AS A SERVICE PLATFORM                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                      API GATEWAY LAYER                              │ │
│  │  • Authentication (API Keys)                                        │ │
│  │  • Rate Limiting (per tenant)                                       │ │
│  │  • WebSocket Multiplexing (Socket.io)                               │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                    │                                     │
│  ┌────────────────────────────────▼────────────────────────────────────┐│
│  │                    ORCHESTRATION LAYER                              ││
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ││
│  │  │ Session Manager  │  │  Skill Router    │  │ Tenant Registry  │  ││
│  │  │ • Session Pool   │  │ • Resolution     │  │ • Config Store   │  ││
│  │  │ • TTL/Cleanup    │  │ • Versioning     │  │ • Quotas         │  ││
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘  ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                    │                                     │
│  ┌────────────────────────────────▼────────────────────────────────────┐│
│  │                      EXECUTION LAYER                                ││
│  │  Relay Server (Claude Code CLI + MCP Servers)                       ││
│  │  • Persistent CLI processes per session                             ││
│  │  • Tenant-isolated workspaces                                       ││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                    │                                     │
│  ┌────────────────────────────────▼────────────────────────────────────┐│
│  │                    MCP SERVER LAYER                                 ││
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────┐││
│  │  │ Platform MCP   │  │ REST Adapter   │  │ Custom MCP             │││
│  │  │ (Built-in)     │  │ (Legacy APIs)  │  │ (Per-tenant)           │││
│  │  └────────────────┘  └────────────────┘  └────────────────────────┘││
│  └─────────────────────────────────────────────────────────────────────┘│
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │                    SKILL & PERSISTENCE LAYER                        ││
│  │  Skill Registry │ Version Manager │ File/PostgreSQL Storage         ││
│  └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

## API Endpoints

### Platform API (v1)

Base URL: `http://localhost:3001/api/v1`

#### Skills

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/skills` | List skills (paginated) |
| `POST` | `/skills` | Create skill |
| `GET` | `/skills/:id` | Get skill by ID or slug |
| `PUT` | `/skills/:id` | Update skill |
| `DELETE` | `/skills/:id` | Archive skill |
| `POST` | `/skills/:id/publish` | Publish skill |
| `POST` | `/skills/:id/deprecate` | Deprecate skill |
| `GET` | `/skills/:id/versions` | List versions |
| `POST` | `/skills/:id/versions` | Create version |
| `POST` | `/skills/:id/versions/:v/rollback` | Rollback to version |
| `GET` | `/skills/:id/export` | Export skill |
| `POST` | `/skills/import` | Import skill |
| `POST` | `/skills/resolve` | Resolve skill from input |

#### MCP Servers

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/mcp-servers` | List MCP servers |
| `POST` | `/mcp-servers` | Create MCP server |
| `GET` | `/mcp-servers/:id` | Get MCP server |
| `PUT` | `/mcp-servers/:id` | Update MCP server |
| `DELETE` | `/mcp-servers/:id` | Delete MCP server |
| `POST` | `/mcp-servers/:id/health` | Check health |

#### Chat

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/chat` | Skill-aware chat (WebSocket required) |

### Legacy Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/agent/status` | Auth status + session stats |
| `POST` | `/agent/chat` | Basic chat (no auth) |

## Authentication

All `/api/v1` endpoints require an API key:

```bash
# Header authentication
curl -H "Authorization: Bearer sk-your-api-key" \
     http://localhost:3001/api/v1/skills

# Or X-API-Key header
curl -H "X-API-Key: sk-your-api-key" \
     http://localhost:3001/api/v1/skills
```

On first startup, a default API key is generated and printed to the console.

### API Key Scopes

| Scope | Description |
|-------|-------------|
| `skills:read` | Read skills |
| `skills:write` | Create/update skills |
| `skills:execute` | Execute skills |
| `skills:delete` | Delete skills |
| `mcp:read` | Read MCP servers |
| `mcp:write` | Create/update MCP servers |
| `chat` | Use chat API |
| `analytics:read` | Read analytics |
| `admin` | All permissions |

## Creating Skills

### Skill Format

Skills use Markdown with YAML frontmatter:

```markdown
---
name: customer-support
type: skill
description: Handle customer support inquiries
allowedTools: ["search_kb", "create_ticket"]
triggers:
  - type: keyword
    value: support
  - type: keyword
    value: help
---

# Customer Support Agent

You are a helpful customer support agent.

## Instructions

1. Greet the customer warmly
2. Understand their issue
3. Search the knowledge base for solutions
4. Create a ticket if needed

## Tone

- Professional and empathetic
- Clear and concise
```

### Sub-Agent Type

For complex tasks requiring tool orchestration:

```markdown
---
name: lesson-plan-designer
type: sub-agent
description: Generate comprehensive lesson plans
model: claude-sonnet-4-20250514
max_tokens: 4096
tools:
  - read_reference_data
  - write_output
  - todo_write
---

# Lesson Plan Designer

You are an expert lesson plan designer...
```

## REST API Adapter

Connect legacy REST APIs as MCP tools:

```typescript
import { RestAdapterConfigBuilder, createRestApiAdapter } from 'claude-code-as-a-service';

const config = new RestAdapterConfigBuilder()
  .baseUrl('https://api.example-crm.com/v1')
  .bearerAuth('your-api-token')
  .rateLimit(100)
  .addGetEndpoint(
    'list_customers',
    '/customers',
    'List all customers with pagination',
    {
      page: { type: 'integer', default: 1 },
      limit: { type: 'integer', default: 20 }
    }
  )
  .addPostEndpoint(
    'create_customer',
    '/customers',
    'Create a new customer',
    {
      name: { type: 'string', required: true },
      email: { type: 'string', required: true }
    }
  )
  .build();

const adapter = createRestApiAdapter(config);
const tools = adapter.generateTools();  // Returns MCP tool definitions
```

### Supported Authentication

- **API Key** - Header or query parameter
- **Bearer Token** - OAuth2 access tokens
- **Basic Auth** - Username/password
- **OAuth2** - Client credentials flow

## WebSocket Events

### Incoming (Client → Server)

| Event | Description |
|-------|-------------|
| `chat` | Send message |
| `skill_chat` | Send message with skill routing |
| `cancel` | Cancel operation |
| `reconnect_session` | Reconnect to session |
| `get_stats` | Get server stats |

### Outgoing (Server → Client)

| Event | Description |
|-------|-------------|
| `client_id` | Client ID assigned |
| `agent_status` | Agent status (idle/running/complete/error) |
| `text_delta` | Streaming text |
| `tool_activity` | Tool execution events |
| `output_update` | Output from write_output tool |
| `todo_update` | Task list updates |
| `session_restored` | Reconnection success |
| `session_not_found` | Reconnection failure |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3001 | Server port |
| `WORKSPACE_DIR` | .agent-workspace | Session workspace |
| `SESSION_TTL_MS` | 1800000 | Session TTL (30 min) |
| `MAX_SESSIONS` | 100 | Max concurrent sessions |
| `AUTH_STORAGE_DIR` | .auth-data | API keys storage |
| `SKILL_REGISTRY_DIR` | .skill-packages | Skills storage |
| `TENANT_STORAGE_DIR` | .tenant-data | Tenants storage |
| `MCP_STORAGE_DIR` | .mcp-servers | MCP servers storage |
| `ENABLE_RATE_LIMITING` | true | Enable rate limiting |
| `ALLOW_ANONYMOUS` | false | Allow anonymous access |

## Database Schema (PostgreSQL)

For production, initialize the database:

```bash
psql -f database/schema.sql
```

Tables:
- `tenants` - Multi-tenant configuration
- `api_keys` - API key authentication
- `skills` - Skill definitions
- `skill_versions` - Version history
- `mcp_servers` - MCP server configurations
- `sessions` - Session tracking
- `usage_events` - Analytics

## Development

```bash
# Type checking
npm run typecheck

# Build
npm run build

# Start development server (basic)
npm run dev

# Start development server (platform)
npm run dev:platform
```

## Programmatic Usage

```typescript
import {
  createPlatformServer,
  getSkillService,
  createRestApiAdapter,
  RestAdapterConfigBuilder,
} from 'claude-code-as-a-service';

// Start server
const server = createPlatformServer({ port: 3001 });
await server.start();

// Use skill service programmatically
const skillService = getSkillService();
const skill = await skillService.createSkill(context, {
  name: 'My Skill',
  content: '# Instructions\n...',
});

// Create REST adapter
const adapter = createRestApiAdapter(config);
const tools = adapter.generateTools();
```

## Frontend Integration

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001');

// Connection established
socket.on('client_id', ({ clientId }) => {
  console.log('Connected with client ID:', clientId);
});

// Agent status updates
socket.on('agent_status', ({ status, sessionId, skill }) => {
  console.log('Agent status:', status);
  if (skill) console.log('Using skill:', skill.name);
});

// Streaming text
socket.on('text_delta', ({ text }) => {
  process.stdout.write(text);
});

// Tool activity
socket.on('tool_activity', ({ payload }) => {
  console.log(`Tool ${payload.toolName}: ${payload.phase}`);
});

// Send a message (basic)
socket.emit('chat', {
  message: 'Hello, Claude!',
  sessionId: 'my-session-123',
});

// Send a message with skill routing (authenticated)
socket.emit('skill_chat', {
  apiKey: 'sk-your-api-key',
  request: {
    skillId: 'customer-support',
    message: 'I need help with my order',
  }
});
```

## Comparison with v1

| Aspect | v1 (Basic Relay) | v2 (Platform) |
|--------|------------------|---------------|
| Lines of code | ~1500 | ~4000+ |
| Authentication | None | API Keys |
| Multi-tenant | No | Yes |
| Skill management | No | Full API |
| MCP management | No | Full API |
| Legacy integration | No | REST Adapter |
| Versioning | No | Semver |
| Rate limiting | No | Yes |

## License

MIT
