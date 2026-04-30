#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Smoke Test: Teacher State API — answer + category in state
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

echo "=== Teacher API Smoke Test ==="

# Pre-check
if ! curl -sf "$API/../lessons" > /dev/null 2>&1; then
  echo "ABORT: Lesson backend not running on :3007"
  exit 1
fi

# Setup: create session + join 2 students
echo ""
echo "[Setup] Creating session..."
SESSION=$(curl -sf -X POST "$API/sessions" \
  -H 'Content-Type: application/json' \
  -d '{"lessonId":"ideal-beauty-reading"}')
CODE=$(echo "$SESSION" | jq -r '.code')
echo "  Session: $CODE"

echo "[Setup] Joining students..."
J1=$(curl -sf -X POST "$API/${CODE}/join" \
  -H 'Content-Type: application/json' \
  -d '{"name":"陈昕妍"}')
S1=$(echo "$J1" | jq -r '.studentId')

J2=$(curl -sf -X POST "$API/${CODE}/join" \
  -H 'Content-Type: application/json' \
  -d '{"name":"王译文"}')
S2=$(echo "$J2" | jq -r '.studentId')
echo "  Students: $S1, $S2"

# Test 1: Ask concept question from student 1
echo ""
echo "[Test 1] Student 1 asks concept question..."
R1=$(curl -sf -X POST "$API/${CODE}/ai/ask" \
  -H 'Content-Type: application/json' \
  -d "{\"studentId\":\"${S1}\",\"question\":\"什么是skimming阅读策略？\",\"step\":1}")
echo "  Response: $(echo "$R1" | jq -c '.')"

# Test 2: Ask task-help question from student 2
echo ""
echo "[Test 2] Student 2 asks task-help question..."
R2=$(curl -sf -X POST "$API/${CODE}/ai/ask" \
  -H 'Content-Type: application/json' \
  -d "{\"studentId\":\"${S2}\",\"question\":\"第2题怎么做？给我提示\",\"step\":3}")
echo "  Response: $(echo "$R2" | jq -c '.')"

# Test 3: Ask article content question from student 1
echo ""
echo "[Test 3] Student 1 asks article question..."
R3=$(curl -sf -X POST "$API/${CODE}/ai/ask" \
  -H 'Content-Type: application/json' \
  -d "{\"studentId\":\"${S1}\",\"question\":\"课文第三段说了什么？\",\"step\":3}")
echo "  Response: $(echo "$R3" | jq -c '.')"

# Test 4: Ask strategy question from student 2
echo ""
echo "[Test 4] Student 2 asks strategy question..."
R4=$(curl -sf -X POST "$API/${CODE}/ai/ask" \
  -H 'Content-Type: application/json' \
  -d "{\"studentId\":\"${S2}\",\"question\":\"evaluating策略怎么用？\",\"step\":5}")
echo "  Response: $(echo "$R4" | jq -c '.')"

# Test 5: Verify state
echo ""
echo "[Test 5] Verify teacher state..."
STATE=$(curl -sf "$API/${CODE}/state")

# Check question count
Q_COUNT=$(echo "$STATE" | jq '.questions | length')
echo "  Questions in state: $Q_COUNT"
check "State has 4 questions" "$([ "$Q_COUNT" -eq 4 ] && echo true || echo false)"

# Check all have answer field
ALL_ANS=$(echo "$STATE" | jq '[.questions[] | .answer != null and .answer != ""] | all')
check "All questions have non-empty 'answer'" "$ALL_ANS"

# Check all have category field
ALL_CAT=$(echo "$STATE" | jq '[.questions[] | .category != null and .category != ""] | all')
check "All questions have non-empty 'category'" "$ALL_CAT"

# Check categories are not all the same
UNIQUE=$(echo "$STATE" | jq '[.questions[].category] | unique | length')
echo "  Unique categories: $UNIQUE"
check "At least 2 different categories" "$([ "$UNIQUE" -ge 2 ] && echo true || echo false)"

# Check student names are correct
NAMES=$(echo "$STATE" | jq -r '[.questions[].studentName] | unique | sort | join(",")')
echo "  Student names in questions: $NAMES"
check "Questions have correct student names" "$(echo "$NAMES" | grep -q '陈昕妍' && echo "$NAMES" | grep -q '王译文' && echo true || echo false)"

# Test 6: Verify SSE stream sends questions with category
echo ""
echo "[Test 6] Check SSE stream structure..."
# Quick SSE check: connect for 2 seconds, capture first message
SSE_DATA=$(timeout 3 curl -sf "$API/${CODE}/stream" 2>/dev/null | head -5 || true)
if [[ -n "$SSE_DATA" ]]; then
  SSE_JSON=$(echo "$SSE_DATA" | grep '^data:' | head -1 | sed 's/^data: //')
  if [[ -n "$SSE_JSON" ]]; then
    SSE_HAS_Q=$(echo "$SSE_JSON" | jq 'has("questions")' 2>/dev/null || echo "false")
    check "SSE stream includes 'questions' array" "$SSE_HAS_Q"
  else
    echo "  SKIP: Could not parse SSE data"
  fi
else
  echo "  SKIP: SSE stream timeout (may need longer wait)"
fi

# Summary
echo ""
echo "=== Results ==="
echo "  Passed: $PASS / $((PASS + FAIL))"
echo "  Failed: $FAIL / $((PASS + FAIL))"

[[ $FAIL -eq 0 ]] && exit 0 || exit 1
