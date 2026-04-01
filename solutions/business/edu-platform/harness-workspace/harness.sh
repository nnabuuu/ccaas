#!/usr/bin/env bash
set -euo pipefail

# Allow nested claude -p invocations from within a Claude Code session
unset CLAUDECODE 2>/dev/null || true

# ─────────────────────────────────────────────────────────
# Edu-Platform Skill + Documentation — Harness Orchestrator
# ─────────────────────────────────────────────────────────
# Usage:
#   ./harness.sh              # Run from v0
#   ./harness.sh --resume     # Continue from last iteration
#   ./harness.sh --dry-run    # Show plan without running
#   ./harness.sh --max-cost 8 # Stop if estimated cost exceeds $8

HARNESS_DIR="$(cd "$(dirname "$0")" && pwd)"
SOLUTION_ROOT="$(cd "$HARNESS_DIR/.." && pwd)"
PROJECT_ROOT="$(cd "$SOLUTION_ROOT/../../.." && pwd)"

# Files that Generator can modify (reverted on large score drops)
REVERT_FILES=(
  "skills/quiz-generator/SKILL.md"
  "skills/student-analysis/SKILL.md"
  "skills/lesson-plan-generator/SKILL.md"
  "mcp-server/src/index.ts"
  "solution.json"
)

# Files that Generator creates (removed on full revert)
REVERT_NEW_FILES=(
  "README.md"
  "SOLUTION_DESIGN.md"
  "CLAUDE.md"
  "mcp-server/README.md"
)

# Config
MAX_ITERATIONS=5
TARGET_SCORE=85
DIMINISHING_THRESHOLD=3  # stop if improvement < this for 2 consecutive rounds
COST_PER_ITERATION=1.50  # rough estimate in USD (generator + evaluator, no test runner)

# Parse flags
RESUME=false
DRY_RUN=false
MAX_COST=20
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

# ─────────────────────────────────────────────────────────
# Pre-flight checks
# ─────────────────────────────────────────────────────────

log "=== Edu-Platform Skill + Documentation Harness ==="
log "Solution root: $SOLUTION_ROOT"
log "Max iterations: $MAX_ITERATIONS"
log "Target score: $TARGET_SCORE/100"
log "Max cost: \$$MAX_COST"

# Ensure required harness files exist
for f in SPEC.md EVAL_CRITERIA.md prompts/generator.md prompts/evaluator.md progress.md; do
  if [[ ! -f "$HARNESS_DIR/$f" ]]; then
    err "Missing required file: $f"
    exit 1
  fi
done

# Ensure skill files exist
for skill in lesson-plan-generator quiz-generator student-analysis; do
  if [[ ! -f "$SOLUTION_ROOT/skills/$skill/SKILL.md" ]]; then
    err "SKILL.md not found: skills/$skill/SKILL.md"
    exit 1
  fi
done

# Ensure MCP server source exists
if [[ ! -f "$SOLUTION_ROOT/mcp-server/src/index.ts" ]]; then
  err "MCP server index.ts not found"
  exit 1
fi

# Ensure output directories exist
mkdir -p "$HARNESS_DIR/eval-reports" "$HARNESS_DIR/changelogs"

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
  log "[DRY RUN] Generator: claude -p → modifies SKILL.md files + creates docs"
  log "[DRY RUN] Automated check: npx tsc --noEmit on mcp-server"
  log "[DRY RUN] Evaluator: claude -p → static analysis + scoring"
  log "[DRY RUN] Estimated cost: ~\$$(echo "$MAX_ITERATIONS * $COST_PER_ITERATION" | bc)"
  log "[DRY RUN] Estimated time: ~$(echo "$MAX_ITERATIONS * 15" | bc) minutes"

  # Quick validation checks
  log ""
  log "[DRY RUN] Validation checks:"

  # Check for non-existent widgets in current SKILL.md files
  WIDGET_COUNT=$(grep -rn 'FormCollect\|TreeSelector\|MetricDashboard\|BarList' "$SOLUTION_ROOT/skills"/*/SKILL.md 2>/dev/null | wc -l | tr -d ' ')
  log "[DRY RUN]   Non-existent widgets in SKILL.md: $WIDGET_COUNT occurrences"

  # Check doc files
  for doc in README.md SOLUTION_DESIGN.md CLAUDE.md mcp-server/README.md; do
    if [[ -f "$SOLUTION_ROOT/$doc" ]]; then
      log "[DRY RUN]   $doc: EXISTS"
    else
      log "[DRY RUN]   $doc: MISSING"
    fi
  done

  # Check MCP server compilation
  log "[DRY RUN]   MCP server tsc check..."
  if (cd "$SOLUTION_ROOT/mcp-server" && npx tsc --noEmit 2>/dev/null); then
    log "[DRY RUN]   MCP server: COMPILES"
  else
    log "[DRY RUN]   MCP server: COMPILE ERROR"
  fi

  exit 0
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

  GENERATOR_PROMPT="你是 edu-platform solution 的 Generator agent。这是第 $VERSION 轮迭代。

**关键**: 你运行在 fresh context 中，没有前几轮的记忆。磁盘上的文件是你的唯一上下文。

请严格按顺序执行：

1. 读任务规范: $HARNESS_DIR/SPEC.md
2. 读评分标准: $HARNESS_DIR/EVAL_CRITERIA.md
3. 读历史记录: $HARNESS_DIR/progress.md${LAST_EVAL_CONTEXT}
5. 读标杆 SKILL.md: $SOLUTION_ROOT/skills/lesson-plan-generator/SKILL.md — 学习正确模式
6. 读需修复的 SKILL.md:
   - $SOLUTION_ROOT/skills/quiz-generator/SKILL.md
   - $SOLUTION_ROOT/skills/student-analysis/SKILL.md
7. 读 MCP 工具定义: $SOLUTION_ROOT/mcp-server/src/index.ts
8. 读 Solution 配置: $SOLUTION_ROOT/solution.json
9. 读参考原型: $SOLUTION_ROOT/reference/chat-interface.html

然后：
10. 分析上轮扣分（如有），制定本轮改进计划
11. 修复 quiz-generator/SKILL.md — 替换 FormCollect/TreeSelector 为 show_info_card
12. 修复 student-analysis/SKILL.md — 替换 MetricDashboard/BarList 为 show_info_card
13. 微调 lesson-plan-generator/SKILL.md（仅在扣分时修改）
14. 创建文档: README.md, SOLUTION_DESIGN.md, CLAUDE.md, mcp-server/README.md
15. 验证 solution.json 配置正确
16. **必须**将 changelog 写入: ${CHANGELOG_PATH}

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

  # --- Check changelog was written ---
  if [[ ! -f "$CHANGELOG_PATH" ]]; then
    log "[v$VERSION] WARNING: Generator did not write changelog to $CHANGELOG_PATH"
  fi

  # ─── Step 1b: Automated checks ───
  log "[v$VERSION] Running automated checks..."

  # Check 1: Non-existent widgets should be zero
  WIDGET_HITS=$(grep -rn 'FormCollect\|TreeSelector\|MetricDashboard\|BarList' "$SOLUTION_ROOT/skills"/*/SKILL.md 2>/dev/null | wc -l | tr -d ' ')
  log "[v$VERSION] Non-existent widgets remaining: $WIDGET_HITS"

  # Check 2: MCP server TypeScript compilation
  TSC_PASS="yes"
  if ! (cd "$SOLUTION_ROOT/mcp-server" && npx tsc --noEmit 2>"$HARNESS_DIR/changelogs/v${VERSION}-tsc-errors.txt"); then
    TSC_PASS="no"
    log "[v$VERSION] WARNING: MCP server tsc failed. See changelogs/v${VERSION}-tsc-errors.txt"
  else
    log "[v$VERSION] MCP server tsc: PASS"
  fi

  # Check 3: Documentation files exist
  DOC_COUNT=0
  for doc in README.md SOLUTION_DESIGN.md CLAUDE.md mcp-server/README.md; do
    [[ -f "$SOLUTION_ROOT/$doc" ]] && DOC_COUNT=$((DOC_COUNT + 1))
  done
  log "[v$VERSION] Documentation files: $DOC_COUNT/4"

  # ─── Step 1c: Git snapshot ───
  log "[v$VERSION] Creating git snapshot..."
  (cd "$PROJECT_ROOT" && \
    git add \
      "$SOLUTION_ROOT/skills"/*/SKILL.md \
      "$SOLUTION_ROOT/mcp-server/src/index.ts" \
      "$SOLUTION_ROOT/solution.json" \
      "$SOLUTION_ROOT/README.md" \
      "$SOLUTION_ROOT/SOLUTION_DESIGN.md" \
      "$SOLUTION_ROOT/CLAUDE.md" \
      "$SOLUTION_ROOT/mcp-server/README.md" \
      2>/dev/null && \
    git commit -m "prompt(edu-platform): harness v$VERSION iteration" -q 2>/dev/null) || \
    log "[v$VERSION] WARNING: git commit failed (no changes or git issue)"

  # ─── Step 2: Evaluator ───
  log "[v$VERSION] Running Evaluator agent..."

  EVALUATOR_PROMPT="你是 edu-platform solution 质量的独立 Evaluator agent。这是第 $VERSION 轮迭代的评估。

请按照以下步骤执行：

1. 读评分标准: $HARNESS_DIR/EVAL_CRITERIA.md
2. 读问题定义: $HARNESS_DIR/SPEC.md
3. 读被评估文件:
   - $SOLUTION_ROOT/skills/lesson-plan-generator/SKILL.md
   - $SOLUTION_ROOT/skills/quiz-generator/SKILL.md
   - $SOLUTION_ROOT/skills/student-analysis/SKILL.md
   - $SOLUTION_ROOT/mcp-server/src/index.ts
   - $SOLUTION_ROOT/solution.json
   - $SOLUTION_ROOT/README.md (如果存在)
   - $SOLUTION_ROOT/SOLUTION_DESIGN.md (如果存在)
   - $SOLUTION_ROOT/CLAUDE.md (如果存在)
   - $SOLUTION_ROOT/mcp-server/README.md (如果存在)
4. 按 7 维度逐项评分 + penalty 检查

自动化检查结果（供参考）:
- 残留虚构 widget 数量: $WIDGET_HITS
- MCP tsc --noEmit: $TSC_PASS
- 文档文件数量: $DOC_COUNT/4

5. 对 D4 维度，在 $SOLUTION_ROOT/mcp-server 目录执行 npx tsc --noEmit 验证编译
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

  # ─── Step 3: Extract score and update progress ───
  if [[ ! -f "$EVAL_REPORT" ]]; then
    err "[v$VERSION] Eval report not found at $EVAL_REPORT"
    echo "| v$VERSION | $TIMESTAMP | ? | - | - | - | - | - | - | - | - | Eval report missing |" >> "$HARNESS_DIR/progress.md"
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
  D6=$(grep -oE 'D6.*Score: [0-9]/5' "$EVAL_REPORT" | grep -oE '[0-9]/5' | head -1 || echo "?")
  D7=$(grep -oE 'D7.*Score: [0-9]/5' "$EVAL_REPORT" | grep -oE '[0-9]/5' | head -1 || echo "?")
  PENALTIES=$(grep -oE 'Penalty 小计.*-[0-9]+' "$EVAL_REPORT" | grep -oE '-[0-9]+' | head -1 || echo "0")

  # Extract top issue
  TOP_ISSUE=$(grep -A2 'Top 3\|未解决问题' "$EVAL_REPORT" | grep '^\s*1\.' | sed 's/^\s*1\.\s*//' | head -c 80 || echo "see eval report")
  if [[ -z "$TOP_ISSUE" ]]; then
    TOP_ISSUE="see eval-reports/v${VERSION}-eval.md"
  fi

  # Update progress.md
  echo "| v$VERSION | $TIMESTAMP | $SCORE | $D1 | $D2 | $D3 | $D4 | $D5 | $D6 | $D7 | $PENALTIES | $TOP_ISSUE |" >> "$HARNESS_DIR/progress.md"

  # ─── Step 3b: Commit eval results ───
  (cd "$HARNESS_DIR" && \
    git add -A eval-reports/ changelogs/ progress.md 2>/dev/null && \
    git commit -m "docs(edu-platform): harness v$VERSION eval score $SCORE" -q 2>/dev/null) || true

  # ─── Step 4: Check exit conditions ───

  # 4a. Target score reached
  if [[ $SCORE -ge $TARGET_SCORE ]]; then
    log ""
    log "Target score reached! ($SCORE >= $TARGET_SCORE)"
    log "Harness complete after $VERSION iterations."
    break
  fi

  # 4b. Rollback check (score dropped > 10 from previous)
  if [[ $PREV_SCORE -gt 0 ]]; then
    DROP=$((PREV_SCORE - SCORE))
    if [[ $DROP -gt 10 ]]; then
      log "[v$VERSION] Score dropped by $DROP (> 10). Rolling back modified files..."
      for f in "${REVERT_FILES[@]}"; do
        git checkout HEAD~1 -- "$SOLUTION_ROOT/$f" 2>/dev/null || true
      done
      for f in "${REVERT_NEW_FILES[@]}"; do
        git checkout HEAD~1 -- "$SOLUTION_ROOT/$f" 2>/dev/null || true
      done
      log "[v$VERSION] Files rolled back to v$((VERSION - 1))"
    fi
  fi

  # 4c. Diminishing returns
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
log ""
log "Git history (each iteration is a commit):"
log "  git log --oneline --grep='harness'"
