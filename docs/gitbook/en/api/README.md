# API Overview

KedgeAgentic provides a REST API with SSE streaming, along with complete type definitions through the `@kedge-agentic/common` package.

## Interface Model

KedgeAgentic uses a REST + SSE model (SSE is the default transport since v1.1.0):

```
Client ──REST──→ Send messages / Manage resources
       ←─SSE───  Receive real-time event streams
```

1. Clients send messages or manage resources via the REST API
2. The server streams real-time events via SSE (text streaming, status changes, tool activity, etc.)
3. Chat messages stream directly as `text/event-stream` from `POST /api/v1/sessions/:id/messages`

> **Note**: Socket.IO (WebSocket) transport is deprecated as of v1.1.0. The endpoint `POST /api/v1/sessions/:id/completion` returns **410 Gone**.

## Authentication

All API requests require API Key authentication:

```bash
# Method 1: Bearer Token
curl -H "Authorization: Bearer YOUR_API_KEY" ...

# Method 2: Custom Header
curl -H "X-API-Key: YOUR_API_KEY" ...
```

### API Key Scope

| Scope | Description |
|-------|-------------|
| `skills:read` | Read Skill list and details |
| `skills:write` | Create and update Skills |
| `skills:execute` | Execute Skills |
| `skills:delete` | Delete Skills |
| `mcp:read` | Read MCP Server list |
| `mcp:write` | Manage MCP Servers |
| `chat` | Send messages and manage sessions |
| `analytics:read` | Read analytics data |
| `admin` | Administrator privileges |

## Section Navigation

| Section | Content |
|---------|---------|
| [REST API Endpoints](rest.md) | Complete reference for all HTTP endpoints |
| [WebSocket Events](websocket.md) | Format definitions for all WebSocket events |
| [Error Handling](error-handling.md) | Standardized error responses and retry strategies |
| [@kedge-agentic/common Types](shared-types.md) | Shared TypeScript type definitions |
