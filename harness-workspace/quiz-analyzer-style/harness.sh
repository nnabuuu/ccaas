#!/usr/bin/env bash
set -euo pipefail

# Allow nested claude -p invocations from within a Claude Code session
export CLAUDECODE=""
unset CLAUDECODE 2>/dev/null || true

# ─────────────────────────────────────────────────────────
# Quiz Analyzer Style Consistency — Overnight Harness Orchestrator
# ─────────────────────────────────────────────────────────
# Usage:
#   ./harness.sh              # Run from v0
#   ./harness.sh --resume     # Continue from last iteration
#   ./harness.sh --dry-run    # Show plan without running
#   ./harness.sh --max-cost 8 # Stop if estimated cost exceeds $8

HARNESS_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$HARNESS_DIR/../.." && pwd)"
QUIZ_PKG="$PROJECT_ROOT/solutions/business/quiz-analyzer/frontend"

# Config
MAX_ITERATIONS=8
TARGET_SCORE=85
DIMINISHING_THRESHOLD=3  # stop if improvement < this for 2 consecutive rounds
SCORE_DROP_THRESHOLD=10  # rollback if score drops > this
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
  local score
  score=$(grep -oE '(总分|Total): [0-9]+/100' "$report" | tail -1 | grep -oE '[0-9]+' | head -1)
  echo "${score:-0}"
}

get_last_version() {
  local last
  last=$(grep -oE '\| v[0-9]+' "$HARNESS_DIR/progress.md" | tail -1 | grep -oE '[0-9]+')
  echo "${last:-0}"
}

cleanup() {
  log "Harness cleanup complete."
}
trap cleanup EXIT

# ─────────────────────────────────────────────────────────
# Pre-flight checks
# ─────────────────────────────────────────────────────────

log "=== Quiz Analyzer Style Consistency Harness ==="
log "Project root: $PROJECT_ROOT"
log "Quiz frontend: $QUIZ_PKG"
log "Max iterations: $MAX_ITERATIONS"
log "Target score: $TARGET_SCORE/100"
log "Max cost: \$$MAX_COST"

# Ensure required files exist
for f in SPEC.md EVAL_CRITERIA.md design-system.md prompts/generator.md prompts/evaluator.md progress.md; do
  if [[ ! -f "$HARNESS_DIR/$f" ]]; then
    err "Missing required file: $f"
    exit 1
  fi
done

# Ensure quiz-analyzer frontend exists
if [[ ! -d "$QUIZ_PKG" ]]; then
  err "Quiz analyzer frontend not found at $QUIZ_PKG"
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
  log "[DRY RUN] Would run up to $MAX_ITERATIONS iterations"
  log "[DRY RUN] Quiz frontend: $QUIZ_PKG"
  log "[DRY RUN] Generator: claude -p with Edit/Write/Bash/Playwright tools"
  log "[DRY RUN] Evaluator: claude -p with Read/Grep/Bash/Playwright tools"
  log "[DRY RUN] Exit when: score >= $TARGET_SCORE OR iterations >= $MAX_ITERATIONS OR diminishing returns"
  log "[DRY RUN] Estimated cost: ~\$$(echo "$MAX_ITERATIONS * $COST_PER_ITERATION" | bc)"
  exit 0
fi

# ─────────────────────────────────────────────────────────
# Shared Playwright tools
# ─────────────────────────────────────────────────────────

PLAYWRIGHT_TOOLS="mcp__playwright__browser_navigate,mcp__playwright__browser_take_screenshot,mcp__playwright__browser_snapshot,mcp__playwright__browser_click,mcp__playwright__browser_resize,mcp__playwright__browser_press_key,mcp__playwright__browser_type,mcp__playwright__browser_fill_form,mcp__playwright__browser_tabs,mcp__playwright__browser_evaluate,mcp__playwright__browser_wait_for"

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

  GENERATOR_PROMPT="你是 quiz-analyzer 前端样式迁移的 Generator agent。这是第 $VERSION 轮迭代。

**关键**: 你运行在 fresh context 中，没有前几轮的记忆。磁盘上的文件是你的唯一上下文。

请严格按顺序执行：

1. 读任务规范: $HARNESS_DIR/SPEC.md
2. 读设计 token 参考: $HARNESS_DIR/design-system.md${LAST_EVAL_CONTEXT}
4. 读历史记录: $HARNESS_DIR/progress.md
5. 浏览当前源码: $QUIZ_PKG/src/ — 这些文件已被前几轮修改过，是你的**起点**

然后：
6. 制定本轮改进计划（优先修复 eval 中扣分最多的项）
7. 修改代码（原地修改）— 仅修改 $QUIZ_PKG/ 下的文件
8. 运行验证:
   cd $QUIZ_PKG && npx tsc --noEmit
9. **必须**将 changelog 写入: ${CHANGELOG_PATH}

完整指南: $HARNESS_DIR/prompts/generator.md"

  GENERATOR_TOOLS="Read,Edit,Write,Glob,Grep,Bash,${PLAYWRIGHT_TOOLS}"

  if ! echo "$GENERATOR_PROMPT" | env -u CLAUDECODE claude -p \
    --allowedTools "$GENERATOR_TOOLS" \
    > "$HARNESS_DIR/screenshots/v$VERSION/generator-output.txt" 2>&1; then

    err "[v$VERSION] Generator failed. Retrying once..."
    if ! echo "$GENERATOR_PROMPT" | env -u CLAUDECODE claude -p \
      --allowedTools "$GENERATOR_TOOLS" \
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

  # ─── Step 2: Typecheck gate ───
  log "[v$VERSION] Running typecheck..."

  TOOL_PASS=true
  if ! (cd "$QUIZ_PKG" && npx tsc --noEmit 2>&1); then
    err "[v$VERSION] Typecheck FAILED"
    TOOL_PASS=false
  fi

  if ! $TOOL_PASS; then
    log "[v$VERSION] Typecheck failed — scoring as 0, reverting changes."
    (cd "$PROJECT_ROOT" && git checkout -- solutions/business/quiz-analyzer/frontend/ 2>/dev/null || true)
    echo "| v$VERSION | $TIMESTAMP | 0 | - | - | - | - | - | - | typecheck failure — reverted |" >> "$HARNESS_DIR/progress.md"
    continue
  fi

  log "[v$VERSION] Typecheck passed."

  # ─── Step 2b: Git snapshot ───
  log "[v$VERSION] Creating git snapshot..."
  (cd "$PROJECT_ROOT" && \
    git add solutions/business/quiz-analyzer/frontend/ 2>/dev/null && \
    git commit -m "style(frontend): quiz-analyzer harness v$VERSION iteration" -q 2>/dev/null) || \
    log "[v$VERSION] WARNING: git commit failed (no changes or git issue)"

  # ─── Step 3: Evaluator ───
  log "[v$VERSION] Running Evaluator agent..."

  EVAL_REPORT="$HARNESS_DIR/eval-reports/v${VERSION}-eval.md"
  mkdir -p "$HARNESS_DIR/eval-reports"

  EVALUATOR_PROMPT="你是 quiz-analyzer 前端样式迁移的独立 Evaluator agent。这是第 $VERSION 轮迭代的评估。

请按照以下步骤执行：

1. 先阅读评分标准: $HARNESS_DIR/EVAL_CRITERIA.md
2. 阅读设计参考: $HARNESS_DIR/design-system.md
3. 阅读任务规范: $HARNESS_DIR/SPEC.md
4. 运行 pre-scoring gate: cd $QUIZ_PKG && npx tsc --noEmit
5. 运行代码分析命令（见 EVAL_CRITERIA.md 中的 detection method）
   注意: 所有代码路径相对于 $PROJECT_ROOT，前端目录是 $QUIZ_PKG
6. 按 EVAL_CRITERIA.md 的格式输出完整的 eval report

**关键**：报告最后一行必须是 \`总分: XX/100\`

将完整报告写入: $EVAL_REPORT

完整的 Evaluator 指南在: $HARNESS_DIR/prompts/evaluator.md"

  EVALUATOR_TOOLS="Read,Write,Glob,Grep,Bash,${PLAYWRIGHT_TOOLS}"

  if ! echo "$EVALUATOR_PROMPT" | env -u CLAUDECODE claude -p \
    --allowedTools "$EVALUATOR_TOOLS" \
    > "$HARNESS_DIR/eval-reports/v${VERSION}-evaluator-output.txt" 2>&1; then

    err "[v$VERSION] Evaluator failed. Logging with score 0."
    echo "| v$VERSION | $TIMESTAMP | 0 | - | - | - | - | - | - | Evaluator agent failed |" >> "$HARNESS_DIR/progress.md"
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
  D1=$(grep -oE 'D1.*Score: [0-9]/5' "$EVAL_REPORT" | grep -oE '[0-9]/5' | head -1 || echo "?")
  D2=$(grep -oE 'D2.*Score: [0-9]/5' "$EVAL_REPORT" | grep -oE '[0-9]/5' | head -1 || echo "?")
  D3=$(grep -oE 'D3.*Score: [0-9]/5' "$EVAL_REPORT" | grep -oE '[0-9]/5' | head -1 || echo "?")
  D4=$(grep -oE 'D4.*Score: [0-9]/5' "$EVAL_REPORT" | grep -oE '[0-9]/5' | head -1 || echo "?")
  D5=$(grep -oE 'D5.*Score: [0-9]/5' "$EVAL_REPORT" | grep -oE '[0-9]/5' | head -1 || echo "?")
  PENALTIES=$(grep -oE 'Penalty 小计.*-[0-9]+' "$EVAL_REPORT" | grep -oE '-[0-9]+' | head -1 || echo "0")

  # Extract top issue
  TOP_ISSUE=$(grep -A2 'Top 3\|Priority' "$EVAL_REPORT" | grep '^\s*1\.' | sed 's/^\s*1\.\s*//' | head -c 80 || echo "see eval report")
  if [[ -z "$TOP_ISSUE" ]]; then
    TOP_ISSUE="see eval-reports/v${VERSION}-eval.md"
  fi

  # Update progress.md
  echo "| v$VERSION | $TIMESTAMP | $SCORE | $D1 | $D2 | $D3 | $D4 | $D5 | $PENALTIES | $TOP_ISSUE |" >> "$HARNESS_DIR/progress.md"

  # ─── Step 4b: Commit eval results ───
  (cd "$HARNESS_DIR" && \
    git add -A eval-reports/ changelogs/ screenshots/ progress.md 2>/dev/null && \
    git commit -m "docs(frontend): quiz-analyzer harness v$VERSION eval score $SCORE" -q 2>/dev/null) || true

  # ─── Step 5: Check exit conditions ───

  # 5a. Target score reached
  if [[ $SCORE -ge $TARGET_SCORE ]]; then
    log ""
    log "Target score reached! ($SCORE >= $TARGET_SCORE)"
    log "Harness complete after $VERSION iterations."
    break
  fi

  # 5b. Score drop > threshold → rollback
  if [[ $PREV_SCORE -gt 0 ]]; then
    SCORE_CHANGE=$((SCORE - PREV_SCORE))
    if [[ $SCORE_CHANGE -lt -$SCORE_DROP_THRESHOLD ]]; then
      log "[v$VERSION] Score dropped by $((PREV_SCORE - SCORE)) (> $SCORE_DROP_THRESHOLD). Rolling back."
      (cd "$PROJECT_ROOT" && git revert --no-edit HEAD~1 2>/dev/null) || true
      log "Reverted v$VERSION changes. Continuing with previous state."
      continue
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
log "  git log --oneline --grep='quiz-analyzer.*harness'"
log ""
log "Compare first and last:"
log "  git diff HEAD~$VERSION -- solutions/business/quiz-analyzer/frontend/"
