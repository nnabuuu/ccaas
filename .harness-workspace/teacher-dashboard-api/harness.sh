#!/usr/bin/env bash
set -euo pipefail

# Allow nested claude sessions (harness runs inside Claude Code)
unset CLAUDECODE 2>/dev/null || true

# ═══════════════════════════════════════════════════════════════
# teacher-dashboard-api harness — Code Mode orchestrator
# ═══════════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
HARNESS_DIR="$SCRIPT_DIR"
TASK_NAME="teacher-dashboard-api"
MODE="code"

# Config
MAX_ITERATIONS=5
SCORE_THRESHOLD=90
REGRESSION_THRESHOLD=5  # revert if score drops > this

# Paths
PROMPTS_DIR="$HARNESS_DIR/prompts"
CHANGELOG_DIR="$HARNESS_DIR/changelogs"
EVAL_DIR="$HARNESS_DIR/eval-reports"
STATE_FILE="$HARNESS_DIR/state.json"
PROGRESS_FILE="$HARNESS_DIR/progress.md"
SOURCE_DIR="$PROJECT_ROOT/solutions/business/live-lesson/backend"

# Tools
GENERATOR_TOOLS="Read,Write,Edit,Grep,Glob,Bash"
EVALUATOR_TOOLS="Read,Grep,Glob,Bash"

# Frozen files (entity files must not change)
FROZEN_FILES="solutions/business/live-lesson/backend/src/entities/student.entity.ts
solutions/business/live-lesson/backend/src/entities/submission.entity.ts
solutions/business/live-lesson/backend/src/entities/ai-question.entity.ts
solutions/business/live-lesson/backend/src/entities/classroom-session.entity.ts
solutions/business/live-lesson/backend/src/entities/lesson.entity.ts"

# ═══ Arg parsing ═══
DRY_RUN=false
RESUME=false
MAX_COST=""
RUN_STEP=""
RUN_ITERATION=""
SHOW_STATUS=false
REGISTER_DAGU=false
UNREGISTER_DAGU=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run) DRY_RUN=true; shift ;;
    --resume) RESUME=true; shift ;;
    --max-cost) MAX_COST="$2"; shift 2 ;;
    --step) RUN_STEP="$2"; shift 2 ;;
    --iteration) RUN_ITERATION="$2"; shift 2 ;;
    --status) SHOW_STATUS=true; shift ;;
    --register-dagu) REGISTER_DAGU=true; shift ;;
    --unregister-dagu) UNREGISTER_DAGU=true; shift ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

# ═══ jq dependency ═══
if ! command -v jq &>/dev/null; then
  echo "ERROR: jq is required but not installed."
  echo "  macOS:  brew install jq"
  echo "  Ubuntu: sudo apt-get install jq"
  exit 1
fi

# ═══ State helpers ═══
state_read() { jq -r "$1" "$STATE_FILE"; }
state_update() {
  local tmp="${STATE_FILE}.tmp"
  jq "$1" "$STATE_FILE" > "$tmp" && mv "$tmp" "$STATE_FILE"
}

state_init() {
  cat > "$STATE_FILE" <<STATEEOF
{
  "harness": "${TASK_NAME}",
  "mode": "${MODE}",
  "status": "running",
  "current_iteration": 1,
  "current_step": "generator",
  "max_iterations": ${MAX_ITERATIONS},
  "score_threshold": ${SCORE_THRESHOLD},
  "started_at": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "updated_at": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "iterations": []
}
STATEEOF
}

state_init_iteration() {
  local version=$1
  state_update "
    .current_iteration = ${version} |
    .updated_at = \"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\" |
    .iterations += [{
      \"version\": ${version},
      \"status\": \"in_progress\",
      \"steps\": {}
    }]"
}

state_step_start() {
  local idx=$1 step=$2
  state_update "
    .current_step = \"${step}\" |
    .updated_at = \"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\" |
    .iterations[${idx}].steps[\"${step}\"] = (.iterations[${idx}].steps[\"${step}\"] // {}) * {\"status\":\"running\",\"started_at\":\"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\"}"
}

state_step_complete() {
  local idx=$1 step=$2
  state_update "
    .updated_at = \"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\" |
    .iterations[${idx}].steps[\"${step}\"] = (.iterations[${idx}].steps[\"${step}\"] // {}) * {\"status\":\"completed\",\"completed_at\":\"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\"}"
}

state_step_fail() {
  local idx=$1 step=$2 error=$3
  local tmp="${STATE_FILE}.tmp"
  jq --arg err "$error" "
    .current_step = \"${step}\" |
    .updated_at = \"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\" |
    .iterations[${idx}].steps[\"${step}\"] = (.iterations[${idx}].steps[\"${step}\"] // {}) * {\"status\":\"failed\",\"error\":\$err}
  " "$STATE_FILE" > "$tmp" && mv "$tmp" "$STATE_FILE"
}

state_get_step_status() {
  local idx=$1 step=$2
  jq -r ".iterations[${idx}].steps[\"${step}\"].status // \"pending\"" "$STATE_FILE"
}

state_finish() {
  state_update ".status = \"${1}\" | .updated_at = \"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\""
}

state_print_summary() {
  echo "╔══════════════════════════════════════════════════╗"
  echo "║  Harness: $(state_read '.harness')"
  echo "║  Mode: $(state_read '.mode')"
  echo "║  Status: $(state_read '.status')"
  echo "║  Iteration: $(state_read '.current_iteration') / $(state_read '.max_iterations')"
  echo "║  Current step: $(state_read '.current_step')"
  echo "║  Started: $(state_read '.started_at')"
  echo "║  Updated: $(state_read '.updated_at')"
  echo "╚══════════════════════════════════════════════════╝"
  echo ""
  local count
  count=$(jq '.iterations | length' "$STATE_FILE")
  if [[ "$count" -gt 0 ]]; then
    echo "Iterations:"
    jq -r '.iterations[] | "  v\(.version): \(.status) — score \(.score // "N/A")"' "$STATE_FILE"
  fi
}

# ═══ Preflight ═══
check() {
  local desc=$1 cmd=$2 fix=$3
  if eval "$cmd" &>/dev/null; then
    echo "  [ok] ${desc}"
  else
    echo "  [FAIL] ${desc}"
    echo "    Fix: ${fix}"
    failed=$((failed + 1))
  fi
}

preflight() {
  echo "Running preflight checks..."
  local failed=0
  check "jq installed" "command -v jq" "brew install jq"
  check "claude CLI available" "command -v claude" "npm install -g @anthropic-ai/claude-code"
  check "better-sqlite3 installed" "cd '$SOURCE_DIR' && node -e \"require('better-sqlite3')\"" "cd $SOURCE_DIR && npm install"
  check "tests pass" "cd '$SOURCE_DIR' && npx jest --no-coverage 2>&1 | grep -q 'passed'" "Fix broken tests first"
  if [[ $failed -gt 0 ]]; then
    echo "ERROR: ${failed} preflight check(s) failed."
    exit 1
  fi
  echo "All preflight checks passed."
}

# ═══ Health check ═══
health_check() {
  local failed=0
  check "tests still pass" "cd '$SOURCE_DIR' && npx jest --no-coverage 2>&1 | grep -q 'passed'" "Revert last iteration"
  check "build compiles" "cd '$SOURCE_DIR' && npx nest build 2>&1" "Fix compile errors"
  if [[ $failed -gt 0 ]]; then
    echo "WARNING: ${failed} health check(s) failed. Pausing."
    state_update '.status = "paused"'
    return 1
  fi
  return 0
}

# ═══ Frozen file check ═══
check_frozen_files() {
  local violations=0
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    if cd "$PROJECT_ROOT" && git diff --name-only | grep -qF "$f"; then
      echo "FROZEN FILE VIOLATION: $f — reverting."
      git checkout -- "$f"
      violations=$((violations + 1))
    fi
  done <<< "$FROZEN_FILES"
  return $violations
}

# ═══ Progress log ═══
append_progress() {
  local version=$1 score=$2 changes=$3 top_issue=$4
  local ts
  ts=$(date '+%Y-%m-%d %H:%M')
  echo "| v${version} | ${ts} | ${score} | ${changes} | ${top_issue} |" >> "$PROGRESS_FILE"
}

# ═══ run_step wrapper ═══
run_step() {
  local idx=$1 step_name=$2 step_fn=$3
  shift 3

  local step_status
  step_status=$(state_get_step_status "$idx" "$step_name")
  if [[ "$step_status" == "completed" ]]; then
    echo "  [skip] ${step_name} (already completed)"
    return 0
  fi

  echo "  [run]  ${step_name}..."

  if [[ "$DRY_RUN" == true ]]; then
    echo "  [dry]  ${step_name} — skipped"
    return 0
  fi

  state_step_start "$idx" "$step_name"

  if $step_fn "$@"; then
    state_step_complete "$idx" "$step_name"
    echo "  [done] ${step_name}"
    return 0
  else
    state_step_fail "$idx" "$step_name" "step returned non-zero"
    echo "  [FAIL] ${step_name}"
    return 1
  fi
}

# ═══════════════════════════════════════════════════════════════
# STEP FUNCTIONS
# ═══════════════════════════════════════════════════════════════

step_generator() {
  local version=$1
  local prev=$((version - 1))
  local prompt
  prompt=$(cat "$PROMPTS_DIR/generator.md")

  if [[ $version -eq 1 ]]; then
    prompt="${prompt}

---
## 本轮指令

This is the FIRST iteration. Implement the gap items from SPEC.md.
Focus on the 1-2 highest-impact gaps first.
Save changelog to: ${CHANGELOG_DIR}/v1-changelog.md"
  else
    prompt="${prompt}

---
## 本轮指令

This is iteration ${version}.
Your STARTING POINT is: solutions/business/live-lesson/backend/src/classroom/classroom.service.ts — read it first.
Read ${EVAL_DIR}/v${prev}-eval.md for specific feedback to address.
Save changelog to: ${CHANGELOG_DIR}/v${version}-changelog.md"
  fi

  if [[ "$DRY_RUN" == true ]]; then
    echo "[DRY RUN] Would run generator v${version}"
    echo "$prompt" > "${CHANGELOG_DIR}/v${version}-changelog.md"
    return 0
  fi

  local cost_args=""
  if [[ -n "$MAX_COST" ]]; then
    cost_args="--max-budget-usd $MAX_COST"
  fi

  cd "$PROJECT_ROOT"
  claude -p "$prompt" --allowedTools "$GENERATOR_TOOLS" $cost_args
}

step_frozen_check() {
  cd "$PROJECT_ROOT"
  check_frozen_files || true
}

step_validation() {
  echo "Running tests..."
  cd "$SOURCE_DIR"
  if ! npx jest --no-coverage 2>&1; then
    echo "Tests failed."
    return 1
  fi
  echo "Running build..."
  if ! npx nest build 2>&1; then
    echo "Build failed."
    return 1
  fi
  return 0
}

step_git_post_gen() {
  local version=$1
  cd "$PROJECT_ROOT"
  git add solutions/business/live-lesson/backend/src/classroom/
  git commit -m "feat(backend): teacher-dashboard-api v${version} iteration

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>" || true
}

step_visual_qa() {
  local version=$1
  echo "Running visual QA checks..."
  if ! command -v npx &>/dev/null || ! npx playwright --version &>/dev/null 2>&1; then
    echo "WARNING: Playwright not available. Skipping visual QA."
    echo "SKIP: Playwright not available" > "$HARNESS_DIR/tests/visual-qa-report.txt"
    return 0
  fi
  bash "$HARNESS_DIR/tests/visual-qa.sh" || {
    echo "Visual QA found rendering issues. Continuing to evaluator."
    return 0  # Don't block — let evaluator assess penalty
  }
}

step_evaluator() {
  local version=$1
  local prompt
  prompt=$(cat "$PROMPTS_DIR/evaluator.md")

  prompt="${prompt}

---
## 本轮指令

Evaluate version ${version}.
Analyze: solutions/business/live-lesson/backend/src/classroom/classroom.service.ts
Tests: solutions/business/live-lesson/backend/src/classroom/classroom.service.spec.ts
Save your evaluation to: ${EVAL_DIR}/v${version}-eval.md

## Visual QA Report
Read the visual QA results at: ${HARNESS_DIR}/tests/visual-qa-report.txt"

  if [[ "$DRY_RUN" == true ]]; then
    echo "[DRY RUN] Would run evaluator v${version}"
    mkdir -p "$EVAL_DIR"
    echo "总分: 50/100" > "${EVAL_DIR}/v${version}-eval.md"
    return 0
  fi

  cd "$PROJECT_ROOT"
  claude -p "$prompt" --allowedTools "$EVALUATOR_TOOLS"
}

step_extract() {
  local version=$1
  local idx=$((version - 1))
  local eval_file="${EVAL_DIR}/v${version}-eval.md"

  if [[ ! -f "$eval_file" ]]; then
    echo "ERROR: eval report not found: $eval_file"
    return 1
  fi

  # Extract score
  local score
  score=$(grep -oE '(总分|Total)[：:][[:space:]]*[0-9]+' "$eval_file" | grep -oE '[0-9]+' | head -1)
  if [[ -z "$score" ]]; then
    echo "WARNING: Could not extract score from eval report. Defaulting to 0."
    score=0
  fi

  # Extract changes from changelog
  local changes=""
  local changelog_file="${CHANGELOG_DIR}/v${version}-changelog.md"
  if [[ -f "$changelog_file" ]]; then
    changes=$(grep "^- " "$changelog_file" 2>/dev/null | head -3 | tr '\n' '; ' || echo "")
  fi

  # Extract top issue
  local top_issue
  top_issue=$(grep -A1 "Priority Fix" "$eval_file" 2>/dev/null | tail -1 | head -c 80 || echo "")

  # Update state
  state_update ".iterations[${idx}].score = ${score} | .iterations[${idx}].changelog_summary = \"${changes}\""

  # Append to progress
  append_progress "$version" "$score" "${changes:0:60}" "${top_issue:0:60}"

  echo "Score: ${score}/100"
}

step_git_post_eval() {
  local version=$1
  cd "$PROJECT_ROOT"
  git add .harness-workspace/teacher-dashboard-api/
  git commit -m "feat(backend): teacher-dashboard-api v${version} eval

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>" || true
}

step_exit_check() {
  local version=$1
  local idx=$((version - 1))

  local score
  score=$(jq -r ".iterations[${idx}].score // 0" "$STATE_FILE")

  # Check threshold
  if [[ "$score" -ge "$SCORE_THRESHOLD" ]]; then
    echo "TARGET REACHED: ${score} >= ${SCORE_THRESHOLD}"
    state_update ".iterations[${idx}].status = \"completed\""
    state_finish "completed"
    return 1  # signal to stop
  fi

  # Check max iterations
  if [[ "$version" -ge "$MAX_ITERATIONS" ]]; then
    echo "MAX ITERATIONS reached: ${version} >= ${MAX_ITERATIONS}"
    state_update ".iterations[${idx}].status = \"completed\""
    state_finish "completed"
    return 1
  fi

  # Check regression
  if [[ $version -gt 1 ]]; then
    local prev_idx=$((version - 2))
    local prev_score
    prev_score=$(jq -r ".iterations[${prev_idx}].score // 0" "$STATE_FILE")
    if [[ "$prev_score" -gt 0 && "$score" -lt $((prev_score - REGRESSION_THRESHOLD)) ]]; then
      echo "REGRESSION: ${prev_score} → ${score}. Reverting source files."
      cd "$PROJECT_ROOT"
      git checkout HEAD~2 -- solutions/business/live-lesson/backend/src/classroom/
      git add solutions/business/live-lesson/backend/src/classroom/
      git commit -m "revert(backend): teacher-dashboard-api v${version} regression revert

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>" || true
      append_progress "$version" "REVERTED" "Regression from ${prev_score} to ${score}" "Auto-reverted"
    fi

    # Check diminishing returns (< 3 points for 2 consecutive)
    if [[ $version -ge 3 ]]; then
      local prev2_idx=$((version - 3))
      local prev2_score
      prev2_score=$(jq -r ".iterations[${prev2_idx}].score // 0" "$STATE_FILE")
      local delta1=$((score - prev_score))
      local delta2=$((prev_score - prev2_score))
      if [[ "$delta1" -lt 3 && "$delta2" -lt 3 && "$delta1" -ge 0 && "$delta2" -ge 0 ]]; then
        echo "DIMINISHING RETURNS: last two deltas < 3 (${delta2}, ${delta1}). Stopping."
        state_update ".iterations[${idx}].status = \"completed\""
        state_finish "completed"
        return 1
      fi
    fi
  fi

  state_update ".iterations[${idx}].status = \"completed\""
  return 0  # continue
}

# ═══════════════════════════════════════════════════════════════
# DAGU REGISTRATION
# ═══════════════════════════════════════════════════════════════

register_dagu() {
  local dags_dir="${DAGU_DAGS_DIR:-${HOME}/.dagu/dags}"
  if command -v dagu &>/dev/null && [[ -d "$dags_dir" ]]; then
    ln -sf "$HARNESS_DIR/dag.yaml" "$dags_dir/${TASK_NAME}.yaml"
    echo "Registered DAG: ${dags_dir}/${TASK_NAME}.yaml"
  else
    echo "DAGU not found or dags dir missing. Skipping registration."
  fi
}

unregister_dagu() {
  local dags_dir="${DAGU_DAGS_DIR:-${HOME}/.dagu/dags}"
  rm -f "$dags_dir/${TASK_NAME}.yaml"
  echo "Unregistered DAG: ${TASK_NAME}"
}

# ═══════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════

if [[ "$SHOW_STATUS" == true ]]; then
  [[ -f "$STATE_FILE" ]] && state_print_summary || echo "No state file found."
  exit 0
fi

if [[ "$REGISTER_DAGU" == true ]]; then register_dagu; exit 0; fi
if [[ "$UNREGISTER_DAGU" == true ]]; then unregister_dagu; exit 0; fi

# Single step mode (for DAGU)
if [[ -n "$RUN_STEP" && -n "$RUN_ITERATION" ]]; then
  local_idx=$((RUN_ITERATION - 1))
  case "$RUN_STEP" in
    generator)     step_generator "$RUN_ITERATION" ;;
    frozen_check)  step_frozen_check ;;
    validation)    step_validation ;;
    git_post_gen)  step_git_post_gen "$RUN_ITERATION" ;;
    visual_qa)     step_visual_qa "$RUN_ITERATION" ;;
    evaluator)     step_evaluator "$RUN_ITERATION" ;;
    extract)       step_extract "$RUN_ITERATION" ;;
    git_post_eval) step_git_post_eval "$RUN_ITERATION" ;;
    exit_check)    step_exit_check "$RUN_ITERATION" ;;
    *) echo "Unknown step: $RUN_STEP"; exit 1 ;;
  esac
  exit $?
fi

# Initialize or resume
if [[ "$RESUME" == true && -f "$STATE_FILE" ]]; then
  echo "Resuming from state.json..."
  start_iter=$(state_read '.current_iteration')
else
  echo "Starting fresh harness run..."
  state_init
  start_iter=1
fi

# Preflight (skip in dry-run)
if [[ "$DRY_RUN" != true ]]; then
  preflight
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ${TASK_NAME} — ${MODE} mode — max ${MAX_ITERATIONS} iterations"
echo "═══════════════════════════════════════════════════════════"
echo ""

for ((i=start_iter; i<=MAX_ITERATIONS; i++)); do
  echo "──── Iteration v${i} ────"
  local_idx=$((i - 1))

  # Check if iteration already exists (resume)
  existing=$(jq ".iterations[${local_idx}] // null" "$STATE_FILE")
  if [[ "$existing" == "null" ]]; then
    state_init_iteration "$i"
  fi

  # Step sequence: generator → frozen_check → validation → git → visual_qa → evaluator → extract → git → exit_check
  run_step "$local_idx" "generator" step_generator "$i" || { echo "Generator failed. Stopping."; break; }
  run_step "$local_idx" "frozen_check" step_frozen_check || true
  run_step "$local_idx" "validation" step_validation || {
    echo "Validation failed. Reverting source files..."
    cd "$PROJECT_ROOT"
    git checkout -- solutions/business/live-lesson/backend/src/classroom/
    append_progress "$i" "FAIL" "Validation failed" "typecheck/test error"
    continue
  }
  run_step "$local_idx" "git_post_gen" step_git_post_gen "$i" || true
  run_step "$local_idx" "visual_qa" step_visual_qa "$i" || true
  run_step "$local_idx" "evaluator" step_evaluator "$i" || { echo "Evaluator failed. Stopping."; break; }
  run_step "$local_idx" "extract" step_extract "$i" || { echo "Extract failed. Stopping."; break; }
  run_step "$local_idx" "git_post_eval" step_git_post_eval "$i" || true

  # Health check between iterations
  if [[ $i -lt $MAX_ITERATIONS && "$DRY_RUN" != true ]]; then
    health_check || { echo "Health check failed. Pausing."; break; }
  fi

  # Exit check (returns 1 to stop)
  run_step "$local_idx" "exit_check" step_exit_check "$i" && true || {
    echo ""
    echo "Harness finished."
    break
  }

  echo ""
done

echo ""
echo "Final state:"
state_print_summary
