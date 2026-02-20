#!/bin/bash
# Inject skills into CCAAS
# Creates tenant and registers skills from skills/*/SKILL.md

set -e

# Configuration
CCAAS_URL="${CCAAS_URL:-http://localhost:3001}"
TENANT_SLUG="lesson-plan-designer"
TENANT_NAME="Lesson Plan Designer"
SOLUTION_DIR="$(cd "$(dirname "$0")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================"
echo "  Lesson Plan Designer - Skill Injection"
echo "========================================"
echo ""
echo "CCAAS URL: $CCAAS_URL"
echo "Tenant: $TENANT_SLUG"
echo "Solution dir: $SOLUTION_DIR"
echo ""

# Check if jq is available
if ! command -v jq &> /dev/null; then
  echo -e "${RED}Error: jq is required but not installed.${NC}"
  echo "Install with: brew install jq (macOS) or apt-get install jq (Linux)"
  exit 1
fi

# Check if CCAAS is running
echo "Checking CCAAS connectivity..."
if ! curl -s "$CCAAS_URL/api/v1/health" > /dev/null 2>&1; then
  echo -e "${RED}Error: Cannot connect to CCAAS at $CCAAS_URL${NC}"
  echo "Please start CCAAS first: cd packages/backend && npm run start:dev"
  exit 1
fi
echo -e "${GREEN}CCAAS is running${NC}"
echo ""

# Step 1: Create or get tenant
echo "Step 1: Setting up tenant..."
echo "----------------------------------------"

# Try to get existing tenant first
TENANT_RESPONSE=$(curl -s "$CCAAS_URL/api/v1/tenants/$TENANT_SLUG" 2>/dev/null || echo '{}')
TENANT_ID=$(echo "$TENANT_RESPONSE" | jq -r '.id // empty')

if [ -n "$TENANT_ID" ]; then
  echo -e "${YELLOW}Tenant already exists: $TENANT_ID${NC}"
else
  # Create new tenant
  echo "Creating tenant '$TENANT_SLUG'..."
  CREATE_RESPONSE=$(curl -s -X POST "$CCAAS_URL/api/v1/tenants" \
    -H "Content-Type: application/json" \
    -d "{
      \"slug\": \"$TENANT_SLUG\",
      \"name\": \"$TENANT_NAME\",
      \"description\": \"AI备课助手 - 基于崔允漷教授的课程与教学论\"
    }")

  TENANT_ID=$(echo "$CREATE_RESPONSE" | jq -r '.id // empty')

  if [ -z "$TENANT_ID" ]; then
    echo -e "${RED}Failed to create tenant${NC}"
    echo "Response: $CREATE_RESPONSE"
    exit 1
  fi

  echo -e "${GREEN}Tenant created: $TENANT_ID${NC}"
fi

echo ""

# Step 1.5: Create bootstrap API key for this script
echo "Step 1.5: Setting up bootstrap API key..."
echo "----------------------------------------"

# Check if we already have an API key in environment
if [ -n "$CCAAS_API_KEY" ]; then
  echo -e "${YELLOW}Using provided API key from environment${NC}"
  API_KEY="$CCAAS_API_KEY"
else
  # Create temporary bootstrap API key
  echo "Creating temporary API key for skill injection..."

  # Create API key with admin scope
  CREATE_KEY_RESPONSE=$(curl -s -X POST "$CCAAS_URL/api/v1/admin/api-keys" \
    -H "Content-Type: application/json" \
    -d "{
      \"tenantId\": \"$TENANT_ID\",
      \"name\": \"bootstrap-skills-injection\",
      \"scopes\": [\"skills:write\", \"mcp:write\"],
      \"expiresAt\": \"$(date -u -v+1H '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || date -u -d '+1 hour' '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || echo '')\",
      \"rateLimitRpm\": 100
    }")

  RAW_KEY=$(echo "$CREATE_KEY_RESPONSE" | jq -r '.rawKey // empty')

  if [ -z "$RAW_KEY" ]; then
    echo -e "${RED}Failed to create API key${NC}"
    echo "Response: $CREATE_KEY_RESPONSE"
    echo ""
    echo -e "${YELLOW}Tip: If AUTH_ALLOW_ANONYMOUS=false, you need to:${NC}"
    echo "  1. Create an admin API key manually"
    echo "  2. Set environment variable: export CCAAS_API_KEY=ccaas_xxx"
    echo "  3. Re-run this script"
    exit 1
  fi

  API_KEY="$RAW_KEY"
  echo -e "${GREEN}Temporary API key created (expires in 1 hour)${NC}"
fi

echo ""

# Step 2: Inject skills
echo "Step 2: Injecting skills..."
echo "----------------------------------------"

SKILLS_DIR="$SOLUTION_DIR/skills"
SKILL_COUNT=0
SUCCESS_COUNT=0

if [ ! -d "$SKILLS_DIR" ]; then
  echo -e "${YELLOW}No skills directory found at $SKILLS_DIR${NC}"
else
  for skill_dir in "$SKILLS_DIR"/*; do
    if [ -d "$skill_dir" ]; then
      skill_name=$(basename "$skill_dir")
      skill_file="$skill_dir/SKILL.md"

      if [ -f "$skill_file" ]; then
        SKILL_COUNT=$((SKILL_COUNT + 1))
        echo ""
        echo "Processing skill: $skill_name"

        # Read skill content
        skill_content=$(cat "$skill_file")

        # Extract metadata from frontmatter if present
        skill_display_name="$skill_name"
        skill_description=""

        # Check if file starts with --- (frontmatter)
        if head -n 1 "$skill_file" | grep -q "^---"; then
          # Extract name from frontmatter
          extracted_name=$(awk '/^---$/,/^---$/' "$skill_file" | grep "^name:" | sed 's/^name:[[:space:]]*//')
          if [ -n "$extracted_name" ]; then
            skill_display_name="$extracted_name"
          fi

          # Extract description from frontmatter
          extracted_desc=$(awk '/^---$/,/^---$/' "$skill_file" | grep "^description:" | sed 's/^description:[[:space:]]*//')
          if [ -n "$extracted_desc" ]; then
            skill_description="$extracted_desc"
          fi
        fi

        echo "  Name: $skill_display_name"
        echo "  Description: ${skill_description:-"(none)"}"

        # Escape content for JSON
        skill_content_escaped=$(echo "$skill_content" | jq -Rs .)

        # Check if skill already exists
        EXISTING_SKILL=$(curl -s "$CCAAS_URL/api/v1/skills/$skill_name" \
          -H "X-Tenant-Id: $TENANT_ID" \
          -H "X-Api-Key: $API_KEY" 2>/dev/null || echo '{}')
        EXISTING_SKILL_ID=$(echo "$EXISTING_SKILL" | jq -r '.id // empty')

        if [ -n "$EXISTING_SKILL_ID" ]; then
          # Update existing skill
          echo "  Updating existing skill..."
          UPDATE_RESPONSE=$(curl -s -X PUT "$CCAAS_URL/api/v1/skills/$EXISTING_SKILL_ID" \
            -H "Content-Type: application/json" \
            -H "X-Tenant-Id: $TENANT_ID" \
            -H "X-Api-Key: $API_KEY" \
            -d "{
              \"name\": \"$skill_display_name\",
              \"description\": \"$skill_description\",
              \"content\": $skill_content_escaped
            }")

          SKILL_ID="$EXISTING_SKILL_ID"
          echo -e "  ${GREEN}Updated skill: $SKILL_ID${NC}"
        else
          # Create new skill
          echo "  Creating new skill..."
          CREATE_SKILL_RESPONSE=$(curl -s -X POST "$CCAAS_URL/api/v1/skills" \
            -H "Content-Type: application/json" \
            -H "X-Tenant-Id: $TENANT_ID" \
            -H "X-Api-Key: $API_KEY" \
            -d "{
              \"name\": \"$skill_display_name\",
              \"slug\": \"$skill_name\",
              \"description\": \"$skill_description\",
              \"content\": $skill_content_escaped,
              \"type\": \"skill\"
            }")

          SKILL_ID=$(echo "$CREATE_SKILL_RESPONSE" | jq -r '.id // empty')

          if [ -z "$SKILL_ID" ]; then
            echo -e "  ${RED}Failed to create skill${NC}"
            echo "  Response: $CREATE_SKILL_RESPONSE"
            continue
          fi

          echo -e "  ${GREEN}Created skill: $SKILL_ID${NC}"
        fi

        # Publish skill
        echo "  Publishing skill..."
        PUBLISH_RESPONSE=$(curl -s -X POST "$CCAAS_URL/api/v1/skills/$SKILL_ID/publish" \
          -H "X-Tenant-Id: $TENANT_ID" \
          -H "X-Api-Key: $API_KEY")

        PUBLISH_STATUS=$(echo "$PUBLISH_RESPONSE" | jq -r '.status // empty')
        if [ "$PUBLISH_STATUS" = "published" ]; then
          echo -e "  ${GREEN}Published successfully${NC}"
          SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
        else
          echo -e "  ${YELLOW}Publish status: $PUBLISH_STATUS${NC}"
          SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
        fi
      fi
    fi
  done
fi

echo ""

# Step 3: Inject MCP Servers
echo "Step 3: Injecting MCP servers..."
echo "----------------------------------------"

SOLUTION_JSON="$SOLUTION_DIR/solution.json"
MCP_COUNT=0
MCP_SUCCESS_COUNT=0

if [ ! -f "$SOLUTION_JSON" ]; then
  echo -e "${YELLOW}No solution.json found at $SOLUTION_DIR${NC}"
else
  MCP_COUNT=$(jq '.mcpServers | length' "$SOLUTION_JSON")

  if [ "$MCP_COUNT" -eq 0 ]; then
    echo -e "${YELLOW}No MCP servers defined in solution.json${NC}"
  else
    echo "Found $MCP_COUNT MCP server(s) in solution.json"

    while IFS= read -r row; do
      SERVER_NAME=$(echo "$row" | jq -r '.key')
      SERVER_CONFIG=$(echo "$row" | jq '.value')

      echo ""
      echo "Processing MCP server: $SERVER_NAME"

      # Resolve relative paths in args (MCP server paths relative to solution dir)
      COMMAND=$(echo "$SERVER_CONFIG" | jq -r '.command')
      ARGS=$(echo "$SERVER_CONFIG" | jq -c --arg solutionDir "$SOLUTION_DIR" '.args | map(if test("\\.js$|\\.ts$") then ($solutionDir + "/" + .) else . end)')
      DESCRIPTION=$(echo "$SERVER_CONFIG" | jq -r '.description // ""')
      ENV=$(echo "$SERVER_CONFIG" | jq -c '.env // {}')

      echo "  Command: $COMMAND"
      echo "  Args: $ARGS"

      # Check if MCP server already exists
      EXISTING_MCP=$(curl -s "$CCAAS_URL/api/v1/mcp-servers/$SERVER_NAME" \
        -H "X-Tenant-Id: $TENANT_ID" \
        -H "X-Api-Key: $API_KEY" 2>/dev/null || echo '{}')
      EXISTING_MCP_ID=$(echo "$EXISTING_MCP" | jq -r '.id // empty')

      if [ -n "$EXISTING_MCP_ID" ]; then
        # Update existing MCP server
        echo "  Updating existing MCP server..."
        UPDATE_MCP_RESPONSE=$(curl -s -X PUT "$CCAAS_URL/api/v1/mcp-servers/$EXISTING_MCP_ID" \
          -H "Content-Type: application/json" \
          -H "X-Tenant-Id: $TENANT_ID" \
          -H "X-Api-Key: $API_KEY" \
          -d @- <<EOF
{
  "name": "$SERVER_NAME",
  "description": "$DESCRIPTION",
  "config": {
    "command": "$COMMAND",
    "args": $ARGS,
    "env": $ENV
  },
  "status": "active"
}
EOF
        )

        MCP_ID="$EXISTING_MCP_ID"
        echo -e "  ${GREEN}Updated MCP server: $MCP_ID${NC}"
        MCP_SUCCESS_COUNT=$((MCP_SUCCESS_COUNT + 1))
      else
        # Create new MCP server
        echo "  Creating new MCP server..."
        CREATE_MCP_RESPONSE=$(curl -s -X POST "$CCAAS_URL/api/v1/mcp-servers" \
          -H "Content-Type: application/json" \
          -H "X-Tenant-Id: $TENANT_ID" \
          -H "X-Api-Key: $API_KEY" \
          -d @- <<EOF
{
  "name": "$SERVER_NAME",
  "slug": "$SERVER_NAME",
  "description": "$DESCRIPTION",
  "type": "stdio",
  "config": {
    "command": "$COMMAND",
    "args": $ARGS,
    "env": $ENV
  },
  "status": "active"
}
EOF
        )

        MCP_ID=$(echo "$CREATE_MCP_RESPONSE" | jq -r '.id // empty')

        if [ -z "$MCP_ID" ]; then
          echo -e "  ${RED}Failed to create MCP server${NC}"
          echo "  Response: $CREATE_MCP_RESPONSE"
          continue
        fi

        echo -e "  ${GREEN}Created MCP server: $MCP_ID${NC}"
        MCP_SUCCESS_COUNT=$((MCP_SUCCESS_COUNT + 1))
      fi
    done < <(jq -c '.mcpServers | to_entries[]' "$SOLUTION_JSON")
  fi
fi

echo ""
echo "========================================"
echo "  Injection Complete"
echo "========================================"
echo ""
echo "Summary:"
echo "  Tenant ID: $TENANT_ID"
echo "  Skills processed: $SKILL_COUNT"
echo "  Skills successful: $SUCCESS_COUNT"
echo "  MCP servers processed: $MCP_COUNT"
echo "  MCP servers successful: $MCP_SUCCESS_COUNT"
echo ""
echo "Verify with:"
echo "  # Skills"
echo "  curl $CCAAS_URL/api/v1/skills -H 'X-Tenant-Id: $TENANT_ID'"
echo "  # MCP Servers"
echo "  curl $CCAAS_URL/api/v1/mcp-servers -H 'X-Tenant-Id: $TENANT_ID'"
echo ""
