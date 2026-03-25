#!/bin/bash
set -e

echo "Running harness checks..."

ERRORS=0

# Check 1: No empty serverUrl in production code
echo "  [1/2] Checking serverUrl patterns..."
if grep -rn "serverUrl:\s*['\"]['\"]" --include="*.ts" --include="*.tsx" solutions/ packages/ 2>/dev/null | grep -v "\.test\." | grep -v "\.spec\." | grep -v "__tests__" | grep -v "node_modules"; then
  echo "  ERROR: Empty serverUrl detected. Must use absolute URL (e.g. http://localhost:3001)."
  ERRORS=$((ERRORS + 1))
else
  echo "  OK"
fi

# Check 2: All core backend controllers must have @ApiTags
echo "  [2/2] Checking @ApiTags coverage (core backend)..."
for f in $(find packages/backend/src -name "*.controller.ts" -not -path "*/node_modules/*" 2>/dev/null); do
  if ! grep -q "@ApiTags" "$f"; then
    echo "  ERROR: $f missing @ApiTags decorator"
    ERRORS=$((ERRORS + 1))
  fi
done
echo "  OK"

# Warning: solution backend controllers without @ApiTags (non-blocking)
WARNINGS=0
for f in $(find solutions -name "*.controller.ts" -not -path "*/node_modules/*" -not -path "*/.agent-workspace/*" 2>/dev/null); do
  if ! grep -q "@ApiTags" "$f"; then
    WARNINGS=$((WARNINGS + 1))
  fi
done
if [ $WARNINGS -gt 0 ]; then
  echo "  WARNING: $WARNINGS solution controller(s) missing @ApiTags (non-blocking)"
fi

# Summary
if [ $ERRORS -gt 0 ]; then
  echo ""
  echo "FAILED: $ERRORS harness check(s) failed."
  exit 1
fi

echo ""
echo "All harness checks passed."
