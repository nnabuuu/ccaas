#!/bin/bash
# solution-lib.sh - Shared library for solution deployment scripts
# Version: 1.0.0
# Usage: source /path/to/solution-lib.sh
#
# This library provides reusable functions for:
# - Configuration management (98% reusable)
# - Port management (98% reusable)
# - Tenant management (95% reusable)
# - API key management (80% reusable)
# - Service management (90% reusable)
# - MCP server registration (85% reusable)
# - Skill injection (70% reusable)
# - Logging and UI utilities
# - Dependency checking

set -e

# Guard against multiple sourcing
if [ -n "$SOLUTION_LIB_LOADED" ]; then
    return 0
fi

# ==============================================================================
# CONSTANTS AND CONFIGURATION
# ==============================================================================

# Colors for output
readonly COLOR_RED='\033[0;31m'
readonly COLOR_GREEN='\033[0;32m'
readonly COLOR_YELLOW='\033[1;33m'
readonly COLOR_BLUE='\033[0;34m'
readonly COLOR_MAGENTA='\033[0;35m'
readonly COLOR_CYAN='\033[0;36m'
readonly COLOR_NC='\033[0m' # No Color

# Default configuration (can be overridden)
CCAAS_URL="${CCAAS_URL:-http://localhost:3001}"
CCAAS_DB="${CCAAS_DB:-../../packages/backend/.agent-workspace/data.db}"

# Solution configuration (loaded from solution.json)
SOLUTION_NAME=""
SOLUTION_SLUG=""
SOLUTION_VERSION=""
SOLUTION_DESCRIPTION=""
SOLUTION_DIR=""

# ==============================================================================
# LOGGING UTILITIES
# ==============================================================================

# Log an informational message
# Usage: log_info "message"
log_info() {
    echo -e "${COLOR_BLUE}ℹ️  $1${COLOR_NC}"
}

# Log a success message
# Usage: log_success "message"
log_success() {
    echo -e "${COLOR_GREEN}✅ $1${COLOR_NC}"
}

# Log a warning message
# Usage: log_warn "message"
log_warn() {
    echo -e "${COLOR_YELLOW}⚠️  $1${COLOR_NC}"
}

# Log an error message
# Usage: log_error "message"
log_error() {
    echo -e "${COLOR_RED}❌ $1${COLOR_NC}" >&2
}

# Log a header/section title
# Usage: log_header "Section Title"
log_header() {
    echo ""
    echo "========================================"
    echo "  $1"
    echo "========================================"
    echo ""
}

# Log a step title
# Usage: log_step "1" "Step description"
log_step() {
    echo ""
    echo "Step $1: $2"
    echo "----------------------------------------"
}

# ==============================================================================
# DEPENDENCY CHECKING
# ==============================================================================

# Check if required tools are installed
# Usage: check_dependencies
check_dependencies() {
    log_info "Checking dependencies..."

    local missing_deps=()

    if ! command -v node &> /dev/null; then
        missing_deps+=("node")
    fi

    if ! command -v jq &> /dev/null; then
        missing_deps+=("jq")
    fi

    if ! command -v sqlite3 &> /dev/null; then
        missing_deps+=("sqlite3")
    fi

    if ! command -v curl &> /dev/null; then
        missing_deps+=("curl")
    fi

    if ! command -v lsof &> /dev/null; then
        missing_deps+=("lsof")
    fi

    if [ ${#missing_deps[@]} -gt 0 ]; then
        log_error "Missing required dependencies: ${missing_deps[*]}"
        echo ""
        echo "Install instructions:"
        for dep in "${missing_deps[@]}"; do
            case "$dep" in
                node)
                    echo "  - Node.js: https://nodejs.org/"
                    ;;
                jq)
                    echo "  - jq: brew install jq (macOS) or apt-get install jq (Linux)"
                    ;;
                sqlite3)
                    echo "  - sqlite3: brew install sqlite (macOS) or apt-get install sqlite3 (Linux)"
                    ;;
                curl)
                    echo "  - curl: should be pre-installed on most systems"
                    ;;
                lsof)
                    echo "  - lsof: should be pre-installed on most systems"
                    ;;
            esac
        done
        exit 1
    fi

    log_success "All dependencies installed"
    log_info "Node.js version: $(node -v)"
}

# Check if CCAAS backend is running
# Usage: check_ccaas_backend
check_ccaas_backend() {
    log_info "Checking CCAAS connectivity at $CCAAS_URL..."

    if ! curl -s "$CCAAS_URL/api/v1/health" > /dev/null 2>&1; then
        log_error "Cannot connect to CCAAS at $CCAAS_URL"
        echo ""
        echo "Please start CCAAS backend first:"
        echo "  cd packages/backend && npm run start:dev"
        echo ""
        exit 1
    fi

    log_success "CCAAS is running at $CCAAS_URL"
}

# ==============================================================================
# CONFIGURATION MANAGEMENT
# ==============================================================================

# Load solution configuration from solution.json
# Usage: load_solution_config "/path/to/solution"
load_solution_config() {
    local solution_dir="${1:-.}"
    SOLUTION_DIR="$solution_dir"

    local config_file="$solution_dir/solution.json"

    if [ ! -f "$config_file" ]; then
        log_error "solution.json not found at $config_file"
        exit 1
    fi

    log_info "Loading solution configuration from $config_file"

    # Parse solution.json
    SOLUTION_NAME=$(jq -r '.name // ""' "$config_file")
    SOLUTION_SLUG=$(jq -r '.slug // ""' "$config_file")
    SOLUTION_VERSION=$(jq -r '.version // "1.0.0"' "$config_file")
    SOLUTION_DESCRIPTION=$(jq -r '.description // ""' "$config_file")

    # Validate required fields
    if [ -z "$SOLUTION_NAME" ]; then
        log_error "solution.json missing required field: name"
        exit 1
    fi

    if [ -z "$SOLUTION_SLUG" ]; then
        log_error "solution.json missing required field: slug"
        exit 1
    fi

    log_success "Configuration loaded"
    log_info "  Name: $SOLUTION_NAME"
    log_info "  Slug: $SOLUTION_SLUG"
    log_info "  Version: $SOLUTION_VERSION"
}

# Validate solution configuration
# Usage: validate_solution_config
validate_solution_config() {
    log_info "Validating solution configuration..."

    local errors=()

    if [ -z "$SOLUTION_NAME" ]; then
        errors+=("SOLUTION_NAME is not set")
    fi

    if [ -z "$SOLUTION_SLUG" ]; then
        errors+=("SOLUTION_SLUG is not set")
    fi

    if [ ${#errors[@]} -gt 0 ]; then
        log_error "Configuration validation failed:"
        for error in "${errors[@]}"; do
            echo "  - $error"
        done
        exit 1
    fi

    log_success "Configuration is valid"
}

# ==============================================================================
# PORT MANAGEMENT (98% reusable)
# ==============================================================================

# Check if a port is available
# Usage: check_port_available PORT
# Returns: 0 if available, 1 if in use
check_port_available() {
    local port="$1"

    if lsof -Pi ":$port" -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 1
    else
        return 0
    fi
}

# Kill process using a port
# Usage: kill_port PORT
kill_port() {
    local port="$1"

    if lsof -Pi ":$port" -sTCP:LISTEN -t >/dev/null 2>&1; then
        log_warn "Port $port is occupied, killing process..."
        lsof -ti":$port" | xargs kill -9 2>/dev/null || true
        sleep 1
        log_success "Port $port released"
    fi
}

# Wait for a port to be ready
# Usage: wait_for_port PORT [MAX_RETRY]
wait_for_port() {
    local port="$1"
    local max_retry="${2:-30}"
    local retry=0

    log_info "Waiting for port $port to be ready..."

    while [ $retry -lt $max_retry ]; do
        if lsof -Pi ":$port" -sTCP:LISTEN -t >/dev/null 2>&1; then
            log_success "Port $port is ready"
            return 0
        fi
        retry=$((retry + 1))
        sleep 1
    done

    log_error "Port $port did not become ready after $max_retry seconds"
    return 1
}

# ==============================================================================
# TENANT MANAGEMENT (95% reusable)
# ==============================================================================

# Create or get tenant
# Usage: eval "$(create_or_get_tenant CCAAS_URL SLUG NAME DESCRIPTION BOOTSTRAP_KEY)"
# Sets: TENANT_ID
#
# Requires admin auth (X-Api-Key header with bootstrap admin key).
# Get BOOTSTRAP_KEY from: BOOTSTRAP_KEY=$(get_or_create_bootstrap_key $CCAAS_URL)
#
# MIGRATION NOTE (from 4-arg signature):
#   Old: eval "$(create_or_get_tenant $URL $SLUG $NAME $DESC)"
#   New: eval "$(create_or_get_tenant $URL $SLUG $NAME $DESC $BOOTSTRAP_KEY)"
#   Or:  export CCAAS_BOOTSTRAP_KEY=sk-...; eval "$(create_or_get_tenant $URL $SLUG $NAME $DESC)"
#
# This function creates or retrieves a tenant. API keys are managed separately
# through the modern API key system (use create_solution_api_key).
create_or_get_tenant() {
    local ccaas_url="$1"
    local slug="$2"
    local name="$3"
    local description="$4"
    local bootstrap_key="${5:-${CCAAS_BOOTSTRAP_KEY:-}}"

    if [ -z "$bootstrap_key" ]; then
        log_error "create_or_get_tenant: bootstrap_key (arg 5) is required" >&2
        echo "" >&2
        echo "Provide it as 5th argument or set CCAAS_BOOTSTRAP_KEY env var:" >&2
        echo "  BOOTSTRAP_KEY=\$(get_or_create_bootstrap_key \$CCAAS_URL)" >&2
        echo "  eval \"\$(create_or_get_tenant \$CCAAS_URL \$SLUG \$NAME \$DESC \$BOOTSTRAP_KEY)\"" >&2
        return 1
    fi

    # Send log messages to stderr to avoid interfering with eval
    log_info "Setting up tenant '$slug'..." >&2

    # Try to create new tenant (requires admin auth)
    local create_response
    create_response=$(curl -s -X POST "$ccaas_url/api/v1/tenants" \
        -H "Content-Type: application/json" \
        -H "X-Api-Key: $bootstrap_key" \
        -d "{
            \"slug\": \"$slug\",
            \"name\": \"$name\",
            \"description\": \"$description\"
        }" 2>/dev/null)

    local tenant_id=$(echo "$create_response" | jq -r '.id // empty')

    if [ -n "$tenant_id" ]; then
        # Validate UUID format before eval to prevent shell injection
        if [[ ! "$tenant_id" =~ ^[a-zA-Z0-9_-]+$ ]]; then
            log_error "API returned unexpected tenant ID format: $tenant_id" >&2
            return 1
        fi
        log_success "Tenant created: $tenant_id" >&2
        echo "export TENANT_ID='$tenant_id'"
        return 0
    fi

    # Tenant already exists, fetch it
    if echo "$create_response" | grep -q "already exists"; then
        log_info "Tenant exists, fetching..." >&2
        local existing_tenant
        existing_tenant=$(curl -s "$ccaas_url/api/v1/tenants/$slug" \
            -H "X-Api-Key: $bootstrap_key" 2>/dev/null)

        tenant_id=$(echo "$existing_tenant" | jq -r '.id // empty')

        if [ -n "$tenant_id" ]; then
            # Validate UUID format before eval to prevent shell injection
            if [[ ! "$tenant_id" =~ ^[a-zA-Z0-9_-]+$ ]]; then
                log_error "API returned unexpected tenant ID format: $tenant_id" >&2
                return 1
            fi
            log_success "Tenant found: $tenant_id" >&2
            echo "export TENANT_ID='$tenant_id'"
            return 0
        fi
    fi

    log_error "Failed to create or fetch tenant" >&2
    echo "Response: $create_response" >&2
    return 1
}

# Verify tenant exists
# Usage: verify_tenant_exists TENANT_ID
verify_tenant_exists() {
    local tenant_id="$1"

    if [ -z "$tenant_id" ]; then
        log_error "Tenant ID is empty"
        return 1
    fi

    local tenant_response
    tenant_response=$(curl -s "$CCAAS_URL/api/v1/tenants" -H "X-Tenant-Id: $tenant_id" 2>/dev/null || echo '{}')
    local found_id
    found_id=$(echo "$tenant_response" | jq -r '.id // empty')

    if [ "$found_id" = "$tenant_id" ]; then
        log_success "Tenant verified: $tenant_id"
        return 0
    else
        log_error "Tenant not found: $tenant_id"
        return 1
    fi
}

# Get or create bootstrap admin key for modern API key system
# Usage: ADMIN_KEY=$(get_or_create_bootstrap_key CCAAS_URL)
# Returns: sk-default-xxxx (bootstrap admin key with 'admin' scope)
#
# This function retrieves the bootstrap admin key that was auto-created
# on backend startup. It's needed to create solution-specific API keys.
get_or_create_bootstrap_key() {
    local ccaas_url="$1"

    log_info "Retrieving bootstrap admin key..." >&2

    # Try to get default tenant's bootstrap key
    # The backend auto-creates this on first startup (api-key.service.ts onModuleInit)
    # It's logged to console but not retrievable via API

    # For now, read from environment variable or prompt user
    if [ -n "$CCAAS_BOOTSTRAP_KEY" ]; then
        echo "$CCAAS_BOOTSTRAP_KEY"
        return 0
    fi

    log_error "Bootstrap admin key not found" >&2
    echo "" >&2
    echo "The bootstrap admin key is auto-created on backend startup." >&2
    echo "Please check backend logs for:" >&2
    echo '  [ApiKeyService] Created default API key: sk-default-...' >&2
    echo "" >&2
    echo "Then set environment variable:" >&2
    echo "  export CCAAS_BOOTSTRAP_KEY=sk-default-xxxxx" >&2
    echo "" >&2
    return 1
}

# Create solution-specific API key using modern system
# Usage: eval "$(create_solution_api_key CCAAS_URL TENANT_ID BOOTSTRAP_KEY SOLUTION_NAME)"
# Sets: API_KEY
#
# This creates a modern API key with proper scopes and rate limiting.
create_solution_api_key() {
    local ccaas_url="$1"
    local tenant_id="$2"
    local bootstrap_key="$3"
    local solution_name="$4"

    log_info "Creating modern API key for solution..." >&2

    # Call admin API to create key
    local create_response
    create_response=$(curl -s -X POST "$ccaas_url/api/v1/admin/api-keys" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $bootstrap_key" \
        -d "{
            \"tenantId\": \"$tenant_id\",
            \"name\": \"$solution_name Setup Key\",
            \"scopes\": [\"skills:write\", \"skills:read\", \"mcp:write\", \"mcp:read\", \"chat\", \"admin\"],
            \"rateLimitRpm\": 1000,
            \"rateLimitRpd\": 100000
        }" 2>/dev/null)

    local raw_key=$(echo "$create_response" | jq -r '.rawKey // empty')

    if [ -n "$raw_key" ]; then
        # Validate sk- key format before eval to prevent shell injection
        if [[ ! "$raw_key" =~ ^sk-[a-zA-Z0-9_-]+$ ]]; then
            log_error "API returned unexpected API key format: ${raw_key:0:16}..." >&2
            return 1
        fi
        log_success "Modern API key created: ${raw_key:0:16}..." >&2
        echo "export API_KEY='$raw_key'"
        return 0
    fi

    log_error "Failed to create modern API key" >&2
    echo "Response: $create_response" >&2
    return 1
}

# ==============================================================================
# API KEY MANAGEMENT
# ==============================================================================
#
# CCAAS provides TWO API key systems:
#
# 1. Legacy Tenant API Key (recommended for solutions):
#    - Created automatically when tenant is created
#    - Returned in tenant API responses (GET /api/v1/tenants/:slug)
#    - Can be regenerated (POST /api/v1/tenants/:id/regenerate-key)
#    - No admin scope required
#    - Use create_or_get_tenant() to get this key
#
# 2. Modern API Keys (for production, requires admin):
#    - Supports scopes and rate limiting
#    - Stored as SHA-256 hash
#    - Requires admin scope to create
#    - Use POST /api/v1/admin/api-keys
#
# For solution demos, use system 1 (legacy tenant API key).
# ==============================================================================

# ⚠️  REMOVED: create_bootstrap_key() has been deprecated
# Usage: N/A - Use get_or_create_bootstrap_key() and create_solution_api_key() instead
#
# Legacy tenant API keys are no longer supported. The modern API key system
# requires a bootstrap admin key that is auto-created on backend startup.
# See tools/README.md for the new workflow.
create_bootstrap_key() {
    log_error "REMOVED: create_bootstrap_key() has been removed" >&2
    log_error "Legacy tenant API keys are no longer supported" >&2
    echo "" >&2
    echo "New workflow:" >&2
    echo "1. Get bootstrap key: BOOTSTRAP_KEY=\$(get_or_create_bootstrap_key \$CCAAS_URL)" >&2
    echo "2. Create solution key: eval \"\$(create_solution_api_key \$CCAAS_URL \$TENANT_ID \$BOOTSTRAP_KEY \$SOLUTION_NAME)\"" >&2
    echo "" >&2
    echo "See tools/README.md for details." >&2
    return 1
}

# Verify API key is valid
# Usage: verify_api_key API_KEY
verify_api_key() {
    local api_key="$1"

    if [ -z "$api_key" ]; then
        log_error "API key is empty"
        return 1
    fi

    if [[ ! "$api_key" =~ ^sk- ]]; then
        log_error "Invalid API key format (must start with 'sk-')"
        return 1
    fi

    log_success "API key format is valid"
    return 0
}

# ==============================================================================
# SERVICE MANAGEMENT (90% reusable)
# ==============================================================================

# Start a service in the background
# Usage: PID=$(start_service "service-name" "/path/to/dir" PORT "npm run dev")
start_service() {
    local name="$1"
    local dir="$2"
    local port="$3"
    local command="$4"

    log_info "Starting $name service on port $port..."

    cd "$dir"
    eval "$command" > "/tmp/${name}.log" 2>&1 &
    local pid=$!

    log_success "$name service started (PID: $pid)"
    echo "$pid"
}

# Stop a service by PID
# Usage: stop_service PID
stop_service() {
    local pid="$1"

    if [ -n "$pid" ]; then
        log_info "Stopping service (PID: $pid)..."
        kill "$pid" 2>/dev/null || true
        log_success "Service stopped"
    fi
}

# Wait for service to be ready
# Usage: wait_for_service_ready PORT [MAX_RETRY]
wait_for_service_ready() {
    wait_for_port "$@"
}

# Check service health
# Usage: check_service_health URL
check_service_health() {
    local url="$1"

    if curl -s "$url" > /dev/null 2>&1; then
        log_success "Service is healthy"
        return 0
    else
        log_error "Service health check failed"
        return 1
    fi
}

# ==============================================================================
# NPM DEPENDENCY MANAGEMENT
# ==============================================================================

# Install npm dependencies in a directory
# Usage: install_npm_dependencies "/path/to/dir"
install_npm_dependencies() {
    local dir="$1"
    local dir_name=$(basename "$dir")

    if [ ! -d "$dir" ]; then
        log_warn "Directory not found: $dir (skipping)"
        return 0
    fi

    if [ ! -f "$dir/package.json" ]; then
        log_warn "No package.json in $dir_name (skipping)"
        return 0
    fi

    log_info "Installing dependencies in $dir_name..."
    cd "$dir"
    npm install > /dev/null 2>&1
    log_success "Dependencies installed in $dir_name"
}

# ==============================================================================
# SKILL INJECTION (70% reusable)
# ==============================================================================

# Inject all skills from a directory
# Usage: inject_skills "/path/to/skills" CCAAS_URL TENANT_ID API_KEY
inject_skills() {
    local skills_dir="$1"
    local ccaas_url="$2"
    local tenant_id="$3"
    local api_key="$4"

    log_step "X" "Injecting skills"

    if [ ! -d "$skills_dir" ]; then
        log_warn "No skills directory found at $skills_dir"
        return 0
    fi

    local skill_count=0
    local success_count=0

    for skill_dir in "$skills_dir"/*; do
        if [ -d "$skill_dir" ]; then
            local skill_name=$(basename "$skill_dir")
            local skill_file="$skill_dir/SKILL.md"

            if [ -f "$skill_file" ]; then
                skill_count=$((skill_count + 1))
                echo ""
                log_info "Processing skill: $skill_name"

                if inject_single_skill "$skill_file" "$skill_name" "$ccaas_url" "$tenant_id" "$api_key"; then
                    success_count=$((success_count + 1))
                fi
            fi
        fi
    done

    echo ""
    log_success "Skills: $success_count/$skill_count successful"
}

# Inject a single skill
# Usage: inject_single_skill SKILL_FILE SKILL_NAME CCAAS_URL TENANT_ID API_KEY
inject_single_skill() {
    local skill_file="$1"
    local skill_name="$2"
    local ccaas_url="$3"
    local tenant_id="$4"
    local api_key="$5"

    # Read skill content
    local skill_content=$(cat "$skill_file")

    # Extract metadata from frontmatter if present
    local skill_display_name="$skill_name"
    local skill_description=""

    # Check if file starts with --- (frontmatter)
    if head -n 1 "$skill_file" | grep -q "^---"; then
        # Extract name from frontmatter
        local extracted_name=$(awk '/^---$/,/^---$/' "$skill_file" | grep "^name:" | sed 's/^name:[[:space:]]*//')
        if [ -n "$extracted_name" ]; then
            skill_display_name="$extracted_name"
        fi

        # Extract description from frontmatter
        local extracted_desc=$(awk '/^---$/,/^---$/' "$skill_file" | grep "^description:" | sed 's/^description:[[:space:]]*//')
        if [ -n "$extracted_desc" ]; then
            skill_description="$extracted_desc"
        fi
    fi

    log_info "  Name: $skill_display_name"
    log_info "  Description: ${skill_description:-"(none)"}"

    # Escape content for JSON
    local skill_content_escaped=$(echo "$skill_content" | jq -Rs .)

    # Check if skill already exists
    local existing_skill=$(curl -s "$ccaas_url/api/v1/skills/$skill_name" \
        -H "X-Tenant-Id: $tenant_id" \
        -H "X-Api-Key: $api_key" 2>/dev/null || echo '{}')
    local existing_skill_id=$(echo "$existing_skill" | jq -r '.id // empty')

    if [ -n "$existing_skill_id" ]; then
        # Update existing skill
        log_info "  Updating existing skill..."
        local update_response=$(curl -s -X PUT "$ccaas_url/api/v1/skills/$existing_skill_id" \
            -H "Content-Type: application/json" \
            -H "X-Tenant-Id: $tenant_id" \
            -H "X-Api-Key: $api_key" \
            -d "{
                \"name\": \"$skill_display_name\",
                \"description\": \"$skill_description\",
                \"content\": $skill_content_escaped
            }")

        local skill_id="$existing_skill_id"
        log_success "  Updated skill: $skill_id"
    else
        # Create new skill
        log_info "  Creating new skill..."
        # Valid type values: "skill" | "sub-agent"
        # Using "skill" for standard AI skills loaded as system prompts.
        # "sub-agent" is for skills that spawn a dedicated sub-agent process.
        local create_skill_response=$(curl -s -X POST "$ccaas_url/api/v1/skills" \
            -H "Content-Type: application/json" \
            -H "X-Tenant-Id: $tenant_id" \
            -H "X-Api-Key: $api_key" \
            -d "{
                \"name\": \"$skill_display_name\",
                \"slug\": \"$skill_name\",
                \"description\": \"$skill_description\",
                \"content\": $skill_content_escaped,
                \"type\": \"skill\"
            }")

        local skill_id=$(echo "$create_skill_response" | jq -r '.id // empty')

        if [ -z "$skill_id" ]; then
            log_error "  Failed to create skill"
            echo "  Response: $create_skill_response" >&2
            return 1
        fi

        log_success "  Created skill: $skill_id"
    fi

    # Publish skill
    publish_skill "$skill_id" "$ccaas_url" "$tenant_id" "$api_key"
    return 0
}

# Publish a skill
# Usage: publish_skill SKILL_ID CCAAS_URL TENANT_ID API_KEY
publish_skill() {
    local skill_id="$1"
    local ccaas_url="$2"
    local tenant_id="$3"
    local api_key="$4"

    log_info "  Publishing skill..."
    local publish_response=$(curl -s -X POST "$ccaas_url/api/v1/skills/$skill_id/publish" \
        -H "X-Tenant-Id: $tenant_id" \
        -H "X-Api-Key: $api_key")

    local publish_status=$(echo "$publish_response" | jq -r '.status // empty')
    if [ "$publish_status" = "published" ] || [ -n "$publish_status" ]; then
        log_success "  Published successfully"
        return 0
    else
        log_warn "  Publish status: $publish_status"
        return 0
    fi
}

# ==============================================================================
# MCP SERVER REGISTRATION (85% reusable)
# ==============================================================================

# Inject all MCP servers from solution.json
# Usage: inject_mcp_servers SOLUTION_DIR CCAAS_URL TENANT_ID API_KEY
inject_mcp_servers() {
    local solution_dir="$1"
    local ccaas_url="$2"
    local tenant_id="$3"
    local api_key="$4"

    log_step "X" "Injecting MCP servers"

    local solution_json="$solution_dir/solution.json"

    if [ ! -f "$solution_json" ]; then
        log_warn "No solution.json found at $solution_dir"
        return 0
    fi

    local mcp_count=$(jq '.mcpServers | length' "$solution_json" 2>/dev/null || echo "0")

    if [ "$mcp_count" -eq 0 ]; then
        log_warn "No MCP servers defined in solution.json"
        return 0
    fi

    log_info "Found $mcp_count MCP server(s) in solution.json"

    local mcp_success_count=0

    while IFS= read -r row; do
        local server_name=$(echo "$row" | jq -r '.key')
        local server_config=$(echo "$row" | jq '.value')

        echo ""
        log_info "Processing MCP server: $server_name"

        # Workspace directory for tenant files
        local workspace_dir="$solution_dir/../../packages/backend/.agent-workspace"

        if inject_single_mcp_server "$server_name" "$server_config" "$solution_dir" "$ccaas_url" "$tenant_id" "$api_key" "$workspace_dir"; then
            mcp_success_count=$((mcp_success_count + 1))
        fi
    done < <(jq -c '.mcpServers | to_entries[]' "$solution_json")

    echo ""
    log_success "MCP servers: $mcp_success_count/$mcp_count successful"
}

# Copy MCP server files to tenant directory
# Returns tenant-relative path for database storage
# Usage: copy_mcp_to_tenant SERVER_NAME SOURCE_PATH TENANT_ID WORKSPACE_DIR
copy_mcp_to_tenant() {
    local server_name="$1"
    local source_path="$2"      # Absolute path to MCP server entry point
    local tenant_id="$3"
    local workspace_dir="$4"    # .agent-workspace

    # Extract directory containing the MCP server (go up from dist/index.js to root)
    local mcp_dir=$(dirname $(dirname "$source_path"))

    # Create tenant MCP directory
    local tenant_mcp_dir="$workspace_dir/tenants/$tenant_id/mcp-servers/$server_name"
    mkdir -p "$tenant_mcp_dir"

    # Copy entire MCP server directory
    cp -r "$mcp_dir/"* "$tenant_mcp_dir/" >&2

    # Return tenant-relative path for database storage (stdout only)
    # Extract the relative path after the MCP server root
    local rel_path="${source_path#$mcp_dir/}"
    echo "tenants/$tenant_id/mcp-servers/$server_name/$rel_path"
}

# Inject a single MCP server
# Usage: inject_single_mcp_server SERVER_NAME SERVER_CONFIG SOLUTION_DIR CCAAS_URL TENANT_ID API_KEY WORKSPACE_DIR
inject_single_mcp_server() {
    local server_name="$1"
    local server_config="$2"
    local solution_dir="$3"
    local ccaas_url="$4"
    local tenant_id="$5"
    local api_key="$6"
    local workspace_dir="$7"    # Optional, defaults to ../../packages/backend/.agent-workspace

    # Default workspace directory if not provided
    if [ -z "$workspace_dir" ]; then
        workspace_dir="$solution_dir/../../packages/backend/.agent-workspace"
    fi

    # Resolve relative paths in args (MCP server paths relative to solution dir)
    local command=$(echo "$server_config" | jq -r '.command')
    local raw_args=$(echo "$server_config" | jq -c '.args')
    local description=$(echo "$server_config" | jq -r '.description // ""')
    local env=$(echo "$server_config" | jq -c '.env // {}')

    # Process args: resolve relative paths and copy to tenant directory
    local tenant_relative_args='[]'
    local first_arg=$(echo "$raw_args" | jq -r '.[0] // ""')

    if [[ "$first_arg" =~ \.(js|ts)$ ]]; then
        # This is a file path - resolve and copy to tenant
        local absolute_source="$solution_dir/$first_arg"

        if [ ! -f "$absolute_source" ]; then
            log_error "  MCP server file not found: $absolute_source"
            return 1
        fi

        # Copy MCP server to tenant directory
        log_info "    Copying MCP server files to tenant directory..."
        local tenant_relative_path=$(copy_mcp_to_tenant "$server_name" "$absolute_source" "$tenant_id" "$workspace_dir")

        # Build args array with tenant-relative path
        tenant_relative_args=$(echo "$raw_args" | jq -c --arg newPath "$tenant_relative_path" '.[0] = $newPath')

        log_info "  Copied to: $workspace_dir/$tenant_relative_path"
    else
        # Not a file path, keep args as-is
        tenant_relative_args="$raw_args"
    fi

    log_info "  Command: $command"
    log_info "  Args: $tenant_relative_args"

    # Check if MCP server already exists
    local existing_mcp=$(curl -s "$ccaas_url/api/v1/mcp-servers/$server_name" \
        -H "X-Tenant-Id: $tenant_id" \
        -H "X-Api-Key: $api_key" 2>/dev/null || echo '{}')
    local existing_mcp_id=$(echo "$existing_mcp" | jq -r '.id // empty')

    if [ -n "$existing_mcp_id" ]; then
        # Update existing MCP server
        log_info "  Updating existing MCP server..."
        local update_mcp_response=$(curl -s -X PUT "$ccaas_url/api/v1/mcp-servers/$existing_mcp_id" \
            -H "Content-Type: application/json" \
            -H "X-Tenant-Id: $tenant_id" \
            -H "X-Api-Key: $api_key" \
            -d "{
                \"name\": \"$server_name\",
                \"description\": \"$description\",
                \"config\": {
                    \"command\": \"$command\",
                    \"args\": $tenant_relative_args,
                    \"env\": $env
                },
                \"status\": \"active\"
            }")

        local mcp_id="$existing_mcp_id"
        log_success "  Updated MCP server: $mcp_id"
        return 0
    else
        # Create new MCP server
        log_info "  Creating new MCP server..."
        local create_mcp_response=$(curl -s -X POST "$ccaas_url/api/v1/mcp-servers" \
            -H "Content-Type: application/json" \
            -H "X-Tenant-Id: $tenant_id" \
            -H "X-Api-Key: $api_key" \
            -d "{
                \"name\": \"$server_name\",
                \"slug\": \"$server_name\",
                \"description\": \"$description\",
                \"type\": \"stdio\",
                \"config\": {
                    \"command\": \"$command\",
                    \"args\": $tenant_relative_args,
                    \"env\": $env
                },
                \"status\": \"active\"
            }")

        local mcp_id=$(echo "$create_mcp_response" | jq -r '.id // empty')

        if [ -z "$mcp_id" ]; then
            log_error "  Failed to create MCP server"
            echo "  Response: $create_mcp_response" >&2
            return 1
        fi

        log_success "  Created MCP server: $mcp_id"
        return 0
    fi
}

# ==============================================================================
# HOOK SYSTEM
# ==============================================================================

# Run a hook script if it exists
# Usage: run_hook "pre-install"
run_hook() {
    local hook_name="$1"
    local hook_file="$SOLUTION_DIR/.solution-hooks/$hook_name.sh"

    if [ -f "$hook_file" ]; then
        log_info "Running $hook_name hook..."
        bash "$hook_file"
        log_success "$hook_name hook completed"
    fi
}

# ==============================================================================
# SUMMARY DISPLAY
# ==============================================================================

# Display setup summary
# Usage: display_summary
display_summary() {
    log_header "Setup Complete"

    echo "Solution: $SOLUTION_NAME"
    echo "Version: $SOLUTION_VERSION"
    echo ""

    echo "📍 CCAAS: $CCAAS_URL"
    echo ""

    if [ -n "$CCAAS_API_KEY" ]; then
        echo "🔑 API Key: ${CCAAS_API_KEY:0:16}..."
        echo ""
    fi

    echo "Press Ctrl+C to stop all services"
}

# ==============================================================================
# LIBRARY INFO
# ==============================================================================

# Display library version and info
# Usage: solution_lib_info
solution_lib_info() {
    echo "solution-lib.sh version 1.0.0"
    echo "CCAAS Solution Deployment Toolkit"
}

# Export all functions
export -f log_info log_success log_warn log_error log_header log_step
export -f check_dependencies check_ccaas_backend
export -f load_solution_config validate_solution_config
export -f check_port_available kill_port wait_for_port
export -f create_or_get_tenant verify_tenant_exists
export -f create_bootstrap_key verify_api_key
export -f start_service stop_service wait_for_service_ready check_service_health
export -f install_npm_dependencies
export -f inject_skills inject_single_skill publish_skill
export -f inject_mcp_servers inject_single_mcp_server
export -f run_hook display_summary solution_lib_info

# Mark library as loaded
export SOLUTION_LIB_LOADED=1
