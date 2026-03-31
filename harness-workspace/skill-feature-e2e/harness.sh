#!/usr/bin/env bash
set -euo pipefail

# Allow nested claude -p invocations from within a Claude Code session
unset CLAUDECODE 2>/dev/null || true

# ─────────────────────────────────────────────────────────
# Skill Feature E2E v2 — Harness Orchestrator
# ─────────────────────────────────────────────────────────
# Validates: code review fixes, unit tests, browser E2E, documentation
#   Guard order → Dead code → Tests → Toggle flow → Persistence → Docs
#
# Usage:
#   ./harness.sh              # Run from v0
#   ./harness.sh --resume     # Continue from last iteration
#   ./harness.sh --dry-run    # Show plan without running
#   ./harness.sh --max-cost 5 # Stop if estimated cost exceeds $5

HARNESS_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$HARNESS_DIR/../.." && pwd)"
CHAT_PKG="$PROJECT_ROOT/packages/chat-interface"
SDK_PKG="$PROJECT_ROOT/packages/react-sdk"
BACKEND_PKG="$PROJECT_ROOT/packages/backend"

# Config
MAX_ITERATIONS=6
TARGET_SCORE=85
DIMINISHING_THRESHOLD=3
DEV_SERVER_PORT=5190
BACKEND_PORT=3001
COST_PER_ITERATION=1.50

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
  nc -z localhost "$DEV_SERVER_PORT" 2>/dev/null
}

check_backend() {
  nc -z localhost "$BACKEND_PORT" 2>/dev/null
}

start_dev_server() {
  log "Starting chat-interface dev server on port $DEV_SERVER_PORT..."
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
    err "Login verification failed"
    return 1
  }
  if echo "$response" | grep -q '"apiKey"'; then
    log "Login verified — credentials work"
    return 0
  else
    err "Login response missing apiKey"
    return 1
  fi
}

cleanup() {
  if [[ -n "${DEV_PID:-}" ]]; then
    log "Stopping chat-interface dev server (PID: $DEV_PID)..."
    kill $DEV_PID 2>/dev/null || true
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

log "=== Skill Feature E2E v2 Harness ==="
log "Project root: $PROJECT_ROOT"
log "Max iterations: $MAX_ITERATIONS"
log "Target score: $TARGET_SCORE/100"
log "Max cost: \$$MAX_COST"
log "Cost per iteration: \$$COST_PER_ITERATION"

# Ensure required files exist
for f in SPEC.md EVAL_CRITERIA.md prompts/generator.md prompts/evaluator.md progress.md; do
  if [[ ! -f "$HARNESS_DIR/$f" ]]; then
    err "Missing required file: $f"
    exit 1
  fi
done

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
  log "[DRY RUN] Backend: localhost:$BACKEND_PORT"
  log "[DRY RUN] Frontend: localhost:$DEV_SERVER_PORT"
  log "[DRY RUN] Auth: POST $AUTH_ENDPOINT with $AUTH_USERNAME/$AUTH_PASSWORD"
  log "[DRY RUN] Generator modifies: 5 source + 4 test + 3 doc files"
  log "[DRY RUN] Evaluator checks: D1-D8 (backend tests, frontend tests, code review, browser E2E, docs)"
  log "[DRY RUN] Exit when: score >= $TARGET_SCORE OR iterations >= $MAX_ITERATIONS"
  log "[DRY RUN] Estimated cost: ~\$$(echo "$MAX_ITERATIONS * $COST_PER_ITERATION" | bc)"
  exit 0
fi

# ─────────────────────────────────────────────────────────
# Start servers
# ─────────────────────────────────────────────────────────

BACKEND_PID=""
if check_backend; then
  log "Backend already running on port $BACKEND_PORT"
else
  start_backend
fi

BACKEND_AUTH_OK=false
if verify_login; then
  BACKEND_AUTH_OK=true
  log "Backend auth pre-check: PASS"
else
  log "WARNING: Backend auth pre-check FAILED"
fi

DEV_PID=""
if check_dev_server; then
  log "Chat-interface dev server already running on port $DEV_SERVER_PORT"
else
  start_dev_server
fi

# ─────────────────────────────────────────────────────────
# Shared Playwright tools
# ─────────────────────────────────────────────────────────

PLAYWRIGHT_TOOLS="mcp__playwright__browser_navigate,mcp__playwright__browser_take_screenshot,mcp__playwright__browser_snapshot,mcp__playwright__browser_click,mcp__playwright__browser_resize,mcp__playwright__browser_press_key,mcp__playwright__browser_type,mcp__playwright__browser_fill_form,mcp__playwright__browser_tabs,mcp__playwright__browser_evaluate,mcp__playwright__browser_wait_for,mcp__playwright__browser_network_requests,mcp__playwright__browser_console_messages"

# ─────────────────────────────────────────────────────────
# Auth context
# ─────────────────────────────────────────────────────────

AUTH_CONTEXT=""
if $BACKEND_AUTH_OK; then
  AUTH_CONTEXT="
## 后端认证信息（已预验证可用）
- Backend: http://localhost:$BACKEND_PORT
- Login: POST http://localhost:$BACKEND_PORT/api/v1/auth/login
- Body: {\"username\":\"$AUTH_USERNAME\",\"password\":\"$AUTH_PASSWORD\"}
- 返回 apiKey，用于: X-API-Key header 或 localStorage.setItem('ck-api-key', key)
- **认证已预验证成功**"
else
  AUTH_CONTEXT="
## 后端认证信息
- ⚠️ 认证预检失败 — 后端可能未启动或凭据无效
- D5 和 D6 将得 0 分"
fi

# ─────────────────────────────────────────────────────────
# Revert scope — 5 source + 2 test extends + 3 doc files
# ─────────────────────────────────────────────────────────

REVERT_FILES=(
  "packages/chat-interface/src/components/SkillPanel.tsx"
  "packages/react-sdk/src/hooks/useSkills.ts"
  "packages/backend/src/sessions/sessions.controller.ts"
  "packages/backend/src/sessions/conversations-alias.controller.ts"
  "packages/backend/src/skills/guards/skill-permission.guard.ts"
  "packages/backend/src/sessions/services/skill-management.service.spec.ts"
  "packages/chat-interface/src/components/__tests__/SkillPanel.test.tsx"
  "docs/gitbook/en/api/rest.md"
  "docs/gitbook/zh/api/rest.md"
  "packages/chat-interface/ARCHITECTURE.md"
  "packages/backend/src/sessions/services/skill-management.service.ts"
)

# New files created by generator — delete on revert
REVERT_NEW_FILES=(
  "packages/backend/src/skills/skills.service.toggle.spec.ts"
  "packages/react-sdk/__tests__/useSkills.test.ts"
)

revert_changes() {
  log "Reverting generator changes..."
  for f in "${REVERT_FILES[@]}"; do
    (cd "$PROJECT_ROOT" && git checkout -- "$f" 2>/dev/null) || true
  done
  for f in "${REVERT_NEW_FILES[@]}"; do
    rm -f "$PROJECT_ROOT/$f" 2>/dev/null || true
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

  mkdir -p "$HARNESS_DIR/screenshots/v$VERSION"
  mkdir -p "$HARNESS_DIR/changelogs"

  # --- Last eval context ---
  PREV_VERSION=$((VERSION - 1))
  LAST_EVAL="$HARNESS_DIR/eval-reports/v${PREV_VERSION}-eval.md"
  LAST_EVAL_CONTEXT=""
  if [[ -f "$LAST_EVAL" ]]; then
    LAST_EVAL_CONTEXT="
3. 读上一轮评估报告: $LAST_EVAL — 重点看扣分项和失败测试"
  else
    LAST_EVAL_CONTEXT="
3. (第一轮，无上轮 eval report)"
  fi

  CHANGELOG_PATH="$HARNESS_DIR/changelogs/v${VERSION}-changelog.md"

  # ─── Step 1: Generator ───
  log "[v$VERSION] Running Generator agent..."

  GENERATOR_PROMPT="你是 Skill Feature E2E v2 的 Generator agent。这是第 $VERSION 轮迭代。

**关键**: 你运行在 fresh context 中，没有前几轮的记忆。磁盘上的文件是你的唯一上下文。
${AUTH_CONTEXT}

请严格按顺序执行：

1. 读任务规范: $HARNESS_DIR/SPEC.md — 修改范围、代码审查发现、测试要求
2. 读历史记录: $HARNESS_DIR/progress.md${LAST_EVAL_CONTEXT}
4. 读完整 Generator 指南: $HARNESS_DIR/prompts/generator.md
5. 读需修改的源码:
   - $CHAT_PKG/src/components/SkillPanel.tsx — toggle handler, auth check
   - $SDK_PKG/src/hooks/useSkills.ts — toggleSkill error propagation
   - $BACKEND_PKG/src/sessions/sessions.controller.ts — decorator order
   - $BACKEND_PKG/src/sessions/conversations-alias.controller.ts — decorator order
   - $BACKEND_PKG/src/skills/guards/skill-permission.guard.ts — dead code
6. 读需扩展的测试文件:
   - $BACKEND_PKG/src/sessions/services/skill-management.service.spec.ts
   - $CHAT_PKG/src/components/__tests__/SkillPanel.test.tsx
7. 读现有测试模式参考:
   - $BACKEND_PKG/src/skills/skills.service.files.spec.ts — Jest mock pattern
   - $SDK_PKG/__tests__/useFiles.test.ts — Vitest hook test pattern
8. 读需更新的文档文件:
   - $PROJECT_ROOT/docs/gitbook/en/api/rest.md — EN REST API docs
   - $PROJECT_ROOT/docs/gitbook/zh/api/rest.md — ZH REST API docs
   - $CHAT_PKG/ARCHITECTURE.md — chat-interface 架构文档

然后：
9. 制定本轮改进计划（优先修复 eval 中扣分最多的项）
10. Layer 1: 执行代码审查修复（Guard 顺序、死代码、toast 错误详情）
11. Layer 2: 写/扩展单元测试（4 个测试文件）
12. Layer 3: UI bug 修复（如果尚未完成）
13. Layer 4: 文档更新（gitbook toggle endpoint、SkillPanel props、loadEnabledSkills JSDoc）
14. 运行验证:
    - cd $BACKEND_PKG && npx tsc --noEmit
    - cd $CHAT_PKG && npx tsc --noEmit
    - cd $BACKEND_PKG && npx jest --no-coverage skills.service.toggle skill-management.service
    - cd $SDK_PKG && npx vitest run useSkills
    - cd $CHAT_PKG && npx vitest run SkillPanel
13. Grep 验证:
    - Guard 顺序: grep -B1 '@UseGuards(TenantGuard)' $BACKEND_PKG/src/sessions/sessions.controller.ts
    - 死代码: grep 'isOptionalAuth' $BACKEND_PKG/src/skills/guards/skill-permission.guard.ts (应该无匹配)
    - Re-throw: grep -n 'throw err' $SDK_PKG/src/hooks/useSkills.ts
    - 文档: grep -i 'toggle' $PROJECT_ROOT/docs/gitbook/en/api/rest.md
    - SkillPanel props: grep -A3 'SkillPanel.*Prop' $CHAT_PKG/ARCHITECTURE.md
    - JSDoc: grep -B5 'async loadEnabledSkills' $BACKEND_PKG/src/sessions/services/skill-management.service.ts
16. 写 changelog: ${CHANGELOG_PATH}

**范围限制**: 只修改 SPEC.md 中列出的 12 个文件。不要修改其他文件。不要改 CSS/样式。"

  GENERATOR_TOOLS="Read,Edit,Write,Glob,Grep,Bash"

  if ! echo "$GENERATOR_PROMPT" | claude -p \
    --allowedTools "$GENERATOR_TOOLS" \
    > "$HARNESS_DIR/screenshots/v$VERSION/generator-output.txt" 2>&1; then

    err "[v$VERSION] Generator failed. Retrying once..."
    if ! echo "$GENERATOR_PROMPT" | claude -p \
      --allowedTools "$GENERATOR_TOOLS" \
      > "$HARNESS_DIR/screenshots/v$VERSION/generator-output-retry.txt" 2>&1; then

      err "[v$VERSION] Generator failed on retry."
      echo "| v$VERSION | $TIMESTAMP | FAIL | - | - | - | - | - | - | - | - | Generator agent failed |" >> "$HARNESS_DIR/progress.md"
      continue
    fi
  fi

  log "[v$VERSION] Generator complete."

  # ─── Step 2: Typecheck ───
  log "[v$VERSION] Running typechecks..."

  TOOL_PASS=true

  # Typecheck backend
  if ! (cd "$BACKEND_PKG" && npx tsc --noEmit 2>&1); then
    err "[v$VERSION] Backend typecheck FAILED"
    TOOL_PASS=false
  fi

  # Typecheck chat-interface
  if $TOOL_PASS; then
    if ! (cd "$CHAT_PKG" && npx tsc --noEmit 2>&1); then
      err "[v$VERSION] Chat-interface typecheck FAILED"
      TOOL_PASS=false
    fi
  fi

  # Typecheck react-sdk (if modified)
  if $TOOL_PASS && git -C "$PROJECT_ROOT" diff --name-only | grep -q 'react-sdk'; then
    if ! (cd "$SDK_PKG" && npx tsc --noEmit 2>&1); then
      err "[v$VERSION] React-SDK typecheck FAILED"
      TOOL_PASS=false
    fi
  fi

  if ! $TOOL_PASS; then
    log "[v$VERSION] Typecheck failed — reverting changes."
    revert_changes
    echo "| v$VERSION | $TIMESTAMP | 0 | - | - | - | - | - | - | - | - | typecheck failure — reverted |" >> "$HARNESS_DIR/progress.md"
    continue
  fi

  log "[v$VERSION] Typecheck passed."

  # ─── Step 2a: Run automated tests (informational — don't revert on failure) ───
  log "[v$VERSION] Running automated tests (D1/D2 pre-check)..."

  BACKEND_TEST_RESULT="unknown"
  FRONTEND_TEST_RESULT="unknown"

  # Backend Jest — toggle + skill-management
  if (cd "$BACKEND_PKG" && npx jest --no-coverage skills.service.toggle skill-management.service 2>&1); then
    BACKEND_TEST_RESULT="pass"
    log "[v$VERSION] Backend tests: PASS"
  else
    BACKEND_TEST_RESULT="fail"
    log "[v$VERSION] Backend tests: FAIL (evaluator will score D1)"
  fi

  # React SDK Vitest
  if (cd "$SDK_PKG" && npx vitest run useSkills 2>&1); then
    FRONTEND_TEST_RESULT="pass"
    log "[v$VERSION] React SDK tests: PASS"
  else
    FRONTEND_TEST_RESULT="fail"
    log "[v$VERSION] React SDK tests: FAIL (evaluator will score D2)"
  fi

  # Chat Interface Vitest
  if (cd "$CHAT_PKG" && npx vitest run SkillPanel 2>&1); then
    log "[v$VERSION] Chat interface tests: PASS"
  else
    log "[v$VERSION] Chat interface tests: FAIL (evaluator will score D2)"
  fi

  # ─── Step 2b: Git snapshot ───
  log "[v$VERSION] Creating git snapshot..."
  (cd "$PROJECT_ROOT" && \
    git add \
      packages/chat-interface/src/components/SkillPanel.tsx \
      packages/react-sdk/src/hooks/useSkills.ts \
      packages/backend/src/sessions/sessions.controller.ts \
      packages/backend/src/sessions/conversations-alias.controller.ts \
      packages/backend/src/skills/guards/skill-permission.guard.ts \
      packages/backend/src/sessions/services/skill-management.service.spec.ts \
      packages/backend/src/sessions/services/skill-management.service.ts \
      packages/chat-interface/src/components/__tests__/SkillPanel.test.tsx \
      packages/backend/src/skills/skills.service.toggle.spec.ts \
      packages/react-sdk/__tests__/useSkills.test.ts \
      docs/gitbook/en/api/rest.md \
      docs/gitbook/zh/api/rest.md \
      packages/chat-interface/ARCHITECTURE.md \
      2>/dev/null && \
    git commit -m "fix(frontend): skill-feature-e2e harness v2 v$VERSION iteration" -q 2>/dev/null) || \
    log "[v$VERSION] WARNING: git commit failed (no changes?)"

  # ─── Step 3: Evaluator ───
  log "[v$VERSION] Running Evaluator agent..."

  EVAL_REPORT="$HARNESS_DIR/eval-reports/v${VERSION}-eval.md"

  EVALUATOR_PROMPT="你是 Skill Feature E2E v2 的独立 Evaluator agent。这是第 $VERSION 轮迭代的评估。
${AUTH_CONTEXT}

请按照以下步骤执行：

1. 先阅读评分标准: $HARNESS_DIR/EVAL_CRITERIA.md
2. 读 Evaluator 完整指南: $HARNESS_DIR/prompts/evaluator.md

3. **Phase 1: D1 Backend Unit Tests** — 运行测试:
   - cd $BACKEND_PKG && npx jest --no-coverage --verbose skills.service.toggle
   - cd $BACKEND_PKG && npx jest --no-coverage --verbose skill-management.service

4. **Phase 2: D2 Frontend Unit Tests** — 运行测试:
   - cd $SDK_PKG && npx vitest run useSkills
   - cd $CHAT_PKG && npx vitest run SkillPanel

5. **Phase 3: D3 Code Review Fixes** — 静态代码分析:
   - Guard 顺序: grep -n '@OptionalAuth\|@UseGuards(TenantGuard)' in sessions/conversations controllers
   - 死代码: grep 'isOptionalAuth' in skill-permission.guard.ts
   - Toast 错误详情: grep toast.error in SkillPanel.tsx

6. **Phase 4: D4 Skill Impact Verification** — 从 D1 Phase 2 测试结果中评分

7. **Phase 5: D5 Auth-Gated Operations** — 浏览器测试:
   - 打开 http://localhost:$DEV_SERVER_PORT/
   - 测试 5.1: 清除 localStorage 后 toggle → 应被阻止
   - 测试 5.2: 登录后 toggle → 应成功

8. **Phase 6: D6 Toggle E2E Flow** — 浏览器测试:
   - 测试 6.1: toggle disable
   - 测试 6.2: toggle enable
   - 测试 6.3: 刷新后状态持久

9. **Phase 7: D7 Error Handling + Quality**:
   - 测试 7.1: toast 时序（代码审查）
   - 测试 7.2: 错误反馈质量
   - 测试 7.3: error propagation grep

10. **Phase 8: D8 Documentation Coverage**:
    - 测试 8.1: grep toggle endpoint in gitbook EN/ZH docs
    - 测试 8.2: grep SkillPanel props in ARCHITECTURE.md
    - 测试 8.3: grep loadEnabledSkills JSDoc in skill-management.service.ts

11. 按 EVAL_CRITERIA.md 的格式输出完整 eval report

**关键**：报告最后一行必须是 \`总分: XX/100\`

将完整报告写入: $EVAL_REPORT"

  EVALUATOR_TOOLS="Read,Write,Glob,Grep,Bash,${PLAYWRIGHT_TOOLS}"

  if ! echo "$EVALUATOR_PROMPT" | claude -p \
    --allowedTools "$EVALUATOR_TOOLS" \
    > "$HARNESS_DIR/eval-reports/v${VERSION}-evaluator-output.txt" 2>&1; then

    err "[v$VERSION] Evaluator failed."
    echo "| v$VERSION | $TIMESTAMP | 0 | - | - | - | - | - | - | - | - | Evaluator agent failed |" >> "$HARNESS_DIR/progress.md"
    continue
  fi

  log "[v$VERSION] Evaluator complete."

  # ─── Step 4: Extract score ───
  if [[ ! -f "$EVAL_REPORT" ]]; then
    err "[v$VERSION] Eval report not found"
    echo "| v$VERSION | $TIMESTAMP | ? | - | - | - | - | - | - | - | - | Eval report missing |" >> "$HARNESS_DIR/progress.md"
    continue
  fi

  SCORE=$(extract_score "$EVAL_REPORT")
  log "[v$VERSION] Score: $SCORE/100"

  # Extract per-dimension scores (8 dimensions)
  D1=$(grep -oE 'D1[^(]*\([0-9]+/13\)' "$EVAL_REPORT" | grep -oE '[0-9]+/13' | head -1 || echo "?")
  D2=$(grep -oE 'D2[^(]*\([0-9]+/13\)' "$EVAL_REPORT" | grep -oE '[0-9]+/13' | head -1 || echo "?")
  D3=$(grep -oE 'D3[^(]*\([0-9]+/13\)' "$EVAL_REPORT" | grep -oE '[0-9]+/13' | head -1 || echo "?")
  D4=$(grep -oE 'D4[^(]*\([0-9]+/8\)' "$EVAL_REPORT" | grep -oE '[0-9]+/8' | head -1 || echo "?")
  D5=$(grep -oE 'D5[^(]*\([0-9]+/13\)' "$EVAL_REPORT" | grep -oE '[0-9]+/13' | head -1 || echo "?")
  D6=$(grep -oE 'D6[^(]*\([0-9]+/13\)' "$EVAL_REPORT" | grep -oE '[0-9]+/13' | head -1 || echo "?")
  D7=$(grep -oE 'D7[^(]*\([0-9]+/15\)' "$EVAL_REPORT" | grep -oE '[0-9]+/15' | head -1 || echo "?")
  D8=$(grep -oE 'D8[^(]*\([0-9]+/12\)' "$EVAL_REPORT" | grep -oE '[0-9]+/12' | head -1 || echo "?")

  TOP_ISSUE=$(grep -A2 'Top\|Priority\|最' "$EVAL_REPORT" | grep '^\s*[-1]' | head -1 | sed 's/^\s*[-1.]*\s*//' | head -c 80 || echo "see eval report")
  if [[ -z "$TOP_ISSUE" ]]; then
    TOP_ISSUE="see eval-reports/v${VERSION}-eval.md"
  fi

  echo "| v$VERSION | $TIMESTAMP | $SCORE | $D1 | $D2 | $D3 | $D4 | $D5 | $D6 | $D7 | $D8 | $TOP_ISSUE |" >> "$HARNESS_DIR/progress.md"

  # ─── Step 4b: Commit eval ───
  (cd "$HARNESS_DIR" && \
    git add -A eval-reports/ changelogs/ screenshots/ progress.md 2>/dev/null && \
    git commit -m "docs(frontend): skill-feature-e2e harness v2 v$VERSION eval score $SCORE" -q 2>/dev/null) || true

  # ─── Step 5: Exit conditions ───

  if [[ $SCORE -ge $TARGET_SCORE ]]; then
    log ""
    log "Target score reached! ($SCORE >= $TARGET_SCORE)"
    log "Harness complete after $VERSION iterations."
    break
  fi

  if [[ $PREV_SCORE -gt 0 ]]; then
    IMPROVEMENT=$((SCORE - PREV_SCORE))
    if [[ $IMPROVEMENT -lt $DIMINISHING_THRESHOLD ]]; then
      STALL_COUNT=$((STALL_COUNT + 1))
      log "[v$VERSION] Low improvement: +$IMPROVEMENT (stall count: $STALL_COUNT/2)"
      if [[ $STALL_COUNT -ge 2 ]]; then
        log ""
        log "Diminishing returns. Stopping."
        log "Final score: $SCORE/100 after $VERSION iterations."
        break
      fi
    else
      STALL_COUNT=0
    fi
  fi

  PREV_SCORE=$SCORE
  log "[v$VERSION] Score: $SCORE/100 — continuing..."
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
log "  progress.md      — score trajectory (8 dimensions)"
log "  eval-reports/    — detailed evaluations"
log "  changelogs/      — code changes per iteration"
log ""
log "Git history:"
log "  git log --oneline --grep='skill-feature-e2e'"
