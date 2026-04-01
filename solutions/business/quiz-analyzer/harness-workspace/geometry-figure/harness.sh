#!/usr/bin/env bash
set -euo pipefail

# Allow nested claude -p invocations from within a Claude Code session
unset CLAUDECODE 2>/dev/null || true

# ─────────────────────────────────────────────────────────
# Geometry Figure Engine — Harness Orchestrator
# ─────────────────────────────────────────────────────────
# Usage:
#   ./harness.sh              # Run Phase 0 (bug fix) + Phase 1+ (prompt loop)
#   ./harness.sh --resume     # Skip Phase 0, continue from last iteration
#   ./harness.sh --dry-run    # Show plan without running
#   ./harness.sh --skip-bugfix # Skip Phase 0 only
#   ./harness.sh --max-cost 8 # Stop if estimated cost exceeds $8

HARNESS_DIR="$(cd "$(dirname "$0")" && pwd)"
SOLUTION_ROOT="$(cd "$HARNESS_DIR/../.." && pwd)"
PROJECT_ROOT="$(cd "$SOLUTION_ROOT/../../.." && pwd)"
PROBLEM_SKILL="$SOLUTION_ROOT/skills/geometry-problem-figure/SKILL.md"
SOLUTION_SKILL="$SOLUTION_ROOT/skills/geometry-solution-figure/SKILL.md"
SCHEMAS_FILE="$SOLUTION_ROOT/mcp-server/src/common/schemas.ts"
GEO_COMPONENT="$SOLUTION_ROOT/frontend/src/components/GeometryFigure.tsx"

# Config
MAX_ITERATIONS=8
TARGET_SCORE=85
DIMINISHING_THRESHOLD=3
COST_PER_ITERATION=2.00
CCAAS_PORT=3001

# Parse flags
RESUME=false
DRY_RUN=false
SKIP_BUGFIX=false
MAX_COST=50
while [[ $# -gt 0 ]]; do
  case $1 in
    --resume) RESUME=true; SKIP_BUGFIX=true; shift ;;
    --dry-run) DRY_RUN=true; shift ;;
    --skip-bugfix) SKIP_BUGFIX=true; shift ;;
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

check_ccaas() {
  nc -z localhost "$CCAAS_PORT" 2>/dev/null
}

# ─────────────────────────────────────────────────────────
# Pre-flight checks
# ─────────────────────────────────────────────────────────

log "=== Geometry Figure Engine Harness ==="
log "Solution root: $SOLUTION_ROOT"
log "Problem skill: $PROBLEM_SKILL"
log "Solution skill: $SOLUTION_SKILL"
log "Max iterations: $MAX_ITERATIONS"
log "Target score: $TARGET_SCORE/100"
log "Max cost: \$$MAX_COST"

# Ensure required files exist
for f in SPEC.md EVAL_CRITERIA.md prompts/generator.md prompts/evaluator.md prompts/bug-fix.md progress.md benchmark.json test-runner.mjs validation/validate-construction.mjs; do
  if [[ ! -f "$HARNESS_DIR/$f" ]]; then
    err "Missing required file: $f"
    exit 1
  fi
done

# Ensure SKILL.md files exist
for f in "$PROBLEM_SKILL" "$SOLUTION_SKILL"; do
  if [[ ! -f "$f" ]]; then
    err "SKILL.md not found at $f"
    exit 1
  fi
done

# Ensure output directories exist
mkdir -p "$HARNESS_DIR/eval-reports" "$HARNESS_DIR/changelogs" "$HARNESS_DIR/results"

# Check claude CLI
if ! command -v claude &>/dev/null; then
  err "claude CLI not found. Install: https://docs.anthropic.com/claude-code"
  exit 1
fi

# Check Node.js
if ! command -v node &>/dev/null; then
  err "Node.js not found."
  exit 1
fi

if $DRY_RUN; then
  log ""
  log "[DRY RUN] Phase 0: Bug fix (GeometryFigure.tsx + schemas.ts)"
  log "[DRY RUN]   - 4 bugs: evalExpr, resolveParent, expandElement, animation range"
  log "[DRY RUN]   - Agent: claude -p with bug-fix.md instructions"
  log "[DRY RUN]   - Verify: tsc --noEmit"
  log ""
  log "[DRY RUN] Phase 1+: Prompt optimization loop"
  log "[DRY RUN]   - Max $MAX_ITERATIONS iterations"
  log "[DRY RUN]   - CCAAS backend: localhost:$CCAAS_PORT (must be running)"
  log "[DRY RUN]   - Test runner: 10 geometry questions"
  log "[DRY RUN]   - Validator: static JSON checks"
  log "[DRY RUN]   - Generator: claude -p → modifies SKILL.md files"
  log "[DRY RUN]   - Evaluator: claude -p → scores results"
  log "[DRY RUN]   - Estimated cost: ~\$$(echo "$MAX_ITERATIONS * $COST_PER_ITERATION" | bc)"
  log "[DRY RUN]   - Estimated time: ~$(echo "$MAX_ITERATIONS * 60" | bc) minutes"
  exit 0
fi

# ─────────────────────────────────────────────────────────
# Phase 0: Bug Fix (one-time)
# ─────────────────────────────────────────────────────────

if ! $SKIP_BUGFIX; then
  log ""
  log "════════════════════════════════════════"
  log "  Phase 0: Bug Fix"
  log "════════════════════════════════════════"

  BUGFIX_PROMPT="你是一位 React/TypeScript 开发者。按照 bug-fix.md 中的指令修复 GeometryFigure.tsx 和 schemas.ts 的 4 个 bug。

请严格按照以下步骤执行：

1. 读 bug 修复指南: $HARNESS_DIR/prompts/bug-fix.md
2. 读当前 GeometryFigure.tsx: $GEO_COMPONENT
3. 读当前 schemas.ts: $SCHEMAS_FILE
4. 按 bug-fix.md 中的 Fix 方案逐个修复 4 个 bug
5. 修复完成后运行 tsc --noEmit 验证无类型错误

重要：
- 只修改 GeometryFigure.tsx 和 schemas.ts
- 不改功能，只修 bug
- 每个 bug 的 fix 方案已在 bug-fix.md 中详细说明"

  log "[Phase 0] Running bug-fix agent..."

  if echo "$BUGFIX_PROMPT" | claude -p \
    --allowedTools "Read,Edit,Write,Bash,Glob,Grep" \
    > "$HARNESS_DIR/changelogs/phase0-bugfix-output.txt" 2>&1; then
    log "[Phase 0] Bug fix agent complete."
  else
    err "[Phase 0] Bug fix agent failed. Check changelogs/phase0-bugfix-output.txt"
    err "[Phase 0] Continuing to Phase 1 anyway..."
  fi

  # Git snapshot
  log "[Phase 0] Creating git snapshot..."
  (cd "$PROJECT_ROOT" && \
    git add "$GEO_COMPONENT" "$SCHEMAS_FILE" 2>/dev/null && \
    git commit -m "fix(quiz-analyzer): geometry renderer bug fixes" -q 2>/dev/null) || \
    log "[Phase 0] WARNING: git commit failed (no changes or git issue)"
fi

# ─────────────────────────────────────────────────────────
# Verify CCAAS backend is running
# ─────────────────────────────────────────────────────────

if ! check_ccaas; then
  err "CCAAS backend not running on port $CCAAS_PORT"
  err "Start it with: npm run dev:backend (from project root)"
  exit 1
fi
log "CCAAS backend running on port $CCAAS_PORT"

# Quick health check
if curl -sf "http://localhost:${CCAAS_PORT}/api/docs" -o /dev/null 2>/dev/null; then
  log "CCAAS health check: OK"
else
  log "WARNING: CCAAS /api/docs not reachable — may affect test runner"
fi

# ─────────────────────────────────────────────────────────
# Phase 1+: Prompt Optimization Loop
# ─────────────────────────────────────────────────────────

# Determine starting version
if $RESUME; then
  VERSION=$(get_last_version)
  log "Resuming from v$VERSION"
else
  VERSION=0
  log "Starting Phase 1 from v0"
fi

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

  # --- Prepare paths ---
  PREV_VERSION=$((VERSION - 1))
  LAST_EVAL="$HARNESS_DIR/eval-reports/v${PREV_VERSION}-eval.md"
  LAST_RESULTS="$HARNESS_DIR/results/v${PREV_VERSION}-results.json"
  CHANGELOG_PATH="$HARNESS_DIR/changelogs/v${VERSION}-changelog.md"
  EVAL_REPORT="$HARNESS_DIR/eval-reports/v${VERSION}-eval.md"
  RESULTS_FILE="$HARNESS_DIR/results/v${VERSION}-results.json"
  VALIDATION_FILE="$HARNESS_DIR/results/v${VERSION}-validation.json"

  LAST_EVAL_CONTEXT=""
  LAST_RESULTS_CONTEXT=""
  if [[ -f "$LAST_EVAL" ]]; then
    LAST_EVAL_CONTEXT="
3. 读上一轮评估报告: $LAST_EVAL — 重点看扣分项和 Top 3 改进建议"
  else
    LAST_EVAL_CONTEXT="
3. (第一轮，无上轮 eval report)"
  fi
  if [[ -f "$LAST_RESULTS" ]]; then
    LAST_RESULTS_CONTEXT="
4. 读上一轮 test results: $LAST_RESULTS — 看哪些题的 JSON 有问题"
  else
    LAST_RESULTS_CONTEXT="
4. (第一轮，无上轮 test results)"
  fi

  # ─── Step 1: Generator ───
  log "[v$VERSION] Running Generator agent..."

  GENERATOR_PROMPT="你是 geometry skill prompt 优化的 Generator agent。这是第 $VERSION 轮迭代。

**关键**: 你运行在 fresh context 中，没有前几轮的记忆。磁盘上的文件是你的唯一上下文。

请严格按顺序执行：

1. 读任务规范: $HARNESS_DIR/SPEC.md
2. 读历史记录: $HARNESS_DIR/progress.md${LAST_EVAL_CONTEXT}${LAST_RESULTS_CONTEXT}
5. 读当前 Problem SKILL.md: $PROBLEM_SKILL
6. 读当前 Solution SKILL.md: $SOLUTION_SKILL
7. 读 Zod schemas: $SCHEMAS_FILE
8. 读 benchmark: $HARNESS_DIR/benchmark.json

然后：
9. 分析上轮扣分最多的维度，制定本轮改进计划
10. 修改 SKILL.md 文件（保持结构，每轮改 ≤30%）
11. **必须**将 changelog 写入: ${CHANGELOG_PATH}

完整指南: $HARNESS_DIR/prompts/generator.md"

  GENERATOR_TOOLS="Read,Edit,Write,Glob,Grep,Bash"

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

  # ─── Step 1b: Git snapshot ───
  log "[v$VERSION] Creating git snapshot..."
  (cd "$PROJECT_ROOT" && \
    git add "$PROBLEM_SKILL" "$SOLUTION_SKILL" 2>/dev/null && \
    git commit -m "prompt(quiz-analyzer): geometry harness v$VERSION iteration" -q 2>/dev/null) || \
    log "[v$VERSION] WARNING: git commit failed (no changes or git issue)"

  # ─── Step 2: Test Runner ───
  log "[v$VERSION] Running test runner (10 geometry questions)..."

  if ! node "$HARNESS_DIR/test-runner.mjs" --version "v$VERSION" \
    > "$HARNESS_DIR/results/v${VERSION}-runner-output.txt" 2>&1; then
    err "[v$VERSION] Test runner failed."
    echo "| v$VERSION | $TIMESTAMP | FAIL | - | - | - | - | - | - | - | - | Test runner failed |" >> "$HARNESS_DIR/progress.md"
    continue
  fi

  if [[ ! -f "$RESULTS_FILE" ]]; then
    err "[v$VERSION] Results file not found at $RESULTS_FILE"
    echo "| v$VERSION | $TIMESTAMP | FAIL | - | - | - | - | - | - | - | - | Results file missing |" >> "$HARNESS_DIR/progress.md"
    continue
  fi

  log "[v$VERSION] Test runner complete."

  # ─── Step 2b: Static Validation ───
  log "[v$VERSION] Running static validation..."
  node "$HARNESS_DIR/validation/validate-construction.mjs" --results "$RESULTS_FILE" \
    > "$HARNESS_DIR/results/v${VERSION}-validation-output.txt" 2>&1 || \
    log "[v$VERSION] WARNING: Validation script had errors"

  # ─── Step 3: Evaluator ───
  log "[v$VERSION] Running Evaluator agent..."

  EVAL_VALIDATION_CONTEXT=""
  if [[ -f "$VALIDATION_FILE" ]]; then
    EVAL_VALIDATION_CONTEXT="
4. 读静态校验结果: $VALIDATION_FILE"
  fi

  EVALUATOR_PROMPT="你是 geometry figure 质量的独立 Evaluator agent。这是第 $VERSION 轮迭代的评估。

请按照以下步骤执行：

1. 读评分标准: $HARNESS_DIR/EVAL_CRITERIA.md
2. 读 benchmark 数据: $HARNESS_DIR/benchmark.json
3. 读本轮 test results: $RESULTS_FILE${EVAL_VALIDATION_CONTEXT}
5. 逐题按 7 维度评分 + penalty 检查
6. 汇总分数，输出 eval report

将完整报告写入: $EVAL_REPORT

**关键**：报告最后一行必须是 \`总分: XX/100\`

完整的 Evaluator 指南在: $HARNESS_DIR/prompts/evaluator.md"

  EVALUATOR_TOOLS="Read,Write,Glob,Grep,Bash"

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
  D1=$(grep -oE 'D1 Schema.*[0-9]/5' "$EVAL_REPORT" | grep -oE '[0-9]/5' | head -1 || echo "?")
  D2=$(grep -oE 'D2 Ref.*[0-9]/5' "$EVAL_REPORT" | grep -oE '[0-9]/5' | head -1 || echo "?")
  D3=$(grep -oE 'D3 .*Correct.*[0-9]/5' "$EVAL_REPORT" | grep -oE '[0-9]/5' | head -1 || echo "?")
  D4=$(grep -oE 'D4 Bbox.*[0-9]/5' "$EVAL_REPORT" | grep -oE '[0-9]/5' | head -1 || echo "?")
  D5=$(grep -oE 'D5 Visual.*[0-9]/5' "$EVAL_REPORT" | grep -oE '[0-9]/5' | head -1 || echo "?")
  D6=$(grep -oE 'D6 Anim.*[0-9]/5' "$EVAL_REPORT" | grep -oE '[0-9]/5' | head -1 || echo "?")
  D7=$(grep -oE 'D7 Constr.*[0-9]/5' "$EVAL_REPORT" | grep -oE '[0-9]/5' | head -1 || echo "?")
  PENALTIES=$(grep -oE 'Penalty 小计.*-[0-9]+' "$EVAL_REPORT" | grep -oE '-[0-9]+' | head -1 || echo "0")

  TOP_ISSUE=$(grep -A2 'Top 3\|未解决问题' "$EVAL_REPORT" | grep '^\s*1\.' | sed 's/^\s*1\.\s*//' | head -c 80 || echo "see eval report")
  if [[ -z "$TOP_ISSUE" ]]; then
    TOP_ISSUE="see eval-reports/v${VERSION}-eval.md"
  fi

  echo "| v$VERSION | $TIMESTAMP | $SCORE | $D1 | $D2 | $D3 | $D4 | $D5 | $D6 | $D7 | $PENALTIES | $TOP_ISSUE |" >> "$HARNESS_DIR/progress.md"

  # ─── Step 4b: Commit eval results ───
  (cd "$HARNESS_DIR" && \
    git add -A eval-reports/ changelogs/ results/ progress.md 2>/dev/null && \
    git commit -m "docs(quiz-analyzer): geometry harness v$VERSION eval score $SCORE" -q 2>/dev/null) || true

  # ─── Step 5: Check exit conditions ───

  # 5a. Target score reached
  if [[ $SCORE -ge $TARGET_SCORE ]]; then
    log ""
    log "Target score reached! ($SCORE >= $TARGET_SCORE)"
    log "Harness complete after $VERSION iterations."
    break
  fi

  # 5b. Rollback check (score dropped > 10 from previous)
  if [[ $PREV_SCORE -gt 0 ]]; then
    DROP=$((PREV_SCORE - SCORE))
    if [[ $DROP -gt 10 ]]; then
      log "[v$VERSION] Score dropped by $DROP (> 10). Rolling back SKILL.md files..."
      git checkout HEAD~1 -- "$PROBLEM_SKILL" "$SOLUTION_SKILL" 2>/dev/null || true
      log "[v$VERSION] SKILL.md files rolled back to v$((VERSION - 1))"
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
log "  results/         — raw test runner output + validation"
log ""
log "Git history (each iteration is a commit):"
log "  git log --oneline --grep='geometry harness'"
