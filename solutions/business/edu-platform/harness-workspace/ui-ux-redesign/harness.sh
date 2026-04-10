#!/usr/bin/env bash
set -euo pipefail

# Allow nested claude -p invocations from within a Claude Code session
unset CLAUDECODE 2>/dev/null || true

# ─────────────────────────────────────────────────────────
# UI/UX Redesign — Harness Orchestrator
# ─────────────────────────────────────────────────────────
# Usage:
#   ./harness.sh              # Run from v0
#   ./harness.sh --resume     # Continue from last iteration
#   ./harness.sh --dry-run    # Show plan without running
#   ./harness.sh --max-cost 8 # Stop if estimated cost exceeds $8

HARNESS_DIR="$(cd "$(dirname "$0")" && pwd)"
SOLUTION_ROOT="$(cd "$HARNESS_DIR/../.." && pwd)"
PROJECT_ROOT="$(cd "$SOLUTION_ROOT/../../.." && pwd)"
EDU_FRONTEND="$SOLUTION_ROOT/frontend"
EDU_BACKEND="$SOLUTION_ROOT/backend"
CHAT_PKG="$PROJECT_ROOT/packages/chat-interface"
CORE_BACKEND="$PROJECT_ROOT/packages/backend"

# Config
MAX_ITERATIONS=8
TARGET_SCORE=95
DIMINISHING_THRESHOLD=3  # stop if improvement < this for 2 consecutive rounds
COST_PER_ITERATION=12.00  # rough estimate in USD (larger scope than widget-catalog)
ROLLBACK_THRESHOLD=10    # revert if score drops more than this

# Ports
CORE_BACKEND_PORT=3001
EDU_BACKEND_PORT=3011
EDU_FRONTEND_PORT=5290

# Auth credentials
AUTH_USERNAME="admin"
AUTH_PASSWORD="dev123"
AUTH_ENDPOINT="http://localhost:${CORE_BACKEND_PORT}/api/v1/auth/login"

EDU_AUTH_USERNAME="teacher"
EDU_AUTH_PASSWORD="teacher123"
EDU_AUTH_ENDPOINT="http://localhost:${EDU_BACKEND_PORT}/api/auth/login"

# Parse flags
RESUME=false
DRY_RUN=false
MAX_COST=120
while [[ $# -gt 0 ]]; do
  case $1 in
    --resume) RESUME=true; shift ;;
    --dry-run) DRY_RUN=true; shift ;;
    --max-cost) MAX_COST="$2"; shift 2 ;;
    *) echo "Unknown flag: $1"; exit 1 ;;
  esac
done

# ─────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────

log() { echo "[$(date '+%H:%M:%S')] $*"; }
err() { echo "[$(date '+%H:%M:%S')] ERROR: $*" >&2; }

extract_score() {
  local report="$1"
  local score
  score=$(grep -oE '(总分|Total): [0-9]+\.?[0-9]*/100' "$report" | tail -1 | grep -oE '[0-9]+\.?[0-9]*' | head -1)
  # Round to integer for comparison
  score=$(printf '%.0f' "${score:-0}")
  echo "${score:-0}"
}

get_last_version() {
  local last
  last=$(grep -oE '\| v[0-9]+' "$HARNESS_DIR/progress.md" | tail -1 | grep -oE '[0-9]+')
  echo "${last:-0}"
}

check_port() {
  nc -z localhost "$1" 2>/dev/null
}

check_edu_frontend() {
  for port in $(seq $EDU_FRONTEND_PORT $((EDU_FRONTEND_PORT + 10))); do
    if nc -z localhost "$port" 2>/dev/null; then
      EDU_FRONTEND_PORT=$port
      return 0
    fi
  done
  return 1
}

start_edu_backend() {
  log "Starting edu-platform backend on port $EDU_BACKEND_PORT..."
  if [[ ! -d "$EDU_BACKEND/dist" ]]; then
    log "Building edu-platform backend..."
    (cd "$EDU_BACKEND" && npm run build) || { err "Edu-platform backend build failed"; return 1; }
  fi

  cd "$EDU_BACKEND" && npm start &
  EDU_BACKEND_PID=$!

  for i in $(seq 1 30); do
    if check_port "$EDU_BACKEND_PORT"; then
      log "Edu-platform backend ready on port $EDU_BACKEND_PORT (PID: $EDU_BACKEND_PID)"
      return 0
    fi
    sleep 1
  done

  err "Edu-platform backend failed to start within 30s"
  kill $EDU_BACKEND_PID 2>/dev/null || true
  EDU_BACKEND_PID=""
  return 1
}

start_edu_frontend() {
  log "Starting edu-platform frontend (preferred port: $EDU_FRONTEND_PORT)..."
  cd "$EDU_FRONTEND" && npm run dev &
  EDU_FRONTEND_PID=$!

  for i in $(seq 1 30); do
    if check_edu_frontend; then
      log "Edu-platform frontend ready on port $EDU_FRONTEND_PORT (PID: $EDU_FRONTEND_PID)"
      return 0
    fi
    sleep 1
  done

  err "Edu-platform frontend failed to start within 30s"
  kill $EDU_FRONTEND_PID 2>/dev/null || true
  EDU_FRONTEND_PID=""
  return 1
}

start_core_backend() {
  log "Starting core backend on port $CORE_BACKEND_PORT..."
  cd "$CORE_BACKEND" && npm run start:dev &
  CORE_BACKEND_PID=$!

  for i in $(seq 1 60); do
    if check_port "$CORE_BACKEND_PORT"; then
      log "Core backend ready on port $CORE_BACKEND_PORT (PID: $CORE_BACKEND_PID)"
      return 0
    fi
    sleep 1
  done

  err "Core backend failed to start within 60s"
  kill $CORE_BACKEND_PID 2>/dev/null || true
  exit 1
}

CORE_API_KEY=""
verify_core_login() {
  local response
  response=$(curl -sf -X POST "$AUTH_ENDPOINT" \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"$AUTH_USERNAME\",\"password\":\"$AUTH_PASSWORD\"}" 2>/dev/null) || return 1
  CORE_API_KEY=$(echo "$response" | grep -o '"apiKey":"[^"]*"' | head -1 | cut -d'"' -f4)
  echo "$response" | grep -q '"apiKey"'
}

cleanup() {
  if [[ -n "${EDU_FRONTEND_PID:-}" ]]; then
    log "Stopping edu-platform frontend (PID: $EDU_FRONTEND_PID)..."
    kill $EDU_FRONTEND_PID 2>/dev/null || true
  fi
  if [[ -n "${EDU_BACKEND_PID:-}" ]]; then
    log "Stopping edu-platform backend (PID: $EDU_BACKEND_PID)..."
    kill $EDU_BACKEND_PID 2>/dev/null || true
  fi
  if [[ -n "${CORE_BACKEND_PID:-}" ]]; then
    log "Stopping core backend (PID: $CORE_BACKEND_PID)..."
    kill $CORE_BACKEND_PID 2>/dev/null || true
  fi
}
trap cleanup EXIT

# ─────────────────────────────────────────────────────────
# Pre-flight checks
# ─────────────────────────────────────────────────────────

log "=== UI/UX Redesign Harness ==="
log "Solution root: $SOLUTION_ROOT"
log "Max iterations: $MAX_ITERATIONS"
log "Target score: $TARGET_SCORE/100"
log "Max cost: \$$MAX_COST"

# Ensure required files exist
for f in SPEC.md EVAL_CRITERIA.md prompts/generator.md prompts/evaluator.md progress.md; do
  if [[ ! -f "$HARNESS_DIR/$f" ]]; then
    err "Missing required file: $f"
    exit 1
  fi
done

# Ensure output directories exist
mkdir -p "$HARNESS_DIR/eval-reports" "$HARNESS_DIR/changelogs" "$HARNESS_DIR/screenshots"

# Check claude CLI
if ! command -v claude &>/dev/null; then
  err "claude CLI not found. Install: https://docs.anthropic.com/claude-code"
  exit 1
fi

# Determine starting version
if $RESUME; then
  VERSION=$(get_last_version)
  log "Resuming from v$VERSION"
else
  VERSION=0
  log "Starting fresh from v0"
fi

if $DRY_RUN; then
  log ""
  log "[DRY RUN] Would run up to $MAX_ITERATIONS iterations"
  log "[DRY RUN] Core backend: localhost:$CORE_BACKEND_PORT"
  log "[DRY RUN] Edu backend: localhost:$EDU_BACKEND_PORT"
  log "[DRY RUN] Edu frontend: localhost:$EDU_FRONTEND_PORT"
  log "[DRY RUN] Generator: claude -p → modifies UI code to match HTML prototypes"
  log "[DRY RUN] Pre-gate: tsc --noEmit (frontend + chat-interface)"
  log "[DRY RUN] Evaluator: claude -p → reads code + screenshots → scores vs prototypes"
  log "[DRY RUN] Estimated cost: ~\$$(echo "$MAX_ITERATIONS * $COST_PER_ITERATION" | bc)"
  log "[DRY RUN] Estimated time: ~$(echo "$MAX_ITERATIONS * 15" | bc) minutes"
  exit 0
fi

# ─────────────────────────────────────────────────────────
# Start services
# ─────────────────────────────────────────────────────────

# Core backend
CORE_BACKEND_PID=""
if check_port "$CORE_BACKEND_PORT"; then
  log "Core backend already running on port $CORE_BACKEND_PORT"
else
  start_core_backend
fi

# Core backend auth
CORE_AUTH_OK=false
if verify_core_login; then
  CORE_AUTH_OK=true
  log "Core backend auth: PASS"
else
  log "WARNING: Core backend auth FAILED — continuing without auth"
fi

# Safety-net: import solution config into Core Backend
if $CORE_AUTH_OK && [[ -n "$CORE_API_KEY" ]]; then
  log "Importing edu-platform solution into core backend..."
  if curl -sf -X POST "http://localhost:${CORE_BACKEND_PORT}/api/v1/admin/solutions/import" \
    -H "x-api-key: $CORE_API_KEY" \
    -H "Content-Type: application/json" \
    -d @"$SOLUTION_ROOT/solution.json" >/dev/null 2>&1; then
    log "Solution import: OK"
  else
    log "WARNING: Solution import failed (non-fatal)"
  fi
fi

# Edu backend
EDU_BACKEND_PID=""
EDU_BACKEND_OK=false
if check_port "$EDU_BACKEND_PORT"; then
  log "Edu backend already running on port $EDU_BACKEND_PORT"
  EDU_BACKEND_OK=true
elif [[ -d "$EDU_BACKEND" ]]; then
  if start_edu_backend; then
    EDU_BACKEND_OK=true
  fi
fi

# Edu frontend
EDU_FRONTEND_PID=""
EDU_FRONTEND_OK=false
if check_edu_frontend; then
  log "Edu frontend already running on port $EDU_FRONTEND_PORT"
  EDU_FRONTEND_OK=true
elif [[ -d "$EDU_FRONTEND" ]]; then
  if start_edu_frontend; then
    EDU_FRONTEND_OK=true
  fi
fi

# ─────────────────────────────────────────────────────────
# Playwright tools
# ─────────────────────────────────────────────────────────

PLAYWRIGHT_TOOLS="mcp__playwright__browser_navigate,mcp__playwright__browser_take_screenshot,mcp__playwright__browser_snapshot,mcp__playwright__browser_click,mcp__playwright__browser_resize,mcp__playwright__browser_press_key,mcp__playwright__browser_type,mcp__playwright__browser_fill_form,mcp__playwright__browser_tabs,mcp__playwright__browser_evaluate,mcp__playwright__browser_wait_for"

# ─────────────────────────────────────────────────────────
# Auth & env context for prompts
# ─────────────────────────────────────────────────────────

EDU_CONTEXT=""
if $EDU_FRONTEND_OK && $EDU_BACKEND_OK; then
  EDU_CONTEXT="
## Edu-Platform 环境（已启动）
- Frontend: http://localhost:$EDU_FRONTEND_PORT
- Backend: http://localhost:$EDU_BACKEND_PORT
- Core Backend: http://localhost:$CORE_BACKEND_PORT
- 登录方式: 在浏览器 console 中:
  \`\`\`javascript
  const res = await fetch('http://localhost:$EDU_BACKEND_PORT/api/auth/login', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({username:'$EDU_AUTH_USERNAME',password:'$EDU_AUTH_PASSWORD'})
  });
  const data = await res.json();
  localStorage.setItem('edu-jwt', data.token);
  localStorage.setItem('edu-ccaas-key', data.ccaasApiKey);
  localStorage.setItem('edu-user', JSON.stringify(data.user));
  location.reload();
  \`\`\`"
else
  EDU_CONTEXT="
## Edu-Platform 环境
- ⚠️ Edu-platform 未完全启动，仅做代码分析评估"
fi

# ─────────────────────────────────────────────────────────
# Revert files list (for rollback on tsc failure or score drop)
# ─────────────────────────────────────────────────────────

REVERT_PATHS=(
  "solutions/business/edu-platform/frontend/src/App.tsx"
  "solutions/business/edu-platform/frontend/src/index.css"
  "solutions/business/edu-platform/frontend/src/widget-registry.ts"
  "solutions/business/edu-platform/frontend/src/widgets/"
  "solutions/business/edu-platform/frontend/src/hooks/"
  "packages/chat-interface/src/components/"
  "packages/chat-interface/tailwind.config.js"
  "packages/chat-interface/src/types/"
  "packages/chat-interface/src/index.ts"
)

# ─────────────────────────────────────────────────────────
# Main loop
# ─────────────────────────────────────────────────────────

PREV_SCORE=0
STALL_COUNT=0

while true; do
  VERSION=$((VERSION + 1))
  TIMESTAMP=$(date '+%Y-%m-%d %H:%M')

  log ""
  log "════════════════════════════════════════"
  log "  Iteration v$VERSION — $TIMESTAMP"
  log "════════════════════════════════════════"

  # --- Cost check ---
  ESTIMATED_COST=$(echo "$VERSION * $COST_PER_ITERATION" | bc)
  if (( $(echo "$ESTIMATED_COST > $MAX_COST" | bc -l) )); then
    log "Cost cap reached (~\$$ESTIMATED_COST > \$$MAX_COST). Stopping."
    break
  fi

  # --- Max iterations check ---
  if [[ $VERSION -gt $MAX_ITERATIONS ]]; then
    log "Max iterations ($MAX_ITERATIONS) reached. Stopping."
    break
  fi

  # --- Create output dirs ---
  mkdir -p "$HARNESS_DIR/screenshots/v$VERSION"

  # --- Prepare last eval path ---
  PREV_VERSION=$((VERSION - 1))
  LAST_EVAL="$HARNESS_DIR/eval-reports/v${PREV_VERSION}-eval.md"
  CHANGELOG_PATH="$HARNESS_DIR/changelogs/v${VERSION}-changelog.md"
  EVAL_REPORT="$HARNESS_DIR/eval-reports/v${VERSION}-eval.md"

  LAST_EVAL_CONTEXT=""
  if [[ -f "$LAST_EVAL" ]]; then
    LAST_EVAL_CONTEXT="
3. 读上一轮评估报告: $LAST_EVAL — 重点看扣分项和 Top 3 改进建议"
  else
    LAST_EVAL_CONTEXT="
3. (第一轮，无上轮 eval report)"
  fi

  # ─── Step 1: Generator ───
  log "[v$VERSION] Running Generator agent..."

  GENERATOR_PROMPT="你是 UI/UX Redesign 的 Generator agent。这是第 $VERSION 轮迭代。

**关键**: 你运行在 fresh context 中，没有前几轮的记忆。磁盘上的文件是你的唯一上下文。
${EDU_CONTEXT}

请严格按顺序执行：

1. 读任务规范: $HARNESS_DIR/SPEC.md
2. 读历史记录: $HARNESS_DIR/progress.md${LAST_EVAL_CONTEXT}
4. 读 HTML 原型（视觉标准）:
   - $HARNESS_DIR/prototypes/components/chat-full-layout.html
   - $HARNESS_DIR/prototypes/components/message-bubbles.html
   - $HARNESS_DIR/prototypes/components/tool-usage-group.html
   - $HARNESS_DIR/prototypes/components/session-input-suggestions.html
   - $HARNESS_DIR/prototypes/components/step-wizard.html
   - $HARNESS_DIR/prototypes/components/review-panel.html
   - $HARNESS_DIR/prototypes/components/metric-dashboard.html
   - $HARNESS_DIR/prototypes/components/file-card-actions.html
5. 读现有代码:
   - $EDU_FRONTEND/src/App.tsx
   - $EDU_FRONTEND/src/index.css
   - $EDU_FRONTEND/src/widget-registry.ts
   - $EDU_FRONTEND/src/widgets/ (所有文件)
6. 读 chat-interface 组件:
   - $CHAT_PKG/src/components/ChatSidebar.tsx
   - $CHAT_PKG/src/components/MessageRenderer.tsx
   - $CHAT_PKG/src/components/ToolGroup.tsx
   - $CHAT_PKG/src/components/ToolActivityBlock.tsx
   - $CHAT_PKG/src/components/chat/ChatInterfaceComposer.tsx
   - $CHAT_PKG/src/components/chat/ChatInterfaceEmptyState.tsx
   - $CHAT_PKG/tailwind.config.js

然后：
7. 制定本轮改进计划（优先修复 eval 中扣分最多的项）
8. 修改代码
9. 运行验证:
    cd $EDU_FRONTEND && npx tsc --noEmit
    cd $CHAT_PKG && npx tsc --noEmit
10. **必须**将 changelog 写入: ${CHANGELOG_PATH}

完整指南: $HARNESS_DIR/prompts/generator.md"

  GENERATOR_TOOLS="Read,Edit,Write,Glob,Grep,Bash,${PLAYWRIGHT_TOOLS}"

  if ! echo "$GENERATOR_PROMPT" | claude -p \
    --allowedTools "$GENERATOR_TOOLS" \
    > "$HARNESS_DIR/changelogs/v${VERSION}-generator-output.txt" 2>&1; then

    err "[v$VERSION] Generator failed. Retrying once..."
    if ! echo "$GENERATOR_PROMPT" | claude -p \
      --allowedTools "$GENERATOR_TOOLS" \
      > "$HARNESS_DIR/changelogs/v${VERSION}-generator-output-retry.txt" 2>&1; then

      err "[v$VERSION] Generator failed on retry. Logging and continuing."
      echo "| v$VERSION | $TIMESTAMP | FAIL | - | - | - | - | - | - | Generator agent failed |" >> "$HARNESS_DIR/progress.md"
      continue
    fi
  fi

  log "[v$VERSION] Generator complete."

  if [[ ! -f "$CHANGELOG_PATH" ]]; then
    log "[v$VERSION] WARNING: Generator did not write changelog to $CHANGELOG_PATH"
  fi

  # ─── Step 2: Pre-gate checks ───
  log "[v$VERSION] Running pre-gate: tsc --noEmit..."

  TOOL_PASS=true
  if ! (cd "$EDU_FRONTEND" && npx tsc --noEmit 2>"$HARNESS_DIR/eval-reports/v${VERSION}-tsc-errors.txt"); then
    err "[v$VERSION] Frontend tsc --noEmit FAILED"
    TOOL_PASS=false
  fi

  if $TOOL_PASS && ! (cd "$CHAT_PKG" && npx tsc --noEmit 2>>"$HARNESS_DIR/eval-reports/v${VERSION}-tsc-errors.txt"); then
    err "[v$VERSION] Chat-interface tsc --noEmit FAILED"
    TOOL_PASS=false
  fi

  if ! $TOOL_PASS; then
    log "[v$VERSION] tsc failed — scoring as 0, reverting changes."
    for rp in "${REVERT_PATHS[@]}"; do
      (cd "$PROJECT_ROOT" && git checkout -- "$rp" 2>/dev/null || true)
    done
    echo "| v$VERSION | $TIMESTAMP | 0 | - | - | - | - | - | -100 | tsc --noEmit failure — reverted |" >> "$HARNESS_DIR/progress.md"
    continue
  fi

  log "[v$VERSION] tsc --noEmit: PASS"

  # ─── Step 2b: Git snapshot ───
  log "[v$VERSION] Creating git snapshot..."
  (cd "$PROJECT_ROOT" && \
    git add \
      solutions/business/edu-platform/frontend/src/ \
      packages/chat-interface/src/components/ \
      packages/chat-interface/src/types/ \
      packages/chat-interface/src/index.ts \
      packages/chat-interface/tailwind.config.js \
      2>/dev/null; \
    git commit -m "feat(frontend): ui-ux-redesign harness v$VERSION iteration" -q 2>/dev/null) || \
    log "[v$VERSION] WARNING: git commit failed (no changes or git issue)"

  # ─── Step 2c: Pre-flight health check for evaluator ───
  log "[v$VERSION] Running pre-flight health check for browser verification..."

  BROWSER_VERIFY_AVAILABLE=false
  if check_port "$EDU_FRONTEND_PORT" && check_port "$CORE_BACKEND_PORT" && check_port "$EDU_BACKEND_PORT"; then
    if curl -sf "http://localhost:$EDU_FRONTEND_PORT" -o /dev/null 2>/dev/null; then
      BROWSER_VERIFY_AVAILABLE=true
      log "[v$VERSION] Pre-flight: All services reachable — browser verification ENABLED"
    else
      log "[v$VERSION] Pre-flight: Frontend port open but not serving — browser verification DISABLED"
    fi
  else
    log "[v$VERSION] Pre-flight: Not all ports reachable — browser verification DISABLED"
  fi

  BROWSER_CONTEXT=""
  if $BROWSER_VERIFY_AVAILABLE; then
    BROWSER_CONTEXT="
## 浏览器验证状态
- **ENABLED** — 所有服务已启动，MUST perform browser verification.
- Frontend: http://localhost:$EDU_FRONTEND_PORT
- Core Backend: http://localhost:$CORE_BACKEND_PORT
- Edu Backend: http://localhost:$EDU_BACKEND_PORT"
  else
    BROWSER_CONTEXT="
## 浏览器验证状态
- **DISABLED** — 部分服务未启动。D1-D4 max 3/5 due to inability to verify runtime rendering."
  fi

  # ─── Step 3: Evaluator ───
  log "[v$VERSION] Running Evaluator agent..."

  EVALUATOR_PROMPT="你是 UI/UX Redesign 质量的独立 Evaluator agent。这是第 $VERSION 轮迭代的评估。
${EDU_CONTEXT}
${BROWSER_CONTEXT}

请按照以下步骤执行：

1. 读评分标准: $HARNESS_DIR/EVAL_CRITERIA.md
2. 读任务规范: $HARNESS_DIR/SPEC.md
3. 读 HTML 原型（视觉标准）:
   - $HARNESS_DIR/prototypes/components/chat-full-layout.html
   - $HARNESS_DIR/prototypes/components/message-bubbles.html
   - $HARNESS_DIR/prototypes/components/tool-usage-group.html
   - $HARNESS_DIR/prototypes/components/step-wizard.html
   - $HARNESS_DIR/prototypes/components/review-panel.html
   - $HARNESS_DIR/prototypes/components/metric-dashboard.html
   - $HARNESS_DIR/prototypes/components/file-card-actions.html
4. 读现有代码 (edu-platform + chat-interface 组件)
5. 运行代码分析 + frozen file 检查
6. 逐维度评分 + penalty 检查
7. 汇总分数，输出 eval report

将完整报告写入: $EVAL_REPORT

**关键**：报告最后一行必须是 \`总分: XX/100\`

完整的 Evaluator 指南在: $HARNESS_DIR/prompts/evaluator.md"

  EVALUATOR_TOOLS="Read,Write,Glob,Grep,Bash,${PLAYWRIGHT_TOOLS}"

  if ! echo "$EVALUATOR_PROMPT" | claude -p \
    --allowedTools "$EVALUATOR_TOOLS" \
    > "$HARNESS_DIR/eval-reports/v${VERSION}-evaluator-output.txt" 2>&1; then

    err "[v$VERSION] Evaluator failed. Logging with score 0."
    echo "| v$VERSION | $TIMESTAMP | 0 | - | - | - | - | - | 0 | Evaluator agent failed |" >> "$HARNESS_DIR/progress.md"
    continue
  fi

  log "[v$VERSION] Evaluator complete."

  # ─── Step 4: Extract score and update progress ───
  if [[ ! -f "$EVAL_REPORT" ]]; then
    err "[v$VERSION] Eval report not found at $EVAL_REPORT"
    echo "| v$VERSION | $TIMESTAMP | ? | - | - | - | - | - | - | Eval report missing |" >> "$HARNESS_DIR/progress.md"
    continue
  fi

  SCORE=$(extract_score "$EVAL_REPORT")
  log "[v$VERSION] Score: $SCORE/100"

  # Extract per-dimension scores
  D1=$(grep -oE 'D1 布局.*[0-9]/5\|D1 Layout.*[0-9]/5' "$EVAL_REPORT" | grep -oE '[0-9]/5' | head -1 || echo "?")
  D2=$(grep -oE 'D2 Landing.*[0-9]/5' "$EVAL_REPORT" | grep -oE '[0-9]/5' | head -1 || echo "?")
  D3=$(grep -oE 'D3 消息.*[0-9]/5\|D3 Message.*[0-9]/5' "$EVAL_REPORT" | grep -oE '[0-9]/5' | head -1 || echo "?")
  D4=$(grep -oE 'D4 Widget.*[0-9]/5' "$EVAL_REPORT" | grep -oE '[0-9]/5' | head -1 || echo "?")
  D5=$(grep -oE 'D5.*[0-9]/5' "$EVAL_REPORT" | grep -oE '[0-9]/5' | head -1 || echo "?")
  PENALTIES=$(grep -oE 'Penalty 小计.*-[0-9]+' "$EVAL_REPORT" | grep -oE '-[0-9]+' | head -1 || echo "0")

  TOP_ISSUE=$(grep -A2 'Top 3\|未解决问题' "$EVAL_REPORT" | grep '^\s*1\.' | sed 's/^\s*1\.\s*//' | head -c 80 || echo "see eval report")
  if [[ -z "$TOP_ISSUE" ]]; then
    TOP_ISSUE="see eval-reports/v${VERSION}-eval.md"
  fi

  echo "| v$VERSION | $TIMESTAMP | $SCORE | $D1 | $D2 | $D3 | $D4 | $D5 | $PENALTIES | $TOP_ISSUE |" >> "$HARNESS_DIR/progress.md"

  # ─── Step 4b: Commit eval results ───
  (cd "$HARNESS_DIR" && \
    git add -A eval-reports/ changelogs/ screenshots/ progress.md 2>/dev/null && \
    git commit -m "docs(edu-platform): ui-ux-redesign harness v$VERSION eval score $SCORE" -q 2>/dev/null) || true

  # ─── Step 5: Check exit conditions ───

  # 5a. Target score reached
  if [[ $SCORE -ge $TARGET_SCORE ]]; then
    log ""
    log "Target score reached! ($SCORE >= $TARGET_SCORE)"
    log "Harness complete after $VERSION iterations."
    break
  fi

  # 5b. Rollback check (score dropped significantly)
  if [[ $PREV_SCORE -gt 0 ]]; then
    DROP=$((PREV_SCORE - SCORE))
    if [[ $DROP -gt $ROLLBACK_THRESHOLD ]]; then
      log "[v$VERSION] Score dropped by $DROP (> $ROLLBACK_THRESHOLD). Rolling back..."
      for rp in "${REVERT_PATHS[@]}"; do
        git checkout HEAD~1 -- "$PROJECT_ROOT/$rp" 2>/dev/null || true
      done
      log "[v$VERSION] Code rolled back to v$((VERSION - 1))"
    fi
  fi

  # 5c. Diminishing returns
  if [[ $PREV_SCORE -gt 0 ]]; then
    IMPROVEMENT=$((SCORE - PREV_SCORE))
    if [[ $IMPROVEMENT -lt $DIMINISHING_THRESHOLD ]]; then
      STALL_COUNT=$((STALL_COUNT + 1))
      log "[v$VERSION] Low improvement: +$IMPROVEMENT (stall count: $STALL_COUNT/2)"
      if [[ $STALL_COUNT -ge 2 ]]; then
        log ""
        log "Diminishing returns (2 consecutive rounds < +$DIMINISHING_THRESHOLD). Stopping."
        log "Final score: $SCORE/100 after $VERSION iterations."
        break
      fi
    else
      STALL_COUNT=0
    fi
  fi

  PREV_SCORE=$SCORE

  log "[v$VERSION] Score: $SCORE/100 — continuing to next iteration..."
done

# ─────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────

log ""
log "════════════════════════════════════════"
log "  Harness Complete"
log "════════════════════════════════════════"
log "Iterations: $VERSION"
log "Final score: ${SCORE:-N/A}/100"
log ""
log "Review:"
log "  progress.md      — score trajectory"
log "  eval-reports/    — detailed per-version evaluations"
log "  changelogs/      — what changed each iteration"
log "  screenshots/     — visual snapshots per iteration"
log ""
log "Git history (each iteration is a commit):"
log "  git log --oneline --grep='ui-ux-redesign harness'"
