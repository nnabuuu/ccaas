#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────
# Chat Interface UI Polish — Overnight Harness Orchestrator
# ─────────────────────────────────────────────────────────
# Usage:
#   ./harness.sh              # Run from v0
#   ./harness.sh --resume     # Continue from last iteration
#   ./harness.sh --dry-run    # Show plan without running
#   ./harness.sh --max-cost 8 # Stop if estimated cost exceeds $8

HARNESS_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$HARNESS_DIR/../.." && pwd)"
CHAT_PKG="$PROJECT_ROOT/packages/chat-interface"

# Config
MAX_ITERATIONS=15
TARGET_SCORE=85
DIMINISHING_THRESHOLD=3  # stop if improvement < this for 2 consecutive rounds
DEV_SERVER_PORT=5190
COST_PER_ITERATION=0.75  # rough estimate in USD

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
  # Match "总分: XX/100" or "Total: XX/100" at end of file
  local score
  score=$(grep -oE '(总分|Total): [0-9]+/100' "$report" | tail -1 | grep -oE '[0-9]+' | head -1)
  echo "${score:-0}"
}

get_last_version() {
  # Parse progress.md to find last version number
  local last
  last=$(grep -oE '\| v[0-9]+' "$HARNESS_DIR/progress.md" | tail -1 | grep -oE '[0-9]+')
  echo "${last:-0}"
}

get_last_scores() {
  # Return last N scores from progress.md (for diminishing returns check)
  grep -oE '\| [0-9]+(\.[0-9]+)? +\|' "$HARNESS_DIR/progress.md" | grep -oE '[0-9]+(\.[0-9]*)?' | tail -"${1:-2}"
}

check_dev_server() {
  if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$DEV_SERVER_PORT/" | grep -q "200"; then
    return 0
  fi
  return 1
}

start_dev_server() {
  log "Starting dev server on port $DEV_SERVER_PORT..."
  cd "$CHAT_PKG" && npm run dev &
  DEV_PID=$!

  # Wait for server to be ready (max 30s)
  for i in $(seq 1 30); do
    if check_dev_server; then
      log "Dev server ready (PID: $DEV_PID)"
      return 0
    fi
    sleep 1
  done

  err "Dev server failed to start within 30s"
  kill $DEV_PID 2>/dev/null || true
  exit 1
}

cleanup() {
  if [[ -n "${DEV_PID:-}" ]]; then
    log "Stopping dev server (PID: $DEV_PID)..."
    kill $DEV_PID 2>/dev/null || true
  fi
}
trap cleanup EXIT

# ─────────────────────────────────────────────────────────
# Pre-flight checks
# ─────────────────────────────────────────────────────────

log "=== Chat Interface UI Polish Harness ==="
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
  log "[DRY RUN] Generator: claude -p with Edit/Write/Bash/Browser tools"
  log "[DRY RUN] Evaluator: claude -p with Read/Grep/Bash(readonly)/Browser(screenshot) tools"
  log "[DRY RUN] Exit when: score >= $TARGET_SCORE OR iterations >= $MAX_ITERATIONS OR diminishing returns"
  log "[DRY RUN] Estimated cost: ~\$$(echo "$MAX_ITERATIONS * $COST_PER_ITERATION" | bc)"
  exit 0
fi

# ─────────────────────────────────────────────────────────
# Start dev server (if not already running)
# ─────────────────────────────────────────────────────────

if check_dev_server; then
  log "Dev server already running on port $DEV_SERVER_PORT"
  DEV_PID=""
else
  start_dev_server
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

  GENERATOR_PROMPT="你是 chat-interface UI 优化的 Generator agent。这是第 $VERSION 轮迭代。

**关键**: 你运行在 fresh context 中，没有前几轮的记忆。磁盘上的文件是你的唯一上下文。

请严格按顺序执行：

1. 读任务规范: $HARNESS_DIR/SPEC.md
2. 读历史记录: $HARNESS_DIR/progress.md${LAST_EVAL_CONTEXT}
4. 读设计系统: $CHAT_PKG/docs/design-system.md
5. 浏览当前源码: $CHAT_PKG/src/ — 这些文件已被前几轮修改过，是你的**起点**，在此基础上继续改进
6. 看参考截图: $CHAT_PKG/reference/

然后：
7. 制定本轮改进计划（优先修复 eval 中扣分最多的项）
8. 修改 $CHAT_PKG/src/ 下的组件代码（原地修改）
9. 运行验证:
   cd $CHAT_PKG && npx tsc --noEmit
   cd $CHAT_PKG && npx vitest run
10. 打开浏览器 http://localhost:$DEV_SERVER_PORT/ 验证效果：
    - 截图 desktop (1440x900) → $HARNESS_DIR/screenshots/v$VERSION/desktop-main.png
    - 截图 mobile (375x812) → $HARNESS_DIR/screenshots/v$VERSION/mobile-main.png
    - 与参考截图对比，如有问题继续调整
11. **必须**将 changelog 写入: $CHANGELOG_PATH（格式见 prompts/generator.md 第 5 节）

完整指南: $HARNESS_DIR/prompts/generator.md"

  GENERATOR_TOOLS="Read,Edit,Write,Glob,Grep,Bash,mcp__playwright__browser_navigate,mcp__playwright__browser_take_screenshot,mcp__playwright__browser_snapshot,mcp__playwright__browser_click,mcp__playwright__browser_resize,mcp__playwright__browser_press_key,mcp__playwright__browser_type,mcp__playwright__browser_tabs,mcp__playwright__browser_evaluate"

  if ! claude -p \
    --allowedTools "$GENERATOR_TOOLS" \
    "$GENERATOR_PROMPT" \
    > "$HARNESS_DIR/screenshots/v$VERSION/generator-output.txt" 2>&1; then

    err "[v$VERSION] Generator failed. Retrying once..."
    if ! claude -p \
      --allowedTools "$GENERATOR_TOOLS" \
      "$GENERATOR_PROMPT" \
      > "$HARNESS_DIR/screenshots/v$VERSION/generator-output-retry.txt" 2>&1; then

      err "[v$VERSION] Generator failed on retry. Logging and continuing."
      echo "| v$VERSION | $TIMESTAMP | FAIL | - | - | - | - | - | - | Generator agent failed |" >> "$HARNESS_DIR/progress.md"
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
    # Revert changes to chat-interface
    (cd "$PROJECT_ROOT" && git checkout -- packages/chat-interface/src/)
    echo "| v$VERSION | $TIMESTAMP | 0 | - | - | - | - | - | -100 | typecheck/test failure — reverted |" >> "$HARNESS_DIR/progress.md"
    continue
  fi

  log "[v$VERSION] Typecheck and tests passed."

  # ─── Step 2b: Git snapshot ───
  log "[v$VERSION] Creating git snapshot..."
  (cd "$PROJECT_ROOT" && \
    git add packages/chat-interface/src/ packages/chat-interface/src/styles/ && \
    git commit -m "harness: v$VERSION iteration" --allow-empty -q 2>/dev/null) || \
    log "[v$VERSION] WARNING: git commit failed (no changes or git issue)"

  # ─── Step 3: Evaluator ───
  log "[v$VERSION] Running Evaluator agent..."

  EVAL_REPORT="$HARNESS_DIR/eval-reports/v${VERSION}-eval.md"
  mkdir -p "$HARNESS_DIR/eval-reports"

  EVALUATOR_PROMPT="你是 chat-interface UI 质量的独立 Evaluator agent。这是第 $VERSION 轮迭代的评估。

请按照以下步骤执行：

1. 先阅读评分标准: $HARNESS_DIR/EVAL_CRITERIA.md

2. 阅读设计参考:
   - $CHAT_PKG/docs/design-system.md
   - $CHAT_PKG/reference/ 中的 Claude Web 参考截图

3. 运行代码分析命令（见 EVAL_CRITERIA.md 中的 detection method）

4. 打开浏览器 http://localhost:$DEV_SERVER_PORT/ 截图对比：
   - Desktop 1440x900
   - Mobile 375x812
   - Tablet 768x1024
   与参考截图逐一对比

5. 按 EVAL_CRITERIA.md 的格式输出完整的 eval report

**关键**：报告最后一行必须是 \`总分: XX/100\`

将完整报告写入: $EVAL_REPORT

完整的 Evaluator 指南在: $HARNESS_DIR/prompts/evaluator.md"

  if ! claude -p \
    --allowedTools "Read,Write,Glob,Grep,Bash,mcp__playwright__browser_navigate,mcp__playwright__browser_take_screenshot,mcp__playwright__browser_snapshot,mcp__playwright__browser_resize,mcp__playwright__browser_tabs" \
    "$EVALUATOR_PROMPT" \
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

  # Extract per-dimension scores from eval report
  D1=$(grep -oE 'Alignment.*Score: [0-9]/5' "$EVAL_REPORT" | grep -oE '[0-9]/5' | head -1 || echo "?")
  D2=$(grep -oE 'Consistency.*Score: [0-9]/5' "$EVAL_REPORT" | grep -oE '[0-9]/5' | head -1 || echo "?")
  D3=$(grep -oE 'Mobile.*Score: [0-9]/5' "$EVAL_REPORT" | grep -oE '[0-9]/5' | head -1 || echo "?")
  D4=$(grep -oE 'Interaction.*Score: [0-9]/5' "$EVAL_REPORT" | grep -oE '[0-9]/5' | head -1 || echo "?")
  D5=$(grep -oE 'Code Quality.*Score: [0-9]/5' "$EVAL_REPORT" | grep -oE '[0-9]/5' | head -1 || echo "?")
  PENALTIES=$(grep -oE 'Penalty 小计.*-[0-9]+' "$EVAL_REPORT" | grep -oE '-[0-9]+' | head -1 || echo "0")

  # Extract top issue from eval report "Top 3 Priority Fixes" section
  TOP_ISSUE=$(grep -A2 'Top 3\|Priority Fix' "$EVAL_REPORT" | grep '^\s*1\.' | sed 's/^\s*1\.\s*//' | head -c 80 || echo "see eval report")
  if [[ -z "$TOP_ISSUE" ]]; then
    TOP_ISSUE="see eval-reports/v${VERSION}-eval.md"
  fi

  # Extract key changes from changelog file (not stdout)
  KEY_CHANGES=""
  if [[ -f "$CHANGELOG_PATH" ]]; then
    KEY_CHANGES=$(grep '^\- ' "$CHANGELOG_PATH" | head -2 | tr '\n' '; ' | head -c 80)
  fi
  if [[ -z "$KEY_CHANGES" ]]; then
    KEY_CHANGES="see changelogs/v${VERSION}-changelog.md"
  fi

  # Update progress.md
  echo "| v$VERSION | $TIMESTAMP | $SCORE | $D1 | $D2 | $D3 | $D4 | $D5 | $PENALTIES | $TOP_ISSUE |" >> "$HARNESS_DIR/progress.md"

  # ─── Step 4b: Commit eval results ───
  (cd "$HARNESS_DIR" && \
    git add -A eval-reports/ changelogs/ screenshots/ progress.md 2>/dev/null && \
    git commit -m "harness: v$VERSION eval — score $SCORE/100" -q 2>/dev/null) || true

  # ─── Step 5: Check exit conditions ───

  # 5a. Target score reached
  if [[ $SCORE -ge $TARGET_SCORE ]]; then
    log ""
    log "🎯 Target score reached! ($SCORE >= $TARGET_SCORE)"
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
        log "📉 Diminishing returns (2 consecutive rounds < +$DIMINISHING_THRESHOLD). Stopping."
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
log "  git log --oneline --grep='harness:'"
log ""
log "Compare first and last:"
log "  git diff HEAD~$VERSION -- packages/chat-interface/src/"
