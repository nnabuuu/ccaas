#!/usr/bin/env bash
set -eu

# ============================================================
# live-lesson-reading-surfaces Harness — Code Mode Iteration Loop
#
# Builds React reading surfaces for live-lesson solution.
# Artifact: solutions/business/live-lesson/frontend/
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
TASK_NAME="live-lesson-reading-surfaces"
MAX_ITERATIONS=8
SCORE_THRESHOLD=95
MIN_IMPROVEMENT=3
ROLLBACK_THRESHOLD=5
MAX_COST_USD="${MAX_COST:-250}"

# Agent tool permissions
GENERATOR_TOOLS="Read,Write,Edit,Grep,Glob,Bash"
EVALUATOR_TOOLS="Read,Write,Grep,Glob,Bash,mcp__playwright__browser_navigate,mcp__playwright__browser_snapshot,mcp__playwright__browser_evaluate,mcp__playwright__browser_click,mcp__playwright__browser_type,mcp__playwright__browser_resize,mcp__playwright__browser_close,mcp__playwright__browser_network_requests,mcp__playwright__browser_wait_for,mcp__playwright__browser_press_key"

# CCAAS core backend
ADMIN_KEY="sk-default-testd84f5b7a1dbdbc4c424417be6c009f01"
CORE_BACKEND_PID=""

# Cost estimates
COST_PER_ITERATION=10.00

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
FROZEN_DIRS=(
  "solutions/business/live-lesson/mcp-server/src/"
  "solutions/business/live-lesson/backend/src/"
  "packages/"
  "solutions/business/edu-platform/"
  "solutions/business/recipe-book/"
)

# --- Flags ---
DRY_RUN=false
RESUME=false

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --resume) RESUME=true ;;
    --max-cost=*) MAX_COST_USD="${arg#*=}" ;;
  esac
done

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
  echo "  [Validation] Running typecheck + build in frontend..."
  local errors=0

  cd "${SOLUTION_DIR}/frontend"

  # Install deps if needed
  if [[ ! -d "node_modules" ]] || [[ "package.json" -nt "node_modules/.package-lock.json" ]]; then
    echo "  [Validation] Installing dependencies..."
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

  # Kill any existing :3001 process
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

  # Wait up to 60s for health endpoint
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

  # Rebuild MCP server so new lesson data is loaded
  echo "  [LessonBackend] Rebuilding MCP server..."
  cd "${SOLUTION_DIR}/mcp-server"
  if [[ ! -d "node_modules" ]]; then
    npm install --no-audit --no-fund 2>&1 | tail -3
  fi
  npm run build 2>&1 | tail -3 || true

  # Seed DB by running the MCP server's init+seed logic directly
  echo "  [LessonBackend] Seeding database with lesson manifests..."
  node --input-type=module -e "
    import { initDb, seedFromManifestFiles } from './dist/db.js';
    const db = initDb();
    seedFromManifestFiles(db);
    db.close();
    console.log('  [LessonBackend] DB seeded successfully');
  " 2>&1 | tail -3 || true

  # Start backend
  cd "${SOLUTION_DIR}/backend"
  if [[ ! -d "node_modules" ]]; then
    npm install --no-audit --no-fund 2>&1 | tail -3
  fi

  # Build backend if dist doesn't exist
  if [[ ! -f "dist/index.js" ]]; then
    echo "  [LessonBackend] Building backend..."
    npm run build 2>&1 | tail -3 || true
  fi

  node dist/index.js &
  LESSON_BACKEND_PID=$!

  # Wait for server to be ready
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
  cd "${SOLUTION_DIR}/frontend"
  if [[ ! -d "node_modules" ]]; then
    npm install --no-audit --no-fund 2>&1 | tail -3
  fi
  npx vite --port 5283 --host &
  FRONTEND_PID=$!
  # Wait for frontend to be ready
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
## 迭代上下文（编排器注入）

这是**第一轮**迭代 (v1)。你需要在现有 live-lesson 前端中添加阅读课堂的 4 个新页面。

**优先级**：先完成 Phase 1-3（token + 类型 + board 组件），再完成 Phase 4-7（页面 + 路由）。
确保每个 Phase 完成后 tsc 通过。

**关键**：
- 必须读完全部 design HTML 文件（board.html, student.html, teacher.html, demo.html）
- 读 board-data.js 和 board-renderer.js 理解 block 渲染逻辑
- 读 colors_and_type.css 提取所有 design tokens
- 读 manifest.json 理解数据结构
- 新页面用光色主题，board 面用暗色 scoped
- 遗留 /lesson 路由不要动

**Changelog 保存到**: ${CHANGELOG_DIR}/v1-changelog.md"
  else
    prompt="${prompt}

---
## 迭代上下文（编排器注入）

这是第 **v${version}** 轮迭代。

**你的起点**：前端代码已被前几轮修改。先读现有代码，在此基础上改进。

**读 eval report**: harness-workspace/live-lesson-reading-surfaces/eval-reports/v${prev}-eval.md — 告诉你哪里扣分了、如何修复。

**策略**：优先修复 eval report 中的 Top Priority Fixes。不要重做已经满分的维度。

**Changelog 保存到**: ${CHANGELOG_DIR}/v${version}-changelog.md"
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

# --- Pre-flight ---

mkdir -p "$EVAL_DIR" "$CHANGELOG_DIR"

# Initialize progress file if not exists
if [[ ! -f "$PROGRESS_FILE" ]]; then
  cat > "$PROGRESS_FILE" << 'EOF'
# Progress — live-lesson-reading-surfaces

| Version | Timestamp | Score | Changes | Top Issue |
|---------|-----------|-------|---------|-----------|
EOF
fi

# --- Main Loop ---

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  ${TASK_NAME} Harness — Code Mode                          ║"
echo "║  Artifact: solutions/business/live-lesson/frontend/         ║"
echo "║  Frozen:                                                    ║"
echo "║    solutions/business/live-lesson/mcp-server/src/           ║"
echo "║    solutions/business/live-lesson/backend/src/              ║"
echo "║    packages/                                                ║"
echo "║    solutions/business/edu-platform/                         ║"
echo "║    solutions/business/recipe-book/                          ║"
echo "║  Max iterations: ${MAX_ITERATIONS}  |  Threshold: ${SCORE_THRESHOLD}/100              ║"
echo "║  Cost cap: \$${MAX_COST_USD}                                            ║"
echo "╚══════════════════════════════════════════════════════════════╝"

if $RESUME; then
  START_VERSION=$(( $(get_last_version) + 1 ))
  echo "Resuming from v${START_VERSION}..."
else
  START_VERSION=1
fi

if $DRY_RUN; then
  remaining=$((MAX_ITERATIONS - START_VERSION + 1))
  est=$(estimate_cost $remaining)
  echo "[DRY RUN] Would run ${remaining} iterations, estimated cost: \$${est}"
  exit 0
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

  # ─── Snapshot frozen dir baseline before generator ───
  cd "$REPO_ROOT"
  FROZEN_BASELINE=$(git diff --name-only -- "${FROZEN_DIRS[@]}" 2>/dev/null | sort || true)

  # ─── Step 1: Generator ───
  echo ""
  echo "  [Step 1/6] Running Generator..."
  run_generator $i || {
    echo "  Generator failed. Retrying once..."
    sleep 5
    run_generator $i || {
      echo "  Generator failed twice. Stopping."
      append_progress $i "ERROR" "Generator failure" "N/A"
      break
    }
  }

  # ─── Step 2: Frozen directory check ───
  echo ""
  echo "  [Step 2/6] Checking frozen directories..."
  cd "$REPO_ROOT"
  FROZEN_VIOLATION_COUNT=0
  check_frozen_dirs
  if [[ $FROZEN_VIOLATION_COUNT -gt 0 ]]; then
    echo "  WARNING: ${FROZEN_VIOLATION_COUNT} frozen directory(ies) had new changes reverted."
  fi

  # ─── Step 3: Validation (typecheck + build) ───
  echo ""
  echo "  [Step 3/6] Running validation..."
  if ! run_validation; then
    echo "  Validation FAILED. Reverting new frontend files and skipping to next iteration."
    cd "$REPO_ROOT"
    # Only revert new reading-related files, not the entire frontend
    git checkout -- "solutions/business/live-lesson/frontend/src/styles/reading-tokens.css" 2>/dev/null || true
    git checkout -- "solutions/business/live-lesson/frontend/src/types/reading.ts" 2>/dev/null || true
    git checkout -- "solutions/business/live-lesson/frontend/src/hooks/useReadingLesson.ts" 2>/dev/null || true
    git checkout -- "solutions/business/live-lesson/frontend/src/hooks/useSurfaceSync.ts" 2>/dev/null || true
    git checkout -- "solutions/business/live-lesson/frontend/src/components/board/" 2>/dev/null || true
    git checkout -- "solutions/business/live-lesson/frontend/src/components/student/" 2>/dev/null || true
    git checkout -- "solutions/business/live-lesson/frontend/src/components/teacher/" 2>/dev/null || true
    git checkout -- "solutions/business/live-lesson/frontend/src/components/orchestrator/" 2>/dev/null || true
    git checkout -- "solutions/business/live-lesson/frontend/src/pages/BoardPage.tsx" 2>/dev/null || true
    git checkout -- "solutions/business/live-lesson/frontend/src/pages/StudentPage.tsx" 2>/dev/null || true
    git checkout -- "solutions/business/live-lesson/frontend/src/pages/TeacherPage.tsx" 2>/dev/null || true
    git checkout -- "solutions/business/live-lesson/frontend/src/pages/DemoPage.tsx" 2>/dev/null || true
    append_progress $i "FAIL" "Validation failed" "typecheck/build error"
    continue
  fi

  # ─── Git snapshot: Generator iteration ───
  cd "$REPO_ROOT"
  git add \
    "solutions/business/live-lesson/frontend/" \
    "${CHANGELOG_DIR}/" 2>/dev/null || true
  git commit -m "feat(frontend): live-lesson reading-surfaces v${i} iteration" --allow-empty 2>/dev/null || true

  # ─── Step 4: Start 3 services ───
  echo ""
  echo "  [Step 4/6] Starting services (core → lesson-backend → frontend)..."

  # 4a: Core backend
  start_core_backend || {
    echo "  Core backend failed to start. Skipping eval."
    append_progress $i "ERROR" "Core backend failed" "N/A"
    continue
  }

  # 4b: Lesson backend
  start_lesson_backend || {
    echo "  Lesson backend failed to start. Skipping eval."
    stop_core_backend
    append_progress $i "ERROR" "Lesson backend failed" "N/A"
    continue
  }

  # 4c: Frontend dev server
  start_frontend_dev || {
    echo "  Frontend dev server failed to start. Skipping eval."
    stop_lesson_backend
    stop_core_backend
    append_progress $i "ERROR" "Frontend failed to start" "N/A"
    continue
  }

  # ─── Step 5: Run evaluator ───
  echo ""
  echo "  [Step 5/6] Running Evaluator..."
  run_evaluator $i || {
    echo "  Evaluator failed. Retrying once..."
    sleep 5
    run_evaluator $i || {
      echo "  Evaluator failed twice. Stopping."
      stop_frontend_dev
      stop_lesson_backend
      stop_core_backend
      append_progress $i "ERROR" "Evaluator failure" "N/A"
      break
    }
  }

  # Stop all services
  stop_frontend_dev
  stop_lesson_backend
  stop_core_backend

  # ─── Step 6: Extract results from FILES ───
  echo ""
  echo "  [Step 6/6] Extracting results..."

  eval_file="${EVAL_DIR}/v${i}-eval.md"
  if [[ ! -f "$eval_file" ]]; then
    echo "  Eval report not found at ${eval_file}. Stopping."
    append_progress $i "ERROR" "No eval report" "N/A"
    break
  fi

  score=$(extract_score "$eval_file")
  if [[ -z "$score" ]]; then
    echo "  Could not extract score from eval report. Stopping."
    append_progress $i "ERROR" "Score extraction failed" "N/A"
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
  echo "  Score: ${score}/100"

  # Git snapshot: eval
  cd "$REPO_ROOT"
  git add "${EVAL_DIR}/" "${PROGRESS_FILE}" 2>/dev/null || true
  git commit -m "feat(frontend): live-lesson reading-surfaces v${i} eval — score ${score}/100" --allow-empty 2>/dev/null || true

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
    echo "  REGRESSION detected: ${prev_score} -> ${score} (delta < -${ROLLBACK_THRESHOLD}). Reverting frontend."
    cd "$REPO_ROOT"
    git checkout HEAD~2 -- \
      solutions/business/live-lesson/frontend/ 2>/dev/null || true
    git add "solutions/business/live-lesson/frontend/" && \
    git commit -m "feat(frontend): live-lesson reading-surfaces v${i} REVERTED — regression ${prev_score}->${score}" 2>/dev/null || true
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

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Run Complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Progress:  ${PROGRESS_FILE}"
echo "  Artifact:  solutions/business/live-lesson/frontend/"
echo "  History:   git log --grep='live-lesson.*reading' --oneline"
echo ""
echo "  Next steps:"
echo "    cat ${PROGRESS_FILE}"
echo "    cd solutions/business/live-lesson/frontend && npx tsc --noEmit"
echo "    cd solutions/business/live-lesson/frontend && npx vite build"
echo ""
