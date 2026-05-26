# Admin API Key Management Guide

This guide covers how to manage API keys using the admin interface, both through the REST API and the web-based admin dashboard.

## Overview

API keys are the primary authentication mechanism for accessing the CCaaS platform. Each key:
- Belongs to a specific solution
- Has configurable permission scopes
- Can have rate limits (per minute and per day)
- Can optionally have an expiration date
- Tracks usage statistics

## Key Types

| Type | Scope | Created By | Purpose |
|------|-------|------------|---------|
| Admin | `admin` | Platform bootstrap | Full platform management |
| Builder | `builder` | Admin (via Builder Users API) | Self-serve tenant & key management |
| Solution | `chat`, `skills:*`, etc. | Admin or Builder | SDK/frontend integration |

### Key Hierarchy

```
Admin → creates Builder keys (with userId binding)
Builder → creates Solution keys (no userId, no admin/builder scope)
Solution keys → used by end-user applications
```

Builder keys require a bound `userId` to function.
Solution keys created by builders intentionally have no `userId` — they cannot call Builder APIs.

## Admin Dashboard

### Accessing the API Keys Page

1. Log in to the admin dashboard
2. Click **API Keys** in the sidebar navigation
3. The list page shows all API keys for the selected tenant

### List View

The API keys list displays:
- **Key Prefix**: First 20 characters of the key (e.g., `ccaas_live_abc123`)
- **Type**: Admin, Builder, or Solution badge (inferred from scopes)
- **Name**: Human-readable identifier
- **Scopes**: Permission badges (shows first 3, then +N for overflow)
- **Status**: Active or Revoked
- **Usage**: Total API call count
- **Last Used**: Timestamp of most recent use
- **Actions**: Dropdown menu for revoke/delete

### Creating a New API Key

1. Click **Create API Key** button
2. Fill in the form:
   - **Name**: Descriptive name (e.g., "Production Frontend")
   - **Solution ID**: Select target tenant (default: "default")
3. Click **Create Key**
4. **⚠️ IMPORTANT**: The complete key is shown only once
   - Copy the key immediately
   - Store it securely (e.g., in a password manager)
   - The warning message emphasizes this is the only opportunity
5. Click **Done** to close the modal

**Default Settings** (applied automatically):
- Scopes: `["chat", "skills:read", "skills:execute"]`
- Rate limit: 60 requests/minute, 1000 requests/day
- No expiration date

### Revoking a Key

To prevent a key from being used without deleting it:

1. Click the **⋮** menu on the key row
2. Select **Revoke**
3. Confirm the action
4. The key status changes to "Revoked"
5. Key remains in the database for audit purposes

**Use Cases**:
- Suspected key compromise
- Temporary access suspension
- Deactivating a former team member's key

### Deleting a Key

To permanently remove a key:

1. Click the **⋮** menu on the key row
2. Select **Delete**
3. Confirm the permanent deletion
4. An audit log entry is created before deletion
5. The key is removed from the database

**⚠️ Warning**: Deletion is permanent. Consider using **Revoke** instead to maintain audit trails.

## Bootstrap Key Chain (New Deployments)

When deploying to a new environment, you face a chicken-and-egg problem: you need an admin API key to create Solution-specific keys, but no keys exist yet. The platform solves this with the **bootstrap key chain**:

```
INITIAL_ADMIN_KEY (env var)
  → Backend startup creates admin key in DB
    → setup.sh uses CCAAS_BOOTSTRAP_KEY to call admin API
      → Admin API creates Solution-specific keys
        → Solution keys written to .env files
```

### Configuration

| Environment Variable | Where to Set | Purpose |
|---------------------|-------------|---------|
| `INITIAL_ADMIN_KEY` | Backend `.env` / K8s secret | Fixed admin key (instead of auto-generated) |
| `CCAAS_BOOTSTRAP_KEY` | Shell before running `setup.sh` | Tells setup scripts which admin key to use |

### Quick Start

```bash
# 1. Generate a key (must start with 'sk-', min 20 chars)
ADMIN_KEY="sk-$(openssl rand -hex 24)"

# 2. Set backend env var
export INITIAL_ADMIN_KEY="$ADMIN_KEY"
# Start backend...

# 3. Run Solution setups
export CCAAS_BOOTSTRAP_KEY="$ADMIN_KEY"
export CCAAS_URL="http://localhost:3001"
cd solutions/business/my-solution && bash setup.sh
```

### Key Files

| File | Role |
|------|------|
| `packages/backend/src/config/configuration.ts` | Reads `INITIAL_ADMIN_KEY` env var |
| `packages/backend/src/auth/api-key.service.ts` | Creates admin key on first startup |
| `tools/solution-lib.sh` | `get_or_create_bootstrap_key()` reads `CCAAS_BOOTSTRAP_KEY` |
| `solutions/business/*/setup.sh` | Each Solution's setup (falls back to dev default if env var not set) |

{% hint style="warning" %}
The hardcoded fallback `sk-default-test...` is only for local development. Always set `CCAAS_BOOTSTRAP_KEY` in staging/production.
{% endhint %}

## REST API Usage

### Authentication

All admin endpoints require an API key with the `admin` scope:

```bash
curl -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  https://your-domain.com/api/v1/admin/api-keys?solutionId=default
```

### Creating a Key via API

```bash
curl -X POST https://your-domain.com/api/v1/admin/api-keys \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "solutionId": "default",
    "name": "Production API Key",
    "scopes": ["chat", "skills:read", "skills:write"],
    "rateLimitRpm": 100,
    "rateLimitRpd": 5000
  }'
```

**Response**:
```json
{
  "apiKey": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "keyPrefix": "ccaas_live_abc123",
    "name": "Production API Key",
    "scopes": ["chat", "skills:read", "skills:write"]
  },
  "rawKey": "ccaas_live_abc123def456ghi789jkl012mno345pqr678stu901",
  "warning": "This is the only time the full key will be displayed."
}
```

**⚠️ Store the `rawKey` immediately** - it cannot be retrieved later.

### Listing Keys

```bash
curl "https://your-domain.com/api/v1/admin/api-keys?solutionId=default&page=1&limit=20" \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY"
```

**Pagination**:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 50, max: 100)

### Updating a Key

```bash
curl -X PUT https://your-domain.com/api/v1/admin/api-keys/KEY_ID \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Name",
    "scopes": ["chat", "skills:read", "skills:write", "mcp:read"],
    "rateLimitRpm": 120
  }'
```

**Linking a user to an existing key** (e.g., fixing a builder key that was created without `userId`):

```bash
curl -X PUT https://your-domain.com/api/v1/admin/api-keys/KEY_ID \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "<user-id>"
  }'
```

**Audit Logging**: All updates are logged with before/after values.

{% hint style="warning" %}
**Builder scope validation**: API keys with `builder` scope **must** have a `userId`. Creating or updating a key to have `builder` scope without a `userId` will return 400 Bad Request. Use `POST /api/v1/admin/builder-users` for one-step builder onboarding.
{% endhint %}

### Revoking a Key

```bash
curl -X POST https://your-domain.com/api/v1/admin/api-keys/KEY_ID/revoke \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY"
```

### Deleting a Key

```bash
curl -X DELETE https://your-domain.com/api/v1/admin/api-keys/KEY_ID \
  -H "Authorization: Bearer YOUR_ADMIN_API_KEY"
```

## Permission Scopes

### Available Scopes

| Scope | Description |
|-------|-------------|
| `chat` | Send chat messages and receive responses |
| `skills:read` | View skill definitions |
| `skills:write` | Create and update skills |
| `skills:execute` | Manually trigger skill execution |
| `skills:delete` | Delete skills |
| `mcp:read` | View MCP server configurations |
| `mcp:write` | Register and manage MCP servers |
| `analytics:read` | Access usage analytics and metrics |
| `admin` | Full administrative access (includes all scopes) |

{% hint style="info" %}
**Admin scope privilege**: API keys with `admin` scope bypass skill-level permission checks (e.g., `allowedTools` restrictions). Admin keys can also auto-resolve `solutionId` — when sending messages via API key, you can omit `solutionId` from the request body and it will be resolved from the API key's solution context.
{% endhint %}

### Scope Combinations

**Common Patterns**:

1. **Frontend Application**:
   ```json
   ["chat", "skills:read"]
   ```
   - Can send messages
   - Can view available skills
   - Cannot modify configuration

2. **Backend Service**:
   ```json
   ["chat", "skills:read", "skills:write", "mcp:read"]
   ```
   - Full chat functionality
   - Can manage skills
   - Can view MCP integrations

3. **Admin Tool**:
   ```json
   ["admin"]
   ```
   - Complete access to all resources
   - Can manage API keys
   - Access to analytics

## Rate Limiting

### Understanding Rate Limits

Each API key has two rate limit settings:

1. **Requests Per Minute (RPM)**: Short-term burst protection
2. **Requests Per Day (RPD)**: Long-term usage control

**Default Values**:
- RPM: 60
- RPD: 1000

### When Rate Limits Apply

Rate limits are enforced per API key across all requests. When exceeded:

**RPM Exceeded**:
```json
{
  "statusCode": 429,
  "message": "Rate limit exceeded: 60 requests per minute",
  "retryAfter": 45
}
```

**RPD Exceeded**:
```json
{
  "statusCode": 429,
  "message": "Daily rate limit exceeded: 1000 requests per day",
  "retryAfter": 43200
}
```

### Best Practices

1. **Set appropriate limits** based on expected usage
2. **Monitor usage** via the admin dashboard
3. **Use separate keys** for different environments
4. **Implement exponential backoff** in client code
5. **Cache responses** where appropriate

## Security Best Practices

### Key Management

✅ **DO**:
- Generate separate keys for each environment (dev, staging, prod)
- Use descriptive names to identify key purpose
- Rotate keys periodically (e.g., every 90 days)
- Revoke keys immediately when compromised
- Store keys in secure vaults (e.g., AWS Secrets Manager)
- Use environment variables, never hardcode keys

❌ **DON'T**:
- Share keys between applications
- Commit keys to version control
- Use production keys in development
- Reuse revoked keys
- Store keys in plain text files

### Scope Principle of Least Privilege

Grant only the minimum scopes required:

```json
// ✅ Good: Frontend only needs basic access
{
  "scopes": ["chat", "skills:read"]
}

// ❌ Bad: Frontend doesn't need admin access
{
  "scopes": ["admin"]
}
```

### Monitoring and Auditing

1. **Review usage regularly**:
   - Check "Last Used" timestamps
   - Identify unused keys for removal
   - Monitor unusual usage patterns

2. **Check audit logs**:
   - All key creation/updates are logged
   - Track who made changes and when
   - Investigate any unexpected modifications

3. **Set up alerts** (if available):
   - High usage patterns
   - Failed authentication attempts
   - Rate limit violations

## Troubleshooting

### Key Not Working

**Symptom**: API returns 401 Unauthorized

**Check**:
1. ✓ Key is not revoked (status should be "active")
2. ✓ Key has not expired (check `expiresAt` field)
3. ✓ Key has required scopes for the operation
4. ✓ Correct `Authorization: Bearer KEY` header format
5. ✓ No extra spaces or line breaks in the key

### Rate Limit Issues

**Symptom**: API returns 429 Too Many Requests

**Solutions**:
1. **Increase limits**: Update `rateLimitRpm` or `rateLimitRpd`
2. **Optimize calls**: Reduce unnecessary API requests
3. **Implement caching**: Store responses when appropriate
4. **Use separate keys**: Split traffic across multiple keys

### Missing Permissions

**Symptom**: API returns 403 Forbidden

**Check**:
1. ✓ Key has the required scope (e.g., `skills:write` for creating skills)
2. ✓ Solution ID matches the key's tenant
3. ✓ Operation is allowed for the key's scope level
4. ✓ Builder keys must have a `userId` — update via `PUT /api/v1/admin/api-keys/:id` or recreate via `POST /api/v1/admin/builder-users`

## Usage Tracking

### Viewing Statistics

In the admin dashboard, each key shows:
- **Usage Count**: Total number of API calls
- **Last Used At**: Most recent usage timestamp

### Analytics Integration

For detailed analytics:
1. Navigate to **Analytics** page
2. Filter by API key ID
3. View:
   - Request volume over time
   - Token usage
   - Error rates
   - Response times

## Examples

### Development Workflow

```bash
# 1. Create dev key with limited scopes
curl -X POST https://dev.example.com/api/v1/admin/api-keys \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -d '{
    "solutionId": "dev-tenant",
    "name": "Dev Environment",
    "scopes": ["chat", "skills:read"]
  }'

# 2. Store in environment variable
export CCAAS_API_KEY="ccaas_live_..."

# 3. Use in application
curl -H "Authorization: Bearer $CCAAS_API_KEY" \
  https://dev.example.com/api/v1/skills
```

### Production Deployment

```bash
# 1. Create production key with full scopes
curl -X POST https://api.example.com/api/v1/admin/api-keys \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -d '{
    "solutionId": "production",
    "name": "Production Frontend",
    "scopes": ["chat", "skills:read", "skills:write"],
    "rateLimitRpm": 200,
    "rateLimitRpd": 10000,
    "expiresAt": "2026-01-15T00:00:00Z"
  }'

# 2. Store in AWS Secrets Manager
aws secretsmanager create-secret \
  --name prod/ccaas/api-key \
  --secret-string "ccaas_live_..."

# 3. Retrieve in application startup
export CCAAS_API_KEY=$(aws secretsmanager get-secret-value \
  --secret-id prod/ccaas/api-key \
  --query SecretString \
  --output text)
```

### Key Rotation

```bash
# 1. Create new key
NEW_KEY=$(curl -X POST .../admin/api-keys -d '...' | jq -r '.rawKey')

# 2. Update application configuration
kubectl set env deployment/app CCAAS_API_KEY="$NEW_KEY"

# 3. Wait for rollout
kubectl rollout status deployment/app

# 4. Revoke old key
curl -X POST .../admin/api-keys/OLD_KEY_ID/revoke
```

## FAQ

**Q: Can I retrieve a lost API key?**
A: No. The complete key is shown only once during creation. If lost, create a new key and revoke the old one.

**Q: How do I change a key's scopes?**
A: Use the PUT endpoint to update scopes. Changes take effect immediately.

**Q: What happens to active requests when I revoke a key?**
A: In-flight requests complete normally. Subsequent requests are rejected with 401 Unauthorized.

**Q: Can I temporarily disable a key without revoking it?**
A: Update the status to `revoked`, then change it back to `active` when needed.

**Q: How long are audit logs retained?**
A: Audit logs are retained indefinitely. Check your organization's data retention policies.

**Q: Can I set different rate limits for different endpoints?**
A: No. Rate limits apply globally to all requests using that key. Use separate keys for different rate requirements.
