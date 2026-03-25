#!/bin/bash
set -e

# Parse arguments
FULL_MODE=false
if [ "$1" = "--full" ]; then
  FULL_MODE=true
fi

echo "Running harness checks..."

ERRORS=0
WARNINGS=0

# Load baselines for ratchet mechanism
BASELINES_FILE="$(dirname "$0")/../.harness-baselines.json"
if command -v jq &>/dev/null && [ -f "$BASELINES_FILE" ]; then
  BASELINE_CONSOLE_LOG=$(jq -r '.console_log' "$BASELINES_FILE")
  BASELINE_ANY_TYPE=$(jq -r '.any_type' "$BASELINES_FILE")
  BASELINE_TODO_UNLINKED=$(jq -r '.todo_unlinked' "$BASELINES_FILE")
  BASELINE_ESLINT_DISABLE=$(jq -r '.eslint_disable' "$BASELINES_FILE")
  BASELINE_BACKEND_COVERAGE=$(jq -r '.backend_coverage' "$BASELINES_FILE")
elif [ -f "$BASELINES_FILE" ]; then
  # fallback to grep when jq is not available
  BASELINE_CONSOLE_LOG=$(grep '"console_log"' "$BASELINES_FILE" | grep -o '[0-9]*')
  BASELINE_ANY_TYPE=$(grep '"any_type"' "$BASELINES_FILE" | grep -o '[0-9]*')
  BASELINE_TODO_UNLINKED=$(grep '"todo_unlinked"' "$BASELINES_FILE" | grep -o '[0-9]*')
  BASELINE_ESLINT_DISABLE=$(grep '"eslint_disable"' "$BASELINES_FILE" | grep -o '[0-9]*')
  BASELINE_BACKEND_COVERAGE=$(grep '"backend_coverage"' "$BASELINES_FILE" | grep -o '[0-9]*')
else
  echo "  WARNING: .harness-baselines.json not found, ratchet disabled"
  BASELINE_CONSOLE_LOG=""
  BASELINE_ANY_TYPE=""
  BASELINE_TODO_UNLINKED=""
  BASELINE_ESLINT_DISABLE=""
  BASELINE_BACKEND_COVERAGE=""
fi

# ratchet_check <metric_name> <current_count> <baseline>
# Returns 0 on pass, 1 on regression (caller increments ERRORS)
ratchet_check() {
  local name="$1"
  local current="$2"
  local baseline="$3"

  if [ -z "$baseline" ]; then
    echo "  WARNING: $current $name found (no baseline to compare)"
    return 0
  fi

  if [ "$current" -gt "$baseline" ]; then
    echo "  ERROR: $name increased from $baseline to $current — fix before merging"
    return 1
  elif [ "$current" -lt "$baseline" ]; then
    echo "  WARNING: $current $name (baseline $baseline) — consider updating .harness-baselines.json to $current"
    return 0
  else
    echo "  WARNING: $current $name (at baseline $baseline)"
    return 0
  fi
}

# Check 1: No empty serverUrl in production code
echo "  [1/8] Checking serverUrl patterns..."
if grep -rn "serverUrl:\s*['\"]['\"]" --include="*.ts" --include="*.tsx" solutions/ packages/ 2>/dev/null | grep -v "\.test\." | grep -v "\.spec\." | grep -v "__tests__" | grep -v "node_modules"; then
  echo "  ERROR: Empty serverUrl detected. Must use absolute URL (e.g. http://localhost:3001)."
  ERRORS=$((ERRORS + 1))
else
  echo "  OK"
fi

# Check 2: All core backend controllers must have @ApiTags
echo "  [2/8] Checking @ApiTags coverage (core backend)..."
for f in $(find packages/backend/src -name "*.controller.ts" -not -path "*/node_modules/*" 2>/dev/null); do
  if ! grep -q "@ApiTags" "$f"; then
    echo "  ERROR: $f missing @ApiTags decorator"
    ERRORS=$((ERRORS + 1))
  fi
done
echo "  OK"

# Warning: solution backend controllers without @ApiTags (non-blocking)
for f in $(find solutions -name "*.controller.ts" -not -path "*/node_modules/*" -not -path "*/.agent-workspace/*" 2>/dev/null); do
  if ! grep -q "@ApiTags" "$f"; then
    WARNINGS=$((WARNINGS + 1))
  fi
done
if [ $WARNINGS -gt 0 ]; then
  echo "  WARNING: $WARNINGS solution controller(s) missing @ApiTags (non-blocking)"
fi

# Check 3: No console.log in production code (ratchet — cannot increase)
echo "  [3/8] Checking console.log in production code..."
CONSOLE_LOG_COUNT=$(grep -rn "console\.log" --include="*.ts" --include="*.tsx" packages/ solutions/ 2>/dev/null \
  | grep -v "\.test\." | grep -v "\.spec\." | grep -v "__tests__" | grep -v "node_modules" | wc -l | tr -d ' ')
if [ "$CONSOLE_LOG_COUNT" -eq 0 ]; then
  echo "  OK"
else
  if ! ratchet_check "console.log" "$CONSOLE_LOG_COUNT" "$BASELINE_CONSOLE_LOG"; then
    ERRORS=$((ERRORS + 1))
  else
    WARNINGS=$((WARNINGS + 1))
  fi
fi

# Check 4: No @ts-ignore / @ts-nocheck (ERROR — zero tolerance)
echo "  [4/8] Checking @ts-ignore / @ts-nocheck..."
if grep -rn "@ts-ignore\|@ts-nocheck" --include="*.ts" --include="*.tsx" packages/ solutions/ 2>/dev/null | grep -v "node_modules"; then
  echo "  ERROR: @ts-ignore or @ts-nocheck detected. Fix the type error instead of suppressing it."
  ERRORS=$((ERRORS + 1))
else
  echo "  OK"
fi

# Check 5: any type escape (ratchet — cannot increase)
echo "  [5/8] Checking 'any' type usage in production code..."
ANY_COUNT=$(grep -rn ": any\b\|as any\b" --include="*.ts" --include="*.tsx" packages/ solutions/ 2>/dev/null \
  | grep -v "\.test\." | grep -v "\.spec\." | grep -v "__tests__" | grep -v "node_modules" | wc -l | tr -d ' ')
if [ "$ANY_COUNT" -eq 0 ]; then
  echo "  OK"
else
  if ! ratchet_check "any type" "$ANY_COUNT" "$BASELINE_ANY_TYPE"; then
    ERRORS=$((ERRORS + 1))
  else
    WARNINGS=$((WARNINGS + 1))
  fi
fi

# Check 6: TODO/FIXME without issue reference (ratchet — cannot increase)
echo "  [6/8] Checking TODO/FIXME without issue reference..."
UNLINKED_TODO_COUNT=$(grep -rn "TODO\|FIXME" --include="*.ts" --include="*.tsx" packages/ solutions/ 2>/dev/null \
  | grep -v "node_modules" | grep -v -E "(NIE-|CCaas-|Linear)" | wc -l | tr -d ' ')
if [ "$UNLINKED_TODO_COUNT" -eq 0 ]; then
  echo "  OK"
else
  if ! ratchet_check "unlinked TODO/FIXME" "$UNLINKED_TODO_COUNT" "$BASELINE_TODO_UNLINKED"; then
    ERRORS=$((ERRORS + 1))
  else
    WARNINGS=$((WARNINGS + 1))
  fi
fi

# Check 7: eslint-disable comments (ratchet — cannot increase)
echo "  [7/8] Checking eslint-disable comments..."
ESLINT_DISABLE_COUNT=$(grep -rn "eslint-disable" --include="*.ts" --include="*.tsx" packages/ solutions/ 2>/dev/null \
  | grep -v node_modules | grep -v "\.test\." | grep -v "\.spec\." | grep -v "__tests__" | wc -l | tr -d ' ')
if [ "$ESLINT_DISABLE_COUNT" -eq 0 ]; then
  echo "  OK"
else
  if ! ratchet_check "eslint-disable" "$ESLINT_DISABLE_COUNT" "$BASELINE_ESLINT_DISABLE"; then
    ERRORS=$((ERRORS + 1))
  else
    WARNINGS=$((WARNINGS + 1))
  fi
fi

# Check 8: Test coverage (backend) — only in --full mode
if [ "$FULL_MODE" = true ]; then
  echo "  [8/8] Checking backend test coverage..."
  (cd packages/backend && npx jest --coverage --coverageReporters=json-summary --silent 2>/dev/null) || true
  if [ -f packages/backend/coverage/coverage-summary.json ]; then
    STMT_PCT=$(python3 -c "import json; print(int(json.load(open('packages/backend/coverage/coverage-summary.json'))['total']['statements']['pct']))" 2>/dev/null || echo "")
    if [ -n "$STMT_PCT" ]; then
      if ! ratchet_check "backend coverage %" "$STMT_PCT" "$BASELINE_BACKEND_COVERAGE"; then
        ERRORS=$((ERRORS + 1))
      fi
    else
      echo "  WARNING: Could not parse coverage data"
    fi
  else
    echo "  WARNING: coverage-summary.json not found, skipping coverage check"
  fi
else
  echo "  [8/8] Skipping coverage check (use --full to enable)"
fi

# Summary
echo ""
if [ $WARNINGS -gt 0 ]; then
  echo "WARNINGS: $WARNINGS warning(s) (non-blocking)"
fi
if [ $ERRORS -gt 0 ]; then
  echo "FAILED: $ERRORS harness check(s) failed."
  exit 1
fi

echo "All harness checks passed."
