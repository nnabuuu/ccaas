#!/usr/bin/env bash
set -eu
# pipefail requires bash 4+; macOS ships bash 3.2
if (set -o pipefail 2>/dev/null); then set -o pipefail; fi

# ============================================================
# live-lesson E2E Harness
#
# Starts 3 services (CCAAS core, live-lesson backend, frontend),
# runs Playwright tests, then tears everything down.
# ============================================================

REPO_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
SOLUTION_DIR="${REPO_ROOT}/solutions/business/live-lesson"
E2E_DIR="${SOLUTION_DIR}/e2e"

ADMIN_KEY="sk-default-testd84f5b7a1dbdbc4c424417be6c009f01"

CORE_PID=""
BACKEND_PID=""
FRONTEND_PID=""

# ── Cleanup ──

cleanup() {
  echo ""
  echo "[Cleanup] Stopping services..."
  [[ -n "$FRONTEND_PID" ]] && kill "$FRONTEND_PID" 2>/dev/null && wait "$FRONTEND_PID" 2>/dev/null || true
  [[ -n "$BACKEND_PID" ]] && kill "$BACKEND_PID" 2>/dev/null && wait "$BACKEND_PID" 2>/dev/null || true
  [[ -n "$CORE_PID" ]] && kill "$CORE_PID" 2>/dev/null && wait "$CORE_PID" 2>/dev/null || true

  # Kill any leftover processes on our ports
  for port in 3001 3007 5283; do
    local pid
    pid=$(lsof -ti :"$port" 2>/dev/null || true)
    [[ -n "$pid" ]] && kill "$pid" 2>/dev/null || true
  done
  echo "[Cleanup] Done."
}
trap cleanup EXIT

# ── Preflight ──

echo "[Preflight] Checking prerequisites..."
for cmd in node npm curl; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "ABORT: '$cmd' not found."
    exit 1
  fi
done

for port in 3001 3007 5283; do
  existing=$(lsof -ti :"$port" 2>/dev/null || true)
  if [[ -n "$existing" ]]; then
    echo "[Preflight] Port $port in use (PID: $existing) — killing..."
    kill "$existing" 2>/dev/null || true
    sleep 1
  fi
done
echo "[Preflight] OK."

# ── 1. Install dependencies if needed ──

if [[ ! -d "${REPO_ROOT}/node_modules" ]]; then
  echo "[Deps] Installing root deps..."
  cd "$REPO_ROOT" && npm install
fi

if [[ ! -d "${SOLUTION_DIR}/backend/node_modules" ]]; then
  echo "[Deps] Installing backend deps..."
  cd "${SOLUTION_DIR}/backend" && npm install --legacy-peer-deps --no-audit --no-fund
fi

if [[ ! -d "${SOLUTION_DIR}/frontend/node_modules" ]]; then
  echo "[Deps] Installing frontend deps..."
  cd "${SOLUTION_DIR}/frontend" && npm install --no-audit --no-fund
fi

# ── 2. Build backend ──

echo "[Build] Building live-lesson backend..."
cd "${SOLUTION_DIR}/backend"
npx nest build 2>&1 | tail -5

# ── 3. Seed DB ──

echo "[Seed] Re-seeding lesson manifests into DB..."
node -e "
const fs=require('fs'),path=require('path'),DB=require('better-sqlite3');
const manifestDir=path.resolve('..','data/lessons');
const dbPath=path.resolve('data/live-lesson.db');
if(!fs.existsSync(dbPath)){console.log('DB not found, will be created on startup');process.exit(0);}
const db=new DB(dbPath);
const dirs=fs.readdirSync(manifestDir).filter(d=>fs.existsSync(path.join(manifestDir,d,'manifest.json')));
for(const d of dirs){
  const raw=fs.readFileSync(path.join(manifestDir,d,'manifest.json'),'utf-8');
  const m=JSON.parse(raw);
  db.prepare('INSERT OR REPLACE INTO lessons(id,manifest_json) VALUES(?,?)').run(m.id,raw);
  console.log('  Seeded:',m.id);
}
db.close();
" 2>&1 | tail -5 || true

# ── 4. Start CCAAS core backend (:3001) ──

echo "[Core] Starting CCAAS core backend on :3001..."
cd "$REPO_ROOT"
ADMIN_KEY="$ADMIN_KEY" npm run dev:backend &>/dev/null &
CORE_PID=$!

retries=0
while ! curl -sf http://localhost:3001/api/v1/health >/dev/null 2>&1; do
  retries=$((retries + 1))
  if [[ $retries -gt 60 ]]; then
    echo "[Core] FAILED to start within 60s"
    exit 1
  fi
  sleep 1
done
echo "[Core] Ready on :3001 (PID: $CORE_PID)"

# ── 5. Start live-lesson backend (:3007) ──

echo "[Backend] Starting live-lesson backend on :3007..."
cd "${SOLUTION_DIR}/backend"
node dist/main.js &>/dev/null &
BACKEND_PID=$!

retries=0
while ! curl -sf http://localhost:3007/api/lessons >/dev/null 2>&1; do
  retries=$((retries + 1))
  if [[ $retries -gt 30 ]]; then
    echo "[Backend] FAILED to start within 30s"
    exit 1
  fi
  sleep 1
done
echo "[Backend] Ready on :3007 (PID: $BACKEND_PID)"

# ── 6. Start frontend dev server (:5283) ──

echo "[Frontend] Starting Vite dev server on :5283..."
cd "${SOLUTION_DIR}/frontend"
npx vite --port 5283 --host &>/dev/null &
FRONTEND_PID=$!

retries=0
while ! curl -sf http://localhost:5283 >/dev/null 2>&1; do
  retries=$((retries + 1))
  if [[ $retries -gt 30 ]]; then
    echo "[Frontend] FAILED to start within 30s"
    exit 1
  fi
  sleep 1
done
echo "[Frontend] Ready on :5283 (PID: $FRONTEND_PID)"

# ── 7. Install E2E deps + Playwright ──

echo "[E2E] Installing E2E dependencies..."
cd "$E2E_DIR"
npm install --no-audit --no-fund 2>&1 | tail -3
npx playwright install chromium 2>&1 | tail -3

# ── 8. Run tests ──

echo ""
echo "========================================="
echo "  Running Playwright E2E tests"
echo "========================================="
echo ""

cd "$E2E_DIR"
npx playwright test --reporter=list
TEST_EXIT=$?

echo ""
if [[ $TEST_EXIT -eq 0 ]]; then
  echo "All E2E tests passed."
else
  echo "Some E2E tests failed (exit code: $TEST_EXIT)."
fi

exit $TEST_EXIT
