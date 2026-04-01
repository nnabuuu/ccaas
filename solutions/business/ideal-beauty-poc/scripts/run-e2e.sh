#!/bin/bash
set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

BACKEND_PORT="${BACKEND_PORT:-3012}"
FRONTEND_PORT="${FRONTEND_PORT:-5291}"
DB_PATH="$BACKEND_DIR/data/e2e-test.db"

HEADED_FLAG=""
if [ "$1" = "--headed" ]; then
  HEADED_FLAG="--headed"
fi

# Cleanup trap
BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  echo ""
  echo "[e2e] Cleaning up..."
  # Kill frontend process tree (subshell + its children like npx/vite)
  if [ -n "$FRONTEND_PID" ]; then
    pkill -P "$FRONTEND_PID" 2>/dev/null || true
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi
  [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null || true
  wait "$BACKEND_PID" 2>/dev/null || true
  wait "$FRONTEND_PID" 2>/dev/null || true
  rm -f "$DB_PATH" "$DB_PATH-shm" "$DB_PATH-wal"
  echo "[e2e] Done."
}
trap cleanup EXIT

# Check ports
check_port() {
  if lsof -i :"$1" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "[e2e] ERROR: Port $1 is already in use"
    exit 1
  fi
}
check_port "$BACKEND_PORT"
check_port "$FRONTEND_PORT"

# Build backend if needed
if [ ! -d "$BACKEND_DIR/dist" ]; then
  echo "[e2e] Building backend..."
  (cd "$BACKEND_DIR" && npm run build)
fi

# Start backend
echo "[e2e] Starting backend on port $BACKEND_PORT..."
DB_PATH="$DB_PATH" PORT="$BACKEND_PORT" \
  CORS_ORIGIN="http://localhost:$FRONTEND_PORT" \
  node "$BACKEND_DIR/dist/main.js" &
BACKEND_PID=$!

# Start frontend (must run from frontend dir so Vite finds index.html)
echo "[e2e] Starting frontend on port $FRONTEND_PORT..."
(cd "$FRONTEND_DIR" && \
  VITE_PORT="$FRONTEND_PORT" \
  VITE_API_URL="http://localhost:$BACKEND_PORT" \
  npx vite --port "$FRONTEND_PORT") &
FRONTEND_PID=$!

# Wait for both to be ready
wait_for_http() {
  local url="$1"
  local name="$2"
  local max=30
  local i=0
  while [ $i -lt $max ]; do
    if curl -so /dev/null -w '' "$url" 2>/dev/null; then
      echo "[e2e] $name is ready"
      return 0
    fi
    sleep 1
    i=$((i + 1))
  done
  echo "[e2e] ERROR: $name did not start within ${max}s"
  exit 1
}

wait_for_http "http://localhost:$BACKEND_PORT/api/sessions/code/PING" "Backend"
wait_for_http "http://localhost:$FRONTEND_PORT" "Frontend"

# Run Playwright
echo "[e2e] Running Playwright tests..."
cd "$FRONTEND_DIR"
BACKEND_URL="http://localhost:$BACKEND_PORT" \
  FRONTEND_URL="http://localhost:$FRONTEND_PORT" \
  npx playwright test $HEADED_FLAG

echo "[e2e] All tests passed!"
