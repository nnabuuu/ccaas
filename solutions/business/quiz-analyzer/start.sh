#!/bin/bash

# Quiz Analyzer - Start All Services
# This script starts MCP Server, Backend, and Frontend in the correct order

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# PID files
PIDS_DIR="$SCRIPT_DIR/.pids"
mkdir -p "$PIDS_DIR"

MCP_PID_FILE="$PIDS_DIR/mcp.pid"
BACKEND_PID_FILE="$PIDS_DIR/backend.pid"
FRONTEND_PID_FILE="$PIDS_DIR/frontend.pid"

# Log function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Check if port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Kill process on port
kill_port() {
    local port=$1
    if check_port $port; then
        warn "Port $port is in use, killing process..."
        lsof -ti:$port | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
}

# Cleanup function
cleanup() {
    log "Cleaning up processes..."

    # Kill processes from PID files
    for pid_file in "$MCP_PID_FILE" "$BACKEND_PID_FILE" "$FRONTEND_PID_FILE"; do
        if [ -f "$pid_file" ]; then
            pid=$(cat "$pid_file")
            if ps -p $pid > /dev/null 2>&1; then
                kill $pid 2>/dev/null || true
            fi
            rm -f "$pid_file"
        fi
    done

    # Kill by ports as fallback
    kill_port 3006  # MCP
    kill_port 3005  # Backend
    kill_port 5282  # Frontend

    log "Cleanup complete"
}

# Check database exists
check_database() {
    if [ ! -f "data/quiz-analyzer.db" ]; then
        error "Database not found at data/quiz-analyzer.db"
        info "Please run './setup.sh' first to initialize the database"
        exit 1
    fi
}

# Start MCP Server
start_mcp() {
    log "Starting MCP Server on port 3006..."

    cd mcp-server

    # Check if built
    if [ ! -d "dist" ]; then
        info "Building MCP Server..."
        npm run build
    fi

    # Start in background
    npm start > ../logs/mcp.log 2>&1 &
    echo $! > "$MCP_PID_FILE"

    cd ..

    # Wait for MCP to be ready
    info "Waiting for MCP Server to start..."
    for i in {1..30}; do
        if curl -s http://localhost:3006/health > /dev/null 2>&1; then
            log "✓ MCP Server is ready"
            return 0
        fi
        sleep 1
    done

    error "MCP Server failed to start"
    cat logs/mcp.log
    exit 1
}

# Start Backend
start_backend() {
    log "Starting Backend on port 3005..."

    cd backend

    # Check if built
    if [ ! -d "dist" ]; then
        info "Building Backend..."
        npm run build
    fi

    # Start in background
    npm run start:prod > ../logs/backend.log 2>&1 &
    echo $! > "$BACKEND_PID_FILE"

    cd ..

    # Wait for Backend to be ready
    info "Waiting for Backend to start..."
    for i in {1..30}; do
        if curl -s http://localhost:3005/health > /dev/null 2>&1; then
            log "✓ Backend is ready"
            return 0
        fi
        sleep 1
    done

    error "Backend failed to start"
    cat logs/backend.log
    exit 1
}

# Start Frontend
start_frontend() {
    log "Starting Frontend on port 5282..."

    cd frontend

    # Check if built
    if [ ! -d "dist" ]; then
        info "Building Frontend..."
        npm run build
    fi

    # Start preview server in background
    npm run preview > ../logs/frontend.log 2>&1 &
    echo $! > "$FRONTEND_PID_FILE"

    cd ..

    # Wait for Frontend to be ready
    info "Waiting for Frontend to start..."
    for i in {1..30}; do
        if curl -s http://localhost:5282 > /dev/null 2>&1; then
            log "✓ Frontend is ready"
            return 0
        fi
        sleep 1
    done

    error "Frontend failed to start"
    cat logs/frontend.log
    exit 1
}

# Display status
show_status() {
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}    Quiz Analyzer - All Services Running${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "  ${BLUE}MCP Server:${NC}    http://localhost:3006/health"
    echo -e "  ${BLUE}Backend API:${NC}   http://localhost:3005/health"
    echo -e "  ${BLUE}Frontend:${NC}      http://localhost:5282"
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "  ${YELLOW}Logs:${NC}"
    echo -e "    • MCP:      tail -f logs/mcp.log"
    echo -e "    • Backend:  tail -f logs/backend.log"
    echo -e "    • Frontend: tail -f logs/frontend.log"
    echo ""
    echo -e "  ${YELLOW}Stop:${NC}       ./stop.sh"
    echo -e "  ${YELLOW}Restart:${NC}    ./stop.sh && ./start.sh"
    echo ""
}

# Main execution
main() {
    log "Quiz Analyzer - Starting all services..."

    # Create logs directory
    mkdir -p logs

    # Clean up any existing processes
    cleanup

    # Check prerequisites
    check_database

    # Start services in order
    start_mcp
    start_backend
    start_frontend

    # Show status
    show_status

    log "All services started successfully!"
    info "Press Ctrl+C to stop all services (will be handled gracefully)"

    # Wait for interrupt
    trap cleanup EXIT INT TERM

    # Keep script running
    while true; do
        sleep 1
    done
}

# Run main function
main
