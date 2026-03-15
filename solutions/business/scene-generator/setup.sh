#!/bin/bash
# Chibi Scene Generator - Setup Script
# Chat-only solution: no frontend, no backend, no database

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOOLS_DIR="$SCRIPT_DIR/../../../tools"

# Source shared library
if [ ! -f "$TOOLS_DIR/solution-lib.sh" ]; then
    echo "Error: solution-lib.sh not found at $TOOLS_DIR"
    echo "   Please run from solutions/ directory"
    exit 1
fi

source "$TOOLS_DIR/solution-lib.sh"

# Load solution configuration
load_solution_config "$SCRIPT_DIR"

# Load port configuration from solution.config
if [ -f "$SCRIPT_DIR/solution.config" ]; then
    source "$SCRIPT_DIR/solution.config"
fi

# Default bootstrap key
CCAAS_BOOTSTRAP_KEY="${CCAAS_BOOTSTRAP_KEY:-sk-default-testd84f5b7a1dbdbc4c424417be6c009f01}"

# Check GEMINI_API_KEY availability
check_gemini_key() {
    if [ -n "$GEMINI_API_KEY" ]; then
        log_success "GEMINI_API_KEY found in environment"
        return 0
    fi

    local env_file="$HOME/.kedge-agentic/scene-generator.env"
    if [ -f "$env_file" ]; then
        # shellcheck disable=SC1090
        source "$env_file"
        if [ -n "$GEMINI_API_KEY" ]; then
            export GEMINI_API_KEY
            log_success "GEMINI_API_KEY loaded from $env_file"
            return 0
        fi
    fi

    log_warn "GEMINI_API_KEY not found!"
    echo "   Set it via one of:"
    echo "   1. export GEMINI_API_KEY=your_key"
    echo "   2. Create ~/.kedge-agentic/scene-generator.env with: GEMINI_API_KEY=your_key"
    echo ""
    echo "   The MCP server will fail without this key."
    return 1
}

# Custom initialization - build MCP server
custom_init() {
    log_step "3" "Building MCP server"

    local mcp_dir="$SCRIPT_DIR/mcp-server"
    if [ -d "$mcp_dir" ]; then
        cd "$mcp_dir"
        log_info "Installing MCP server dependencies..."
        npm install > /dev/null 2>&1
        log_info "Building MCP server..."
        npm run build > /dev/null 2>&1
        log_success "MCP server built successfully"
        cd "$SCRIPT_DIR"
    else
        log_warn "MCP server directory not found, skipping build"
    fi

    return 0
}

# Main workflow
main() {
    log_header "$SOLUTION_NAME Setup"

    # Step 1: Check dependencies
    log_step "1" "Checking dependencies"
    check_dependencies
    log_info "Node.js version: $(node -v)"

    # Step 1.5: Check Gemini API key
    log_step "1.5" "Checking GEMINI_API_KEY"
    check_gemini_key || true

    # Step 2: Check CCAAS backend
    log_step "2" "Verifying CCAAS backend"
    check_ccaas_backend

    # Step 3: Build MCP server
    custom_init

    # Step 4: Setup tenant and API key
    log_step "4" "Setting up tenant and API key"

    eval "$(create_or_get_tenant "$CCAAS_URL" "$SOLUTION_SLUG" "$SOLUTION_NAME" "$SOLUTION_DESCRIPTION")"

    if [ -z "$TENANT_ID" ]; then
        log_error "Failed to create tenant"
        exit 1
    fi

    log_info "Tenant ID: $TENANT_ID"

    BOOTSTRAP_KEY=$(get_or_create_bootstrap_key "$CCAAS_URL")
    if [ -z "$BOOTSTRAP_KEY" ]; then
        log_error "Bootstrap key required. See instructions above."
        exit 1
    fi

    eval "$(create_solution_api_key "$CCAAS_URL" "$TENANT_ID" "$BOOTSTRAP_KEY" "$SOLUTION_NAME")"

    if [ -z "$API_KEY" ]; then
        log_error "Failed to create API key"
        exit 1
    fi

    CCAAS_API_KEY="$API_KEY"
    export CCAAS_API_KEY

    # Step 5: Inject skills and MCP servers
    log_step "5" "Injecting skills and MCP servers"
    inject_skills "$SCRIPT_DIR/skills" "$CCAAS_URL" "$TENANT_ID" "$CCAAS_API_KEY"
    inject_mcp_servers "$SCRIPT_DIR" "$CCAAS_URL" "$TENANT_ID" "$CCAAS_API_KEY"

    # Step 6: Display summary
    log_header "Setup Complete"
    echo ""
    log_success "Chibi Scene Generator is ready!"
    echo ""
    log_info "This is a chat-only solution (no frontend/backend to start)."
    log_info "Use the admin panel to create a session and start chatting."
    echo ""
    log_warn "Ensure CCAAS backend is running on port 3001:"
    echo "   cd packages/backend && npm run start:dev"
    echo ""
    log_info "Usage:"
    echo "   1. Open admin panel (http://localhost:5175)"
    echo "   2. Create a session with tenant 'chibi-scene-generator'"
    echo "   3. Upload a chibi reference image"
    echo "   4. Send article text and ask for illustration"
}

main "$@"
