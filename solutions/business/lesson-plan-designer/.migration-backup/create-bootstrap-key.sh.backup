#!/bin/bash
# Create bootstrap API key directly in database
# This solves the chicken-and-egg problem: need API key to create API key

set -e

# Parse arguments
QUIET_MODE=false
if [ "$1" = "--quiet" ]; then
  QUIET_MODE=true
fi

# Configuration
DB_PATH="${DB_PATH:-../../packages/backend/.agent-workspace/data.db}"
TENANT_SLUG="lesson-plan-designer"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

if [ "$QUIET_MODE" = false ]; then
  echo "========================================"
  echo "  Bootstrap API Key Creator"
  echo "========================================"
  echo ""
  echo "Database: $DB_PATH"
  echo "Tenant: $TENANT_SLUG"
  echo ""
fi

# Check if sqlite3 is available
if ! command -v sqlite3 &> /dev/null; then
  if [ "$QUIET_MODE" = false ]; then
    echo -e "${RED}Error: sqlite3 is required but not installed.${NC}"
  fi
  exit 1
fi

# Check if database exists
if [ ! -f "$DB_PATH" ]; then
  if [ "$QUIET_MODE" = false ]; then
    echo -e "${RED}Error: Database not found at $DB_PATH${NC}"
    echo "Please start CCAAS backend first to create the database."
  fi
  exit 1
fi

# Get tenant ID
TENANT_ID=$(sqlite3 "$DB_PATH" "SELECT id FROM tenants WHERE slug='$TENANT_SLUG' LIMIT 1;")

if [ -z "$TENANT_ID" ]; then
  if [ "$QUIET_MODE" = false ]; then
    echo -e "${RED}Error: Tenant '$TENANT_SLUG' not found${NC}"
    echo "Please create the tenant first."
  fi
  exit 1
fi

if [ "$QUIET_MODE" = false ]; then
  echo -e "${GREEN}Found tenant: $TENANT_ID${NC}"
  echo ""
  echo "Generating bootstrap API key..."
fi
RAW_KEY="sk-bootstrap_$(openssl rand -hex 24)"
KEY_PREFIX="${RAW_KEY:0:16}"
KEY_HASH=$(echo -n "$RAW_KEY" | openssl dgst -sha256 -binary | xxd -p -c 256)

# Insert API key into database
sqlite3 "$DB_PATH" <<EOF
INSERT INTO api_keys (
  id,
  tenantId,
  name,
  keyHash,
  keyPrefix,
  scopes,
  rateLimitRpm,
  rateLimitRpd,
  status,
  expiresAt,
  lastUsedAt,
  usageCount,
  metadata,
  createdAt,
  updatedAt
) VALUES (
  lower(hex(randomblob(16))),
  '$TENANT_ID',
  'bootstrap-tenant-key',
  '$KEY_HASH',
  '$KEY_PREFIX',
  '["skills:write","mcp:write","admin"]',
  100,
  10000,
  'active',
  NULL,
  NULL,
  0,
  NULL,
  datetime('now'),
  datetime('now')
);
EOF

if [ "$QUIET_MODE" = true ]; then
  # Quiet mode: only output the API key
  echo "$RAW_KEY"
else
  # Normal mode: show full output
  echo ""
  echo -e "${GREEN}✅ Bootstrap API key created successfully!${NC}"
  echo ""
  echo "========================================"
  echo "  API Key Details"
  echo "========================================"
  echo ""
  echo -e "${YELLOW}⚠️  SAVE THIS KEY - IT WILL NOT BE SHOWN AGAIN${NC}"
  echo ""
  echo "API Key: $RAW_KEY"
  echo ""
  echo "Key Prefix: $KEY_PREFIX"
  echo "Scopes: skills:write, mcp:write, admin"
  echo "Type: Tenant-level (no userId)"
  echo ""
  echo "========================================"
  echo "  Next Steps"
  echo "========================================"
  echo ""
  echo "1. Save the API key in a secure location"
  echo "2. Export it for inject-skills.sh:"
  echo ""
  echo "   export CCAAS_API_KEY=$RAW_KEY"
  echo ""
  echo "3. Run inject-skills.sh:"
  echo ""
  echo "   ./inject-skills.sh"
  echo ""
fi
