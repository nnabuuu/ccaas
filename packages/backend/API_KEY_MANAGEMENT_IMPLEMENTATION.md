# API Key Management Backend Implementation (NIE-44)

## Summary

Implemented admin REST API endpoints for API key management. The service layer was already complete, this implementation adds the missing controller endpoints.

## Files Created

### 1. `/src/admin/dto/create-api-key-admin.dto.ts`
- Extends `CreateApiKeyDto` with `tenantId` field
- Allows admins to specify which tenant the key belongs to

### 2. `/src/admin/controllers/admin-api-keys.controller.ts`
- Main controller with 6 endpoints
- Full CRUD operations for API key management
- Comprehensive error handling and validation
- Audit logging for all operations

### 3. `/src/admin/controllers/admin-api-keys.controller.spec.ts`
- 24 comprehensive unit tests
- Tests all endpoints and error cases
- Validates audit logging behavior
- All tests passing ✅

## Files Modified

### 1. `/src/admin/admin.module.ts`
- Added `AdminApiKeysController` to controllers array
- Controller is now registered and available

### 2. `/src/admin/entities/admin-audit-log.entity.ts`
- Added `'apikey.delete'` to `AdminAction` type
- Ensures delete operations can be audited

## API Endpoints Implemented

All endpoints require `@Auth('admin')` scope.

### 1. List API Keys
```
GET /api/v1/admin/api-keys?tenantId={id}&page={num}&limit={num}
```
- Returns paginated list of API keys for a tenant
- Max 100 items per page, default 50
- Validates tenant exists

### 2. Get Single Key
```
GET /api/v1/admin/api-keys/:id
```
- Returns details of a single API key
- Validates UUID format
- Returns 404 if not found

### 3. Create API Key
```
POST /api/v1/admin/api-keys
Body: { tenantId, name, scopes?, rateLimitRpm?, rateLimitRpd?, expiresAt? }
```
- ⚠️ **CRITICAL**: Returns raw key ONLY in this response
- Includes warning message
- Creates audit log entry
- Validates tenant exists

### 4. Update API Key
```
PUT /api/v1/admin/api-keys/:id
Body: { name?, scopes?, rateLimitRpm?, rateLimitRpd?, status?, expiresAt? }
```
- Updates key properties
- Logs before/after values in audit
- Validates key exists

### 5. Revoke API Key
```
POST /api/v1/admin/api-keys/:id/revoke
```
- Sets status to 'revoked'
- Validates key is not already revoked
- Creates audit log entry

### 6. Delete API Key
```
DELETE /api/v1/admin/api-keys/:id
```
- Permanently deletes the key
- Creates audit log BEFORE deletion (critical for compliance)
- Returns success message with keyPrefix

## Security Features

### Input Validation
- UUID format validation for IDs
- Tenant ID max 100 characters
- Scopes validated against `ALL_SCOPES` constant
- Rate limits: RPM (1-1000), RPD (1-1000000)

### Authorization
- All endpoints require `@Auth('admin')` scope
- Validates tenant exists before operations
- Validates key exists before updates/revoke/delete

### Audit Trail
- All operations logged (create, update, revoke, delete)
- Delete operations logged BEFORE deletion
- Includes previous/new values for updates
- Never logs sensitive data (raw keys, hashes)

### Raw Key Exposure
- Raw key ONLY returned in create response
- Never returned in list/get/update responses
- Never logged in audit metadata
- Includes explicit warning message

## Testing

### Type Check
```bash
npm run typecheck
```
✅ Passes with no errors

### Unit Tests
```bash
npm test -- admin-api-keys.controller.spec.ts
```
✅ 24/24 tests passing

### Build
```bash
npm run build
```
✅ Builds successfully

## Example Usage

### Create an API Key
```bash
curl -X POST http://localhost:3001/api/v1/admin/api-keys \
  -H "x-api-key: YOUR_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "default",
    "name": "Production Key",
    "scopes": ["chat", "skills:read"]
  }'
```

**Response:**
```json
{
  "apiKey": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Production Key",
    "keyPrefix": "sk-default-abc",
    "scopes": ["chat", "skills:read"],
    "rateLimitRpm": 60,
    "rateLimitRpd": 10000,
    "status": "active",
    "expiresAt": null,
    "createdAt": "2026-02-05T10:00:00Z"
  },
  "rawKey": "sk-default-abc1234567890abcdefghijklmnop",
  "warning": "This is the only time the raw API key will be displayed. Please save it securely."
}
```

### List API Keys
```bash
curl "http://localhost:3001/api/v1/admin/api-keys?tenantId=default" \
  -H "x-api-key: YOUR_ADMIN_KEY"
```

### Revoke a Key
```bash
curl -X POST http://localhost:3001/api/v1/admin/api-keys/{KEY_ID}/revoke \
  -H "x-api-key: YOUR_ADMIN_KEY"
```

## Next Steps

1. **Frontend Implementation** (separate ticket)
   - Create admin UI page for API key management
   - List view with DataTable component
   - Create modal with scope selector
   - Copy key dialog (show once warning)
   - Revoke confirmation dialog

2. **Documentation Updates**
   - Update `CLAUDE.md` with new endpoints
   - Add to API documentation

3. **Integration Testing** (optional)
   - End-to-end tests for complete workflows
   - Test with actual database

## Notes

- Service layer (`ApiKeyService`) was already complete
- DTOs were already defined in `auth/dto/api-key.dto.ts`
- Audit log types (`apikey.*`) already existed in schema
- `ApiKey` entity already imported in `AdminModule`
- Followed existing patterns from `AdminTenantsController` and `AdminSkillsController`

## Implementation Date

2026-02-05
