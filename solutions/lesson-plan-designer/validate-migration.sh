#!/bin/bash
# Validation script for lesson-plan-designer migration
# Tests that the new setup.sh can load and parse configuration correctly

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOOLS_DIR="$SCRIPT_DIR/../../tools"

echo "========================================"
echo "  Migration Validation Test"
echo "========================================"
echo ""

# Test 1: Check syntax
echo "Test 1: Syntax check..."
if bash -n "$SCRIPT_DIR/setup.sh"; then
    echo "✅ Syntax is valid"
else
    echo "❌ Syntax errors found"
    exit 1
fi
echo ""

# Test 2: Load shared library
echo "Test 2: Library loading..."
if [ -f "$TOOLS_DIR/solution-lib.sh" ]; then
    source "$TOOLS_DIR/solution-lib.sh"
    echo "✅ Shared library loaded"
else
    echo "❌ Shared library not found"
    exit 1
fi
echo ""

# Test 3: Load configuration
echo "Test 3: Configuration loading..."
load_solution_config "$SCRIPT_DIR"

if [ "$SOLUTION_NAME" = "Lesson Plan Designer" ]; then
    echo "✅ SOLUTION_NAME correct: $SOLUTION_NAME"
else
    echo "❌ SOLUTION_NAME incorrect: $SOLUTION_NAME"
    exit 1
fi

if [ "$SOLUTION_SLUG" = "lesson-plan-designer" ]; then
    echo "✅ SOLUTION_SLUG correct: $SOLUTION_SLUG"
else
    echo "❌ SOLUTION_SLUG incorrect: $SOLUTION_SLUG"
    exit 1
fi

if [ "$BACKEND_PORT" = "3002" ]; then
    echo "✅ BACKEND_PORT correct: $BACKEND_PORT"
else
    echo "❌ BACKEND_PORT incorrect: $BACKEND_PORT"
    exit 1
fi

if [ "$FRONTEND_PORT" = "5280" ]; then
    echo "✅ FRONTEND_PORT correct: $FRONTEND_PORT"
else
    echo "❌ FRONTEND_PORT incorrect: $FRONTEND_PORT"
    exit 1
fi
echo ""

# Test 4: Validate configuration
echo "Test 4: Configuration validation..."
if validate_solution_config; then
    echo "✅ Configuration is valid"
else
    echo "❌ Configuration validation failed"
    exit 1
fi
echo ""

# Test 5: Check solution.json structure
echo "Test 5: solution.json structure..."
if command -v jq &> /dev/null; then
    SKILL_COUNT=$(jq '.skills | length' "$SCRIPT_DIR/solution.json")
    MCP_COUNT=$(jq '.mcpServers | length' "$SCRIPT_DIR/solution.json")

    if [ "$SKILL_COUNT" -eq 3 ]; then
        echo "✅ Skills array has 3 items"
    else
        echo "❌ Skills array has $SKILL_COUNT items (expected 3)"
        exit 1
    fi

    if [ "$MCP_COUNT" -eq 1 ]; then
        echo "✅ MCP servers has 1 item"
    else
        echo "❌ MCP servers has $MCP_COUNT items (expected 1)"
        exit 1
    fi
else
    echo "⚠️  jq not found, skipping JSON validation"
fi
echo ""

# Test 6: Check file structure
echo "Test 6: File structure..."
REQUIRED_DIRS=("frontend" "backend" "mcp-server" "skills")
for dir in "${REQUIRED_DIRS[@]}"; do
    if [ -d "$SCRIPT_DIR/$dir" ]; then
        echo "✅ $dir/ exists"
    else
        echo "❌ $dir/ missing"
        exit 1
    fi
done
echo ""

# Test 7: Check skills directory
echo "Test 7: Skills directory..."
EXPECTED_SKILLS=("lesson-plan-designer" "notebooklm" "teaching-script-generator")
for skill in "${EXPECTED_SKILLS[@]}"; do
    if [ -f "$SCRIPT_DIR/skills/$skill/SKILL.md" ]; then
        echo "✅ skills/$skill/SKILL.md exists"
    else
        echo "⚠️  skills/$skill/SKILL.md missing"
    fi
done
echo ""

# Test 8: Check backup files
echo "Test 8: Backup verification..."
if [ -d "$SCRIPT_DIR/.migration-backup" ]; then
    echo "✅ .migration-backup/ exists"
    if [ -f "$SCRIPT_DIR/.migration-backup/setup.sh.old" ]; then
        echo "✅ setup.sh.old backed up"
    else
        echo "⚠️  setup.sh.old not found in backup"
    fi
else
    echo "⚠️  .migration-backup/ not found"
fi
echo ""

# Test 9: Line count comparison
echo "Test 9: Code reduction verification..."
if [ -f "$SCRIPT_DIR/.migration-backup/setup.sh.old" ]; then
    OLD_LINES=$(wc -l < "$SCRIPT_DIR/.migration-backup/setup.sh.old" | tr -d ' ')
    NEW_LINES=$(wc -l < "$SCRIPT_DIR/setup.sh" | tr -d ' ')
    REDUCTION=$((OLD_LINES - NEW_LINES))
    PERCENT=$((REDUCTION * 100 / OLD_LINES))

    echo "  Old setup.sh: $OLD_LINES lines"
    echo "  New setup.sh: $NEW_LINES lines"
    echo "  Reduction: $REDUCTION lines ($PERCENT%)"

    if [ $PERCENT -ge 40 ]; then
        echo "✅ Target reduction achieved (≥40%)"
    else
        echo "⚠️  Reduction below target: $PERCENT% (expected ≥40%)"
    fi
else
    echo "⚠️  Cannot compare (old file not found)"
fi
echo ""

echo "========================================"
echo "  Validation Summary"
echo "========================================"
echo ""
echo "✅ All critical tests passed!"
echo ""
echo "Migration is ready for integration testing."
echo ""
echo "Next steps:"
echo "  1. Ensure CCAAS backend is running (port 3001)"
echo "  2. Run: ./setup.sh"
echo "  3. Verify services start correctly"
echo "  4. Test skills and MCP servers"
echo ""
