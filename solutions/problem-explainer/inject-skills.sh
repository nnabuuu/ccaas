#!/bin/bash
# Inject skills into CCAAS
# Creates tenant and registers skills from skills/*/SKILL.md

set -e

# Configuration
CCAAS_URL="${CCAAS_URL:-http://localhost:3001}"
MCP_SERVER_URL="${MCP_SERVER_URL:-http://localhost:3004}"
TENANT_SLUG="problem-explainer"
TENANT_NAME="Problem Explainer"
SOLUTION_DIR="$(cd "$(dirname "$0")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================"
echo "  Problem Explainer - Skill Injection"
echo "========================================"
echo ""
echo "CCAAS URL: $CCAAS_URL"
echo "MCP Server URL: $MCP_SERVER_URL"
echo "Tenant: $TENANT_SLUG"
echo "Solution dir: $SOLUTION_DIR"
echo ""

# Check if jq is available
if ! command -v jq &> /dev/null; then
  echo -e "${RED}Error: jq is required but not installed.${NC}"
  echo "Install with: brew install jq (macOS) or apt-get install jq (Linux)"
  exit 1
fi

# Read solution.json for skill configuration
SOLUTION_JSON="$SOLUTION_DIR/solution.json"
if [ ! -f "$SOLUTION_JSON" ]; then
  echo -e "${RED}Error: solution.json not found at $SOLUTION_JSON${NC}"
  exit 1
fi

# Extract skill configuration from solution.json
SKILL_ALLOWED_TOOLS=$(jq -c '.skill.allowedTools // []' "$SOLUTION_JSON")
SKILL_TRIGGERS=$(jq -c '.skill.triggers // []' "$SOLUTION_JSON")

echo "Skill allowedTools: $SKILL_ALLOWED_TOOLS"
echo "Skill triggers: $(echo "$SKILL_TRIGGERS" | jq -r 'map(.value) | join(", ")')"

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
      \"description\": \"AI讲题专家 - 分析题目、生成讲稿、制作音频和PPT\"
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
          -H "X-Tenant-Id: $TENANT_ID" 2>/dev/null || echo '{}')
        EXISTING_SKILL_ID=$(echo "$EXISTING_SKILL" | jq -r '.id // empty')

        if [ -n "$EXISTING_SKILL_ID" ]; then
          # Update existing skill
          echo "  Updating existing skill..."
          UPDATE_RESPONSE=$(curl -s -X PUT "$CCAAS_URL/api/v1/skills/$EXISTING_SKILL_ID" \
            -H "Content-Type: application/json" \
            -H "X-Tenant-Id: $TENANT_ID" \
            -d "{
              \"name\": \"$skill_display_name\",
              \"description\": \"$skill_description\",
              \"content\": $skill_content_escaped,
              \"allowedTools\": $SKILL_ALLOWED_TOOLS,
              \"triggers\": $SKILL_TRIGGERS
            }")

          SKILL_ID="$EXISTING_SKILL_ID"
          echo -e "  ${GREEN}Updated skill: $SKILL_ID${NC}"
        else
          # Create new skill
          # IMPORTANT: Only include valid CreateSkillDto fields
          # DO NOT include: tenantId, mcpServers, isActive (causes 400 error)
          echo "  Creating new skill..."
          CREATE_SKILL_RESPONSE=$(curl -s -X POST "$CCAAS_URL/api/v1/skills" \
            -H "Content-Type: application/json" \
            -H "X-Tenant-Id: $TENANT_ID" \
            -d "{
              \"name\": \"$skill_display_name\",
              \"slug\": \"$skill_name\",
              \"description\": \"$skill_description\",
              \"content\": $skill_content_escaped,
              \"type\": \"skill\",
              \"allowedTools\": $SKILL_ALLOWED_TOOLS,
              \"triggers\": $SKILL_TRIGGERS
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
          -H "X-Tenant-Id: $TENANT_ID")

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

# Step 3: Verify MCP Server
echo "Step 3: Verifying MCP Server..."
echo "----------------------------------------"

# Check if MCP Server is running
if curl -s "$MCP_SERVER_URL/health" > /dev/null 2>&1; then
  echo -e "${GREEN}MCP Server is running at $MCP_SERVER_URL${NC}"

  # Show available tools
  TOOLS_RESPONSE=$(curl -s "$MCP_SERVER_URL/tools/get_subjects")
  if echo "$TOOLS_RESPONSE" | jq -e '.status == "success"' > /dev/null 2>&1; then
    echo -e "${GREEN}MCP Server API is responding correctly${NC}"
  fi

  MCP_STATUS="running"
else
  echo -e "${YELLOW}Warning: MCP Server not running at $MCP_SERVER_URL${NC}"
  echo "  Start it with: cd mcp-server && npm run start"
  MCP_STATUS="not running"
fi

# Note: CCAAS backend doesn't expose MCP server registration API
# The MCP server runs as a standalone REST API service
# Tools are available via the skill's allowedTools configuration

echo ""
echo "========================================"
echo "  Injection Complete"
echo "========================================"
echo ""
echo "Summary:"
echo "  Tenant ID: $TENANT_ID"
echo "  Skills processed: $SKILL_COUNT"
echo "  Skills successful: $SUCCESS_COUNT"
echo "  MCP Server: $MCP_STATUS"
echo ""
echo "Verify with:"
echo "  curl $CCAAS_URL/api/v1/skills -H 'X-Tenant-Id: $TENANT_ID'"
echo "  curl $MCP_SERVER_URL/health"
echo "  curl $MCP_SERVER_URL/tools/get_subjects"
echo ""
