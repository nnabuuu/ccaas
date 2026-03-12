# Session Timeout Configuration

Session TTL (Time-To-Live) controls how long an Agent session is retained after the last activity. Configuring TTL appropriately balances user experience with resource utilization.

---

## What is Session TTL?

**TTL** is the time after the last activity before a session is automatically closed. When a session expires, the platform releases its concurrent slot for other users.

- **Short TTL (e.g. 5 minutes)**: Releases resources quickly; suitable for high-concurrency, short-dialogue scenarios.
- **Long TTL (e.g. 30 minutes)**: Users can return after stepping away; suitable for deep analysis or complex tasks.

---

## TTL Limits by Plan

Each plan has a default TTL and a maximum configurable TTL:

| Plan | Default TTL | Max TTL |
|------|-------------|---------|
| **Free** | 5 min (300000ms) | 5 min (300000ms) |
| **Starter** | 30 min (1800000ms) | 30 min (1800000ms) |
| **Business** | 30 min (1800000ms) | 30 min (1800000ms) |
| **Enterprise** | 30 min (1800000ms) | 30 min (1800000ms) |

> **Free plan restriction**: The TTL cap for Free tenants is 5 minutes and cannot be extended by configuration. Upgrade to Starter or above for longer session durations.

---

## Configuring Tenant TTL

Use the admin API to set a custom TTL for a tenant:

```http
PUT /api/v1/tenants/:id
Content-Type: application/json
Authorization: Bearer <admin-api-key>

{
  "sessionTtlMs": 1800000
}
```

**Notes:**
- `sessionTtlMs` is in milliseconds; minimum value is 60000 (1 minute).
- The value is automatically capped at the plan maximum. For example, passing `1800000` for a Free tenant is silently reduced to `300000`.
- If omitted, the plan's default TTL is used.

---

## Session Template TTL Override

[Session templates](admin-session-templates.md) support a per-template TTL that overrides the tenant default:

```json
{
  "name": "quick-query",
  "template": {
    "description": "Short-query template with reduced timeout",
    "sessionTtlMs": 120000,
    "enabledSkills": ["knowledge-search"]
  }
}
```

**Notes:**
- Template `sessionTtlMs` is also subject to the plan cap and is automatically capped at save time.
- Template TTL takes effect when the template is applied to a session (Phase 2 feature, coming soon).

---

## Stuck-Processing Recovery (maxProcessingMs)

If an Agent stays in `processing` state for longer than `maxProcessingMs` (default 30 minutes), the platform forcibly closes the session to prevent concurrent slots from being permanently occupied.

| Config key | Default | Description |
|-----------|---------|-------------|
| `workspace.maxProcessingMs` | 1800000 (30 min) | Sessions stuck in processing beyond this threshold are force-closed |

This is a server-side hard limit and cannot be overridden by tenant configuration.

---

## Upgrade Path

To unlock longer session timeouts:

1. Upgrade the tenant plan from `free` to `starter` or higher in the admin dashboard.
2. After upgrading, `sessionTtlMs` is automatically recalculated to the new plan's default (or your previously set value, whichever is lower).
3. Use `PUT /api/v1/tenants/:id` to set `sessionTtlMs` to the desired value (within the plan cap).

---

## Related Docs

- [Session Templates Management](admin-session-templates.md)
- [Core Concepts](../concepts.md)
- [Pricing](../platform/pricing.md)
