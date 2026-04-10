#!/usr/bin/env bash
set -eu

# Allow nested claude -p invocations from within a Claude Code session
unset CLAUDECODE 2>/dev/null || true

# ─────────────────────────────────────────────────────────
# AskUserQuestion Widget — Harness Orchestrator
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

# Target file
COMPONENT_FILE="$EDU_FRONTEND/src/components/AskUserQuestionRenderer.tsx"

# Config
MAX_ITERATIONS=8
TARGET_SCORE=95
DIMINISHING_THRESHOLD=3
COST_PER_ITERATION=8.00  # generator + evaluator with Playwright browser interaction
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

log "=== AskUserQuestion Widget Harness ==="
log "Solution root: $SOLUTION_ROOT"
log "Component: $COMPONENT_FILE"
log "Max iterations: $MAX_ITERATIONS"
log "Target score: $TARGET_SCORE/100"
log "Max cost: \$$MAX_COST"

# Ensure required files exist
for f in SPEC.md EVAL_CRITERIA.md ASK-USER-QUESTION-SPEC.md ask-user-question.html prompts/generator.md prompts/evaluator.md progress.md; do
  if [[ ! -f "$HARNESS_DIR/$f" ]]; then
    err "Missing required file: $f"
    exit 1
  fi
done

# Ensure component file exists
if [[ ! -f "$COMPONENT_FILE" ]]; then
  err "Component file not found: $COMPONENT_FILE"
  exit 1
fi

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
  log "[DRY RUN] Generator: claude -p → modifies AskUserQuestionRenderer.tsx + browser verify"
  log "[DRY RUN] Pre-gate: npx tsc --noEmit (frontend)"
  log "[DRY RUN] Evaluator: claude -p → reads code + browser interaction + screenshots → scores"
  log "[DRY RUN] Estimated cost: ~\$$(echo "$MAX_ITERATIONS * $COST_PER_ITERATION" | bc)"
  log "[DRY RUN] Estimated time: ~$(echo "$MAX_ITERATIONS * 15" | bc) minutes"

  log ""
  log "[DRY RUN] Validation checks:"

  # Check tsc
  log "[DRY RUN]   Frontend tsc check..."
  if (cd "$EDU_FRONTEND" && npx tsc --noEmit 2>/dev/null); then
    log "[DRY RUN]   Frontend tsc: PASS"
  else
    log "[DRY RUN]   Frontend tsc: FAIL"
  fi

  # Check component size
  LINES=$(wc -l < "$COMPONENT_FILE" | tr -d ' ')
  log "[DRY RUN]   Component lines: $LINES"

  # Check ports
  for port in $CORE_BACKEND_PORT $EDU_BACKEND_PORT; do
    if check_port "$port"; then
      log "[DRY RUN]   Port $port: IN USE"
    else
      log "[DRY RUN]   Port $port: FREE"
    fi
  done

  if check_edu_frontend; then
    log "[DRY RUN]   Frontend port $EDU_FRONTEND_PORT: IN USE"
  else
    log "[DRY RUN]   Frontend port $EDU_FRONTEND_PORT: FREE"
  fi

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
- ⚠️ Edu-platform 未完全启动，无法进行浏览器验证"
fi

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
4. 读上一轮评估报告: $LAST_EVAL — 重点看扣分项和 Top 3 改进建议"
  else
    LAST_EVAL_CONTEXT="
4. (第一轮，无上轮 eval report)"
  fi

  # ─── Step 1: Generator ───
  log "[v$VERSION] Running Generator agent..."

  GENERATOR_PROMPT="你是 AskUserQuestion Widget 的 Generator agent。这是第 ${VERSION} 轮迭代。

**关键**: 你运行在 fresh context 中，没有前几轮的记忆。磁盘上的文件是你的唯一上下文。
${EDU_CONTEXT}

请严格按顺序执行：

1. 读任务规范: ${HARNESS_DIR}/SPEC.md
2. 读产品规格: ${HARNESS_DIR}/ASK-USER-QUESTION-SPEC.md
3. 读 HTML 原型: ${HARNESS_DIR}/ask-user-question.html
${LAST_EVAL_CONTEXT}
5. 读评分标准: ${HARNESS_DIR}/EVAL_CRITERIA.md
6. 读历史记录: ${HARNESS_DIR}/progress.md
7. 读当前实现: ${COMPONENT_FILE}
8. 读注册方式: ${EDU_FRONTEND}/src/App.tsx
9. 读设计规范: ${EDU_FRONTEND}/DESIGN_SYSTEM.md

然后：
10. 分析上轮扣分（如有），制定本轮改进计划
11. 修改 ${COMPONENT_FILE}（主要工作）
12. 如需额外 CSS，修改 ${EDU_FRONTEND}/src/index.css
13. 运行验证: cd ${EDU_FRONTEND} && npx tsc --noEmit
14. **浏览器验证（MANDATORY）**: 如果 Playwright 工具可用：
    a. 打开 http://localhost:${EDU_FRONTEND_PORT}
    b. 登录
    c. 发消息触发 AskUserQuestion（如\"帮我出5道关于全等三角形判定的题\"）
    d. 截图初始态 → 保存到 ${HARNESS_DIR}/screenshots/v${VERSION}/
    e. 点选选项，验证交互（chip 切换、radio 选择、Other 输入）
    f. 截图交互过程
    g. 验证确认提交流程
    h. 截图提交后状态
    i. 如发现视觉或交互 bug，立即修复代码并重新验证
15. **必须**将 changelog 写入: ${CHANGELOG_PATH}
16. **持久化链路修复（W7）**:
    - 修改 packages/react-sdk/src/hooks/useAgentChat.ts 的 loadMessageHistory，URL 加 &includeToolEvents=true
    - 在 chat-interface 的历史消息转换中，从 toolEvents 重建 contentBlocks
    - 验证：提交 → 刷新 → SubmittedView 正确渲染
    - 运行 packages 的 tsc 验证：cd ${PROJECT_ROOT}/packages/react-sdk && npx tsc --noEmit && cd ${PROJECT_ROOT}/packages/chat-interface && npx tsc --noEmit

完整指南: ${HARNESS_DIR}/prompts/generator.md"

  GENERATOR_TOOLS="Read,Edit,Write,Glob,Grep,Bash,${PLAYWRIGHT_TOOLS}"

  if ! echo "$GENERATOR_PROMPT" | claude -p \
    --allowedTools "$GENERATOR_TOOLS" \
    > "$HARNESS_DIR/changelogs/v${VERSION}-generator-output.txt" 2>&1; then

    err "[v$VERSION] Generator failed. Retrying once..."
    if ! echo "$GENERATOR_PROMPT" | claude -p \
      --allowedTools "$GENERATOR_TOOLS" \
      > "$HARNESS_DIR/changelogs/v${VERSION}-generator-output-retry.txt" 2>&1; then

      err "[v$VERSION] Generator failed on retry. Logging and continuing."
      echo "| v$VERSION | $TIMESTAMP | FAIL | - | - | - | - | - | - | - | - | Generator agent failed |" >> "$HARNESS_DIR/progress.md"
      continue
    fi
  fi

  log "[v$VERSION] Generator complete."

  if [[ ! -f "$CHANGELOG_PATH" ]]; then
    log "[v$VERSION] WARNING: Generator did not write changelog to $CHANGELOG_PATH"
  fi

  # ─── Step 2: Pre-gate check ───
  log "[v$VERSION] Running pre-gate: tsc --noEmit..."

  TSC_PASS=true
  if ! (cd "$EDU_FRONTEND" && npx tsc --noEmit 2>"$HARNESS_DIR/eval-reports/v${VERSION}-tsc-errors.txt"); then
    TSC_PASS=false
    err "[v$VERSION] Frontend tsc --noEmit FAILED"
  fi

  if ! $TSC_PASS; then
    log "[v$VERSION] tsc failed — scoring as 0, reverting component."
    (cd "$PROJECT_ROOT" && git checkout -- "$COMPONENT_FILE" 2>/dev/null || true)
    echo "| v$VERSION | $TIMESTAMP | 0 | - | - | - | - | - | - | - | -100 | tsc --noEmit failure — reverted |" >> "$HARNESS_DIR/progress.md"
    continue
  fi

  log "[v$VERSION] tsc --noEmit: PASS"

  # ─── Step 2b: Automated checks ───
  log "[v$VERSION] Running automated checks..."

  HC_COUNT=$(grep -c '#[0-9a-fA-F]\{3,6\}' "$COMPONENT_FILE" 2>/dev/null || echo 0)
  CL_COUNT=$(grep -c 'console\.log' "$COMPONENT_FILE" 2>/dev/null || echo 0)
  CV_COUNT=$(grep -c 'var(--' "$COMPONENT_FILE" 2>/dev/null || echo 0)
  BS_COUNT=$(grep -c 'box-shadow' "$COMPONENT_FILE" 2>/dev/null || echo 0)
  LINES=$(wc -l < "$COMPONENT_FILE" | tr -d ' ')

  log "[v$VERSION] Component: ${LINES} lines, ${CV_COUNT} CSS vars, ${HC_COUNT} hardcoded colors, ${CL_COUNT} console.log, ${BS_COUNT} box-shadow"

  # ─── Step 2c: Git snapshot ───
  log "[v$VERSION] Creating git snapshot..."
  (cd "$PROJECT_ROOT" && \
    git add "$COMPONENT_FILE" \
      "$EDU_FRONTEND/src/index.css" \
      "$EDU_FRONTEND/src/App.tsx" \
      "packages/react-sdk/src/hooks/useAgentChat.ts" \
      "packages/chat-interface/src/context/ChatCoreContext.tsx" \
      2>/dev/null && \
    git commit -m "feat(edu-platform): ask-user-question widget harness v$VERSION" -q 2>/dev/null) || \
    log "[v$VERSION] WARNING: git commit failed (no changes or git issue)"

  # ─── Step 2d: Pre-flight health check for evaluator ───
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
- Core Backend: http://localhost:${CORE_BACKEND_PORT}
- Edu Backend: http://localhost:${EDU_BACKEND_PORT}
- 截图保存到: ${HARNESS_DIR}/screenshots/v${VERSION}/"
  else
    BROWSER_CONTEXT="
## 浏览器验证状态
- **DISABLED** — 部分服务未启动。D1-D5 max 3/5 due to inability to verify runtime rendering and interaction."
  fi

  # ─── Step 3: Evaluator ───
  log "[v$VERSION] Running Evaluator agent..."

  EVALUATOR_PROMPT="你是 AskUserQuestion Widget 质量的独立 Evaluator agent。这是第 ${VERSION} 轮迭代的评估。
${EDU_CONTEXT}
${BROWSER_CONTEXT}

请按照以下步骤执行：

1. 读评分标准: ${HARNESS_DIR}/EVAL_CRITERIA.md
2. 读任务规范: ${HARNESS_DIR}/SPEC.md
3. 读产品规格: ${HARNESS_DIR}/ASK-USER-QUESTION-SPEC.md
4. 读 HTML 原型: ${HARNESS_DIR}/ask-user-question.html
5. 读被评估组件: ${COMPONENT_FILE}
6. 读设计规范: ${EDU_FRONTEND}/DESIGN_SYSTEM.md
7. **浏览器验证（MANDATORY if ENABLED）**:
   a. 打开 http://localhost:${EDU_FRONTEND_PORT}
   b. 登录（使用 console 注入 auth）
   c. 发消息触发 AskUserQuestion
   d. 截图初始态
   e. 实际点击选项 → 截图交互过程（chip 切换、选项选择、Other 输入）
   f. 点击确认 → 截图提交后状态
   g. 所有截图保存到 ${HARNESS_DIR}/screenshots/v${VERSION}/
8. 按 7 维度逐项评分 + penalty 检查
8b. **API 持久化测试（D7）**: curl 检查 toolEvents → toolOutput 是否返回
8c. **浏览器持久化测试（D7）**: 提交后刷新页面 → 截图对比

自动化检查结果（供参考）:
- tsc --noEmit: PASS
- Component lines: ${LINES}
- CSS variable refs: ${CV_COUNT}
- Hardcoded colors: ${HC_COUNT}
- console.log: ${CL_COUNT}
- box-shadow: ${BS_COUNT}

9. 汇总分数，输出 eval report

将完整报告写入: ${EVAL_REPORT}

**关键**：报告最后一行必须是 \`总分: XX/100\`

完整的 Evaluator 指南在: ${HARNESS_DIR}/prompts/evaluator.md"

  EVALUATOR_TOOLS="Read,Write,Glob,Grep,Bash,${PLAYWRIGHT_TOOLS}"

  if ! echo "$EVALUATOR_PROMPT" | claude -p \
    --allowedTools "$EVALUATOR_TOOLS" \
    > "$HARNESS_DIR/eval-reports/v${VERSION}-evaluator-output.txt" 2>&1; then

    err "[v$VERSION] Evaluator failed. Logging with score 0."
    echo "| v$VERSION | $TIMESTAMP | 0 | - | - | - | - | - | - | - | 0 | Evaluator agent failed |" >> "$HARNESS_DIR/progress.md"
    continue
  fi

  log "[v$VERSION] Evaluator complete."

  # ─── Step 4: Extract score and update progress ───
  if [[ ! -f "$EVAL_REPORT" ]]; then
    err "[v$VERSION] Eval report not found at $EVAL_REPORT"
    echo "| v$VERSION | $TIMESTAMP | ? | - | - | - | - | - | - | - | - | Eval report missing |" >> "$HARNESS_DIR/progress.md"
    continue
  fi

  SCORE=$(extract_score "$EVAL_REPORT")
  log "[v$VERSION] Score: $SCORE/100"

  # Extract per-dimension scores
  D1=$(grep -oE 'D1 Chips.*[0-9]/5\|D1.*Chips.*[0-9]/5' "$EVAL_REPORT" | grep -oE '[0-9]/5' | head -1 || echo "?")
  D2=$(grep -oE 'D2 选项.*[0-9]/5\|D2.*选项.*[0-9]/5\|D2.*交互.*[0-9]/5' "$EVAL_REPORT" | grep -oE '[0-9]/5' | head -1 || echo "?")
  D3=$(grep -oE 'D3 Footer.*[0-9]/5\|D3.*提交.*[0-9]/5' "$EVAL_REPORT" | grep -oE '[0-9]/5' | head -1 || echo "?")
  D4=$(grep -oE 'D4 Preview.*[0-9]/5\|D4.*分栏.*[0-9]/5' "$EVAL_REPORT" | grep -oE '[0-9]/5' | head -1 || echo "?")
  D5=$(grep -oE 'D5 面板.*[0-9]/5\|D5.*状态.*[0-9]/5' "$EVAL_REPORT" | grep -oE '[0-9]/5' | head -1 || echo "?")
  D6=$(grep -oE 'D6 设计.*[0-9]/5\|D6.*系统.*[0-9]/5' "$EVAL_REPORT" | grep -oE '[0-9]/5' | head -1 || echo "?")
  D7=$(grep -oE 'D7 持久化.*[0-9]/5\|D7.*链路.*[0-9]/5' "$EVAL_REPORT" | grep -oE '[0-9]/5' | head -1 || echo "?")
  PENALTIES=$(grep -oE 'Penalty 小计.*-[0-9]+' "$EVAL_REPORT" | grep -oE '-[0-9]+' | head -1 || echo "0")

  TOP_ISSUE=$(grep -A2 'Top 3\|未解决问题' "$EVAL_REPORT" | grep '^\s*1\.' | sed 's/^\s*1\.\s*//' | head -c 80 || echo "see eval report")
  if [[ -z "$TOP_ISSUE" ]]; then
    TOP_ISSUE="see eval-reports/v${VERSION}-eval.md"
  fi

  echo "| v$VERSION | $TIMESTAMP | $SCORE | $D1 | $D2 | $D3 | $D4 | $D5 | $D6 | $D7 | $PENALTIES | $TOP_ISSUE |" >> "$HARNESS_DIR/progress.md"

  # ─── Step 4b: Commit eval results ───
  (cd "$HARNESS_DIR" && \
    git add -A eval-reports/ changelogs/ screenshots/ progress.md 2>/dev/null && \
    git commit -m "docs(edu-platform): ask-user-question harness v$VERSION eval score $SCORE" -q 2>/dev/null) || true

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
      log "[v$VERSION] Score dropped by $DROP (> $ROLLBACK_THRESHOLD). Rolling back component..."
      (cd "$PROJECT_ROOT" && git checkout HEAD~1 -- "$COMPONENT_FILE" 2>/dev/null || true)
      log "[v$VERSION] Component rolled back to v$((VERSION - 1))"
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
log "  git log --oneline --grep='ask-user-question'"
