#!/bin/sh
# Quick smoke validation for project/execution/manifest.json.
#
# Catches the most common write errors without spinning up Zod:
#   - JSON parse failure
#   - missing required top-level fields
#   - duplicate readingSteps[].idx
#   - quiz answers where correct >= options.length
#
# Usage:
#   sh skills/manifest-editor/scripts/lint-manifest.sh
#
# Exit code 0 = OK, non-zero = fail.

set -e
MANIFEST="project/execution/manifest.json"

if [ ! -f "$MANIFEST" ]; then
  echo "✗ $MANIFEST not found"
  exit 1
fi

# Parse check
jq empty "$MANIFEST" 2>/dev/null || { echo "✗ JSON parse failed"; exit 1; }

# Required top-level fields (per ManifestSchema in
# solutions/business/live-lesson/backend/src/schemas/manifest.schema.ts)
for f in id title subject gradeLevel lessonType readingSteps; do
  jq -e ".\"$f\"" "$MANIFEST" >/dev/null 2>&1 || { echo "✗ missing top-level field: $f"; exit 1; }
done

# step.type, when present, must be "task" or "instruction" (Zod enum)
BAD_STEP_TYPE=$(jq '[.readingSteps[] | select(.type != null and .type != "task" and .type != "instruction")] | length' "$MANIFEST")
if [ "$BAD_STEP_TYPE" -gt 0 ]; then
  echo "✗ $BAD_STEP_TYPE readingSteps[].type value(s) are not \"task\" or \"instruction\""
  exit 1
fi

# Unique idx
TOTAL=$(jq '[.readingSteps[].idx] | length' "$MANIFEST")
UNIQUE=$(jq '[.readingSteps[].idx] | unique | length' "$MANIFEST")
if [ "$TOTAL" != "$UNIQUE" ]; then
  echo "✗ readingSteps[].idx not unique ($TOTAL items, $UNIQUE unique)"
  exit 1
fi

# Quiz correct index in bounds
BAD_QUIZ=$(jq '[.readingSteps[] | select(.answerKey.type == "quiz") | .answerKey.answers[] | select(.correct >= (.options | length))] | length' "$MANIFEST")
if [ "$BAD_QUIZ" -gt 0 ]; then
  echo "✗ $BAD_QUIZ quiz answer(s) have correct >= options.length"
  exit 1
fi

echo "✓ manifest passes smoke lint ($TOTAL steps)"
