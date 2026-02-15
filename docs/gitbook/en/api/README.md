# API Overview

KedgeAgentic provides both REST API and WebSocket interfaces, along with complete type definitions through the `@ccaas/common` package.

## Interface Model

KedgeAgentic uses a hybrid REST/WebSocket model:

```
Client ──REST──→ Send messages / Manage resources
       ←─WS───  Receive real-time event streams
```

1. Clients send messages or manage resources via the REST API
2. The server pushes real-time events via WebSocket (text streaming, status changes, tool activity, etc.)
3. After the REST API returns the operation result, subsequent events continue to be pushed via WebSocket

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
| [@ccaas/common Types](shared-types.md) | Shared TypeScript type definitions |
