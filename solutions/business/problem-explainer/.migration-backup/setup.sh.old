#!/bin/bash

# Problem Explainer Setup Script
# This script initializes and starts all services

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=========================================="
echo "  Problem Explainer - Setup Script"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if CCAAS backend is running
check_ccaas() {
    echo -e "${YELLOW}Checking CCAAS backend...${NC}"
    if curl -s http://localhost:3001/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ CCAAS backend is running on port 3001${NC}"
    else
        echo -e "${RED}✗ CCAAS backend is not running on port 3001${NC}"
        echo "Please start CCAAS backend first: cd ../../packages/backend && npm run start:dev"
        exit 1
    fi
}

# Install dependencies
install_deps() {
    echo -e "\n${YELLOW}Installing dependencies...${NC}"

    if [ -d "$SCRIPT_DIR/backend/node_modules" ]; then
        echo "Backend dependencies already installed"
    else
        echo "Installing backend dependencies..."
        (cd "$SCRIPT_DIR/backend" && npm install)
    fi

    if [ -d "$SCRIPT_DIR/frontend/node_modules" ]; then
        echo "Frontend dependencies already installed"
    else
        echo "Installing frontend dependencies..."
        (cd "$SCRIPT_DIR/frontend" && npm install)
    fi

    if [ -d "$SCRIPT_DIR/mcp-server/node_modules" ]; then
        echo "MCP Server dependencies already installed"
    else
        echo "Installing MCP Server dependencies..."
        (cd "$SCRIPT_DIR/mcp-server" && npm install)
    fi

    echo -e "${GREEN}✓ Dependencies installed${NC}"
}

# Build MCP Server
build_mcp() {
    echo -e "\n${YELLOW}Building MCP Server...${NC}"
    (cd "$SCRIPT_DIR/mcp-server" && npm run build)
    echo -e "${GREEN}✓ MCP Server built${NC}"
}

# Initialize database
init_db() {
    echo -e "\n${YELLOW}Initializing database...${NC}"
    # Database will be auto-initialized by TypeORM on first run
    echo -e "${GREEN}✓ Database will be initialized on first run${NC}"
}

# Inject skill into CCAAS
inject_skill() {
    echo -e "\n${YELLOW}Injecting skill into CCAAS...${NC}"
    if ./inject-skills.sh; then
        echo -e "${GREEN}✓ Skill injected successfully${NC}"
    else
        echo -e "${RED}✗ Failed to inject skill (CCAAS may not be running)${NC}"
        echo "You can manually run: ./inject-skills.sh"
    fi
}

# Start services
start_services() {
    echo -e "\n${YELLOW}Starting services...${NC}"

    # Store PIDs for cleanup
    declare -a PIDS

    # Start MCP REST Server
    echo "Starting MCP REST Server on port 3004..."
    (cd "$SCRIPT_DIR/mcp-server" && npm run start) &
    MCP_PID=$!
    PIDS+=($MCP_PID)

    # Wait for MCP Server to be ready
    sleep 2
    if curl -s http://localhost:3004/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ MCP REST Server is running${NC}"
    else
        echo -e "${YELLOW}⚠ MCP REST Server may still be starting...${NC}"
    fi

    # Start backend (using subshell to preserve working directory)
    echo "Starting backend on port 3003..."
    (cd "$SCRIPT_DIR/backend" && npm run start:dev) &
    BACKEND_PID=$!
    PIDS+=($BACKEND_PID)

    # Wait for backend to be ready
    sleep 3

    # Start frontend (using subshell to preserve working directory)
    echo "Starting frontend on port 5281..."
    (cd "$SCRIPT_DIR/frontend" && npm run dev) &
    FRONTEND_PID=$!
    PIDS+=($FRONTEND_PID)

    echo -e "\n${GREEN}=========================================="
    echo "  Services Started!"
    echo "==========================================${NC}"
    echo ""
    echo "  MCP Server: http://localhost:3004"
    echo "  Backend:    http://localhost:3003"
    echo "  Frontend:   http://localhost:5281"
    echo ""
    echo "Press Ctrl+C to stop all services"

    # Wait for interrupt
    trap "kill ${PIDS[*]} 2>/dev/null; exit 0" INT TERM
    wait
}

# Main
main() {
    check_ccaas
    install_deps
    build_mcp
    init_db
    inject_skill
    start_services
}

# Run with argument handling
case "${1:-}" in
    --deps-only)
        install_deps
        build_mcp
        ;;
    --backend-only)
        check_ccaas
        cd "$SCRIPT_DIR/backend" && npm run start:dev
        ;;
    --frontend-only)
        cd "$SCRIPT_DIR/frontend" && npm run dev
        ;;
    --mcp-only)
        build_mcp
        cd "$SCRIPT_DIR/mcp-server" && npm run start
        ;;
    --inject-only)
        check_ccaas
        inject_skill
        ;;
    *)
        main
        ;;
esac
