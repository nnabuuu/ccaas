# Legacy API Key System Removal - Complete Migration

**Date**: 2026-02-11
**Status**: ✅ **IMPLEMENTED** - Breaking Change (v2.0.0)
**User Decision**: "不需要migrate任何东西，让我们抛弃legacy的数据" - Abandon legacy data, no migration needed

## Overview

CCAAS has **completely removed** the legacy tenant API key system (`tenant.apiKey` field) and now uses **only** the modern API key system with SHA-256 hashing, scopes, and rate limiting.

## What Changed

### ❌ Removed (Legacy System)

1. **`tenant.apiKey` field** - Removed from database and entity
2. **`TenantGuard` legacy authentication** - No longer validates `sk_` prefix keys
3. **`TenantsService.findByApiKey()`** - Deleted
4. **`TenantsService.regenerateApiKey()`** - Deleted
5. **`TenantsService.generateApiKey()`** - Deleted
6. **`POST /api/v1/tenants/:id/regenerate-key`** - Endpoint removed
7. **`create_bootstrap_key()` in solution-lib.sh** - Deprecated (now shows error)
8. **Legacy tenant API key creation** - Tenants no longer auto-create API keys

### ✅ Now Required (Modern System)

1. **Bootstrap Admin Key** - Auto-created on backend startup, retrieve from logs
2. **Modern API Keys** - Created via `POST /api/v1/admin/api-keys` with admin scope
3. **Solution Setup Workflow**:
   ```bash
   # 1. Create tenant (no API key returned)
   eval "$(create_or_get_tenant ...)"

   # 2. Get bootstrap admin key
   BOOTSTRAP_KEY=$(get_or_create_bootstrap_key ...)

   # 3. Create solution-specific API key
   eval "$(create_solution_api_key ... $BOOTSTRAP_KEY ...)"
   ```

## Migration Guide

### For Existing Deployments

Since we're abandoning legacy data (per user decision), follow these steps:

#### 1. Backup (Optional)

```bash
# Optional: Save current database for reference
cp packages/backend/.agent-workspace/data.db data.db.backup
```

#### 2. Pull Latest Code

```bash
git pull origin master
cd packages/backend
npm install
```

#### 3. Start Backend and Get Bootstrap Key

```bash
cd packages/backend
npm run start:dev
```

**Watch logs for**:
```
[ApiKeyService] Created default API key: sk-default-xxxxxxxxxxxxx
```

**Copy this key** and export it:
```bash
export CCAAS_BOOTSTRAP_KEY=sk-default-xxxxxxxxxxxxx
```

#### 4. Re-run Solution Setup Scripts

All solutions must be re-initialized:

```bash
cd solutions/lesson-plan-designer
./setup.sh  # Will prompt for bootstrap key if not set

cd ../quiz-analyzer
./setup.sh

cd ../problem-explainer
./setup.sh

cd ../ccaas-demo
./setup.sh
```

#### 5. Verify Modern API Keys Work

```bash
# Test API key authentication
curl http://localhost:3001/api/v1/skills \
  -H "Authorization: Bearer sk-lesson-xxxxx"  # Modern key from setup
```

### For New Deployments

New deployments automatically use the modern system. Follow the standard setup workflow.

## Database Migration (SQLite)

The migration file `003-remove-tenant-api-key.sql` removes the `apiKey` column:

```sql
-- Creates new table without apiKey
CREATE TABLE tenants_new (...);

-- Copies data (excluding apiKey)
INSERT INTO tenants_new SELECT ...;

-- Replaces old table
DROP TABLE tenants;
ALTER TABLE tenants_new RENAME TO tenants;
```

**Note**: Since we're abandoning legacy data, you can also just delete `data.db` and let it recreate.

## Breaking Changes

### API Changes

| Endpoint/Feature | Status | Replacement |
|------------------|--------|-------------|
| `POST /api/v1/tenants` | ⚠️ Changed | No longer returns `apiKey` field |
| `GET /api/v1/tenants/:id` | ⚠️ Changed | No longer returns `apiKey` field |
| `POST /api/v1/tenants/:id/regenerate-key` | ❌ Removed | Use `POST /api/v1/admin/api-keys` |
| `TenantGuard` with `sk_` keys | ❌ Removed | Use modern `sk-` keys |

### Solution Library Changes

| Function | Status | Replacement |
|----------|--------|-------------|
| `create_or_get_tenant()` | ⚠️ Changed | No longer sets `API_KEY`, only `TENANT_ID` |
| `create_bootstrap_key()` | ❌ Deprecated | Use `get_or_create_bootstrap_key()` |
| N/A | ✅ New | `get_or_create_bootstrap_key(CCAAS_URL)` |
| N/A | ✅ New | `create_solution_api_key(URL, TENANT_ID, BOOTSTRAP_KEY, NAME)` |

### Code Changes

**TypeScript Entity**:
```diff
// packages/backend/src/tenants/entities/tenant.entity.ts
- @Column({ nullable: true })
- apiKey: string;
```

**Service Methods**:
```diff
// packages/backend/src/tenants/tenants.service.ts
- async findByApiKey(apiKey: string): Promise<Tenant | null>
- async regenerateApiKey(idOrSlug: string): Promise<{ apiKey: string }>
- private generateApiKey(): string
```

**TenantGuard**:
```diff
// packages/backend/src/tenants/tenant.guard.ts
- // Legacy API key authentication (sk_)
- if (authHeader?.startsWith('Bearer sk_')) {
-   const tenant = await this.tenantsService.findByApiKey(apiKey);
-   ...
- }
```

## New Workflow

### Solution Setup Pattern

**Before** (Legacy):
```bash
# Tenant creation returned API key
eval "$(create_or_get_tenant ...)"
# Sets: TENANT_ID, API_KEY ← Legacy key

CCAAS_API_KEY="$API_KEY"
inject_skills ... "$CCAAS_API_KEY"
```

**After** (Modern):
```bash
# Step 1: Create tenant (no API key)
eval "$(create_or_get_tenant ...)"
# Sets: TENANT_ID only

# Step 2: Get bootstrap admin key
BOOTSTRAP_KEY=$(get_or_create_bootstrap_key "$CCAAS_URL")

# Step 3: Create modern API key
eval "$(create_solution_api_key "$CCAAS_URL" "$TENANT_ID" "$BOOTSTRAP_KEY" "$SOLUTION_NAME")"
# Sets: API_KEY ← Modern key with scopes

CCAAS_API_KEY="$API_KEY"
inject_skills ... "$CCAAS_API_KEY"
```

### Bootstrap Key Management

**Where is it?**
- Auto-created on backend startup (see logs)
- Tenant: `default`
- Format: `sk-default-{32-random-chars}`
- Scopes: `["admin", "skills:write", "mcp:write", "chat"]`

**How to use it?**
```bash
# Set environment variable
export CCAAS_BOOTSTRAP_KEY=sk-default-xxxxx

# Or pass directly
./setup.sh  # Will prompt if not set
```

## Benefits of Modern System

1. **Security**: SHA-256 hashing (keys never stored in plain text)
2. **Granular Permissions**: 9 scopes for fine-grained access control
3. **Rate Limiting**: RPM (requests/minute) and RPD (requests/day) limits
4. **Audit Trail**: Full audit log of key creation, usage, and revocation
5. **Revocation**: Can revoke keys without deletion
6. **Expiration**: Optional expiry dates
7. **User Attribution**: Keys can be tied to specific users

## Modern API Key Scopes

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
| `admin` | Full admin access (required to create API keys) |

## Troubleshooting

### Problem: "Bootstrap key required"

**Solution**:
```bash
# Check backend logs
cd packages/backend
npm run start:dev | grep "Created default API key"

# Export the key
export CCAAS_BOOTSTRAP_KEY=sk-default-xxxxx
```

### Problem: "Invalid API key format"

**Cause**: Still using legacy `sk_` key (underscore)

**Solution**: Re-run solution setup to get modern `sk-` key (hyphen)

### Problem: "Tenant not found"

**Cause**: Database was cleared but tenant wasn't recreated

**Solution**:
```bash
# Re-run solution setup.sh
cd solutions/YOUR_SOLUTION
./setup.sh
```

### Problem: "Failed to create modern API key"

**Possible causes**:
1. Bootstrap key doesn't have `admin` scope
2. Bootstrap key expired
3. Bootstrap key revoked
4. Backend not running

**Solution**:
```bash
# Restart backend to regenerate bootstrap key
cd packages/backend
npm run start:dev

# Get new bootstrap key from logs
export CCAAS_BOOTSTRAP_KEY=sk-default-xxxxx
```

## Testing Checklist

- [ ] Backend starts without errors
- [ ] Bootstrap admin key is logged on startup
- [ ] `POST /api/v1/tenants` returns NO `apiKey` field
- [ ] `GET /api/v1/tenants/:id` returns NO `apiKey` field
- [ ] Modern API key creation works (`POST /api/v1/admin/api-keys`)
- [ ] Modern API key authentication works (skills injection, MCP registration)
- [ ] All solutions start successfully with new workflow
- [ ] Skills are injectable with modern API keys
- [ ] MCP servers are registerable with modern API keys
- [ ] Chat sessions work with modern API keys

## Files Modified

### Backend
- `packages/backend/src/tenants/entities/tenant.entity.ts` ← Removed `apiKey` field
- `packages/backend/src/tenants/tenants.service.ts` ← Removed 3 methods
- `packages/backend/src/tenants/tenants.controller.ts` ← Removed regenerate endpoint
- `packages/backend/src/tenants/tenant.guard.ts` ← Removed legacy auth path
- `packages/backend/migrations/003-remove-tenant-api-key.sql` ← New migration

### Solutions
- `tools/solution-lib.sh` ← Added 2 new functions, deprecated 1
- `solutions/lesson-plan-designer/setup.sh` ← Updated Step 4
- `solutions/quiz-analyzer/setup.sh` ← Updated Step 4
- `solutions/problem-explainer/setup.sh` ← Updated Step 4
- `solutions/ccaas-demo/setup.sh` ← Updated Step 4

### Documentation
- `LEGACY_API_KEY_REMOVAL.md` ← This file
- `tools/README.md` ← TODO: Update API key section
- `packages/backend/CLAUDE.md` ← TODO: Update auth section

## Rollback Plan

If you need to rollback (not recommended):

1. **Restore database backup**:
   ```bash
   cp data.db.backup packages/backend/.agent-workspace/data.db
   ```

2. **Checkout previous commit**:
   ```bash
   git checkout <commit-before-migration>
   ```

3. **Restart services**:
   ```bash
   cd packages/backend && npm run start:dev
   cd solutions/lesson-plan-designer && ./setup.sh
   ```

## Timeline

- **2026-02-11**: Implementation completed
- **2026-02-11**: User decision to abandon legacy data
- **Next**: Testing and documentation updates

## Questions?

See:
- `packages/backend/docs/AUTHENTICATION_AND_AUTHORIZATION.md` - Auth guide
- `tools/README.md` - Solution library docs
- `packages/backend/CLAUDE.md` - Backend architecture

## Version Bump

This is a **breaking change** and requires a major version bump:

```
v1.x.x → v2.0.0
```

Update `package.json` versions accordingly.
