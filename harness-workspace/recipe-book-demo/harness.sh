#!/usr/bin/env bash
set -eu

# ============================================================
# recipe-book-demo Harness — Code Mode Iteration Loop
#
# Builds solutions/business/recipe-book/ from scratch:
#   Custom ingredient transform + RecipeProvider + CCAAS tenant
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
TASK_NAME="recipe-book-demo"
MAX_ITERATIONS=8
SCORE_THRESHOLD=90
MIN_IMPROVEMENT=3
ROLLBACK_THRESHOLD=5
MAX_COST_USD="${MAX_COST:-200}"

# Agent tool permissions
GENERATOR_TOOLS="Read,Write,Edit,Grep,Glob,Bash"
EVALUATOR_TOOLS="Read,Write,Grep,Glob,Bash"

# Cost estimates
COST_PER_ITERATION=7.00

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
  "packages/entity-document/src/"
  "packages/context-layer/src/core/"
  "solutions/business/edu-platform/"
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
  grep -E '(总分|Total)[：:][[:space:]]*[0-9]+' "$eval_file" | head -1 | sed 's/.*[：:][[:space:]]*//' | sed 's|/.*||' | tr -d '[:space:]'
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
  # Compare frozen dirs against a pre-generator baseline to detect only NEW changes.
  # Uses FROZEN_BASELINE (set before generator runs) to avoid flagging pre-existing changes.
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
  # Store count in global var instead of return code (avoids set -e crash)
  FROZEN_VIOLATION_COUNT=$violations
}

run_validation() {
  echo "  [Validation] Running typecheck + tests in recipe-book backend..."
  local errors=0

  if [[ ! -d "${SOLUTION_DIR}/backend" ]]; then
    echo "  [Validation] recipe-book/backend does not exist yet"
    return 1
  fi

  cd "${SOLUTION_DIR}/backend"

  # Install deps if needed
  if [[ ! -d "node_modules" ]]; then
    echo "  [Validation] Installing dependencies..."
    npm install --no-audit --no-fund 2>&1 | tail -3
  fi

  # Run tests if vitest config exists
  if [[ -f "vitest.config.ts" ]] || [[ -f "vitest.config.js" ]]; then
    if ! npx vitest run 2>&1 | tail -10; then
      echo "  [Validation] recipe-book vitest FAILED"
      errors=$((errors + 1))
    fi
  else
    echo "  [Validation] No vitest config found, skipping tests"
  fi

  # TypeScript check
  if ! npx tsc --noEmit 2>&1 | tail -5; then
    echo "  [Validation] recipe-book tsc FAILED"
    errors=$((errors + 1))
  fi

  cd "$REPO_ROOT"
  return $errors
}

run_generator() {
  local version=$1
  local prev=$((version - 1))
  local prompt=$(cat "$PROMPTS_DIR/generator.md")

  # Inject iteration-specific context
  if [[ $version -eq 1 ]]; then
    prompt="${prompt}

---
## 迭代上下文（编排器注入）

这是**第一轮**迭代 (v1)。从头构建整个 recipe-book solution。

**你的起点**：solution 目录不存在，需要从零创建所有文件。先读 SPEC.md 和参考实现（edu-platform），然后按 Phase 1→5 顺序创建。

**优先级**：Phase 1 (NestJS 脚手架) + Phase 2 (ingredient transform) 最关键。如果时间不够，先确保 Phase 1-3 完成。

**Changelog 保存到**: ${CHANGELOG_DIR}/v1-changelog.md"
  else
    prompt="${prompt}

---
## 迭代上下文（编排器注入）

这是第 **v${version}** 轮迭代。

**你的起点**：solution 目录已被前几轮创建/修改。先读现有代码，在此基础上改进。

**读 eval report**: harness-workspace/recipe-book-demo/eval-reports/v${prev}-eval.md — 告诉你哪里扣分了、如何修复。

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

  # Inject version number
  prompt=$(echo "$prompt" | sed "s/{N}/${version}/g")

  cd "$REPO_ROOT"
  claude_safe -p "$prompt" --allowedTools "$EVALUATOR_TOOLS" 2>&1 || {
    echo "ERROR: Evaluator failed on v${version}" >&2
    return 1
  }
}

# --- Pre-flight ---

mkdir -p "$EVAL_DIR" "$CHANGELOG_DIR"

# --- Main Loop ---

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  ${TASK_NAME} Harness — Code Mode                          ║"
echo "║  Artifact: solutions/business/recipe-book/                  ║"
echo "║  Frozen:                                                    ║"
echo "║    packages/entity-document/src/                            ║"
echo "║    packages/context-layer/src/core/                         ║"
echo "║    solutions/business/edu-platform/                         ║"
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

# If resuming, recover prev_score from last eval
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
  echo "  [Step 1/5] Running Generator..."
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
  echo "  [Step 2/5] Checking frozen directories..."
  cd "$REPO_ROOT"
  FROZEN_VIOLATION_COUNT=0
  check_frozen_dirs
  if [[ $FROZEN_VIOLATION_COUNT -gt 0 ]]; then
    echo "  WARNING: ${FROZEN_VIOLATION_COUNT} frozen directory(ies) had new changes reverted."
  fi

  # ─── Step 3: Validation (typecheck + tests) ───
  echo ""
  echo "  [Step 3/5] Running validation..."
  if ! run_validation; then
    echo "  Validation FAILED. Reverting solution and skipping to next iteration."
    cd "$REPO_ROOT"
    git checkout -- "solutions/business/recipe-book/" 2>/dev/null || true
    append_progress $i "FAIL" "Validation failed" "typecheck/test error"
    continue
  fi

  # ─── Git snapshot: Generator iteration ───
  cd "$REPO_ROOT"
  git add \
    "solutions/business/recipe-book/" \
    "${CHANGELOG_DIR}/" 2>/dev/null || true
  git commit -m "feat(recipe-book): demo v${i} iteration" --allow-empty 2>/dev/null || true

  # ─── Step 4: Evaluator ───
  echo ""
  echo "  [Step 4/5] Running Evaluator..."
  run_evaluator $i || {
    echo "  Evaluator failed. Retrying once..."
    sleep 5
    run_evaluator $i || {
      echo "  Evaluator failed twice. Stopping."
      append_progress $i "ERROR" "Evaluator failure" "N/A"
      break
    }
  }

  # ─── Step 5: Extract results from FILES ───
  echo ""
  echo "  [Step 5/5] Extracting results..."

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

  # Extract key changes from changelog FILE
  changelog_file="${CHANGELOG_DIR}/v${i}-changelog.md"
  if [[ -f "$changelog_file" ]]; then
    changes=$(grep "^- " "$changelog_file" | head -3 | tr '\n' '; ' | cut -c1-100)
  else
    changes="(no changelog file)"
  fi

  # Extract top issue from eval report FILE
  top_issue=$(grep -A1 "Priority Fix" "$eval_file" 2>/dev/null | tail -1 | sed 's/^[0-9. ]*//' | cut -c1-80 || echo "N/A")

  append_progress "$i" "$score" "$changes" "$top_issue"
  echo "  Score: ${score}/100"

  # Git snapshot: eval
  cd "$REPO_ROOT"
  git add "${EVAL_DIR}/" "${PROGRESS_FILE}" 2>/dev/null || true
  git commit -m "feat(recipe-book): demo v${i} eval — score ${score}/100" --allow-empty 2>/dev/null || true

  # ─── Exit conditions ───

  # 1. Score threshold
  if [[ "$score" -ge "$SCORE_THRESHOLD" ]]; then
    echo ""
    echo "  Score threshold reached! (${score} >= ${SCORE_THRESHOLD})"
    break
  fi

  # 2. Regression detection + auto-revert
  if [[ $prev_score -gt 0 && $score -lt $((prev_score - ROLLBACK_THRESHOLD)) ]]; then
    echo ""
    echo "  REGRESSION detected: ${prev_score} -> ${score} (delta < -${ROLLBACK_THRESHOLD}). Reverting solution."
    cd "$REPO_ROOT"
    git checkout HEAD~2 -- \
      solutions/business/recipe-book/ 2>/dev/null || true
    git add -A && git commit -m "feat(recipe-book): demo v${i} REVERTED — regression ${prev_score}->${score}" 2>/dev/null || true
    continue
  fi

  # 3. Diminishing returns
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
echo "  Solution:  solutions/business/recipe-book/"
echo "  History:   git log --grep='recipe-book.*demo' --oneline"
echo ""
echo "  Next steps:"
echo "    cat ${PROGRESS_FILE}"
echo "    cd solutions/business/recipe-book/backend && npx vitest run"
echo "    cd solutions/business/recipe-book/backend && npx tsc --noEmit"
echo ""
