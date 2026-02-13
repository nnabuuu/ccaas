# Testing Scripts

Manual testing scripts for API endpoints and features.

## Scripts

### file-registration.sh
Test `/api/v1/files/register` endpoint for manual file registration.

**Purpose**: Validates the file registration API endpoint works correctly with various inputs.

**Type**: Manual test script (one-time verification)

**Usage**:
```bash
./tools/testing/file-registration.sh
```

**What it tests**:
- File registration endpoint is accessible
- Request payload validation
- Response format is correct
- Files are correctly stored in database
- Error handling for invalid inputs

## When to Use

Use these scripts for:
- Manual testing of specific API endpoints
- Verifying endpoint behavior with different inputs
- Debugging API request/response issues
- Testing edge cases not covered by automated tests

## Best Practices

- Scripts should be idempotent (safe to run multiple times)
- Include cleanup logic to avoid polluting the database
- Document expected inputs and outputs
- Add error handling and clear error messages
