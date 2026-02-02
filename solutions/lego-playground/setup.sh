#!/bin/bash
set -e

# ============================================================================
# LEGO Playground - Setup & Launch Script
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() { echo -e "${GREEN}[LEGO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }
info() { echo -e "${BLUE}[INFO]${NC} $1"; }

# ============================================================================
# Prerequisites Check
# ============================================================================

log "Checking prerequisites..."

if ! command -v node &> /dev/null; then
  error "Node.js is not installed. Please install Node.js 18+ first."
  exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  error "Node.js 18+ is required. Current version: $(node -v)"
  exit 1
fi

log "Node.js $(node -v) ✓"

# ============================================================================
# Parse Arguments
# ============================================================================

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

# ============================================================================
# Build MCP Server
# ============================================================================

log "Building MCP Server..."
cd "$SCRIPT_DIR/mcp-server"

if [ ! -d "node_modules" ] || [ "$SKIP_BUILD" = false ]; then
  npm install --silent 2>/dev/null
fi

if [ "$SKIP_BUILD" = false ]; then
  npm run build
fi

log "MCP Server built ✓"

if [ "$MCP_ONLY" = true ]; then
  log "Starting MCP REST Server only..."
  npm run start
  exit 0
fi

if [ "$INJECT_ONLY" = true ]; then
  log "Inject mode: skill injection would happen here"
  exit 0
fi

# ============================================================================
# Install Backend Dependencies
# ============================================================================

log "Setting up Backend..."
cd "$SCRIPT_DIR/backend"

if [ ! -d "node_modules" ]; then
  npm install --silent 2>/dev/null
fi

log "Backend ready ✓"

# ============================================================================
# Install Frontend Dependencies
# ============================================================================

log "Setting up Frontend..."
cd "$SCRIPT_DIR/frontend"

if [ ! -d "node_modules" ]; then
  npm install --silent 2>/dev/null
fi

log "Frontend ready ✓"

# ============================================================================
# Verify solution.json
# ============================================================================

cd "$SCRIPT_DIR"
if [ ! -f "solution.json" ]; then
  error "solution.json not found!"
  exit 1
fi

log "solution.json verified ✓"

# ============================================================================
# Register Tenant in CCAAS
# ============================================================================

CCAAS_URL="${CCAAS_URL:-http://localhost:3001}"

log "Checking CCAAS connectivity at $CCAAS_URL..."
if ! curl -s --max-time 3 "$CCAAS_URL" > /dev/null 2>&1; then
  warn "CCAAS not reachable at $CCAAS_URL — skipping tenant registration"
  warn "Make sure CCAAS is running before using the chat feature"
else
  # Check if tenant already exists
  TENANT_EXISTS=$(curl -s "$CCAAS_URL/api/v1/tenants" 2>/dev/null | grep -c '"slug":"lego-playground"' || true)
  if [ "$TENANT_EXISTS" = "0" ]; then
    log "Registering lego-playground tenant in CCAAS..."
    curl -s -X POST "$CCAAS_URL/api/v1/tenants" \
      -H "Content-Type: application/json" \
      -d '{"name":"LEGO Playground","slug":"lego-playground","description":"AI LEGO mosaic designer"}' \
      > /dev/null 2>&1
    log "Tenant registered ✓"
  else
    log "Tenant lego-playground already exists ✓"
  fi
fi

# ============================================================================
# Start Services
# ============================================================================

# Cleanup function
cleanup() {
  log "Stopping services..."
  kill $MCP_PID 2>/dev/null || true
  kill $BACKEND_PID 2>/dev/null || true
  kill $FRONTEND_PID 2>/dev/null || true
  exit 0
}

trap cleanup SIGINT SIGTERM

# Start MCP REST Server
log "Starting MCP REST Server on port 3006..."
cd "$SCRIPT_DIR/mcp-server"
npm run start &
MCP_PID=$!
sleep 2

# Start Backend
log "Starting Backend on port 3005..."
cd "$SCRIPT_DIR/backend"
npm run start:dev &
BACKEND_PID=$!
sleep 2

# Start Frontend
log "Starting Frontend on port 5282..."
cd "$SCRIPT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
log "============================================"
log "  LEGO Playground is running!"
log "============================================"
info "  Frontend:   http://localhost:5282"
info "  Backend:    http://localhost:3005"
info "  MCP Server: http://localhost:3006"
info "  CCAAS:      http://localhost:3001 (must be running separately)"
echo ""
info "Press Ctrl+C to stop all services"
echo ""

# Wait for any process to exit
wait
