#!/usr/bin/env bash
set -eu

# Allow nested claude -p invocations from within a Claude Code session
unset CLAUDECODE 2>/dev/null || true

# ─────────────────────────────────────────────────────────
# AskUserQuestion Wizard — Harness Orchestrator
# ─────────────────────────────────────────────────────────
# Usage:
#   ./harness.sh              # Run from v0
#   ./harness.sh --resume     # Continue from last iteration
#   ./harness.sh --dry-run    # Show plan without running
#   ./harness.sh --max-cost 8 # Stop if estimated cost exceeds $8

HARNESS_DIR="$(cd "$(dirname "$0")" && pwd)"
HARNESS_ROOT="$(cd "$HARNESS_DIR/.." && pwd)"
SOLUTION_ROOT="$(cd "$HARNESS_ROOT/.." && pwd)"
PROJECT_ROOT="$(cd "$SOLUTION_ROOT/../../.." && pwd)"
EDU_FRONTEND="$SOLUTION_ROOT/frontend"
EDU_BACKEND="$SOLUTION_ROOT/backend"
CORE_BACKEND="$PROJECT_ROOT/packages/backend"
CHAT_INTERFACE="$PROJECT_ROOT/packages/chat-interface"

# Config
MAX_ITERATIONS=8
TARGET_SCORE=90
DIMINISHING_THRESHOLD=3
COST_PER_ITERATION=10.00
ROLLBACK_THRESHOLD=10

# Ports
CORE_BACKEND_PORT=3001
EDU_BACKEND_PORT=3011
EDU_FRONTEND_PORT=5290

# Auth credentials
EDU_AUTH_USERNAME="teacher"
EDU_AUTH_PASSWORD="teacher123"
EDU_AUTH_ENDPOINT="http://localhost:${EDU_BACKEND_PORT}/api/auth/login"

CORE_AUTH_USERNAME="admin"
CORE_AUTH_PASSWORD="dev123"
CORE_AUTH_ENDPOINT="http://localhost:${CORE_BACKEND_PORT}/api/v1/auth/login"

# Parse flags
RESUME=false
DRY_RUN=false
MAX_COST=80
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
  CORE_BACKEND_PID=""
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
  # Build chat-interface first (wizard components need to be compiled)
  log "Building chat-interface..."
  (cd "$CHAT_INTERFACE" && npm run build) || { err "Chat-interface build failed"; return 1; }
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

CORE_API_KEY=""
verify_core_login() {
  local response
  response=$(curl -sf -X POST "$CORE_AUTH_ENDPOINT" \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"$CORE_AUTH_USERNAME\",\"password\":\"$CORE_AUTH_PASSWORD\"}" 2>/dev/null) || return 1
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

log "=== AskUserQuestion Wizard Harness ==="
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
  log "[DRY RUN] Generator: claude -p → modifies wizard components + browser verify"
  log "[DRY RUN] Pre-gate: tsc --noEmit (backend + chat-interface + edu-frontend)"
  log "[DRY RUN] Evaluator: claude -p → reads code + browser interaction → scores"
  log "[DRY RUN] Estimated cost: ~\$$(echo "$MAX_ITERATIONS * $COST_PER_ITERATION" | bc)"

  log ""
  log "[DRY RUN] Validation checks:"

  # Check tsc
  log "[DRY RUN]   Backend tsc check..."
  if (cd "$CORE_BACKEND" && npx tsc --noEmit 2>/dev/null); then
    log "[DRY RUN]   Backend tsc: PASS"
  else
    log "[DRY RUN]   Backend tsc: FAIL"
  fi

  log "[DRY RUN]   Chat-interface tsc check..."
  if (cd "$CHAT_INTERFACE" && npx tsc --noEmit 2>/dev/null); then
    log "[DRY RUN]   Chat-interface tsc: PASS"
  else
    log "[DRY RUN]   Chat-interface tsc: FAIL"
  fi

  # Check ports
  for port in $CORE_BACKEND_PORT $EDU_BACKEND_PORT; do
    if check_port "$port"; then
      log "[DRY RUN]   Port $port: IN USE"
    else
      log "[DRY RUN]   Port $port: FREE"
    fi
  done

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

# Core backend auth + solution import
CORE_AUTH_OK=false
if verify_core_login; then
  CORE_AUTH_OK=true
  log "Core backend auth: PASS"
else
  log "WARNING: Core backend auth FAILED — continuing without auth"
fi

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
- Frontend: http://localhost:${EDU_FRONTEND_PORT}
- Backend: http://localhost:${EDU_BACKEND_PORT}
- Core Backend: http://localhost:${CORE_BACKEND_PORT}
- 登录方式: 在浏览器 console 中执行:
  \`\`\`javascript
  const res = await fetch('http://localhost:${EDU_BACKEND_PORT}/api/auth/login', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({username:'${EDU_AUTH_USERNAME}',password:'${EDU_AUTH_PASSWORD}'})
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
- WARNING: Edu-platform 未完全启动，无法进行浏览器验证"
fi

# ─────────────────────────────────────────────────────────
# Key source files for generators/evaluators
# ─────────────────────────────────────────────────────────

WIZARD_FILES="
- WizardRenderer: ${CHAT_INTERFACE}/src/components/wizard/WizardRenderer.tsx
- FormStep: ${CHAT_INTERFACE}/src/components/wizard/steps/FormStep.tsx
- TreeSelectStep: ${CHAT_INTERFACE}/src/components/wizard/steps/TreeSelectStep.tsx
- DataReviewStep: ${CHAT_INTERFACE}/src/components/wizard/steps/DataReviewStep.tsx
- SummaryStep: ${CHAT_INTERFACE}/src/components/wizard/steps/SummaryStep.tsx
- Wizard types: ${CHAT_INTERFACE}/src/components/wizard/types.ts
- Wizard registry: ${CHAT_INTERFACE}/src/components/wizard/registry.ts
- AskUserQuestionRenderer: ${EDU_FRONTEND}/src/components/AskUserQuestionRenderer.tsx
- Lesson-plan wizard: ${EDU_FRONTEND}/src/wizards/lesson-plan.wizard.ts
- EventMapper: ${CORE_BACKEND}/src/sessions/event-mapper.service.ts
- CliProcessService: ${CORE_BACKEND}/src/sessions/services/cli-process.service.ts
- SessionsController: ${CORE_BACKEND}/src/sessions/sessions.controller.ts"

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

  # --- Prepare paths ---
  PREV_VERSION=$((VERSION - 1))
  LAST_EVAL="$HARNESS_DIR/eval-reports/v${PREV_VERSION}-eval.md"
  CHANGELOG_PATH="$HARNESS_DIR/changelogs/v${VERSION}-changelog.md"
  EVAL_REPORT="$HARNESS_DIR/eval-reports/v${VERSION}-eval.md"

  LAST_EVAL_CONTEXT=""
  if [[ -f "$LAST_EVAL" ]]; then
    LAST_EVAL_CONTEXT="
4. 读上一轮评估报告: $LAST_EVAL — 重点看扣分项和改进建议"
  else
    LAST_EVAL_CONTEXT="
4. (第一轮，无上轮 eval report)"
  fi

  # ─── Step 1: Generator ───
  log "[v$VERSION] Running Generator agent..."

  GENERATOR_PROMPT="你是 AskUserQuestion Wizard 的 Generator agent。这是第 ${VERSION} 轮迭代。

**关键**: 你运行在 fresh context 中，没有前几轮的记忆。磁盘上的文件是你的唯一上下文。
${EDU_CONTEXT}

## 关键源文件
${WIZARD_FILES}

请严格按顺序执行：

1. 读任务规范: ${HARNESS_DIR}/SPEC.md
2. 读评分标准: ${HARNESS_DIR}/EVAL_CRITERIA.md
3. 读历史记录: ${HARNESS_DIR}/progress.md
${LAST_EVAL_CONTEXT}
5. 读当前源代码（按上面的关键源文件列表）
6. 读 Generator 完整指南: ${HARNESS_DIR}/prompts/generator.md

然后：
7. 分析上轮扣分（如有），制定本轮改进计划（每轮只修 1-2 个最大扣分项）
8. 实施修改（严格遵守 SPEC.md 可修改文件范围）
9. Pre-gate 验证:
   - cd ${CORE_BACKEND} && npx tsc --noEmit
   - cd ${CHAT_INTERFACE} && npx tsc --noEmit
   - cd ${CHAT_INTERFACE} && npm run build
   - cd ${EDU_FRONTEND} && npx tsc --noEmit
10. **浏览器验证（MANDATORY）**: 如果 Playwright 工具可用：
    a. 打开 http://localhost:${EDU_FRONTEND_PORT}
    b. 登录教师
    c. 发消息触发 AskUserQuestion（如 \"帮我备课\"）
    d. 截图每个 wizard 步骤 → 保存到 ${HARNESS_DIR}/screenshots/v${VERSION}/
    e. 完成 4 步向导并提交
    f. 截图提交后 LLM 恢复的响应
    g. 如发现问题立即修复并重新验证
11. **必须**将 changelog 写入: ${CHANGELOG_PATH}"

  GENERATOR_TOOLS="Read,Edit,Write,Glob,Grep,Bash,${PLAYWRIGHT_TOOLS}"

  # Heartbeat: monitor claude -p progress in background
  log "[v$VERSION] Generator started (expected ~10-15min)..."
  echo "$GENERATOR_PROMPT" | claude -p \
    --allowedTools "$GENERATOR_TOOLS" \
    > "$HARNESS_DIR/changelogs/v${VERSION}-generator-output.txt" 2>&1 &
  CLAUDE_PID=$!

  # Heartbeat loop: log progress every 30s while claude -p runs
  HEARTBEAT=0
  while kill -0 $CLAUDE_PID 2>/dev/null; do
    sleep 30
    HEARTBEAT=$((HEARTBEAT + 1))
    OUT_SIZE=$(wc -c < "$HARNESS_DIR/changelogs/v${VERSION}-generator-output.txt" 2>/dev/null || echo 0)
    CHANGELOG_EXISTS="no"
    [[ -f "$CHANGELOG_PATH" ]] && CHANGELOG_EXISTS="yes ($(wc -c < "$CHANGELOG_PATH") bytes)"
    log "[v$VERSION] Generator heartbeat #${HEARTBEAT} (${HEARTBEAT}x30s) — output=${OUT_SIZE}b changelog=${CHANGELOG_EXISTS}"
  done
  wait $CLAUDE_PID
  CLAUDE_EXIT=$?

  if [[ $CLAUDE_EXIT -ne 0 ]]; then
    err "[v$VERSION] Generator failed (exit=$CLAUDE_EXIT). Retrying once..."
    echo "$GENERATOR_PROMPT" | claude -p \
      --allowedTools "$GENERATOR_TOOLS" \
      > "$HARNESS_DIR/changelogs/v${VERSION}-generator-output-retry.txt" 2>&1
    if [[ $? -ne 0 ]]; then
      err "[v$VERSION] Generator failed on retry. Logging and continuing."
      echo "| v$VERSION | $TIMESTAMP | FAIL | - | - | - | - | - | - | - | Generator agent failed |" >> "$HARNESS_DIR/progress.md"
      continue
    fi
  fi

  log "[v$VERSION] Generator complete ($(wc -c < "$HARNESS_DIR/changelogs/v${VERSION}-generator-output.txt") bytes output)."

  if [[ ! -f "$CHANGELOG_PATH" ]]; then
    log "[v$VERSION] WARNING: Generator did not write changelog to $CHANGELOG_PATH"
  fi

  # ─── Step 2: Pre-gate check ───
  log "[v$VERSION] Running pre-gate: tsc --noEmit + jest..."

  TSC_PASS=true

  if ! (cd "$CORE_BACKEND" && npx tsc --noEmit 2>"$HARNESS_DIR/eval-reports/v${VERSION}-backend-tsc-errors.txt"); then
    TSC_PASS=false
    err "[v$VERSION] Backend tsc --noEmit FAILED"
  fi

  if $TSC_PASS && ! (cd "$CHAT_INTERFACE" && npx tsc --noEmit 2>"$HARNESS_DIR/eval-reports/v${VERSION}-chat-tsc-errors.txt"); then
    TSC_PASS=false
    err "[v$VERSION] Chat-interface tsc --noEmit FAILED"
  fi

  if $TSC_PASS; then
    # Rebuild chat-interface for edu-frontend to consume
    (cd "$CHAT_INTERFACE" && npm run build 2>/dev/null) || true
  fi

  if $TSC_PASS && ! (cd "$EDU_FRONTEND" && npx tsc --noEmit 2>"$HARNESS_DIR/eval-reports/v${VERSION}-frontend-tsc-errors.txt"); then
    TSC_PASS=false
    err "[v$VERSION] Edu-frontend tsc --noEmit FAILED"
  fi

  if ! $TSC_PASS; then
    log "[v$VERSION] tsc failed — scoring as 0, reverting changes."
    (cd "$PROJECT_ROOT" && git checkout -- \
      "$CHAT_INTERFACE/src/components/wizard/" \
      "$EDU_FRONTEND/src/components/AskUserQuestionRenderer.tsx" \
      "$CORE_BACKEND/src/sessions/event-mapper.service.ts" \
      "$CORE_BACKEND/src/sessions/services/cli-process.service.ts" \
      2>/dev/null || true)
    echo "| v$VERSION | $TIMESTAMP | 0 | - | - | - | - | - | - | -100 | tsc --noEmit failure — reverted |" >> "$HARNESS_DIR/progress.md"
    continue
  fi

  log "[v$VERSION] tsc --noEmit: PASS (all packages)"

  # ─── Step 2b: Backend tests ───
  log "[v$VERSION] Running backend tests..."
  JEST_PASS=true
  if ! (cd "$CORE_BACKEND" && npx jest --no-coverage 2>"$HARNESS_DIR/eval-reports/v${VERSION}-jest-errors.txt" | tail -5); then
    JEST_PASS=false
    err "[v$VERSION] Backend jest FAILED"
  fi

  # ─── Step 2c: Git snapshot ───
  log "[v$VERSION] Creating git snapshot..."
  (cd "$PROJECT_ROOT" && \
    git add \
      "$CHAT_INTERFACE/src/components/wizard/" \
      "$EDU_FRONTEND/src/components/AskUserQuestionRenderer.tsx" \
      "$EDU_FRONTEND/src/wizards/" \
      "$EDU_FRONTEND/src/App.tsx" \
      "$CORE_BACKEND/src/sessions/event-mapper.service.ts" \
      "$CORE_BACKEND/src/sessions/services/cli-process.service.ts" \
      "$CORE_BACKEND/src/sessions/sessions.controller.ts" \
      2>/dev/null && \
    git commit -m "feat(edu-platform): ask-user-question wizard harness v$VERSION" -q 2>/dev/null) || \
    log "[v$VERSION] WARNING: git commit failed (no changes or git issue)"

  # ─── Step 2d: Pre-flight health check ───
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
- **ENABLED** — 所有服务已启动，MUST perform browser verification with screenshots and interaction.
- Frontend: http://localhost:${EDU_FRONTEND_PORT}
${EDU_CONTEXT}"
  else
    BROWSER_CONTEXT="
## 浏览器验证状态
- **DISABLED** — 服务未完全启动。D1/D6 max 2/5。仅做静态代码分析。"
  fi

  # ─── Step 3: Evaluator ───
  log "[v$VERSION] Running Evaluator agent..."

  EVALUATOR_PROMPT="你是 AskUserQuestion Wizard 的 Evaluator agent。这是 v${VERSION} 轮评估。
${BROWSER_CONTEXT}

## 关键源文件
${WIZARD_FILES}

请严格按顺序执行：

1. 读任务规范: ${HARNESS_DIR}/SPEC.md
2. 读评分标准: ${HARNESS_DIR}/EVAL_CRITERIA.md — **你必须严格按此标准评分**
3. 读本轮 changelog: ${CHANGELOG_PATH}（如存在）
4. 读历史记录: ${HARNESS_DIR}/progress.md
5. 按 EVAL_CRITERIA.md 中的 Pre-gate 检查
6. 读所有关键源文件（上面列表）
7. 按 6 个维度逐一评分（D1-D6）
8. 执行 Penalty 检查
9. 如果浏览器可用:
   a. 打开 http://localhost:${EDU_FRONTEND_PORT}
   b. 登录教师
   c. 发消息触发 AskUserQuestion
   d. 验证 Wizard 渲染+交互
   e. 提交 → 验证 LLM 恢复
   f. 截图保存到 ${HARNESS_DIR}/screenshots/v${VERSION}/
10. **必须**将评估报告写入: ${EVAL_REPORT}
    - 最后一行必须包含 \`总分: XX/100\`

完整评估指南: ${HARNESS_DIR}/prompts/evaluator.md"

  EVALUATOR_TOOLS="Read,Glob,Grep,Bash,${PLAYWRIGHT_TOOLS}"

  log "[v$VERSION] Evaluator started (expected ~10-15min)..."
  echo "$EVALUATOR_PROMPT" | claude -p \
    --allowedTools "$EVALUATOR_TOOLS" \
    > "$HARNESS_DIR/eval-reports/v${VERSION}-evaluator-output.txt" 2>&1 &
  CLAUDE_PID=$!

  HEARTBEAT=0
  while kill -0 $CLAUDE_PID 2>/dev/null; do
    sleep 30
    HEARTBEAT=$((HEARTBEAT + 1))
    OUT_SIZE=$(wc -c < "$HARNESS_DIR/eval-reports/v${VERSION}-evaluator-output.txt" 2>/dev/null || echo 0)
    EVAL_EXISTS="no"
    [[ -f "$EVAL_REPORT" ]] && EVAL_EXISTS="yes ($(wc -c < "$EVAL_REPORT") bytes)"
    log "[v$VERSION] Evaluator heartbeat #${HEARTBEAT} (${HEARTBEAT}x30s) — output=${OUT_SIZE}b eval=${EVAL_EXISTS}"
  done
  wait $CLAUDE_PID
  CLAUDE_EXIT=$?

  if [[ $CLAUDE_EXIT -ne 0 ]]; then
    err "[v$VERSION] Evaluator failed (exit=$CLAUDE_EXIT)."
    echo "| v$VERSION | $TIMESTAMP | ERR | - | - | - | - | - | - | - | Evaluator agent failed |" >> "$HARNESS_DIR/progress.md"
    continue
  fi

  log "[v$VERSION] Evaluator complete ($(wc -c < "$HARNESS_DIR/eval-reports/v${VERSION}-evaluator-output.txt") bytes output)."

  # ─── Step 4: Extract score ───
  if [[ ! -f "$EVAL_REPORT" ]]; then
    err "[v$VERSION] Eval report not found at $EVAL_REPORT"
    echo "| v$VERSION | $TIMESTAMP | ERR | - | - | - | - | - | - | - | No eval report written |" >> "$HARNESS_DIR/progress.md"
    continue
  fi

  SCORE=$(extract_score "$EVAL_REPORT")
  log "[v$VERSION] Score: $SCORE/100 (previous: $PREV_SCORE/100)"

  # Extract per-dimension scores
  D1=$(grep -oE 'D1.*Score: ([0-9])/5' "$EVAL_REPORT" | grep -oE '[0-9]/5' | head -1 || echo "-")
  D2=$(grep -oE 'D2.*Score: ([0-9])/5' "$EVAL_REPORT" | grep -oE '[0-9]/5' | head -1 || echo "-")
  D3=$(grep -oE 'D3.*Score: ([0-9])/5' "$EVAL_REPORT" | grep -oE '[0-9]/5' | head -1 || echo "-")
  D4=$(grep -oE 'D4.*Score: ([0-9])/5' "$EVAL_REPORT" | grep -oE '[0-9]/5' | head -1 || echo "-")
  D5=$(grep -oE 'D5.*Score: ([0-9])/5' "$EVAL_REPORT" | grep -oE '[0-9]/5' | head -1 || echo "-")
  D6=$(grep -oE 'D6.*Score: ([0-9])/5' "$EVAL_REPORT" | grep -oE '[0-9]/5' | head -1 || echo "-")
  TOP_ISSUE=$(grep -oE 'Top Issue:.*' "$EVAL_REPORT" | head -1 | sed 's/Top Issue: //' || echo "See eval report")

  # Update progress
  echo "| v$VERSION | $TIMESTAMP | $SCORE | $D1 | $D2 | $D3 | $D4 | $D5 | $D6 | 0 | $TOP_ISSUE |" >> "$HARNESS_DIR/progress.md"

  # ─── Step 5: Exit conditions ───

  # Target reached
  if [[ $SCORE -ge $TARGET_SCORE ]]; then
    log ""
    log "TARGET REACHED: $SCORE/100 >= $TARGET_SCORE/100"
    log "Stopping harness."
    break
  fi

  # Score regression — rollback
  if [[ $PREV_SCORE -gt 0 ]] && [[ $((PREV_SCORE - SCORE)) -ge $ROLLBACK_THRESHOLD ]]; then
    log "[v$VERSION] REGRESSION: $SCORE < $PREV_SCORE by $((PREV_SCORE - SCORE)) points"
    log "[v$VERSION] Rolling back changes..."
    (cd "$PROJECT_ROOT" && git checkout HEAD~1 -- \
      "$CHAT_INTERFACE/src/components/wizard/" \
      "$EDU_FRONTEND/src/components/AskUserQuestionRenderer.tsx" \
      "$CORE_BACKEND/src/sessions/event-mapper.service.ts" \
      "$CORE_BACKEND/src/sessions/services/cli-process.service.ts" \
      2>/dev/null || true)
    SCORE=$PREV_SCORE
    log "[v$VERSION] Rolled back to previous score: $SCORE"
  fi

  # Diminishing returns
  if [[ $PREV_SCORE -gt 0 ]]; then
    IMPROVEMENT=$((SCORE - PREV_SCORE))
    if [[ $IMPROVEMENT -le $DIMINISHING_THRESHOLD ]]; then
      STALL_COUNT=$((STALL_COUNT + 1))
    else
      STALL_COUNT=0
    fi

    if [[ $STALL_COUNT -ge 3 ]]; then
      log ""
      log "DIMINISHING RETURNS: Score stalled for $STALL_COUNT consecutive rounds."
      log "Final score: $SCORE/100. Stopping."
      break
    fi
  fi

  PREV_SCORE=$SCORE
done

log ""
log "═══════════════════════════════════════════"
log "  Harness complete. Final score: ${PREV_SCORE}/100"
log "  Progress: $HARNESS_DIR/progress.md"
log "═══════════════════════════════════════════"
