#!/bin/bash
# test-solution-lib.sh - Unit tests for solution-lib.sh
# Version: 1.0.0
# Usage: ./test-solution-lib.sh

set -e

# Colors (will be overridden by solution-lib.sh if sourced)
COLOR_GREEN='\033[0;32m'
COLOR_RED='\033[0;31m'
COLOR_YELLOW='\033[1;33m'
COLOR_NC='\033[0m'

# Test counters
TESTS_TOTAL=0
TESTS_PASSED=0
TESTS_FAILED=0

# Test setup
TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB_FILE="$TEST_DIR/solution-lib.sh"

# Source the library only once
if [ -z "$SOLUTION_LIB_LOADED" ]; then
    if [ ! -f "$LIB_FILE" ]; then
        echo -e "${COLOR_RED}Error: solution-lib.sh not found at $LIB_FILE${COLOR_NC}"
        exit 1
    fi

    # Mock jq if not available (for testing)
    if ! command -v jq &> /dev/null; then
        echo -e "${COLOR_YELLOW}Warning: jq not found, using mock implementation${COLOR_NC}"
        jq() {
            echo "{\"mock\": \"data\"}"
        }
        export -f jq
    fi

    source "$LIB_FILE"
    export SOLUTION_LIB_LOADED=1
fi

# ==============================================================================
# TEST UTILITIES
# ==============================================================================

# Assert equal
# Usage: assert_equals "expected" "actual" "test_name"
assert_equals() {
    local expected="$1"
    local actual="$2"
    local test_name="$3"

    TESTS_TOTAL=$((TESTS_TOTAL + 1))

    if [ "$expected" = "$actual" ]; then
        echo -e "${COLOR_GREEN}✓${COLOR_NC} $test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${COLOR_RED}✗${COLOR_NC} $test_name"
        echo "  Expected: $expected"
        echo "  Actual: $actual"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

# Assert not empty
# Usage: assert_not_empty "value" "test_name"
assert_not_empty() {
    local value="$1"
    local test_name="$2"

    TESTS_TOTAL=$((TESTS_TOTAL + 1))

    if [ -n "$value" ]; then
        echo -e "${COLOR_GREEN}✓${COLOR_NC} $test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${COLOR_RED}✗${COLOR_NC} $test_name"
        echo "  Value is empty"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

# Assert true
# Usage: assert_true COMMAND "test_name"
assert_true() {
    local test_name="$2"

    TESTS_TOTAL=$((TESTS_TOTAL + 1))

    if eval "$1" &> /dev/null; then
        echo -e "${COLOR_GREEN}✓${COLOR_NC} $test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${COLOR_RED}✗${COLOR_NC} $test_name"
        echo "  Command failed: $1"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

# Assert false
# Usage: assert_false COMMAND "test_name"
assert_false() {
    local test_name="$2"

    TESTS_TOTAL=$((TESTS_TOTAL + 1))

    if ! eval "$1" &> /dev/null; then
        echo -e "${COLOR_GREEN}✓${COLOR_NC} $test_name"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${COLOR_RED}✗${COLOR_NC} $test_name"
        echo "  Command should have failed: $1"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

# Setup test environment
setup_test_env() {
    # Create temporary test directory
    TEST_TMP_DIR=$(mktemp -d)
    export TEST_TMP_DIR

    # Create mock solution.json
    cat > "$TEST_TMP_DIR/solution.json" <<EOF
{
  "name": "Test Solution",
  "slug": "test-solution",
  "version": "1.0.0",
  "description": "Test solution description",
  "backend": {
    "port": 3099,
    "ccaasUrl": "http://localhost:3001"
  },
  "frontend": {
    "port": 5299
  },
  "mcpServers": {
    "test-server": {
      "command": "node",
      "args": ["test.js"],
      "description": "Test MCP server"
    }
  }
}
EOF

    # Create mock skills directory
    mkdir -p "$TEST_TMP_DIR/skills/test-skill"
    cat > "$TEST_TMP_DIR/skills/test-skill/SKILL.md" <<EOF
---
name: Test Skill
description: Test skill description
---

# Test Skill Content
EOF
}

# Cleanup test environment
cleanup_test_env() {
    if [ -n "$TEST_TMP_DIR" ] && [ -d "$TEST_TMP_DIR" ]; then
        rm -rf "$TEST_TMP_DIR"
    fi
}

# ==============================================================================
# TESTS: LOGGING UTILITIES
# ==============================================================================

test_logging() {
    echo ""
    echo "=== Testing Logging Utilities ==="

    # Capture output
    local output

    output=$(log_info "test message" 2>&1)
    assert_not_empty "$output" "log_info produces output"

    output=$(log_success "test message" 2>&1)
    assert_not_empty "$output" "log_success produces output"

    output=$(log_warn "test message" 2>&1)
    assert_not_empty "$output" "log_warn produces output"

    output=$(log_error "test message" 2>&1)
    assert_not_empty "$output" "log_error produces output"

    output=$(log_header "Test Header" 2>&1)
    assert_not_empty "$output" "log_header produces output"
}

# ==============================================================================
# TESTS: CONFIGURATION MANAGEMENT
# ==============================================================================

test_configuration() {
    echo ""
    echo "=== Testing Configuration Management ==="

    setup_test_env

    # Test load_solution_config
    load_solution_config "$TEST_TMP_DIR" > /dev/null 2>&1
    assert_equals "Test Solution" "$SOLUTION_NAME" "load_solution_config sets SOLUTION_NAME"
    assert_equals "test-solution" "$SOLUTION_SLUG" "load_solution_config sets SOLUTION_SLUG"
    assert_equals "1.0.0" "$SOLUTION_VERSION" "load_solution_config sets SOLUTION_VERSION"
    assert_equals "3099" "$BACKEND_PORT" "load_solution_config sets BACKEND_PORT"
    assert_equals "5299" "$FRONTEND_PORT" "load_solution_config sets FRONTEND_PORT"

    # Test validate_solution_config
    assert_true "validate_solution_config" "validate_solution_config succeeds with valid config"

    cleanup_test_env
}

# ==============================================================================
# TESTS: PORT MANAGEMENT
# ==============================================================================

test_port_management() {
    echo ""
    echo "=== Testing Port Management ==="

    # Test check_port_available
    # Port 99999 should be available
    assert_true "check_port_available 99999" "check_port_available detects free port"

    # Test wait_for_port (should fail fast if port never opens)
    assert_false "wait_for_port 99999 1" "wait_for_port fails if port doesn't open"
}

# ==============================================================================
# TESTS: API KEY UTILITIES
# ==============================================================================

test_api_key() {
    echo ""
    echo "=== Testing API Key Utilities ==="

    # Test verify_api_key
    assert_true "verify_api_key 'sk-test_12345'" "verify_api_key accepts valid key"
    assert_false "verify_api_key 'invalid-key'" "verify_api_key rejects invalid key"
    assert_false "verify_api_key ''" "verify_api_key rejects empty key"
}

# ==============================================================================
# TESTS: SKILL PARSING
# ==============================================================================

test_skill_parsing() {
    echo ""
    echo "=== Testing Skill Parsing ==="

    setup_test_env

    # Test that skill file exists
    assert_true "test -f '$TEST_TMP_DIR/skills/test-skill/SKILL.md'" "test skill file exists"

    # Test frontmatter extraction (basic check)
    local skill_file="$TEST_TMP_DIR/skills/test-skill/SKILL.md"
    local has_frontmatter=$(head -n 1 "$skill_file" | grep -q "^---" && echo "yes" || echo "no")
    assert_equals "yes" "$has_frontmatter" "skill file has frontmatter"

    cleanup_test_env
}

# ==============================================================================
# TESTS: HOOK SYSTEM
# ==============================================================================

test_hooks() {
    echo ""
    echo "=== Testing Hook System ==="

    setup_test_env

    # Create test hook
    mkdir -p "$TEST_TMP_DIR/.solution-hooks"
    cat > "$TEST_TMP_DIR/.solution-hooks/test-hook.sh" <<'EOF'
#!/bin/bash
echo "HOOK_EXECUTED"
EOF
    chmod +x "$TEST_TMP_DIR/.solution-hooks/test-hook.sh"

    # Set SOLUTION_DIR for run_hook
    SOLUTION_DIR="$TEST_TMP_DIR"

    # Test run_hook
    local hook_output=$(run_hook "test-hook" 2>&1)
    assert_not_empty "$hook_output" "run_hook executes hook script"

    cleanup_test_env
}

# ==============================================================================
# TESTS: LIBRARY INFO
# ==============================================================================

test_library_info() {
    echo ""
    echo "=== Testing Library Info ==="

    local info=$(solution_lib_info 2>&1)
    assert_not_empty "$info" "solution_lib_info produces output"
}

# ==============================================================================
# INTEGRATION TESTS
# ==============================================================================

test_integration() {
    echo ""
    echo "=== Integration Tests ==="

    setup_test_env

    # Test full config load + validate workflow
    load_solution_config "$TEST_TMP_DIR" > /dev/null 2>&1
    assert_true "validate_solution_config" "integration: load + validate config"

    cleanup_test_env
}

# ==============================================================================
# RUN ALL TESTS
# ==============================================================================

main() {
    echo "========================================"
    echo "  solution-lib.sh Unit Tests"
    echo "========================================"

    # Run test suites
    test_logging
    test_configuration
    test_port_management
    test_api_key
    test_skill_parsing
    test_hooks
    test_library_info
    test_integration

    # Summary
    echo ""
    echo "========================================"
    echo "  Test Results"
    echo "========================================"
    echo ""
    echo "Total: $TESTS_TOTAL"
    echo -e "${COLOR_GREEN}Passed: $TESTS_PASSED${COLOR_NC}"

    if [ $TESTS_FAILED -gt 0 ]; then
        echo -e "${COLOR_RED}Failed: $TESTS_FAILED${COLOR_NC}"
        echo ""
        exit 1
    else
        echo -e "${COLOR_GREEN}Failed: 0${COLOR_NC}"
        echo ""
        echo -e "${COLOR_GREEN}✅ All tests passed!${COLOR_NC}"
        exit 0
    fi
}

# Trap cleanup
trap cleanup_test_env EXIT

# Run tests
main
