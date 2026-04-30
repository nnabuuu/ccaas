#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# live-lesson-teacher-v2-fidelity Harness — Code Mode Iteration Loop
#
# Rewrites TeacherShell to high-fidelity match teacher.html,
# removes all mock fallback data, 100% real backend data.
# Artifact: solutions/business/live-lesson/frontend/src/components/teacher/
#           solutions/business/live-lesson/frontend/src/styles/teacher.css
# Services: CCAAS core (:3001) + live-lesson backend (:3007) + frontend (:5283)
# ============================================================

# --- Nested Session Guard ---
claude_safe() {
  env -u CLAUDECODE \
      -u CLAUDE_CODE_ENTRYPOINT \
      -u CLAUDE_CODE_DISABLE_TERMINAL_TITLE \
      -u CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS \
      claude "$@"
}

# --- Configuration ---
TASK_NAME="live-lesson-teacher-v2-fidelity"
MAX_ITERATIONS=12
SCORE_THRESHOLD=98
MIN_IMPROVEMENT=3
ROLLBACK_THRESHOLD=5
MAX_COST_USD="${MAX_COST:-200}"

# Agent tool permissions
GENERATOR_TOOLS="Read,Write,Edit,Grep,Glob,Bash"
EVALUATOR_TOOLS="Read,Write,Grep,Glob,Bash,mcp__playwright__browser_navigate,mcp__playwright__browser_snapshot,mcp__playwright__browser_evaluate,mcp__playwright__browser_click,mcp__playwright__browser_type,mcp__playwright__browser_resize,mcp__playwright__browser_close,mcp__playwright__browser_network_requests,mcp__playwright__browser_wait_for,mcp__playwright__browser_press_key,mcp__playwright__browser_tabs"

# CCAAS core backend
ADMIN_KEY="sk-default-testd84f5b7a1dbdbc4c424417be6c009f01"
CORE_BACKEND_PID=""

# Cost estimates
COST_PER_ITERATION=12.00

# --- Directories ---
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
HARNESS_DIR="$(cd "$(dirname "$0")" && pwd)"
EVAL_DIR="${HARNESS_DIR}/eval-reports"
CHANGELOG_DIR="${HARNESS_DIR}/changelogs"
PROMPTS_DIR="${HARNESS_DIR}/prompts"
PROGRESS_FILE="${HARNESS_DIR}/progress.md"

# Solution directory
SOLUTION_DIR="${REPO_ROOT}/solutions/business/live-lesson"

# Frozen directories (MUST NOT be modified)
# Backend, student components, hooks, pages, mcp-server — ALL frozen
FROZEN_DIRS=(
  "solutions/business/live-lesson/mcp-server/src/"
  "solutions/business/live-lesson/backend/src/"
  "solutions/business/live-lesson/frontend/src/components/student/"
  "solutions/business/live-lesson/frontend/src/components/orchestrator/"
  "solutions/business/live-lesson/frontend/src/hooks/"
  "solutions/business/live-lesson/frontend/src/pages/"
  "solutions/business/live-lesson/frontend/src/types/"
  "solutions/business/live-lesson/frontend/src/styles/student.css"
  "solutions/business/live-lesson/frontend/src/styles/orchestrator.css"
  "solutions/business/live-lesson/frontend/src/App.tsx"
  "solutions/business/live-lesson/data/"
  "packages/"
  "solutions/business/edu-platform/"
  "solutions/business/recipe-book/"
)

# --- State File ---
STATE_FILE="${HARNESS_DIR}/state.json"

# --- Flags ---
DRY_RUN=false
RESUME=false
SINGLE_STEP=""
SINGLE_ITERATION=""
SHOW_STATUS=false
REGISTER_DAGU=false
UNREGISTER_DAGU=false

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --resume) RESUME=true ;;
    --max-cost=*) MAX_COST_USD="${arg#*=}" ;;
    --step=*) SINGLE_STEP="${arg#*=}" ;;
    --iteration=*) SINGLE_ITERATION="${arg#*=}" ;;
    --status) SHOW_STATUS=true ;;
    --register-dagu) REGISTER_DAGU=true ;;
    --unregister-dagu) UNREGISTER_DAGU=true ;;
  esac
done

# --- Preflight ---

preflight() {
  local fail=0
  echo "  [Preflight] Checking prerequisites..."

  for cmd in claude jq npm node; do
    if ! which "$cmd" > /dev/null 2>&1; then
      echo "  ABORT: '$cmd' not found. Install it first."
      fail=1
    fi
  done
  [[ $fail -ne 0 ]] && exit 1

  # Check node_modules
  if [[ ! -d "${REPO_ROOT}/packages/backend/node_modules" ]]; then
    echo "  [Preflight] Core backend deps missing, running npm install..."
    cd "$REPO_ROOT" && npm install
  fi
  if [[ ! -d "${SOLUTION_DIR}/backend/node_modules" ]]; then
    echo "  [Preflight] Solution backend deps missing, running npm install..."
    cd "${SOLUTION_DIR}/backend" && npm install --legacy-peer-deps --no-audit --no-fund
  fi
  if [[ ! -d "${SOLUTION_DIR}/frontend/node_modules" ]]; then
    echo "  [Preflight] Frontend deps missing, running npm install..."
    cd "${SOLUTION_DIR}/frontend" && npm install --no-audit --no-fund
  fi

  cd "$REPO_ROOT"
  echo "  [Preflight] All checks passed."
}

# --- state.json Helpers ---

init_state() {
  if [[ ! -f "$STATE_FILE" ]]; then
    cat > "$STATE_FILE" << STATEEOF
{
  "task": "${TASK_NAME}",
  "status": "running",
  "startedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "currentIteration": 0,
  "iterations": {}
}
STATEEOF
  fi
}

state_read() {
  local key="$1"
  jq -r "$key" "$STATE_FILE" 2>/dev/null || echo ""
}

state_update() {
  local key="$1" value="$2"
  local tmp="${STATE_FILE}.tmp"
  jq "$key = $value" "$STATE_FILE" > "$tmp" && mv "$tmp" "$STATE_FILE"
}

state_init_iteration() {
  local iter="$1"
  local tmp="${STATE_FILE}.tmp"
  jq ".currentIteration = $iter | .iterations[\"$iter\"] = {\"status\":\"running\",\"startedAt\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"steps\":{}}" "$STATE_FILE" > "$tmp" && mv "$tmp" "$STATE_FILE"
}

state_step_start() {
  local iter="$1" step="$2"
  local tmp="${STATE_FILE}.tmp"
  jq ".iterations[\"$iter\"].steps[\"$step\"] = {\"status\":\"running\",\"startedAt\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" "$STATE_FILE" > "$tmp" && mv "$tmp" "$STATE_FILE"
}

state_step_complete() {
  local iter="$1" step="$2"
  local tmp="${STATE_FILE}.tmp"
  jq ".iterations[\"$iter\"].steps[\"$step\"].status = \"completed\" | .iterations[\"$iter\"].steps[\"$step\"].completedAt = \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"" "$STATE_FILE" > "$tmp" && mv "$tmp" "$STATE_FILE"
}

state_step_fail() {
  local iter="$1" step="$2" reason="${3:-unknown}"
  local tmp="${STATE_FILE}.tmp"
  jq ".iterations[\"$iter\"].steps[\"$step\"].status = \"failed\" | .iterations[\"$iter\"].steps[\"$step\"].reason = \"$reason\"" "$STATE_FILE" > "$tmp" && mv "$tmp" "$STATE_FILE"
}

state_get_step_status() {
  local iter="$1" step="$2"
  jq -r ".iterations[\"$iter\"].steps[\"$step\"].status // \"pending\"" "$STATE_FILE" 2>/dev/null || echo "pending"
}

state_finish() {
  local final_status="${1:-completed}"
  local tmp="${STATE_FILE}.tmp"
  jq ".status = \"$final_status\" | .finishedAt = \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"" "$STATE_FILE" > "$tmp" && mv "$tmp" "$STATE_FILE"
}

state_print_summary() {
  if [[ ! -f "$STATE_FILE" ]]; then
    echo "No state.json found. Run the harness first."
    return
  fi
  echo ""
  echo "┌─────────────────────────────────────────┐"
  echo "│  State Summary: ${TASK_NAME}"
  echo "├─────────────────────────────────────────┤"
  echo "│  Status: $(state_read '.status')"
  echo "│  Current Iteration: $(state_read '.currentIteration')"
  echo "│  Started: $(state_read '.startedAt')"
  local finished
  finished=$(state_read '.finishedAt')
  if [[ -n "$finished" && "$finished" != "null" ]]; then
    echo "│  Finished: $finished"
  fi
  echo "├─────────────────────────────────────────┤"
  local iters
  iters=$(jq -r '.iterations | keys[]' "$STATE_FILE" 2>/dev/null || true)
  for it in $iters; do
    local it_status
    it_status=$(jq -r ".iterations[\"$it\"].status" "$STATE_FILE")
    echo "│  Iteration $it: $it_status"
    local steps
    steps=$(jq -r ".iterations[\"$it\"].steps | keys[]" "$STATE_FILE" 2>/dev/null || true)
    for st in $steps; do
      local st_status
      st_status=$(jq -r ".iterations[\"$it\"].steps[\"$st\"].status" "$STATE_FILE")
      echo "│    ├─ $st: $st_status"
    done
  done
  echo "└─────────────────────────────────────────┘"
}

# --- run_step Wrapper ---

run_step() {
  local iter="$1" step_name="$2"
  shift 2
  local step_fn="$@"

  local current_status
  current_status=$(state_get_step_status "$iter" "$step_name")
  if [[ "$current_status" == "completed" ]]; then
    echo "  [run_step] Skipping $step_name (already completed)"
    return 0
  fi

  state_step_start "$iter" "$step_name"
  if eval "$step_fn"; then
    state_step_complete "$iter" "$step_name"
    return 0
  else
    state_step_fail "$iter" "$step_name" "step function returned non-zero"
    return 1
  fi
}

# --- Functions ---

get_last_version() {
  local last=$(ls "${EVAL_DIR}"/v*-eval.md 2>/dev/null | sort -V | tail -1)
  if [[ -n "$last" ]]; then
    basename "$last" | sed 's/[^0-9]//g'
  else
    echo "0"
  fi
}

extract_score() {
  local eval_file="$1"
  grep -E '(总分|Total)[：:][[:space:]]*[0-9]+' "$eval_file" | head -1 | sed 's/.*[：:][[:space:]]*//' | sed 's|/.*||' | tr -d '[:space:]'
}

estimate_cost() {
  local iterations=$1
  echo "scale=2; $iterations * $COST_PER_ITERATION" | bc
}

append_progress() {
  local version=$1 score=$2 changes=$3 top_issue=$4
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  echo "| v${version} | ${timestamp} | ${score}/100 | ${changes} | ${top_issue} |" >> "$PROGRESS_FILE"
}

check_frozen_dirs() {
  local violations=0
  cd "$REPO_ROOT"
  for dir in "${FROZEN_DIRS[@]}"; do
    local current_changes
    current_changes=$(git diff --name-only -- "$dir" 2>/dev/null | sort || true)
    local new_changes
    new_changes=$(comm -13 <(echo "$FROZEN_BASELINE" | grep "^${dir}" | sort) <(echo "$current_changes") 2>/dev/null || true)
    if [[ -n "$new_changes" ]]; then
      echo "FROZEN DIRECTORY VIOLATION: $dir has new changes. Reverting."
      echo "$new_changes" | while IFS= read -r f; do
        [[ -n "$f" ]] && git checkout -- "$f" 2>/dev/null || true
      done
      violations=$((violations + 1))
    fi
  done
  FROZEN_VIOLATION_COUNT=$violations
}

run_validation() {
  echo "  [Validation] Running frontend typecheck + build..."
  local errors=0

  # --- Frontend build only (backend is frozen) ---
  cd "${SOLUTION_DIR}/frontend"

  # Install deps if needed
  if [[ ! -d "node_modules" ]] || [[ "package.json" -nt "node_modules/.package-lock.json" ]]; then
    echo "  [Validation] Installing frontend dependencies..."
    npm install --no-audit --no-fund 2>&1 | tail -3
  fi

  # TypeScript check
  if ! npx tsc --noEmit 2>&1 | tail -10; then
    echo "  [Validation] tsc FAILED"
    errors=$((errors + 1))
  fi

  # Vite build
  if ! npx vite build 2>&1 | tail -5; then
    echo "  [Validation] vite build FAILED"
    errors=$((errors + 1))
  fi

  cd "$REPO_ROOT"
  return $errors
}

# --- Core Backend Lifecycle ---

start_core_backend() {
  echo "  [CoreBackend] Starting CCAAS core backend on :3001..."

  local existing_pid
  existing_pid=$(lsof -ti :3001 2>/dev/null || true)
  if [[ -n "$existing_pid" ]]; then
    echo "  [CoreBackend] Killing existing :3001 process (PID: $existing_pid)..."
    kill $existing_pid 2>/dev/null || true
    sleep 2
  fi

  cd "$REPO_ROOT"
  npm run dev:backend &
  CORE_BACKEND_PID=$!

  local retries=0
  while ! curl -s http://localhost:3001/api/v1/health > /dev/null 2>&1; do
    retries=$((retries + 1))
    if [[ $retries -gt 60 ]]; then
      echo "  [CoreBackend] Failed to start within 60s"
      kill $CORE_BACKEND_PID 2>/dev/null || true
      CORE_BACKEND_PID=""
      return 1
    fi
    sleep 1
  done
  echo "  [CoreBackend] Ready on :3001 (PID: $CORE_BACKEND_PID)"
  cd "$REPO_ROOT"
}

stop_core_backend() {
  if [[ -n "${CORE_BACKEND_PID}" ]]; then
    echo "  [CoreBackend] Stopping (PID: $CORE_BACKEND_PID)..."
    kill $CORE_BACKEND_PID 2>/dev/null || true
    wait $CORE_BACKEND_PID 2>/dev/null || true
    CORE_BACKEND_PID=""
  fi
  local leftover
  leftover=$(lsof -ti :3001 2>/dev/null || true)
  if [[ -n "$leftover" ]]; then
    kill $leftover 2>/dev/null || true
  fi
}

# --- Live-Lesson Backend Lifecycle ---

LESSON_BACKEND_PID=""

start_lesson_backend() {
  echo "  [LessonBackend] Starting live-lesson backend on :3007..."

  local existing_pid
  existing_pid=$(lsof -ti :3007 2>/dev/null || true)
  if [[ -n "$existing_pid" ]]; then
    echo "  [LessonBackend] Killing existing :3007 process (PID: $existing_pid)..."
    kill $existing_pid 2>/dev/null || true
    sleep 2
  fi

  # Rebuild MCP server so lesson data is loaded
  echo "  [LessonBackend] Rebuilding MCP server..."
  cd "${SOLUTION_DIR}/mcp-server"
  if [[ ! -d "node_modules" ]]; then
    npm install --no-audit --no-fund 2>&1 | tail -3
  fi
  npm run build 2>&1 | tail -3 || true

  # Seed DB
  echo "  [LessonBackend] Seeding database with lesson manifests..."
  node --input-type=module -e "
    import { initDb, seedFromManifestFiles } from './dist/db.js';
    const db = initDb();
    seedFromManifestFiles(db);
    db.close();
    console.log('  [LessonBackend] DB seeded successfully');
  " 2>&1 | tail -3 || true

  # Build backend (but don't modify source — it's frozen)
  cd "${SOLUTION_DIR}/backend"
  if [[ ! -d "node_modules" ]]; then
    npm install --legacy-peer-deps --no-audit --no-fund 2>&1 | tail -3
  fi

  echo "  [LessonBackend] Building backend..."
  npx nest build 2>&1 | tail -5 || true

  # Re-seed DB
  echo "  [LessonBackend] Re-seeding DB with updated manifest..."
  node -e "
    const fs=require('fs'),path=require('path'),DB=require('better-sqlite3');
    const manifestDir=path.resolve('..','data/lessons');
    const dbPath=path.resolve('data/live-lesson.db');
    if(!fs.existsSync(dbPath)){console.log('DB not found, skipping re-seed');process.exit(0);}
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

  node dist/main.js &
  LESSON_BACKEND_PID=$!

  local retries=0
  while ! curl -s http://localhost:3007/api/lessons > /dev/null 2>&1; do
    retries=$((retries + 1))
    if [[ $retries -gt 30 ]]; then
      echo "  [LessonBackend] Failed to start within 30s"
      kill $LESSON_BACKEND_PID 2>/dev/null || true
      LESSON_BACKEND_PID=""
      return 1
    fi
    sleep 1
  done
  echo "  [LessonBackend] Ready on :3007 (PID: $LESSON_BACKEND_PID)"
  cd "$REPO_ROOT"
}

stop_lesson_backend() {
  if [[ -n "${LESSON_BACKEND_PID}" ]]; then
    echo "  [LessonBackend] Stopping (PID: $LESSON_BACKEND_PID)..."
    kill $LESSON_BACKEND_PID 2>/dev/null || true
    wait $LESSON_BACKEND_PID 2>/dev/null || true
    LESSON_BACKEND_PID=""
  fi
  local leftover
  leftover=$(lsof -ti :3007 2>/dev/null || true)
  if [[ -n "$leftover" ]]; then
    kill $leftover 2>/dev/null || true
  fi
}

# --- Frontend Dev Server Lifecycle ---

FRONTEND_PID=""

start_frontend_dev() {
  echo "  [Frontend] Starting Vite dev server on :5283..."

  local existing_pid
  existing_pid=$(lsof -ti :5283 2>/dev/null || true)
  if [[ -n "$existing_pid" ]]; then
    echo "  [Frontend] Killing existing :5283 process (PID: $existing_pid)..."
    kill $existing_pid 2>/dev/null || true
    sleep 2
  fi

  cd "${SOLUTION_DIR}/frontend"
  if [[ ! -d "node_modules" ]]; then
    npm install --no-audit --no-fund 2>&1 | tail -3
  fi
  npx vite --port 5283 --host &
  FRONTEND_PID=$!

  local retries=0
  while ! curl -s http://localhost:5283 > /dev/null 2>&1; do
    retries=$((retries + 1))
    if [[ $retries -gt 30 ]]; then
      echo "  [Frontend] Failed to start within 30s"
      kill $FRONTEND_PID 2>/dev/null || true
      FRONTEND_PID=""
      return 1
    fi
    sleep 1
  done
  echo "  [Frontend] Ready on :5283 (PID: $FRONTEND_PID)"
  cd "$REPO_ROOT"
}

stop_frontend_dev() {
  if [[ -n "${FRONTEND_PID}" ]]; then
    echo "  [Frontend] Stopping (PID: $FRONTEND_PID)..."
    kill $FRONTEND_PID 2>/dev/null || true
    wait $FRONTEND_PID 2>/dev/null || true
    FRONTEND_PID=""
  fi
  local leftover
  leftover=$(lsof -ti :5283 2>/dev/null || true)
  if [[ -n "$leftover" ]]; then
    kill $leftover 2>/dev/null || true
  fi
}

# --- Generator & Evaluator ---

run_generator() {
  local version=$1
  local prev=$((version - 1))
  local prompt=$(cat "$PROMPTS_DIR/generator.md")

  # Inject iteration-specific context
  if [[ $version -eq 1 ]]; then
    prompt="${prompt}

---
## Iteration Context (injected by harness)

This is **iteration v1** (first round). You need to:
1. Delete ALL mock data (DEMO_STUDENTS, MOCK_QUEUE, MOCK_*_SUB, etc.)
2. Rewrite TeacherShell to match teacher.html reference design (Step Cards, not swim-rows)
3. Add empty state for zero students
4. All data 100% from classroomState prop

**Priority**: Read teacher.html thoroughly → implement Step Card structure → wire to classroomState → empty states.

**Key points**:
- Read teacher.html — this is your design truth, match it faithfully
- Read useClassroom.ts — understand ClassroomState type
- Do NOT modify frozen files (backend, hooks, student components, pages, etc.)
- Only modify: \`frontend/src/components/teacher/\` and \`frontend/src/styles/teacher.css\`

**Changelog**: ${CHANGELOG_DIR}/v1-changelog.md"
  else
    prompt="${prompt}

---
## Iteration Context (injected by harness)

This is **iteration v${version}**.

**Your starting point**: Code has been modified by previous iterations. Read existing code first, build on it.

**Read eval report**: harness-workspace/live-lesson-teacher-v2-fidelity/eval-reports/v${prev}-eval.md — tells you what lost points and how to fix it.

**Strategy**: Fix the eval report's Priority Fixes first. Don't redo dimensions that already scored well.

### Root Cause Analysis
For each deduction in the eval report, classify:
- **A (Missing)**: Feature not implemented → add it
- **B (Wrong)**: Feature exists but incorrect → fix it
- **C (System-level)**: Issue outside your control → note but skip

### Single-Focus Strategy
Fix at most 2 highest-impact items per iteration. Do NOT scatter-fix across all dimensions — that causes cross-dimension regressions.

**Changelog**: ${CHANGELOG_DIR}/v${version}-changelog.md"
  fi

  cd "$REPO_ROOT"
  claude_safe -p "$prompt" --allowedTools "$GENERATOR_TOOLS" 2>&1 || {
    echo "ERROR: Generator failed on v${version}" >&2
    return 1
  }
}

run_evaluator() {
  local version=$1
  local prompt=$(cat "$PROMPTS_DIR/evaluator.md")

  # Inject version number
  prompt=$(echo "$prompt" | sed "s/{N}/${version}/g")

  cd "$REPO_ROOT"
  claude_safe -p "$prompt" --allowedTools "$EVALUATOR_TOOLS" 2>&1 || {
    echo "ERROR: Evaluator failed on v${version}" >&2
    return 1
  }
}

# --- Cleanup ---

cleanup() {
  stop_frontend_dev
  stop_lesson_backend
  stop_core_backend
}
trap cleanup EXIT

# --- CLI Quick Commands ---

if $SHOW_STATUS; then
  init_state
  state_print_summary
  exit 0
fi

if $REGISTER_DAGU; then
  DAG_FILE="${HARNESS_DIR}/dag.yaml"
  if [[ -f "$DAG_FILE" ]]; then
    echo "DAGU dag.yaml found at: $DAG_FILE"
    echo "To register: dagu server & dagu start $DAG_FILE"
  else
    echo "No dag.yaml found. Create one first."
  fi
  exit 0
fi

if $UNREGISTER_DAGU; then
  echo "DAGU unregister is a manual operation. Stop the dagu server process."
  exit 0
fi

# --- Pre-flight ---

preflight
init_state
mkdir -p "$EVAL_DIR" "$CHANGELOG_DIR"

# Initialize progress file if not exists
if [[ ! -f "$PROGRESS_FILE" ]]; then
  cat > "$PROGRESS_FILE" << 'EOF'
# Progress — live-lesson-teacher-v2-fidelity

| Version | Timestamp | Score | Changes | Top Issue |
|---------|-----------|-------|---------|-----------|
EOF
fi

# --- Main Loop ---

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  ${TASK_NAME} Harness — Code Mode                          ║"
echo "║  Artifact: frontend/src/components/teacher/ + teacher.css   ║"
echo "║  Frozen: backend, hooks, student, pages, data, packages     ║"
echo "║  Max iterations: ${MAX_ITERATIONS}  |  Threshold: ${SCORE_THRESHOLD}/100              ║"
echo "║  Cost cap: \$${MAX_COST_USD}                                            ║"
echo "╚══════════════════════════════════════════════════════════════╝"

if $RESUME; then
  state_iter=$(state_read '.currentIteration')
  if [[ -n "$state_iter" && "$state_iter" != "null" && "$state_iter" != "0" ]]; then
    state_iter_status=$(jq -r ".iterations[\"$state_iter\"].status // \"unknown\"" "$STATE_FILE" 2>/dev/null || echo "unknown")
    if [[ "$state_iter_status" == "running" ]]; then
      START_VERSION=$state_iter
      echo "Resuming iteration v${START_VERSION} (sub-step recovery via state.json)..."
    else
      START_VERSION=$(( state_iter + 1 ))
      echo "Resuming from v${START_VERSION} (state.json: iteration $state_iter was $state_iter_status)..."
    fi
  else
    START_VERSION=$(( $(get_last_version) + 1 ))
    echo "Resuming from v${START_VERSION} (eval file count fallback)..."
  fi
else
  START_VERSION=1
fi

if $DRY_RUN; then
  remaining=$((MAX_ITERATIONS - START_VERSION + 1))
  est=$(estimate_cost $remaining)
  echo "[DRY RUN] Would run ${remaining} iterations, estimated cost: \$${est}"
  exit 0
fi

# --- DAGU Single Step Mode ---
if [[ -n "$SINGLE_STEP" && -n "$SINGLE_ITERATION" ]]; then
  echo "Running single step: --step=$SINGLE_STEP --iteration=$SINGLE_ITERATION"
  state_init_iteration "$SINGLE_ITERATION"
  case "$SINGLE_STEP" in
    generator)    run_step "$SINGLE_ITERATION" "generator" "run_generator $SINGLE_ITERATION" ;;
    frozen-check) run_step "$SINGLE_ITERATION" "frozen-check" "cd '$REPO_ROOT' && FROZEN_BASELINE=\$(git diff --name-only -- \"\${FROZEN_DIRS[@]}\" 2>/dev/null | sort || true) && FROZEN_VIOLATION_COUNT=0 && check_frozen_dirs" ;;
    validation)   run_step "$SINGLE_ITERATION" "validation" "run_validation" ;;
    services)     run_step "$SINGLE_ITERATION" "services" "start_core_backend && start_lesson_backend && start_frontend_dev" ;;
    evaluator)    run_step "$SINGLE_ITERATION" "evaluator" "run_evaluator $SINGLE_ITERATION" ;;
    results)      run_step "$SINGLE_ITERATION" "results" "echo 'Extract results manually for single-step mode'" ;;
    *)            echo "Unknown step: $SINGLE_STEP. Valid: generator, frozen-check, validation, services, evaluator, results" ; exit 1 ;;
  esac
  exit $?
fi

low_improvement_count=0
prev_score=0

# If resuming, recover prev_score from last eval
if [[ $START_VERSION -gt 1 ]]; then
  prev_eval="${EVAL_DIR}/v$((START_VERSION - 1))-eval.md"
  if [[ -f "$prev_eval" ]]; then
    prev_score=$(extract_score "$prev_eval" || echo "0")
  fi
fi

for i in $(seq $START_VERSION $MAX_ITERATIONS); do
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  Iteration $i / $MAX_ITERATIONS"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # Cost check
  completed=$((i - START_VERSION))
  spent=$(estimate_cost $completed)
  if (( $(echo "$spent > $MAX_COST_USD" | bc -l) )); then
    echo "Cost cap reached (\$${spent} > \$${MAX_COST_USD}). Stopping."
    break
  fi

  # Initialize state for this iteration
  state_init_iteration "$i"

  # ─── Snapshot frozen dir baseline before generator ───
  cd "$REPO_ROOT"
  FROZEN_BASELINE=$(git diff --name-only -- "${FROZEN_DIRS[@]}" 2>/dev/null | sort || true)

  # ─── Step 1: Generator ───
  echo ""
  echo "  [Step 1/6] Running Generator..."
  run_step "$i" "generator" "run_generator $i || { sleep 5; run_generator $i; }" || {
    echo "  Generator failed twice. Stopping."
    append_progress $i "ERROR" "Generator failure" "N/A"
    state_step_fail "$i" "generator" "failed twice"
    break
  }

  # ─── Step 2: Frozen directory check ───
  echo ""
  echo "  [Step 2/6] Checking frozen directories..."
  run_step "$i" "frozen-check" "cd '$REPO_ROOT' && FROZEN_VIOLATION_COUNT=0 && check_frozen_dirs && if [[ \$FROZEN_VIOLATION_COUNT -gt 0 ]]; then echo '  WARNING: \${FROZEN_VIOLATION_COUNT} frozen directory(ies) had new changes reverted.'; fi; true"

  # ─── Step 3: Validation (frontend typecheck + build) ───
  echo ""
  echo "  [Step 3/6] Running validation..."
  if ! run_step "$i" "validation" "run_validation"; then
    echo "  Validation FAILED. Reverting teacher files and skipping to next iteration."
    cd "$REPO_ROOT"
    git checkout -- "solutions/business/live-lesson/frontend/src/components/teacher/" 2>/dev/null || true
    git checkout -- "solutions/business/live-lesson/frontend/src/styles/teacher.css" 2>/dev/null || true
    append_progress $i "FAIL" "Validation failed" "typecheck/build error"
    continue
  fi

  # ─── Git snapshot: Generator iteration ───
  cd "$REPO_ROOT"
  git add \
    "solutions/business/live-lesson/frontend/src/components/teacher/" \
    "solutions/business/live-lesson/frontend/src/styles/teacher.css" \
    "${CHANGELOG_DIR}/" 2>/dev/null || true
  git commit -m "feat(live-lesson): teacher-v2-fidelity v${i} iteration" --allow-empty 2>/dev/null || true

  # ─── Step 4: Start 3 services ───
  echo ""
  echo "  [Step 4/6] Starting services (core → lesson-backend → frontend)..."
  run_step "$i" "services" "start_core_backend && start_lesson_backend && start_frontend_dev" || {
    echo "  Services failed to start. Skipping eval."
    stop_frontend_dev
    stop_lesson_backend
    stop_core_backend
    append_progress $i "ERROR" "Services failed" "N/A"
    continue
  }

  # ─── Step 5: Run evaluator ───
  echo ""
  echo "  [Step 5/6] Running Evaluator..."
  run_step "$i" "evaluator" "run_evaluator $i || { sleep 5; run_evaluator $i; }" || {
    echo "  Evaluator failed twice. Stopping."
    stop_frontend_dev
    stop_lesson_backend
    stop_core_backend
    append_progress $i "ERROR" "Evaluator failure" "N/A"
    break
  }

  # Stop all services
  stop_frontend_dev
  stop_lesson_backend
  stop_core_backend

  # ─── Step 6: Extract results from FILES ───
  echo ""
  echo "  [Step 6/6] Extracting results..."
  state_step_start "$i" "results"

  eval_file="${EVAL_DIR}/v${i}-eval.md"
  if [[ ! -f "$eval_file" ]]; then
    echo "  Eval report not found at ${eval_file}. Stopping."
    append_progress $i "ERROR" "No eval report" "N/A"
    state_step_fail "$i" "results" "no eval report"
    break
  fi

  score=$(extract_score "$eval_file")
  if [[ -z "$score" ]]; then
    echo "  Could not extract score from eval report. Stopping."
    append_progress $i "ERROR" "Score extraction failed" "N/A"
    state_step_fail "$i" "results" "score extraction failed"
    break
  fi

  # Extract key changes from changelog FILE
  changelog_file="${CHANGELOG_DIR}/v${i}-changelog.md"
  if [[ -f "$changelog_file" ]]; then
    changes=$(grep "^- " "$changelog_file" | head -3 | tr '\n' '; ' | cut -c1-100)
  else
    changes="(no changelog file)"
  fi

  # Extract top issue from eval report FILE
  top_issue=$(grep -A1 "Priority Fix" "$eval_file" 2>/dev/null | tail -1 | sed 's/^[0-9. ]*//' | cut -c1-80 || echo "N/A")

  append_progress "$i" "$score" "$changes" "$top_issue"
  state_step_complete "$i" "results"
  state_update ".iterations[\"$i\"].score" "$score"
  echo "  Score: ${score}/100"

  # Git snapshot: eval
  cd "$REPO_ROOT"
  git add "${EVAL_DIR}/" "${PROGRESS_FILE}" 2>/dev/null || true
  git commit -m "feat(live-lesson): teacher-v2-fidelity v${i} eval — score ${score}/100" --allow-empty 2>/dev/null || true

  # ─── Exit conditions ───

  # 1. Score threshold
  if [[ "$score" -ge "$SCORE_THRESHOLD" ]]; then
    echo ""
    echo "  Score threshold reached! (${score} >= ${SCORE_THRESHOLD})"
    break
  fi

  # 2. Regression detection + auto-revert
  if [[ $prev_score -gt 0 && $score -lt $((prev_score - ROLLBACK_THRESHOLD)) ]]; then
    echo ""
    echo "  REGRESSION detected: ${prev_score} -> ${score} (delta < -${ROLLBACK_THRESHOLD}). Reverting artifact."
    cd "$REPO_ROOT"
    git checkout HEAD~2 -- \
      solutions/business/live-lesson/frontend/src/components/teacher/ \
      solutions/business/live-lesson/frontend/src/styles/teacher.css 2>/dev/null || true
    git add \
      "solutions/business/live-lesson/frontend/src/components/teacher/" \
      "solutions/business/live-lesson/frontend/src/styles/teacher.css" && \
    git commit -m "feat(live-lesson): teacher-v2-fidelity v${i} REVERTED — regression ${prev_score}->${score}" 2>/dev/null || true
    continue
  fi

  # 3. Diminishing returns
  if [[ $prev_score -gt 0 ]]; then
    improvement=$((score - prev_score))
    if [[ $improvement -lt $MIN_IMPROVEMENT ]]; then
      low_improvement_count=$((low_improvement_count + 1))
      if [[ $low_improvement_count -ge 2 ]]; then
        echo ""
        echo "  Diminishing returns (< ${MIN_IMPROVEMENT} points for 2 consecutive iterations). Stopping."
        echo "  Bottleneck: ${top_issue}"
        break
      fi
      echo "  Low improvement (${improvement} pts). Count: ${low_improvement_count}/2"
    else
      low_improvement_count=0
    fi
  fi

  prev_score=$score
done

state_finish "completed"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Run Complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Progress:  ${PROGRESS_FILE}"
echo "  Artifact:  solutions/business/live-lesson/frontend/src/components/teacher/"
echo "             solutions/business/live-lesson/frontend/src/styles/teacher.css"
echo "  History:   git log --grep='teacher-v2-fidelity' --oneline"
echo ""
echo "  Next steps:"
echo "    cat ${PROGRESS_FILE}"
echo "    cd solutions/business/live-lesson/frontend && npx tsc --noEmit"
echo "    cd solutions/business/live-lesson/frontend && npx vite build"
echo ""
