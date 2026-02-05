#!/bin/bash

# Quiz Analyzer - Integration Test Suite
# Tests all services and their integration

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Test function
test_case() {
    local name="$1"
    local command="$2"

    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -ne "${BLUE}[TEST $TOTAL_TESTS]${NC} $name ... "

    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PASS${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# HTTP test with expected response
test_http() {
    local name="$1"
    local url="$2"
    local expected="$3"

    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -ne "${BLUE}[TEST $TOTAL_TESTS]${NC} $name ... "

    response=$(curl -s "$url")

    if echo "$response" | grep -q "$expected"; then
        echo -e "${GREEN}✓ PASS${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}"
        echo "  Expected: $expected"
        echo "  Got: $response"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# Section header
section() {
    echo ""
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}  $1${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Show summary
show_summary() {
    echo ""
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}  Test Summary${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "  Total:  $TOTAL_TESTS"
    echo -e "  ${GREEN}Passed: $PASSED_TESTS${NC}"
    if [ $FAILED_TESTS -gt 0 ]; then
        echo -e "  ${RED}Failed: $FAILED_TESTS${NC}"
    else
        echo -e "  ${GREEN}Failed: $FAILED_TESTS${NC}"
    fi
    echo ""

    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "${GREEN}✓ All tests passed!${NC}"
        echo ""
        return 0
    else
        echo -e "${RED}✗ Some tests failed${NC}"
        echo ""
        return 1
    fi
}

# Main test execution
main() {
    echo -e "${GREEN}Quiz Analyzer - Integration Test Suite${NC}"
    echo ""

    # Phase 1: Prerequisites
    section "Phase 1: Prerequisites"
    test_case "Database exists" "[ -f data/quiz-analyzer.db ]"
    test_case "MCP dist exists" "[ -d mcp-server/dist ]"
    test_case "Backend dist exists" "[ -d backend/dist ]"
    test_case "Frontend dist exists" "[ -d frontend/dist ]"

    # Phase 2: Service Health Checks
    section "Phase 2: Service Health Checks"
    test_http "MCP Server health" "http://localhost:3006/health" "healthy"
    test_http "Backend health" "http://localhost:3005/health" "healthy"
    test_case "Frontend responds" "curl -s http://localhost:5282 > /dev/null"

    # Phase 3: MCP Server Tools
    section "Phase 3: MCP Server Tools"
    test_http "Get knowledge points tree" \
        "http://localhost:3006/tools/get_knowledge_points_tree" \
        "tree"

    test_case "Search quizzes tool" \
        "curl -s -X POST http://localhost:3006/tools/search_quizzes \
        -H 'Content-Type: application/json' \
        -d '{\"limit\": 5}' | grep -q status"

    test_case "Get quiz details tool" \
        "curl -s -X POST http://localhost:3006/tools/get_quiz_details \
        -H 'Content-Type: application/json' \
        -d '{\"quizId\": \"quiz-001\"}' | grep -q quiz"

    # Phase 4: Backend API Endpoints
    section "Phase 4: Backend API Endpoints"

    # Quizzes
    test_http "List quizzes" \
        "http://localhost:3005/api/v1/quizzes?limit=5" \
        "quizzes"

    test_case "Search quizzes" \
        "curl -s -X POST http://localhost:3005/api/v1/quizzes/search \
        -H 'Content-Type: application/json' \
        -d '{\"limit\": 5}' | grep -q quizzes"

    test_http "Get quiz by ID" \
        "http://localhost:3005/api/v1/quizzes/quiz-001" \
        "content"

    # Knowledge Points
    test_http "Get knowledge points tree" \
        "http://localhost:3005/api/v1/knowledge-points/tree" \
        "tree"

    test_http "List knowledge points" \
        "http://localhost:3005/api/v1/knowledge-points" \
        "knowledge_points"

    # Analyses
    test_http "Get quiz analysis" \
        "http://localhost:3005/api/v1/analyses/quiz-001" \
        "thinking_process"

    # Batch
    test_http "List batch jobs" \
        "http://localhost:3005/api/v1/batch/jobs" \
        "jobs"

    test_http "Get batch status" \
        "http://localhost:3005/api/v1/batch/status" \
        "queueSize"

    # Phase 5: Database Queries
    section "Phase 5: Database Verification"
    test_case "Subjects table has data" \
        "sqlite3 data/quiz-analyzer.db 'SELECT COUNT(*) FROM subjects' | grep -q '[1-9]'"

    test_case "Knowledge points table has data" \
        "sqlite3 data/quiz-analyzer.db 'SELECT COUNT(*) FROM knowledge_points' | grep -q '[1-9]'"

    test_case "Quizzes table has data" \
        "sqlite3 data/quiz-analyzer.db 'SELECT COUNT(*) FROM quizzes' | grep -q '[1-9]'"

    test_case "Analyses table exists" \
        "sqlite3 data/quiz-analyzer.db '.tables' | grep -q quiz_analyses"

    # Phase 6: Frontend Integration
    section "Phase 6: Frontend Pages"
    test_case "Frontend index loads" \
        "curl -s http://localhost:5282 | grep -q 'Quiz Analyzer'"

    test_case "Frontend has React bundle" \
        "curl -s http://localhost:5282 | grep -q 'script'"

    # Show summary
    show_summary
}

# Check if services are running
echo "Checking if services are running..."
if ! curl -s http://localhost:3006/health > /dev/null 2>&1; then
    echo -e "${RED}Error: MCP Server is not running${NC}"
    echo "Please run './start.sh' first"
    exit 1
fi

if ! curl -s http://localhost:3005/health > /dev/null 2>&1; then
    echo -e "${RED}Error: Backend is not running${NC}"
    echo "Please run './start.sh' first"
    exit 1
fi

if ! curl -s http://localhost:5282 > /dev/null 2>&1; then
    echo -e "${RED}Error: Frontend is not running${NC}"
    echo "Please run './start.sh' first"
    exit 1
fi

echo -e "${GREEN}✓ All services are running${NC}"
echo ""

# Run tests
main
