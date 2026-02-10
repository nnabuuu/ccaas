#!/bin/bash
# Lesson Plan Designer - Setup Script
# Uses: tools/solution-lib.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOOLS_DIR="$SCRIPT_DIR/../../tools"

# Source shared library
if [ ! -f "$TOOLS_DIR/solution-lib.sh" ]; then
    echo "❌ Error: solution-lib.sh not found at $TOOLS_DIR"
    echo "   Please run from solutions/ directory"
    exit 1
fi

source "$TOOLS_DIR/solution-lib.sh"

# Load solution configuration
load_solution_config "$SCRIPT_DIR"

# Custom initialization
custom_init() {
    # Build MCP server
    log_step "3.5" "Building MCP server"
    local mcp_dir="$SCRIPT_DIR/mcp-server"

    if [ -d "$mcp_dir" ]; then
        cd "$mcp_dir"
        npm install > /dev/null 2>&1
        npm run build > /dev/null 2>&1
        log_success "MCP server built"
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

    # Step 2: Check CCAAS backend
    log_step "2" "Verifying CCAAS backend"
    check_ccaas_backend

    # Step 3: Install npm dependencies
    log_step "3" "Installing dependencies"
    run_hook "preInstall"
    install_npm_dependencies "$SCRIPT_DIR/frontend"
    install_npm_dependencies "$SCRIPT_DIR/backend"

    # Step 3.5: Custom initialization (MCP build)
    custom_init

    # Step 4: Create or get tenant
    log_step "4" "Setting up tenant"
    TENANT_ID=$(create_or_get_tenant "$CCAAS_URL" "$SOLUTION_SLUG" "$SOLUTION_NAME" "$SOLUTION_DESCRIPTION")
    log_info "Tenant ID: $TENANT_ID"

    # Step 5: Create or get API key
    log_step "5" "Setting up API key"
    if [ -z "$CCAAS_API_KEY" ]; then
        CCAAS_API_KEY=$(create_bootstrap_key "$CCAAS_DB" "$SOLUTION_SLUG" --quiet)
        export CCAAS_API_KEY
        log_success "Bootstrap API Key created: ${CCAAS_API_KEY:0:16}..."
        echo ""
        log_warn "🔐 Please save this API Key (shown only once):"
        echo "   $CCAAS_API_KEY"
        echo ""
    else
        log_success "Using existing API Key: ${CCAAS_API_KEY:0:16}..."
    fi

    # Step 6: Inject skills and MCP servers
    log_step "6" "Injecting skills and MCP servers"
    inject_skills "$SCRIPT_DIR/skills" "$CCAAS_URL" "$TENANT_ID" "$CCAAS_API_KEY"
    inject_mcp_servers "$SCRIPT_DIR" "$CCAAS_URL" "$TENANT_ID" "$CCAAS_API_KEY"

    run_hook "postInstall"

    # Step 7: Clear ports
    log_step "7" "Preparing ports"
    kill_port "$BACKEND_PORT"
    kill_port "$FRONTEND_PORT"

    # Step 8: Start services
    log_step "8" "Starting services"
    BACKEND_PID=$(start_service "backend" "$SCRIPT_DIR/backend" "$BACKEND_PORT" "npm run dev")
    wait_for_port "$BACKEND_PORT" 30

    FRONTEND_PID=$(start_service "frontend" "$SCRIPT_DIR/frontend" "$FRONTEND_PORT" "npm run dev")
    wait_for_port "$FRONTEND_PORT" 30

    # Step 9: Display summary
    display_summary

    echo ""
    log_warn "⚠️  Ensure CCAAS backend is running on port 3001:"
    echo "   cd packages/backend && npm run start:dev"
    echo ""
    echo "Press Ctrl+C to stop all services"

    # Wait for Ctrl+C
    trap cleanup SIGINT SIGTERM
    wait
}

# Cleanup function
cleanup() {
    echo ""
    log_info "Stopping services..."
    stop_service "$BACKEND_PID"
    stop_service "$FRONTEND_PID"
    kill_port "$BACKEND_PORT"
    kill_port "$FRONTEND_PORT"
    log_success "Services stopped"
    exit 0
}

# Run main
main "$@"
