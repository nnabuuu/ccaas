#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Smoke Test: Dynamic Categorization System
# Requires: lesson backend running on :3007
# ============================================================

API="http://localhost:3007/api/classroom"
PASS=0
FAIL=0

check() {
  local desc="$1" result="$2"
  if [[ "$result" == "true" ]]; then
    echo "  ✓ $desc"
    PASS=$((PASS + 1))
  else
    echo "  ✗ $desc"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== Categorization Smoke Test ==="

# Pre-check: backend alive
if ! curl -sf "$API/../lessons" > /dev/null 2>&1; then
  echo "ABORT: Lesson backend not running on :3007"
  exit 1
fi

# 1. Create session
echo ""
echo "[Step 1] Create session..."
SESSION=$(curl -sf -X POST "$API/sessions" \
  -H 'Content-Type: application/json' \
  -d '{"lessonId":"ideal-beauty-reading"}')
CODE=$(echo "$SESSION" | jq -r '.code')
echo "  Session code: $CODE"

# 2. Join a student
echo ""
echo "[Step 2] Join student..."
JOIN=$(curl -sf -X POST "$API/${CODE}/join" \
  -H 'Content-Type: application/json' \
  -d '{"name":"测试同学A"}')
SID=$(echo "$JOIN" | jq -r '.studentId')
echo "  Student ID: $SID"

# 3. Ask a concept question
echo ""
echo "[Step 3] Ask concept question..."
R1=$(curl -sf -X POST "$API/${CODE}/ai/ask" \
  -H 'Content-Type: application/json' \
  -d "{\"studentId\":\"${SID}\",\"question\":\"什么是skimming？\",\"step\":1}")
echo "  Response: $(echo "$R1" | jq -c '.')"

HAS_ANSWER=$(echo "$R1" | jq 'has("answer")')
HAS_CATEGORY=$(echo "$R1" | jq 'has("category")')
check "API returns 'answer' key" "$HAS_ANSWER"
check "API returns 'category' key" "$HAS_CATEGORY"

CATEGORY=$(echo "$R1" | jq -r '.category // "null"')
check "Category is non-empty" "$([ "$CATEGORY" != "null" ] && [ -n "$CATEGORY" ] && echo true || echo false)"

# 4. Ask a task-help question
echo ""
echo "[Step 4] Ask task-help question..."
R2=$(curl -sf -X POST "$API/${CODE}/ai/ask" \
  -H 'Content-Type: application/json' \
  -d "{\"studentId\":\"${SID}\",\"question\":\"第1题答案是什么？\",\"step\":1}")
CAT2=$(echo "$R2" | jq -r '.category // "null"')
echo "  Category: $CAT2"
check "Task-help question has category" "$([ "$CAT2" != "null" ] && [ -n "$CAT2" ] && echo true || echo false)"

# 5. Ask an article content question
echo ""
echo "[Step 5] Ask article content question..."
R3=$(curl -sf -X POST "$API/${CODE}/ai/ask" \
  -H 'Content-Type: application/json' \
  -d "{\"studentId\":\"${SID}\",\"question\":\"Nigeria的审美观是什么？\",\"step\":3}")
CAT3=$(echo "$R3" | jq -r '.category // "null"')
echo "  Category: $CAT3"
check "Article question has category" "$([ "$CAT3" != "null" ] && [ -n "$CAT3" ] && echo true || echo false)"

# 6. Verify state has categories
echo ""
echo "[Step 6] Verify state..."
STATE=$(curl -sf "$API/${CODE}/state")
Q_COUNT=$(echo "$STATE" | jq '.questions | length')
echo "  Questions in state: $Q_COUNT"
check "State has ≥3 questions" "$([ "$Q_COUNT" -ge 3 ] && echo true || echo false)"

# Check every question has category
ALL_HAVE_CAT=$(echo "$STATE" | jq '[.questions[] | has("category")] | all')
check "All questions in state have 'category' field" "$ALL_HAVE_CAT"

# Check every question has answer
ALL_HAVE_ANS=$(echo "$STATE" | jq '[.questions[] | has("answer")] | all')
check "All questions in state have 'answer' field" "$ALL_HAVE_ANS"

# 7. Verify different categories exist
echo ""
echo "[Step 7] Category diversity check..."
UNIQUE_CATS=$(echo "$STATE" | jq '[.questions[].category // "null"] | unique | length')
echo "  Unique categories: $UNIQUE_CATS"
check "At least 2 different categories" "$([ "$UNIQUE_CATS" -ge 2 ] && echo true || echo false)"

# Summary
echo ""
echo "=== Results ==="
echo "  Passed: $PASS / $((PASS + FAIL))"
echo "  Failed: $FAIL / $((PASS + FAIL))"

[[ $FAIL -eq 0 ]] && exit 0 || exit 1
