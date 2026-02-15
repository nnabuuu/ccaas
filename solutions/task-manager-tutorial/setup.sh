#!/bin/bash
# Task Manager Tutorial - Setup Script
# Uses: tools/solution-lib.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOOLS_DIR="$SCRIPT_DIR/../../tools"

# Source shared library
if [ ! -f "$TOOLS_DIR/solution-lib.sh" ]; then
    echo "Error: solution-lib.sh not found at $TOOLS_DIR"
    echo "   Please run from solutions/ directory"
    exit 1
fi

source "$TOOLS_DIR/solution-lib.sh"

# Load solution configuration
load_solution_config "$SCRIPT_DIR"

# Default bootstrap key for internal solutions
CCAAS_BOOTSTRAP_KEY="${CCAAS_BOOTSTRAP_KEY:-sk-default-testd84f5b7a1dbdbc4c424417be6c009f01}"

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

    # Step 4: Setup tenant and modern API key
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

    run_hook "postInstall"

    # Step 6: Clear ports
    log_step "6" "Preparing ports"
    kill_port "$BACKEND_PORT"
    kill_port "$FRONTEND_PORT"

    # Step 7: Start services
    log_step "7" "Starting services"
    BACKEND_PID=$(start_service "backend" "$SCRIPT_DIR/backend" "$BACKEND_PORT" "npm run start:dev")
    wait_for_port "$BACKEND_PORT" 30

    FRONTEND_PID=$(start_service "frontend" "$SCRIPT_DIR/frontend" "$FRONTEND_PORT" "npm run dev")
    wait_for_port "$FRONTEND_PORT" 30

    # Step 8: Display summary
    display_summary

    echo ""
    log_warn "Ensure CCAAS backend is running on port 3001:"
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
