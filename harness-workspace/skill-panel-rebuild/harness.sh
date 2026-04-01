#!/usr/bin/env bash
set -euo pipefail

# Allow nested claude -p invocations from within a Claude Code session
unset CLAUDECODE 2>/dev/null || true

# ─────────────────────────────────────────────────────────
# SkillPanel Rebuild — Harness Orchestrator
# ─────────────────────────────────────────────────────────
# Usage:
#   ./harness.sh              # Run from v0
#   ./harness.sh --resume     # Continue from last iteration
#   ./harness.sh --dry-run    # Show plan without running
#   ./harness.sh --max-cost 8 # Stop if estimated cost exceeds $8

HARNESS_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$HARNESS_DIR/../.." && pwd)"
CHAT_PKG="$PROJECT_ROOT/packages/chat-interface"
BACKEND_PKG="$PROJECT_ROOT/packages/backend"
EDU_PKG="$PROJECT_ROOT/solutions/business/edu-platform/frontend"
EDU_BACKEND_PKG="$PROJECT_ROOT/solutions/business/edu-platform/backend"

# Config
MAX_ITERATIONS=10
TARGET_SCORE=90
DIMINISHING_THRESHOLD=3  # stop if improvement < this for 2 consecutive rounds
DEV_SERVER_PORT=5190
EDU_SERVER_PORT=5290
BACKEND_PORT=3001
EDU_BACKEND_PORT=3011
COST_PER_ITERATION=0.75

# Auth credentials
AUTH_USERNAME="admin"
AUTH_PASSWORD="dev123"
AUTH_ENDPOINT="http://localhost:${BACKEND_PORT}/api/v1/auth/login"

# Parse flags
RESUME=false
DRY_RUN=false
MAX_COST=999
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
  score=$(grep -oE '(总分|Total): [0-9]+/100' "$report" | tail -1 | grep -oE '[0-9]+' | head -1)
  echo "${score:-0}"
}

get_last_version() {
  local last
  last=$(grep -oE '\| v[0-9]+' "$HARNESS_DIR/progress.md" | tail -1 | grep -oE '[0-9]+')
  echo "${last:-0}"
}

check_dev_server() {
  for port in $(seq $DEV_SERVER_PORT $((DEV_SERVER_PORT + 10))); do
    if nc -z localhost "$port" 2>/dev/null; then
      DEV_SERVER_PORT=$port
      return 0
    fi
  done
  return 1
}

check_edu_server() {
  for port in $(seq $EDU_SERVER_PORT $((EDU_SERVER_PORT + 10))); do
    if nc -z localhost "$port" 2>/dev/null; then
      EDU_SERVER_PORT=$port
      return 0
    fi
  done
  return 1
}

check_edu_backend() {
  nc -z localhost "$EDU_BACKEND_PORT" 2>/dev/null
}

start_edu_backend() {
  log "Starting edu-platform backend on port $EDU_BACKEND_PORT..."
  if [[ ! -d "$EDU_BACKEND_PKG/dist" ]]; then
    log "Building edu-platform backend..."
    (cd "$EDU_BACKEND_PKG" && npm run build) || { err "Edu-platform backend build failed"; return 1; }
  fi
  if [[ ! -f "$EDU_BACKEND_PKG/data/edu.db" ]]; then
    log "Seeding edu-platform database..."
    local ccaas_key=""
    if $BACKEND_AUTH_OK; then
      ccaas_key=$(curl -sf -X POST "$AUTH_ENDPOINT" \
        -H 'Content-Type: application/json' \
        -d "{\"username\":\"$AUTH_USERNAME\",\"password\":\"$AUTH_PASSWORD\"}" 2>/dev/null \
        | grep -o '"apiKey":"[^"]*"' | cut -d'"' -f4) || true
    fi
    (cd "$EDU_BACKEND_PKG" && CCAAS_API_KEY="$ccaas_key" npx ts-node src/seed.ts) || { err "Edu-platform seed failed"; return 1; }
  fi

  cd "$EDU_BACKEND_PKG" && npm start &
  EDU_BACKEND_PID=$!

  for i in $(seq 1 30); do
    if check_edu_backend; then
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

check_backend() {
  nc -z localhost "$BACKEND_PORT" 2>/dev/null
}

start_dev_server() {
  log "Starting chat-interface dev server (preferred port: $DEV_SERVER_PORT)..."
  cd "$CHAT_PKG" && npm run dev &
  DEV_PID=$!

  for i in $(seq 1 30); do
    if check_dev_server; then
      log "Chat-interface dev server ready on port $DEV_SERVER_PORT (PID: $DEV_PID)"
      return 0
    fi
    sleep 1
  done

  err "Chat-interface dev server failed to start within 30s"
  kill $DEV_PID 2>/dev/null || true
  exit 1
}

start_edu_server() {
  log "Starting edu-platform dev server (preferred port: $EDU_SERVER_PORT)..."
  cd "$EDU_PKG" && npm run dev &
  EDU_PID=$!

  for i in $(seq 1 30); do
    if check_edu_server; then
      log "Edu-platform dev server ready on port $EDU_SERVER_PORT (PID: $EDU_PID)"
      return 0
    fi
    sleep 1
  done

  err "Edu-platform dev server failed to start within 30s"
  kill $EDU_PID 2>/dev/null || true
  EDU_PID=""
  return 1
}

start_backend() {
  log "Starting backend server on port $BACKEND_PORT..."
  cd "$BACKEND_PKG" && npm run start:dev &
  BACKEND_PID=$!

  for i in $(seq 1 60); do
    if check_backend; then
      log "Backend ready on port $BACKEND_PORT (PID: $BACKEND_PID)"
      return 0
    fi
    sleep 1
  done

  err "Backend failed to start within 60s"
  kill $BACKEND_PID 2>/dev/null || true
  exit 1
}

verify_login() {
  log "Verifying login credentials..."
  local response
  response=$(curl -sf -X POST "$AUTH_ENDPOINT" \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"$AUTH_USERNAME\",\"password\":\"$AUTH_PASSWORD\"}" 2>/dev/null) || {
    err "Login verification failed — curl returned non-zero"
    return 1
  }
  if echo "$response" | grep -q '"apiKey"'; then
    log "Login verified — credentials work (admin/dev123)"
    return 0
  else
    err "Login response missing apiKey: $response"
    return 1
  fi
}

cleanup() {
  if [[ -n "${DEV_PID:-}" ]]; then
    log "Stopping chat-interface dev server (PID: $DEV_PID)..."
    kill $DEV_PID 2>/dev/null || true
  fi
  if [[ -n "${EDU_PID:-}" ]]; then
    log "Stopping edu-platform dev server (PID: $EDU_PID)..."
    kill $EDU_PID 2>/dev/null || true
  fi
  if [[ -n "${EDU_BACKEND_PID:-}" ]]; then
    log "Stopping edu-platform backend (PID: $EDU_BACKEND_PID)..."
    kill $EDU_BACKEND_PID 2>/dev/null || true
  fi
  if [[ -n "${BACKEND_PID:-}" ]]; then
    log "Stopping backend server (PID: $BACKEND_PID)..."
    kill $BACKEND_PID 2>/dev/null || true
  fi
}
trap cleanup EXIT

# ─────────────────────────────────────────────────────────
# Pre-flight checks
# ─────────────────────────────────────────────────────────

log "=== SkillPanel Rebuild Harness ==="
log "Project root: $PROJECT_ROOT"
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
  log "[DRY RUN] Would run up to $MAX_ITERATIONS iterations"
  log "[DRY RUN] Backend: localhost:$BACKEND_PORT (start if not running)"
  log "[DRY RUN] Core frontend: localhost:$DEV_SERVER_PORT (start if not running)"
  log "[DRY RUN] Edu-platform: localhost:$EDU_SERVER_PORT (start if available)"
  log "[DRY RUN] Auth: POST $AUTH_ENDPOINT with $AUTH_USERNAME/$AUTH_PASSWORD"
  log "[DRY RUN] Generator: claude -p with Edit/Write/Bash/Playwright tools"
  log "[DRY RUN] Evaluator: claude -p with Read/Grep/Bash/Playwright tools"
  log "[DRY RUN] Exit when: score >= $TARGET_SCORE OR iterations >= $MAX_ITERATIONS OR diminishing returns"
  log "[DRY RUN] Estimated cost: ~\$$(echo "$MAX_ITERATIONS * $COST_PER_ITERATION" | bc)"
  log "[DRY RUN] Revert scope: SkillPanel, ChatSidebar, ChatInterface, ChatInterfaceRoot, ChatCoreContext, App.tsx"
  exit 0
fi

# ─────────────────────────────────────────────────────────
# Start backend server (if not already running)
# ─────────────────────────────────────────────────────────

BACKEND_PID=""
if check_backend; then
  log "Backend already running on port $BACKEND_PORT"
else
  start_backend
fi

# ─────────────────────────────────────────────────────────
# Login pre-check
# ─────────────────────────────────────────────────────────

BACKEND_AUTH_OK=false
if verify_login; then
  BACKEND_AUTH_OK=true
  log "Backend auth pre-check: PASS"
else
  log "WARNING: Backend auth pre-check FAILED — functional verification will score 0"
  log "Continuing with code-only evaluation..."
fi

# ─────────────────────────────────────────────────────────
# Start dev server (if not already running)
# ─────────────────────────────────────────────────────────

DEV_PID=""
if check_dev_server; then
  log "Chat-interface dev server already running on port $DEV_SERVER_PORT"
else
  start_dev_server
fi

# ─────────────────────────────────────────────────────────
# Start edu-platform backend (if not already running)
# ─────────────────────────────────────────────────────────

EDU_BACKEND_PID=""
EDU_BACKEND_OK=false
if check_edu_backend; then
  log "Edu-platform backend already running on port $EDU_BACKEND_PORT"
  EDU_BACKEND_OK=true
elif [[ -d "$EDU_BACKEND_PKG" ]]; then
  if start_edu_backend; then
    EDU_BACKEND_OK=true
  else
    log "WARNING: Edu-platform backend failed to start"
  fi
fi

# ─────────────────────────────────────────────────────────
# Start edu-platform frontend (if not already running)
# ─────────────────────────────────────────────────────────

EDU_PID=""
EDU_AVAILABLE=false
if check_edu_server; then
  log "Edu-platform dev server already running on port $EDU_SERVER_PORT"
  EDU_AVAILABLE=true
elif [[ -d "$EDU_PKG" ]]; then
  if start_edu_server; then
    EDU_AVAILABLE=true
  else
    log "WARNING: Edu-platform frontend not available — will evaluate core only"
  fi
else
  log "WARNING: Edu-platform package not found at $EDU_PKG — skipping"
fi

# ─────────────────────────────────────────────────────────
# Shared Playwright tools
# ─────────────────────────────────────────────────────────

PLAYWRIGHT_TOOLS="mcp__playwright__browser_navigate,mcp__playwright__browser_take_screenshot,mcp__playwright__browser_snapshot,mcp__playwright__browser_click,mcp__playwright__browser_resize,mcp__playwright__browser_press_key,mcp__playwright__browser_type,mcp__playwright__browser_fill_form,mcp__playwright__browser_tabs,mcp__playwright__browser_evaluate,mcp__playwright__browser_wait_for"

# ─────────────────────────────────────────────────────────
# Auth context for prompts
# ─────────────────────────────────────────────────────────

AUTH_CONTEXT=""
EDU_CONTEXT=""
if $BACKEND_AUTH_OK; then
  AUTH_CONTEXT="
## 后端认证信息（已预验证可用）
- Backend: http://localhost:$BACKEND_PORT
- Login: POST http://localhost:$BACKEND_PORT/api/v1/auth/login
- Body: {\"username\":\"$AUTH_USERNAME\",\"password\":\"$AUTH_PASSWORD\"}
- 返回 apiKey，用作 x-api-key header 或 localStorage.setItem('apiKey', key)
- **认证已预验证成功** — 可以直接使用"
else
  AUTH_CONTEXT="
## 后端认证信息
- ⚠️ 认证预检失败 — 后端可能未启动或凭据无效
- 跳过交互验证，仅做代码分析
- D1 和 D3 将得 0 分"
fi

if $EDU_AVAILABLE && $EDU_BACKEND_OK; then
  EDU_CONTEXT="
## Edu-Platform（Solution 层验证）
- Frontend: http://localhost:$EDU_SERVER_PORT
- Solution Backend: http://localhost:$EDU_BACKEND_PORT
- 代码目录: $EDU_PKG/src/
- 登录: 在浏览器 console 中调用:
  \`\`\`javascript
  const res = await fetch('http://localhost:$EDU_BACKEND_PORT/api/auth/login', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({username:'teacher',password:'teacher123'})
  });
  const data = await res.json();
  localStorage.setItem('edu-jwt', data.token);
  localStorage.setItem('edu-ccaas-key', data.ccaasApiKey);
  localStorage.setItem('edu-user', JSON.stringify(data.user));
  location.reload();
  \`\`\`"
elif $EDU_AVAILABLE; then
  EDU_CONTEXT="
## Edu-Platform（部分可用）
- Frontend: http://localhost:$EDU_SERVER_PORT
- ⚠️ Solution backend 未启动 — 只能检查 UI 层接入"
else
  EDU_CONTEXT="
## Edu-Platform
- ⚠️ Edu-platform 不可用，仅评估 core chat-interface"
fi

# ─────────────────────────────────────────────────────────
# Revert scope — files the generator may modify
# ─────────────────────────────────────────────────────────

REVERT_FILES=(
  "packages/chat-interface/src/components/SkillPanel.tsx"
  "packages/chat-interface/src/components/chat/ChatInterfaceSkillPanel.tsx"
  "packages/chat-interface/src/components/ChatSidebar.tsx"
  "packages/chat-interface/src/components/ChatInterface.tsx"
  "packages/chat-interface/src/components/chat/ChatInterfaceRoot.tsx"
  "packages/chat-interface/src/context/ChatCoreContext.tsx"
  "packages/chat-interface/src/App.tsx"
  "packages/chat-interface/src/styles/globals.css"
  "solutions/business/edu-platform/frontend/src/App.tsx"
)

revert_changes() {
  log "Reverting generator changes..."
  for f in "${REVERT_FILES[@]}"; do
    (cd "$PROJECT_ROOT" && git checkout -- "$f" 2>/dev/null) || true
  done
}

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
  mkdir -p "$HARNESS_DIR/changelogs"

  # --- Prepare last eval path ---
  PREV_VERSION=$((VERSION - 1))
  LAST_EVAL="$HARNESS_DIR/eval-reports/v${PREV_VERSION}-eval.md"
  LAST_EVAL_CONTEXT=""
  if [[ -f "$LAST_EVAL" ]]; then
    LAST_EVAL_CONTEXT="
3. 读上一轮评估报告: $LAST_EVAL — 重点看扣分项和 Top 3 改进建议"
  else
    LAST_EVAL_CONTEXT="
3. (第一轮，无上轮 eval report)"
  fi

  CHANGELOG_PATH="$HARNESS_DIR/changelogs/v${VERSION}-changelog.md"

  # ─── Step 1: Generator ───
  log "[v$VERSION] Running Generator agent..."

  GENERATOR_PROMPT="你是 SkillPanel 重建的 Generator agent。这是第 $VERSION 轮迭代。

**关键**: 你运行在 fresh context 中，没有前几轮的记忆。磁盘上的文件是你的唯一上下文。
${AUTH_CONTEXT}
${EDU_CONTEXT}

请严格按顺序执行：

1. 读任务规范: $HARNESS_DIR/SPEC.md
2. 读历史记录: $HARNESS_DIR/progress.md${LAST_EVAL_CONTEXT}
4. 读 HTML 原型: $CHAT_PKG/reference/skill-management-ccaas-light.html — 视觉标准
5. 读设计系统: $CHAT_PKG/docs/design-system.md
6. 浏览需修改的源码:
   - $CHAT_PKG/src/components/SkillPanel.tsx
   - $CHAT_PKG/src/components/ChatSidebar.tsx
   - $CHAT_PKG/src/components/ChatInterface.tsx
   - $CHAT_PKG/src/components/chat/ChatInterfaceRoot.tsx
   - $CHAT_PKG/src/context/ChatCoreContext.tsx
   - $CHAT_PKG/src/App.tsx
   - $EDU_PKG/src/App.tsx

然后：
7. 制定本轮改进计划（优先修复 eval 中扣分最多的项）
8. 修改代码（原地修改，按 SPEC.md 的架构方案）
9. 运行验证:
   cd $CHAT_PKG && npx tsc --noEmit
   cd $CHAT_PKG && npx vitest run
10. 打开浏览器验证效果:
    - Core (http://localhost:$DEV_SERVER_PORT/):
      - 认证后点击 sidebar Skills 入口
      - 截图 SkillPanel desktop → $HARNESS_DIR/screenshots/v$VERSION/skill-panel-desktop.png
      - 截图 sidebar 展开态 → $HARNESS_DIR/screenshots/v$VERSION/sidebar-skills-expanded.png
      - 截图 mobile (375x812) → $HARNESS_DIR/screenshots/v$VERSION/skill-panel-mobile.png
      - 关闭 panel，验证 chat 恢复
    - Edu-Platform (http://localhost:$EDU_SERVER_PORT/) — 如果可用:
      - 登录后截图 → $HARNESS_DIR/screenshots/v$VERSION/edu-desktop.png
11. **必须**将 changelog 写入: ${CHANGELOG_PATH}

完整指南: $HARNESS_DIR/prompts/generator.md"

  GENERATOR_TOOLS="Read,Edit,Write,Glob,Grep,Bash,${PLAYWRIGHT_TOOLS}"

  if ! echo "$GENERATOR_PROMPT" | claude -p \
    --allowedTools "$GENERATOR_TOOLS" \
    > "$HARNESS_DIR/screenshots/v$VERSION/generator-output.txt" 2>&1; then

    err "[v$VERSION] Generator failed. Retrying once..."
    if ! echo "$GENERATOR_PROMPT" | claude -p \
      --allowedTools "$GENERATOR_TOOLS" \
      > "$HARNESS_DIR/screenshots/v$VERSION/generator-output-retry.txt" 2>&1; then

      err "[v$VERSION] Generator failed on retry. Logging and continuing."
      echo "| v$VERSION | $TIMESTAMP | FAIL | - | - | - | - | - | - | - | Generator agent failed |" >> "$HARNESS_DIR/progress.md"
      continue
    fi
  fi

  log "[v$VERSION] Generator complete."

  # --- Check changelog was written ---
  if [[ ! -f "$CHANGELOG_PATH" ]]; then
    log "[v$VERSION] WARNING: Generator did not write changelog to $CHANGELOG_PATH"
  fi

  # ─── Step 2: Tool Agent (typecheck + test) ───
  log "[v$VERSION] Running typecheck and tests..."

  TOOL_PASS=true
  if ! (cd "$CHAT_PKG" && npx tsc --noEmit 2>&1); then
    err "[v$VERSION] Typecheck FAILED"
    TOOL_PASS=false
  fi

  if $TOOL_PASS && ! (cd "$CHAT_PKG" && npx vitest run 2>&1); then
    err "[v$VERSION] Tests FAILED"
    TOOL_PASS=false
  fi

  if ! $TOOL_PASS; then
    log "[v$VERSION] Build/test failed — scoring as 0, reverting changes."
    revert_changes
    echo "| v$VERSION | $TIMESTAMP | 0 | - | - | - | - | - | - | -100 | typecheck/test failure — reverted |" >> "$HARNESS_DIR/progress.md"
    continue
  fi

  log "[v$VERSION] Typecheck and tests passed."

  # ─── Step 2b: Git snapshot ───
  log "[v$VERSION] Creating git snapshot..."
  (cd "$PROJECT_ROOT" && \
    git add packages/chat-interface/src/ \
           solutions/business/edu-platform/frontend/src/ 2>/dev/null && \
    git commit -m "feat(frontend): skill-panel harness v$VERSION iteration" -q 2>/dev/null) || \
    log "[v$VERSION] WARNING: git commit failed (no changes or git issue)"

  # ─── Step 3: Evaluator ───
  log "[v$VERSION] Running Evaluator agent..."

  EVAL_REPORT="$HARNESS_DIR/eval-reports/v${VERSION}-eval.md"
  mkdir -p "$HARNESS_DIR/eval-reports"

  EVALUATOR_PROMPT="你是 SkillPanel 重建质量的独立 Evaluator agent。这是第 $VERSION 轮迭代的评估。
${AUTH_CONTEXT}
${EDU_CONTEXT}

请按照以下步骤执行：

1. 先阅读评分标准: $HARNESS_DIR/EVAL_CRITERIA.md

2. 阅读参考文档:
   - HTML 原型: $CHAT_PKG/reference/skill-management-ccaas-light.html
   - 设计系统: $CHAT_PKG/docs/design-system.md

3. **后端认证**（Pre-Scoring Gate — MANDATORY）:
   - 执行 curl 登录获取 apiKey
   - 如果失败，D1 和 D3 直接 0 分

4. 运行代码分析命令（见 EVAL_CRITERIA.md 中的 detection method）

5. 打开浏览器 http://localhost:$DEV_SERVER_PORT/ 进行认证后验证:
   - 登录后在 console 注入 apiKey
   - 刷新页面
   - 点击 sidebar Skills 入口 → 验证 panel 打开
   - 截图 SkillPanel，与 HTML 原型对比
   - 切换 tabs，截图
   - 关闭 panel → 验证 chat 恢复
   - 发送消息验证无回归
   - Mobile 375x812 截图

5b. 如果 edu-platform 可用 (http://localhost:$EDU_SERVER_PORT/):
    - 登录后检查 sidebar Skills 入口
    - 验证 chat 发消息无回归

6. 按 EVAL_CRITERIA.md 的格式输出完整的 eval report

**关键**：报告最后一行必须是 \`总分: XX/100\`

将完整报告写入: $EVAL_REPORT

完整 Evaluator 指南: $HARNESS_DIR/prompts/evaluator.md"

  EVALUATOR_TOOLS="Read,Write,Glob,Grep,Bash,${PLAYWRIGHT_TOOLS}"

  if ! echo "$EVALUATOR_PROMPT" | claude -p \
    --allowedTools "$EVALUATOR_TOOLS" \
    > "$HARNESS_DIR/eval-reports/v${VERSION}-evaluator-output.txt" 2>&1; then

    err "[v$VERSION] Evaluator failed. Logging with score 0."
    echo "| v$VERSION | $TIMESTAMP | 0 | - | - | - | - | - | - | 0 | Evaluator agent failed |" >> "$HARNESS_DIR/progress.md"
    continue
  fi

  log "[v$VERSION] Evaluator complete."

  # ─── Step 4: Extract score and update progress ───
  if [[ ! -f "$EVAL_REPORT" ]]; then
    err "[v$VERSION] Eval report not found at $EVAL_REPORT"
    echo "| v$VERSION | $TIMESTAMP | ? | - | - | - | - | - | - | - | Eval report missing |" >> "$HARNESS_DIR/progress.md"
    continue
  fi

  SCORE=$(extract_score "$EVAL_REPORT")
  log "[v$VERSION] Score: $SCORE/100"

  # Extract per-dimension scores
  D1=$(grep -oE 'D1.*Score: [0-9]/5' "$EVAL_REPORT" | grep -oE '[0-9]/5' | head -1 || echo "?")
  D2=$(grep -oE 'D2.*Score: [0-9]/5' "$EVAL_REPORT" | grep -oE '[0-9]/5' | head -1 || echo "?")
  D3=$(grep -oE 'D3.*Score: [0-9]/5' "$EVAL_REPORT" | grep -oE '[0-9]/5' | head -1 || echo "?")
  D4=$(grep -oE 'D4.*Score: [0-9]/5' "$EVAL_REPORT" | grep -oE '[0-9]/5' | head -1 || echo "?")
  D5=$(grep -oE 'D5.*Score: [0-9]/5' "$EVAL_REPORT" | grep -oE '[0-9]/5' | head -1 || echo "?")
  D6=$(grep -oE 'D6.*Bonus: \+[0-9]\|Bonus: \+[0-9]' "$EVAL_REPORT" | grep -oE '\+[0-9]' | head -1 || echo "+0")
  PENALTIES=$(grep -oE 'Penalty 小计.*-[0-9]+' "$EVAL_REPORT" | grep -oE '-[0-9]+' | head -1 || echo "0")

  TOP_ISSUE=$(grep -A2 'Top 3\|Priority' "$EVAL_REPORT" | grep '^\s*1\.' | sed 's/^\s*1\.\s*//' | head -c 80 || echo "see eval report")
  if [[ -z "$TOP_ISSUE" ]]; then
    TOP_ISSUE="see eval-reports/v${VERSION}-eval.md"
  fi

  echo "| v$VERSION | $TIMESTAMP | $SCORE | $D1 | $D2 | $D3 | $D4 | $D5 | $D6 | $PENALTIES | $TOP_ISSUE |" >> "$HARNESS_DIR/progress.md"

  # ─── Step 4b: Commit eval results ───
  (cd "$HARNESS_DIR" && \
    git add -A eval-reports/ changelogs/ screenshots/ progress.md 2>/dev/null && \
    git commit -m "docs(frontend): skill-panel harness v$VERSION eval score $SCORE" -q 2>/dev/null) || true

  # ─── Step 5: Check exit conditions ───

  # 5a. Target score reached
  if [[ $SCORE -ge $TARGET_SCORE ]]; then
    log ""
    log "Target score reached! ($SCORE >= $TARGET_SCORE)"
    log "Harness complete after $VERSION iterations."
    break
  fi

  # 5b. Diminishing returns
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
log "  git log --oneline --grep='skill-panel harness'"
