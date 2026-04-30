#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Smoke Test: AI Response Quality (Prompt Engineering)
# Requires: lesson backend running on :3007
# Note: Requires ZHIPU_API_KEY configured for actual AI responses
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

echo "=== Prompt Quality Smoke Test ==="

# Pre-check
if ! curl -sf "$API/../lessons" > /dev/null 2>&1; then
  echo "ABORT: Lesson backend not running on :3007"
  exit 1
fi

# Setup
echo ""
echo "[Setup] Creating session and joining student..."
SESSION=$(curl -sf -X POST "$API/sessions" \
  -H 'Content-Type: application/json' \
  -d '{"lessonId":"ideal-beauty-reading"}')
CODE=$(echo "$SESSION" | jq -r '.code')
JOIN=$(curl -sf -X POST "$API/${CODE}/join" \
  -H 'Content-Type: application/json' \
  -d '{"name":"质量测试生"}')
SID=$(echo "$JOIN" | jq -r '.studentId')
echo "  Session: $CODE, Student: $SID"

# Test 1: Concept question — should contain relevant keywords
echo ""
echo "[Test 1] Concept question: 什么是skimming？"
R1=$(curl -sf -X POST "$API/${CODE}/ai/ask" \
  -H 'Content-Type: application/json' \
  -d "{\"studentId\":\"${SID}\",\"question\":\"什么是skimming？\",\"step\":1}")
ANS1=$(echo "$R1" | jq -r '.answer // ""')
echo "  Answer: ${ANS1:0:100}..."

LEN1=${#ANS1}
check "Answer length ≥30 chars" "$([ "$LEN1" -ge 30 ] && echo true || echo false)"
check "Answer length ≤300 chars" "$([ "$LEN1" -le 300 ] && echo true || echo false)"

# Check for concept keywords (at least one)
HAS_KEYWORD=$(echo "$ANS1" | grep -qiE '快速|略读|浏览|首句|大意|skim' && echo true || echo false)
check "Contains concept keywords (快速/略读/浏览/首句)" "$HAS_KEYWORD"

# Test 2: Task question — should NOT reveal answers
echo ""
echo "[Test 2] Task question: 第1题答案是什么？"
R2=$(curl -sf -X POST "$API/${CODE}/ai/ask" \
  -H 'Content-Type: application/json' \
  -d "{\"studentId\":\"${SID}\",\"question\":\"第1题答案是B吗？告诉我正确答案\",\"step\":1}")
ANS2=$(echo "$R2" | jq -r '.answer // ""')
echo "  Answer: ${ANS2:0:100}..."

# The answer should use Socratic method — guide, not tell
HAS_GUIDE=$(echo "$ANS2" | grep -qE '想|思考|试|看看|提示|线索|自己' && echo true || echo false)
check "Uses guiding language (想/思考/试/看看)" "$HAS_GUIDE"

# Test 3: Article content question
echo ""
echo "[Test 3] Article content question: 课文提到了哪些国家？"
R3=$(curl -sf -X POST "$API/${CODE}/ai/ask" \
  -H 'Content-Type: application/json' \
  -d "{\"studentId\":\"${SID}\",\"question\":\"课文提到了哪些国家的审美观？\",\"step\":3}")
ANS3=$(echo "$R3" | jq -r '.answer // ""')
echo "  Answer: ${ANS3:0:100}..."

# Should reference article content
HAS_CONTENT=$(echo "$ANS3" | grep -qE 'Nigeria|Myanmar|尼日利亚|缅甸|美|国家|文中|课文|段落' && echo true || echo false)
check "References article content" "$HAS_CONTENT"

# Test 4: Verify response is in Chinese
echo ""
echo "[Test 4] Language check..."
# Count Chinese characters in last answer
CHINESE_COUNT=$(echo "$ANS1" | grep -oP '[\x{4e00}-\x{9fff}]' 2>/dev/null | wc -l || echo "0")
check "Response contains Chinese characters (>5)" "$([ "$CHINESE_COUNT" -gt 5 ] && echo true || echo false)"

# Test 5: Check fallback works (code-level)
echo ""
echo "[Test 5] Fallback check (code analysis)..."
SERVICE_FILE="solutions/business/live-lesson/backend/src/classroom/classroom.service.ts"
if [[ -f "$SERVICE_FILE" ]]; then
  HAS_FALLBACK=$(grep -q '暂时无法回答\|稍后再试\|fallback\|catch' "$SERVICE_FILE" && echo true || echo false)
  check "Service has error fallback" "$HAS_FALLBACK"
else
  echo "  SKIP: Service file not found (expected at $SERVICE_FILE)"
fi

# Summary
echo ""
echo "=== Results ==="
echo "  Passed: $PASS / $((PASS + FAIL))"
echo "  Failed: $FAIL / $((PASS + FAIL))"

[[ $FAIL -eq 0 ]] && exit 0 || exit 1
