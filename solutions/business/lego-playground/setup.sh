#!/bin/bash
# LEGO Playground - Setup Script
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

# Default bootstrap key for internal solutions
# Can be overridden by setting CCAAS_BOOTSTRAP_KEY environment variable
CCAAS_BOOTSTRAP_KEY="${CCAAS_BOOTSTRAP_KEY:-sk-default-testd84f5b7a1dbdbc4c424417be6c009f01}"

# Parse CLI arguments
MCP_ONLY=false
INJECT_ONLY=false
SKIP_BUILD=false

for arg in "$@"; do
    case $arg in
        --mcp-only) MCP_ONLY=true ;;
        --inject-only) INJECT_ONLY=true ;;
        --skip-build) SKIP_BUILD=true ;;
        *) ;;
    esac
done

# Custom initialization
custom_init() {
    # Build MCP server
    log_step "3.5" "Building MCP server"
    local mcp_dir="$SCRIPT_DIR/mcp-server"

    if [ -d "$mcp_dir" ]; then
        cd "$mcp_dir"
        if [ ! -d "node_modules" ] || [ "$SKIP_BUILD" = false ]; then
            npm install > /dev/null 2>&1
        fi
        if [ "$SKIP_BUILD" = false ]; then
            npm run build > /dev/null 2>&1
        fi
        log_success "MCP server built"
    else
        log_warn "MCP server directory not found, skipping build"
    fi

    return 0
}

# Main workflow
main() {
    log_header "$SOLUTION_NAME Setup"

    # Handle special modes
    if [ "$MCP_ONLY" = true ]; then
        log_info "Starting MCP REST Server only..."
        cd "$SCRIPT_DIR/mcp-server"
        npm run start
        exit 0
    fi

    if [ "$INJECT_ONLY" = true ]; then
        log_info "Inject mode: Running skill and MCP server injection only"

        # Need to setup tenant and API key first
        log_step "1" "Setting up tenant and API key"

        eval "$(create_or_get_tenant "$CCAAS_URL" "$SOLUTION_SLUG" "$SOLUTION_NAME" "$SOLUTION_DESCRIPTION")"
        if [ -z "$TENANT_ID" ]; then
            log_error "Failed to create tenant"
            exit 1
        fi

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

        log_step "2" "Injecting skills and MCP servers"
        inject_skills "$SCRIPT_DIR/skills" "$CCAAS_URL" "$TENANT_ID" "$CCAAS_API_KEY"
        inject_mcp_servers "$SCRIPT_DIR" "$CCAAS_URL" "$TENANT_ID" "$CCAAS_API_KEY"

        log_success "Injection complete"
        exit 0
    fi

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

    # Step 4: Setup tenant and modern API key
    log_step "4" "Setting up tenant and API key"

    # Step 4a: Create tenant (no API key returned)
    eval "$(create_or_get_tenant "$CCAAS_URL" "$SOLUTION_SLUG" "$SOLUTION_NAME" "$SOLUTION_DESCRIPTION")"

    if [ -z "$TENANT_ID" ]; then
        log_error "Failed to create tenant"
        exit 1
    fi

    log_info "Tenant ID: $TENANT_ID"

    # Step 4b: Get bootstrap admin key
    BOOTSTRAP_KEY=$(get_or_create_bootstrap_key "$CCAAS_URL")
    if [ -z "$BOOTSTRAP_KEY" ]; then
        log_error "Bootstrap key required. See instructions above."
        exit 1
    fi

    # Step 4c: Create modern API key for this solution
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
    kill_port "$MCP_PORT"
    kill_port "$BACKEND_PORT"
    kill_port "$FRONTEND_PORT"

    # Step 7: Start services
    log_step "7" "Starting services"

    # Start MCP REST Server first
    MCP_PID=$(start_service "mcp-server" "$SCRIPT_DIR/mcp-server" "$MCP_PORT" "npm run start")
    wait_for_port "$MCP_PORT" 30

    BACKEND_PID=$(start_service "backend" "$SCRIPT_DIR/backend" "$BACKEND_PORT" "npm run start:dev")
    wait_for_port "$BACKEND_PORT" 30

    FRONTEND_PID=$(start_service "frontend" "$SCRIPT_DIR/frontend" "$FRONTEND_PORT" "npm run dev")
    wait_for_port "$FRONTEND_PORT" 30

    # Step 8: Display summary
    display_summary

    echo ""
    log_info "MCP Server: http://localhost:$MCP_PORT"
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
    stop_service "$MCP_PID"
    stop_service "$BACKEND_PID"
    stop_service "$FRONTEND_PID"
    kill_port "$MCP_PORT"
    kill_port "$BACKEND_PORT"
    kill_port "$FRONTEND_PORT"
    log_success "Services stopped"
    exit 0
}

# Run main
main "$@"
