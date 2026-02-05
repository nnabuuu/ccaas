#!/bin/bash

# Quiz Analyzer - Stop All Services

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

PIDS_DIR="$SCRIPT_DIR/.pids"

log "Stopping all Quiz Analyzer services..."

# Kill processes from PID files
for service in mcp backend frontend; do
    pid_file="$PIDS_DIR/${service}.pid"
    if [ -f "$pid_file" ]; then
        pid=$(cat "$pid_file")
        if ps -p $pid > /dev/null 2>&1; then
            log "Stopping $service (PID: $pid)..."
            kill $pid 2>/dev/null || true
            sleep 1
            # Force kill if still running
            if ps -p $pid > /dev/null 2>&1; then
                kill -9 $pid 2>/dev/null || true
            fi
        fi
        rm -f "$pid_file"
    fi
done

# Kill by ports as fallback
for port in 3006 3005 5282; do
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        log "Killing process on port $port..."
        lsof -ti:$port | xargs kill -9 2>/dev/null || true
    fi
done

# Clean up PID directory
rm -rf "$PIDS_DIR"

log "All services stopped"
