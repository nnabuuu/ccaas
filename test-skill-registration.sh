#!/bin/bash
# Test Skill Registration System
# Verifies quiz-analyzer skills are registered and services are configured correctly

set -e

echo "🧪 Testing Skill Registration System"
echo "======================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Check CCAAS Backend Health
echo "1️⃣  Testing CCAAS Backend..."
if curl -sf http://localhost:3001/api/v1/health > /dev/null; then
  echo -e "${GREEN}✅ CCAAS backend is running${NC}"
else
  echo -e "${RED}❌ CCAAS backend is NOT running${NC}"
  echo "   Start it with: cd packages/backend && npm run start:dev"
  exit 1
fi
echo ""

# Test 2: Check Quiz-Analyzer Backend Health
echo "2️⃣  Testing Quiz-Analyzer Backend..."
QUIZ_HEALTH=$(curl -s http://localhost:3005/health)
if echo "$QUIZ_HEALTH" | grep -q "healthy"; then
  QUIZ_COUNT=$(echo "$QUIZ_HEALTH" | python3 -c "import sys, json; print(json.load(sys.stdin)['database']['quizCount'])")
  echo -e "${GREEN}✅ Quiz-analyzer backend is running (${QUIZ_COUNT} quizzes in DB)${NC}"
else
  echo -e "${RED}❌ Quiz-analyzer backend is NOT running${NC}"
  echo "   Start it with: cd solutions/quiz-analyzer/backend && npm run start:dev"
  exit 1
fi
echo ""

# Test 3: Check Skills Registered
echo "3️⃣  Testing Skill Registration..."
SKILLS_RESPONSE=$(curl -s "http://localhost:3001/api/v1/skills?tenantId=quiz-analyzer")
SKILLS_COUNT=$(echo "$SKILLS_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('total', 0))")

if [ "$SKILLS_COUNT" -eq 4 ]; then
  echo -e "${GREEN}✅ All 4 skills are registered${NC}"
  echo "$SKILLS_RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); [print(f'   • {s[\"slug\"]}: {s[\"status\"]}, enabled={s[\"enabled\"]}') for s in data.get('items', [])]"
else
  echo -e "${RED}❌ Expected 4 skills, found ${SKILLS_COUNT}${NC}"
  echo "   Register skills with: cd packages/backend && npm run skill:import -- quiz-analyzer"
  exit 1
fi
echo ""

# Test 4: Check Database
echo "4️⃣  Testing Database..."
DB_PATH="packages/backend/.agent-workspace/data.db"
if [ -f "$DB_PATH" ]; then
  DB_SKILLS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM skills WHERE tenantId='227f2b75-d73a-d450-27ee-d523e270161f';")
  echo -e "${GREEN}✅ Database contains ${DB_SKILLS} skills for quiz-analyzer tenant${NC}"
else
  echo -e "${RED}❌ Database not found at ${DB_PATH}${NC}"
  exit 1
fi
echo ""

# Test 5: Check Frontend Configuration
echo "5️⃣  Testing Frontend Configuration..."
FRONTEND_CONFIG="solutions/quiz-analyzer/frontend/src/hooks/useQuizSession.ts"
if grep -q "tenantId: TENANT_ID" "$FRONTEND_CONFIG" && grep -q "TENANT_ID = 'quiz-analyzer'" "$FRONTEND_CONFIG"; then
  echo -e "${GREEN}✅ Frontend correctly configured with tenantId: 'quiz-analyzer'${NC}"
else
  echo -e "${YELLOW}⚠️  Frontend configuration may need review${NC}"
fi
echo ""

# Test 6: Check Frontend Running
echo "6️⃣  Testing Frontend..."
if curl -sf http://localhost:5282 > /dev/null; then
  echo -e "${GREEN}✅ Frontend is running at http://localhost:5282${NC}"
else
  echo -e "${YELLOW}⚠️  Frontend is NOT running${NC}"
  echo "   Start it with: cd solutions/quiz-analyzer/frontend && npm run dev"
fi
echo ""

# Summary
echo "======================================"
echo -e "${GREEN}🎉 All automated tests passed!${NC}"
echo ""
echo "📝 Manual Testing Steps:"
echo "   1. Open http://localhost:5282 in your browser"
echo "   2. Open DevTools Console (F12)"
echo "   3. Enter quiz text: '1+1=?'"
echo "   4. Click '🚀 开始分析'"
echo ""
echo "✅ Expected Behavior:"
echo "   • Console shows: 'Auto-loading tenant skills for: quiz-analyzer'"
echo "   • AI calls 'parse_quiz_content' (NOT 'list_issues')"
echo "   • Console shows: '📦 Quiz analysis update received'"
echo "   • Middle column displays parsed quiz"
echo ""
echo "❌ If AI uses wrong tools:"
echo "   • Check backend logs for skill loading"
echo "   • Verify frontend sends tenantId in requests"
echo "   • See docs: packages/backend/docs/SKILL_REGISTRATION.md#troubleshooting"
echo ""
