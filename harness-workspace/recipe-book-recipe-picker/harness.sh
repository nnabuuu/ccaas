#!/usr/bin/env bash
set -eu

# ============================================================
# recipe-book-recipe-picker Harness — Code Mode Iteration Loop
#
# Replaces AtPicker with keyboard-first RecipePicker.
# Artifact: solutions/business/recipe-book/frontend/
# Services: CCAAS core (:3001) + recipe backend (:3002) + frontend (:5291)
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
TASK_NAME="recipe-book-recipe-picker"
MAX_ITERATIONS=5
SCORE_THRESHOLD=95
MIN_IMPROVEMENT=3
ROLLBACK_THRESHOLD=5
MAX_COST_USD="${MAX_COST:-150}"

# Agent tool permissions
GENERATOR_TOOLS="Read,Write,Edit,Grep,Glob,Bash"
EVALUATOR_TOOLS="Read,Write,Grep,Glob,Bash,mcp__playwright__browser_navigate,mcp__playwright__browser_snapshot,mcp__playwright__browser_evaluate,mcp__playwright__browser_click,mcp__playwright__browser_type,mcp__playwright__browser_press_key,mcp__playwright__browser_resize,mcp__playwright__browser_close,mcp__playwright__browser_network_requests,mcp__playwright__browser_wait_for"

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
SOLUTION_DIR="${REPO_ROOT}/solutions/business/recipe-book"

# Frozen directories (MUST NOT be modified)
FROZEN_DIRS=(
  "packages/chat-interface/src/"
  "packages/context-layer/src/"
  "packages/context-layer-react/src/"
  "packages/entity-document/src/"
  "solutions/business/edu-platform/"
  "solutions/business/recipe-book/backend/"
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
  grep -oE '(总分|Total)[^0-9]*[0-9]+/100' "$eval_file" | head -1 | grep -oE '[0-9]+/100' | sed 's|/100||'
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
  echo "  [Validation] Running typecheck + build..."
  local errors=0

  # Frontend typecheck + build
  cd "${SOLUTION_DIR}/frontend"
  if [[ ! -d "node_modules" ]] || [[ "package.json" -nt "node_modules/.package-lock.json" ]]; then
    echo "  [Validation] Installing frontend dependencies..."
    npm install --no-audit --no-fund 2>&1 | tail -3
  fi
  if ! npx tsc --noEmit 2>&1 | tail -10; then
    echo "  [Validation] Frontend tsc FAILED"
    errors=$((errors + 1))
  fi
  if ! npx vite build 2>&1 | tail -5; then
    echo "  [Validation] Frontend vite build FAILED"
    errors=$((errors + 1))
  fi

  # Backend tests (solution must not be broken)
  cd "${SOLUTION_DIR}/backend"
  if [[ -f "vitest.config.ts" ]] || [[ -f "vitest.config.js" ]]; then
    if ! npx vitest run 2>&1 | tail -5; then
      echo "  [Validation] Backend tests FAILED"
      errors=$((errors + 1))
    fi
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

# --- Recipe Backend Lifecycle ---

RECIPE_BACKEND_PID=""

start_recipe_backend() {
  echo "  [RecipeBackend] Starting recipe-book backend on :3002..."
  cd "${SOLUTION_DIR}/backend"
  if [[ ! -d "node_modules" ]]; then
    npm install --no-audit --no-fund 2>&1 | tail -3
  fi
  # Build MCP server if dist doesn't exist
  if [[ -d "${SOLUTION_DIR}/mcp-server" ]] && [[ ! -f "${SOLUTION_DIR}/mcp-server/dist/index.js" ]]; then
    echo "  [RecipeBackend] Building MCP server..."
    cd "${SOLUTION_DIR}/mcp-server"
    npm install --no-audit --no-fund 2>&1 | tail -3 || true
    npm run build 2>&1 | tail -3 || true
    cd "${SOLUTION_DIR}/backend"
  fi
  # Run seed to ensure data exists
  npx ts-node src/seed.ts 2>&1 | tail -3 || true
  # Start server
  CCAAS_URL=http://localhost:3001 \
  CCAAS_API_KEY=$ADMIN_KEY \
  npx ts-node src/main.ts &
  RECIPE_BACKEND_PID=$!

  local retries=0
  while ! curl -s http://localhost:3002/context/entity-types > /dev/null 2>&1; do
    retries=$((retries + 1))
    if [[ $retries -gt 30 ]]; then
      echo "  [RecipeBackend] Failed to start within 30s"
      kill $RECIPE_BACKEND_PID 2>/dev/null || true
      RECIPE_BACKEND_PID=""
      return 1
    fi
    sleep 1
  done
  echo "  [RecipeBackend] Ready on :3002 (PID: $RECIPE_BACKEND_PID)"
  cd "$REPO_ROOT"
}

stop_recipe_backend() {
  if [[ -n "${RECIPE_BACKEND_PID}" ]]; then
    echo "  [RecipeBackend] Stopping (PID: $RECIPE_BACKEND_PID)..."
    kill $RECIPE_BACKEND_PID 2>/dev/null || true
    wait $RECIPE_BACKEND_PID 2>/dev/null || true
    RECIPE_BACKEND_PID=""
  fi
  local leftover
  leftover=$(lsof -ti :3002 2>/dev/null || true)
  if [[ -n "$leftover" ]]; then
    kill $leftover 2>/dev/null || true
  fi
}

# --- Skills Registration ---

register_skills() {
  echo "  [Skills] Registering skills with CCAAS core..."
  SKILLS_DIR="${SOLUTION_DIR}/skills" \
  ADMIN_KEY="${ADMIN_KEY}" \
  python3 << 'PYEOF'
import json, os, sys
from urllib.request import Request, urlopen
from urllib.error import HTTPError

API_KEY = os.environ.get("ADMIN_KEY", "sk-default-testd84f5b7a1dbdbc4c424417be6c009f01")
SKILLS_DIR = os.environ.get("SKILLS_DIR", "")
CORE_URL = "http://localhost:3001"

def api(method, path, body=None, headers=None):
    hdrs = {"Content-Type": "application/json", "x-api-key": API_KEY}
    if headers: hdrs.update(headers)
    data = json.dumps(body).encode() if body else None
    req = Request(f"{CORE_URL}{path}", data=data, headers=hdrs, method=method)
    try:
        with urlopen(req) as resp:
            return json.loads(resp.read()), resp.status
    except HTTPError as e:
        body = e.read()
        return json.loads(body) if body else {}, e.code

tenant_data, status = api("GET", "/api/v1/admin/tenants/recipe-book")
if status >= 400:
    print(f"  [Skills] ERROR: Could not find tenant recipe-book (HTTP {status})")
    sys.exit(1)
tenant_id = tenant_data.get("id", "")

if not os.path.isdir(SKILLS_DIR):
    print(f"  [Skills] SKIP: {SKILLS_DIR} does not exist")
    sys.exit(0)

skill_dirs = sorted([d for d in os.listdir(SKILLS_DIR) if os.path.isdir(os.path.join(SKILLS_DIR, d))])
for skill_slug in skill_dirs:
    skill_md_path = os.path.join(SKILLS_DIR, skill_slug, "SKILL.md")
    if not os.path.exists(skill_md_path): continue
    content = open(skill_md_path, "r").read()
    create_body = {"name": skill_slug, "slug": skill_slug, "content": content, "description": f"Recipe Book - {skill_slug}"}
    result, code = api("POST", "/api/v1/skills", create_body, {"X-Tenant-Id": tenant_id})
    if code == 409:
        result, code = api("GET", f"/api/v1/skills/{skill_slug}", headers={"X-Tenant-Id": tenant_id})
    elif code >= 400:
        continue
    skill_id = result.get("id", "")
    api("POST", f"/api/v1/skills/{skill_id}/publish", headers={"X-Tenant-Id": tenant_id})
print("  [Skills] Done")
PYEOF
}

# --- Frontend Dev Server Lifecycle ---

FRONTEND_PID=""

start_frontend_dev() {
  echo "  [Frontend] Starting Vite dev server on :5291..."
  cd "${SOLUTION_DIR}/frontend"
  if [[ ! -d "node_modules" ]]; then
    npm install --no-audit --no-fund 2>&1 | tail -3
  fi
  npx vite --port 5291 --host &
  FRONTEND_PID=$!
  local retries=0
  while ! curl -s http://localhost:5291 > /dev/null 2>&1; do
    retries=$((retries + 1))
    if [[ $retries -gt 30 ]]; then
      echo "  [Frontend] Failed to start within 30s"
      kill $FRONTEND_PID 2>/dev/null || true
      FRONTEND_PID=""
      return 1
    fi
    sleep 1
  done
  echo "  [Frontend] Ready on :5291 (PID: $FRONTEND_PID)"
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
  leftover=$(lsof -ti :5291 2>/dev/null || true)
  if [[ -n "$leftover" ]]; then
    kill $leftover 2>/dev/null || true
  fi
}

# --- Generator & Evaluator ---

run_generator() {
  local version=$1
  local prev=$((version - 1))
  local prompt=$(cat "$PROMPTS_DIR/generator.md")

  if [[ $version -eq 1 ]]; then
    prompt="${prompt}

---
## 迭代上下文（编排器注入）

这是**第一轮**迭代 (v1)。你需要创建 RecipePicker 并替换所有 MentionPicker 用法。

**优先级**：
1. 先创建 RecipePicker.tsx（完整的键盘导航 + autoRef + pills）
2. 修改 mention.ts（删除 MentionPicker export）
3. 修改 RecipeDetailPage.tsx 和 ChatPage.tsx（swap 组件）
4. 清理 index.css（删除 AtPicker overrides + 添加 RecipePicker styles）
5. 验证 tsc + build

**关键**：键盘导航是核心要求。ArrowDown/Up 导航，Enter 选择，Escape 关闭。

**Changelog 保存到**: ${CHANGELOG_DIR}/v1-changelog.md"
  else
    prompt="${prompt}

---
## 迭代上下文（编排器注入）

这是第 **v${version}** 轮迭代。

**你的起点**：代码已被前几轮修改。先读现有代码，在此基础上改进。

**读 eval report**: harness-workspace/recipe-book-recipe-picker/eval-reports/v${prev}-eval.md — 告诉你哪里扣分了、如何修复。

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
  stop_recipe_backend
  stop_core_backend
}
trap cleanup EXIT

# --- Pre-flight ---

mkdir -p "$EVAL_DIR" "$CHANGELOG_DIR"

# Initialize progress file if needed
if [[ ! -f "$PROGRESS_FILE" ]]; then
  cat > "$PROGRESS_FILE" << 'PROGRESS_EOF'
# Progress — recipe-book-recipe-picker

| Version | Timestamp | Score | Changes | Top Issue |
|---------|-----------|-------|---------|-----------|
PROGRESS_EOF
fi

# --- Main Loop ---

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  ${TASK_NAME} Harness — Code Mode                          ║"
echo "║  Artifact: solutions/business/recipe-book/frontend/         ║"
echo "║  Frozen:                                                    ║"
echo "║    packages/{chat-interface,context-layer*,entity-document} ║"
echo "║    solutions/business/{edu-platform,recipe-book/backend}    ║"
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

  # ─── Step 3: Validation ───
  echo ""
  echo "  [Step 3/6] Running validation..."
  if ! run_validation; then
    echo "  Validation FAILED. Reverting frontend and skipping to next iteration."
    cd "$REPO_ROOT"
    git checkout -- "solutions/business/recipe-book/frontend/" 2>/dev/null || true
    append_progress $i "FAIL" "Validation failed" "typecheck/build error"
    continue
  fi

  # ─── Git snapshot: Generator iteration ───
  cd "$REPO_ROOT"
  git add \
    "solutions/business/recipe-book/frontend/" \
    "${CHANGELOG_DIR}/" 2>/dev/null || true
  git commit -m "feat(frontend): recipe-book recipe-picker v${i} iteration" --allow-empty 2>/dev/null || true

  # ─── Step 4: Start 3 services ───
  echo ""
  echo "  [Step 4/6] Starting services (core → backend → skills → frontend)..."

  start_core_backend || {
    echo "  Core backend failed to start. Skipping eval."
    append_progress $i "ERROR" "Core backend failed" "N/A"
    continue
  }

  start_recipe_backend || {
    echo "  Recipe backend failed to start. Skipping eval."
    stop_core_backend
    append_progress $i "ERROR" "Recipe backend failed" "N/A"
    continue
  }

  sleep 3
  register_skills || {
    echo "  WARNING: Skill registration had errors (continuing anyway)."
  }

  start_frontend_dev || {
    echo "  Frontend dev server failed to start. Skipping eval."
    stop_recipe_backend
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
      stop_recipe_backend
      stop_core_backend
      append_progress $i "ERROR" "Evaluator failure" "N/A"
      break
    }
  }

  # Stop all services
  stop_frontend_dev
  stop_recipe_backend
  stop_core_backend

  # ─── Step 6: Extract results ───
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

  changelog_file="${CHANGELOG_DIR}/v${i}-changelog.md"
  if [[ -f "$changelog_file" ]]; then
    changes=$(grep "^- " "$changelog_file" | head -3 | tr '\n' '; ' | cut -c1-100)
  else
    changes="(no changelog file)"
  fi

  top_issue=$(grep -A1 "Priority Fix" "$eval_file" 2>/dev/null | tail -1 | sed 's/^[0-9. ]*//' | cut -c1-80 || echo "N/A")

  append_progress "$i" "$score" "$changes" "$top_issue"
  echo "  Score: ${score}/100"

  # Git snapshot: eval
  cd "$REPO_ROOT"
  git add "${EVAL_DIR}/" "${PROGRESS_FILE}" 2>/dev/null || true
  git commit -m "feat(frontend): recipe-book recipe-picker v${i} eval — score ${score}/100" --allow-empty 2>/dev/null || true

  # ─── Exit conditions ───

  if [[ "$score" -ge "$SCORE_THRESHOLD" ]]; then
    echo ""
    echo "  Score threshold reached! (${score} >= ${SCORE_THRESHOLD})"
    break
  fi

  if [[ $prev_score -gt 0 && $score -lt $((prev_score - ROLLBACK_THRESHOLD)) ]]; then
    echo ""
    echo "  REGRESSION detected: ${prev_score} -> ${score} (delta < -${ROLLBACK_THRESHOLD}). Reverting."
    cd "$REPO_ROOT"
    git checkout HEAD~2 -- \
      solutions/business/recipe-book/frontend/ 2>/dev/null || true
    git add "solutions/business/recipe-book/frontend/" && \
    git commit -m "feat(frontend): recipe-book recipe-picker v${i} reverted — regression ${prev_score} to ${score}" 2>/dev/null || true
    continue
  fi

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
echo "  Artifact:  solutions/business/recipe-book/frontend/"
echo "  History:   git log --grep='recipe-picker' --oneline"
echo ""
echo "  Next steps:"
echo "    cat ${PROGRESS_FILE}"
echo "    cd solutions/business/recipe-book/frontend && npx tsc --noEmit"
echo "    cd solutions/business/recipe-book/frontend && npx vite build"
echo ""
