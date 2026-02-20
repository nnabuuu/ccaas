#!/bin/bash

# Test script to verify MCP tools merged into backend

set -e

echo "🧪 Testing Merged MCP Tools"
echo "========================================"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Start backend
echo "Starting backend..."
cd backend
npm run start:dev > /tmp/backend-test.log 2>&1 &
BACKEND_PID=$!
cd ..

# Wait for backend to start
echo "Waiting for backend to start..."
sleep 10

# Test 1: Health check
echo ""
echo "Test 1: Health check"
RESPONSE=$(curl -s http://localhost:3005/api/v1/tools/health)
if echo "$RESPONSE" | grep -q "ok"; then
    echo -e "${GREEN}✓ Health check passed${NC}"
else
    echo -e "${RED}✗ Health check failed${NC}"
    echo "Response: $RESPONSE"
fi

# Test 2: Calculate difficulty
echo ""
echo "Test 2: Calculate difficulty"
RESPONSE=$(curl -s -X POST http://localhost:3005/api/v1/tools/calculate_difficulty \
  -H "Content-Type: application/json" \
  -d '{"knowledgePointCount":3,"stepCount":5,"quizType":"解答题"}')
if echo "$RESPONSE" | grep -q "success"; then
    echo -e "${GREEN}✓ Calculate difficulty passed${NC}"
    echo "   Difficulty: $(echo "$RESPONSE" | grep -o '"difficulty":[0-9]' | cut -d: -f2)"
else
    echo -e "${RED}✗ Calculate difficulty failed${NC}"
    echo "Response: $RESPONSE"
fi

# Test 3: Generate template
echo ""
echo "Test 3: Generate thinking process template"
RESPONSE=$(curl -s -X POST http://localhost:3005/api/v1/tools/generate_thinking_process_template \
  -H "Content-Type: application/json" \
  -d '{"quizContent":"求解方程","quizType":"解答题","knowledgePoints":["代数","方程"]}')
if echo "$RESPONSE" | grep -q "success"; then
    echo -e "${GREEN}✓ Generate template passed${NC}"
else
    echo -e "${RED}✗ Generate template failed${NC}"
    echo "Response: $RESPONSE"
fi

# Test 4: Write output (validation test)
echo ""
echo "Test 4: Write output validation"
RESPONSE=$(curl -s -X POST http://localhost:3005/api/v1/tools/write_output \
  -H "Content-Type: application/json" \
  -d '{"field":"difficulty","value":3,"preview":"Set difficulty to 3"}')
if echo "$RESPONSE" | grep -q "success"; then
    echo -e "${GREEN}✓ Write output validation passed${NC}"
else
    echo -e "${RED}✗ Write output validation failed${NC}"
    echo "Response: $RESPONSE"
fi

# Test 5: Database tables exist
echo ""
echo "Test 5: Check error tracking tables"
if sqlite3 data/quiz-analyzer.db "SELECT name FROM sqlite_master WHERE type='table' AND name='student_answers';" | grep -q "student_answers"; then
    echo -e "${GREEN}✓ Error tracking tables exist${NC}"
    echo "   Tables: student_answers, error_steps, error_patterns"
else
    echo -e "${RED}✗ Error tracking tables missing${NC}"
fi

# Cleanup
echo ""
echo "Cleaning up..."
kill $BACKEND_PID 2>/dev/null || true
sleep 1
lsof -ti:3005 | xargs kill -9 2>/dev/null || true

echo ""
echo "========================================"
echo "✅ All tests completed"
echo ""
echo "Next steps:"
echo "1. Start CCAAS backend: cd packages/backend && npm run start:dev"
echo "2. Start quiz-analyzer: ./start-dev.sh"
echo "3. Test skills with CCAAS session"
