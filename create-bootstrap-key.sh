#!/bin/bash
# Create bootstrap API key for inject-skills.sh

set -e

DB_PATH="packages/backend/.agent-workspace/data.db"
TENANT_ID="${1:-f5461be1-0d28-40e0-bf48-154657f1696f}"

# Generate API key with correct prefix (sk-)
KEY_ID="bootstrap-$(date +%s)"
RAW_KEY="sk-bootstrap_$(openssl rand -hex 24)"

# Extract key prefix (first 12 chars)
KEY_PREFIX="${RAW_KEY:0:12}"

# Hash the key (SHA-256)
KEY_HASH=$(echo -n "$RAW_KEY" | openssl dgst -sha256 -binary | xxd -p -c 256)

# Current timestamp
NOW=$(date -u '+%Y-%m-%d %H:%M:%S')
EXPIRES_AT=$(date -u -v+1H '+%Y-%m-%d %H:%M:%S' 2>/dev/null || date -u -d '+1 hour' '+%Y-%m-%d %H:%M:%S')

# Insert into database
sqlite3 "$DB_PATH" << EOF
INSERT INTO api_keys (
  id, tenantId, name, keyHash, keyPrefix,
  scopes, status, rateLimitRpm, rateLimitRpd,
  createdAt, updatedAt, expiresAt, usageCount, userId
) VALUES (
  '$KEY_ID',
  '$TENANT_ID',
  'bootstrap-skills-injection',
  '$KEY_HASH',
  '$KEY_PREFIX',
  '["skills:write","mcp:write"]',
  'active',
  100,
  10000,
  '$NOW',
  '$NOW',
  '$EXPIRES_AT',
  0,
  'bootstrap-user'
);
EOF

echo "✅ Bootstrap API key created!"
echo ""
echo "Export this key to environment:"
echo "export CCAAS_API_KEY='$RAW_KEY'"
echo ""
echo "Or run inject-skills.sh with:"
echo "CCAAS_API_KEY='$RAW_KEY' ./solutions/lesson-plan-designer/inject-skills.sh"
