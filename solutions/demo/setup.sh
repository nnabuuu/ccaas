#!/bin/bash
# setup.sh - Import a demo Solution into KedgeAgentic
#
# Usage:
#   cd demo/01-pure-chat && ../setup.sh       # Run from demo subdirectory
#   ./setup.sh 01-pure-chat                   # Run from demo/ directory with argument
#
# Configuration (via .env or environment variables):
#   CCAAS_URL     - Backend URL (default: https://ccaas.zhushou.one)
#   CCAAS_API_KEY - API key with admin + skills:write scopes (required)

set -e

# ==============================================================================
# Resolve demo directory
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -n "$1" ]; then
    # Argument mode: ./setup.sh 01-pure-chat
    DEMO_DIR="$SCRIPT_DIR/$1"
else
    # Subdirectory mode: cd 01-pure-chat && ../setup.sh
    DEMO_DIR="$(pwd)"
fi

if [ ! -f "$DEMO_DIR/solution.json" ]; then
    echo "Error: solution.json not found in $DEMO_DIR"
    echo ""
    echo "Usage:"
    echo "  cd demo/01-pure-chat && ../setup.sh"
    echo "  ./setup.sh 01-pure-chat"
    exit 1
fi

# ==============================================================================
# Load environment
# ==============================================================================

# Load .env from demo directory, then from parent (solutions/demo/)
if [ -f "$DEMO_DIR/.env" ]; then
    set -a; source "$DEMO_DIR/.env"; set +a
elif [ -f "$SCRIPT_DIR/.env" ]; then
    set -a; source "$SCRIPT_DIR/.env"; set +a
fi

# Default to hosted backend (core backend is not open-source)
export CCAAS_URL="${CCAAS_URL:-https://ccaas.zhushou.one}"

if [ -z "$CCAAS_API_KEY" ]; then
    echo "Error: CCAAS_API_KEY is required"
    echo ""
    echo "Set it in .env or as an environment variable:"
    echo "  cp .env.example .env"
    echo "  # Edit .env to set your CCAAS_API_KEY"
    echo ""
    echo "Get an API key from the admin dashboard at $CCAAS_URL"
    exit 1
fi

# ==============================================================================
# Source shared library
# ==============================================================================

TOOLS_DIR="$SCRIPT_DIR/../../tools"

if [ ! -f "$TOOLS_DIR/solution-lib.sh" ]; then
    echo "Error: tools/solution-lib.sh not found at $TOOLS_DIR"
    exit 1
fi

source "$TOOLS_DIR/solution-lib.sh"

# ==============================================================================
# Import solution
# ==============================================================================

DEMO_NAME="$(basename "$DEMO_DIR")"

log_header "Importing Demo: $DEMO_NAME"
log_info "Backend: $CCAAS_URL"
log_info "API Key: ${CCAAS_API_KEY:0:16}..."

# Step 1: Check backend connectivity
log_step "1" "Checking backend connectivity"
if ! curl -sf "$CCAAS_URL/api/v1/chat/health" > /dev/null 2>&1; then
    log_error "Cannot connect to backend at $CCAAS_URL"
    exit 1
fi
log_success "Backend is reachable"

# Step 2: Load solution config
log_step "2" "Loading solution configuration"
load_solution_config "$DEMO_DIR"

# Step 3: Import solution via admin API (creates tenant, MCP servers, templates)
log_step "3" "Importing solution (tenant + MCP + templates)"

SOLUTION_JSON=$(cat "$DEMO_DIR/solution.json")
IMPORT_RESPONSE=$(curl -s -X POST "$CCAAS_URL/api/v1/admin/solutions/import" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $CCAAS_API_KEY" \
    -d "$SOLUTION_JSON" 2>/dev/null)

# Check for errors
if echo "$IMPORT_RESPONSE" | jq -e '.statusCode >= 400' > /dev/null 2>&1; then
    log_error "Import failed"
    echo "$IMPORT_RESPONSE" | jq .
    exit 1
fi

TENANT_ID=$(echo "$IMPORT_RESPONSE" | jq -r '.tenantId // .tenant.id // empty')
if [ -n "$TENANT_ID" ]; then
    log_success "Solution imported (tenant: $TENANT_ID)"
else
    log_success "Solution imported"
    echo "$IMPORT_RESPONSE" | jq .
fi

# Step 4: Register skills
log_step "4" "Registering skills"

SKILLS_DIR="$DEMO_DIR/skills"
if [ -d "$SKILLS_DIR" ]; then
    inject_skills "$SKILLS_DIR" "$CCAAS_URL" "$SOLUTION_SLUG" "$CCAAS_API_KEY"
else
    log_warn "No skills directory found"
fi

# ==============================================================================
# Summary
# ==============================================================================

log_header "Setup Complete"

echo "Solution: $SOLUTION_NAME"
echo "Slug:     $SOLUTION_SLUG"
echo "Backend:  $CCAAS_URL"
echo ""
echo "Test with curl:"
echo ""
echo "  curl -N -X POST $CCAAS_URL/api/v1/sessions/test-$DEMO_NAME/messages \\"
echo "    -H \"Authorization: Bearer \$CCAAS_API_KEY\" \\"
echo "    -H \"Content-Type: application/json\" \\"
echo "    -H \"Accept: text/event-stream\" \\"
echo "    -d '{\"message\":\"Hello!\",\"tenantId\":\"$SOLUTION_SLUG\"}'"
echo ""
