# Builder Flow Tutorial

This tutorial guides **external Solution developers** through the complete Builder API integration flow from scratch.

## What is Builder Flow

A Builder is an external developer who holds a `builder`-scoped API key. Through the Builder API, developers can self-serve tenant creation, skill registration, and API key management without requiring platform admin intervention for day-to-day operations.

**Core Flow:**

```
Get Builder Key → Create Tenant → Register Skill → Create API Key → Chat
    (Admin)         (Builder)       (Builder)        (Builder)       (End User)
```

### Builder vs Admin

| Capability | Builder | Admin |
|-----------|---------|-------|
| Create Tenant | Only their own | Manage all |
| Manage API Keys | Only for owned tenants | Manage all |
| Create admin/builder scoped keys | Forbidden | Allowed |

Builder keys automatically have all scopes except `admin` and `builder`.

## Prerequisites

- CCAAS backend running (`npm run dev:backend`, default port 3001)
- A `builder`-scoped API key (created by platform admin)
- **Builder key must have a `userId` bound** — otherwise all Builder endpoints return 403

**Recommended**: Use the one-step onboarding endpoint (creates user + tenant + key in one call):

```bash
curl -X POST http://localhost:3001/api/v1/admin/builder-users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-admin_xxx" \
  -d '{
    "email": "builder@example.com",
    "name": "Acme Corp",
    "tenantName": "Acme Corp"
  }'
```

**Alternative**: Create user first, then create a builder key manually:

```bash
curl -X POST http://localhost:3001/api/v1/admin/api-keys \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-admin_xxx" \
  -d '{
    "tenantId": "<platform-tenant-id>",
    "name": "Builder: Acme Corp",
    "scopes": ["builder"],
    "userId": "<builder-user-id>"
  }'
```

{% hint style="warning" %}
Save the returned `rawKey` — all subsequent steps require it. Builder keys without `userId` are rejected at creation time (400 Bad Request).
{% endhint %}

## Step 1: Create Tenant

Each Builder can create multiple tenants, each representing an isolated business space.

```bash
BUILDER_KEY="sk-builder_xxx"

curl -X POST http://localhost:3001/api/v1/builder/tenants \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $BUILDER_KEY" \
  -d '{
    "name": "My Solution",
    "slug": "my-solution",
    "description": "A demo solution for testing"
  }'
```

**Response example:**

```json
{
  "id": "a1b2c3d4-...",
  "tenant": {
    "id": "a1b2c3d4-...",
    "name": "My Solution",
    "slug": "my-solution",
    "status": "active"
  }
}
```

{% hint style="info" %}
**Auto-link mechanism**: After creating a tenant, the Builder is automatically linked as admin via UserTenant.
{% endhint %}

## Step 2: Register Skill

Skills define the AI assistant's behavior and capabilities.

### Option A: Register via API

Requires the `X-Tenant-Id` header.

```bash
TENANT_ID="a1b2c3d4-..."

curl -X POST http://localhost:3001/api/v1/skills \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $BUILDER_KEY" \
  -H "X-Tenant-Id: $TENANT_ID" \
  -d '{
    "name": "echo-chat",
    "slug": "echo-chat",
    "content": "You are a simple echo assistant. When a user sends a message, acknowledge it and repeat back the key points. Keep responses short.",
    "description": "Simple echo skill for testing"
  }'
```

**CreateSkillDto fields:**

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Skill name |
| `content` | Yes | Skill prompt content |
| `slug` | No | URL-friendly unique identifier |
| `description` | No | Skill description |
| `type` | No | `skill` (default) or `sub-agent` |
| `triggers` | No | Trigger condition array |
| `allowedTools` | No | Allowed MCP tools |

## Step 3: Create API Key

Create API keys for end users or frontend applications.

```bash
curl -X POST http://localhost:3001/api/v1/builder/tenants/$TENANT_ID/api-keys \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $BUILDER_KEY" \
  -d '{
    "name": "Frontend Key",
    "scopes": ["chat", "skills:read", "skills:execute"]
  }'
```

**Response example:**

```json
{
  "apiKey": {
    "id": "key-uuid-...",
    "name": "Frontend Key",
    "keyPrefix": "sk-xxxx",
    "scopes": ["chat", "skills:read", "skills:execute"],
    "status": "active"
  },
  "rawKey": "sk-xxxxxxxxxxxxxxxxxxxxxxxx",
  "warning": "This is the only time the raw API key will be displayed. Please save it securely."
}
```

{% hint style="danger" %}
`rawKey` is only returned once at creation time. Save it immediately.
{% endhint %}

{% hint style="info" %}
**Builder Key vs Child Key**: The key you just created is a "Tenant key" — it can only call chat/skills/MCP APIs. It cannot create tenants or manage other keys. Only your original Builder key (with `builder` scope and bound `userId`) has management capabilities.
{% endhint %}

**Available scopes:**

| Scope | Description |
|-------|-------------|
| `chat` | Send messages, chat |
| `skills:read` | Read skill list |
| `skills:write` | Create/update skills |
| `skills:execute` | Execute skills |
| `skills:delete` | Delete skills |
| `mcp:read` | Read MCP server config |
| `mcp:write` | Manage MCP servers |
| `analytics:read` | Read analytics |

> Builders **cannot** create keys with `admin` or `builder` scope.

## Step 4: Start a Conversation

Use the API key from the previous step. The response is an SSE stream.

```bash
CHAT_KEY="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
SESSION_ID="test-session-$(date +%s)"

curl -N -X POST "http://localhost:3001/api/v1/sessions/$SESSION_ID/messages" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CHAT_KEY" \
  -d "{
    \"message\": \"Hello, this is a test message!\",
    \"tenantId\": \"$TENANT_ID\",
    \"enabledSkills\": [\"echo-chat\"]
  }"
```

**Key SendMessageDto fields:**

| Field | Required | Description |
|-------|----------|-------------|
| `message` | Yes | User message content |
| `tenantId` | Yes | Tenant ID |
| `enabledSkills` | No | Enabled skill slugs (auto-loads all if omitted) |
| `context` | No | Page context |
| `afterSeq` | No | Reconnection sequence number |

### SSE Event Types

| Event | Description |
|-------|-------------|
| `agent_status` | Status changes (`processing`, `complete`, `error`) |
| `text_delta` | Text increments (streaming output) |
| `token_usage` | Token consumption stats |
| `tool_activity` | Tool call activity |
| `error` | Error events |

## API Quick Reference

### Builder Tenants API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/builder/tenants` | Create tenant |
| GET | `/api/v1/builder/tenants` | List own tenants |
| GET | `/api/v1/builder/tenants/:id` | Get details |
| PUT | `/api/v1/builder/tenants/:id` | Update |

### Builder API Keys API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/builder/tenants/:tenantId/api-keys` | Create key |
| GET | `/api/v1/builder/tenants/:tenantId/api-keys` | List keys |
| PUT | `/api/v1/builder/api-keys/:id` | Update key |
| POST | `/api/v1/builder/api-keys/:id/revoke` | Revoke key |
| DELETE | `/api/v1/builder/api-keys/:id` | Delete key |

### Sessions API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/sessions/:id/messages` | Send message (SSE) |
| GET | `/api/v1/sessions/:id` | Get status |
| POST | `/api/v1/sessions/:id/cancel` | Cancel turn |

### Solutions API (Admin/Builder)

> These endpoints are under the admin path and require `admin` or `builder` scope.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/admin/solutions/status` | Get loader status |
| POST | `/api/v1/admin/solutions/import` | Import solution from config body |

## Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| 403: builder key must be linked to a user | Builder key has no `userId` | Fix via `PUT /api/v1/admin/api-keys/:id` with `userId`, or recreate via `POST /api/v1/admin/builder-users` |
| 403: You do not have access to this tenant | No UserTenant link | Can only operate on self-created tenants |
| 403: cannot create keys with scopes: admin | Privilege escalation prevention | Use only allowed scopes |
| 409: Skill slug already exists | Slug conflict | Change slug or PUT to update |
| MISSING\_TENANT\_ID | Missing `tenantId` in body | Include it in request body |
| 401: Invalid or missing API key | Key invalid/expired/revoked | Check Authorization header |

## Full Reference

For the complete curl command set and builder-smoke-test example, see [`docs/BUILDER_TUTORIAL.md`](../../../BUILDER_TUTORIAL.md) in the project root.
