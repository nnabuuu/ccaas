#!/bin/bash

# Quiz Analyzer Setup Script
# This script sets up the quiz-analyzer solution from scratch

set -e  # Exit on error

echo "=========================================="
echo "Quiz Analyzer Setup"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Check if Excel files exist
echo "Step 1: Checking Excel files..."
if [ ! -f "resources/目录信息.xlsx" ] || [ ! -f "resources/知识点信息.xlsx" ] || [ ! -f "resources/题目信息.xlsx" ]; then
    echo -e "${YELLOW}⚠ Excel files not found in resources/${NC}"
    echo "Please place the following files in resources/:"
    echo "  - 目录信息.xlsx"
    echo "  - 知识点信息.xlsx"
    echo "  - 题目信息.xlsx"
    echo ""
    read -p "Press Enter to continue after adding files, or Ctrl+C to exit..."
fi

# Install script dependencies
echo ""
echo "Step 2: Installing script dependencies..."
cd scripts
npm install
echo -e "${GREEN}✓ Script dependencies installed${NC}"

# Analyze Excel structure
echo ""
echo "Step 3: Analyzing Excel structure..."
if [ -f "../resources/目录信息.xlsx" ]; then
    node analyze-excel-structure.js > ../data/excel-analysis.txt 2>&1
    echo -e "${GREEN}✓ Excel structure analyzed (see data/excel-analysis.txt)${NC}"
else
    echo -e "${YELLOW}⚠ Skipping Excel analysis (files not found)${NC}"
fi

# Import Excel to database
echo ""
echo "Step 4: Importing Excel data to SQLite..."
if [ -f "../resources/目录信息.xlsx" ]; then
    node import-excel-to-db.js
    echo -e "${GREEN}✓ Excel data imported${NC}"
else
    echo -e "${YELLOW}⚠ Skipping Excel import (files not found)${NC}"
    # Create empty database with schema
    echo "Creating empty database with schema..."
    cd ..
    mkdir -p data
    sqlite3 data/quiz-analyzer.db < scripts/schema.sql
    echo -e "${GREEN}✓ Empty database created${NC}"
    cd scripts
fi

# Verify database
echo ""
echo "Step 5: Verifying database..."
cd ..
if [ -f "data/quiz-analyzer.db" ]; then
    echo "Database statistics:"
    echo -n "  Subjects: "
    sqlite3 data/quiz-analyzer.db "SELECT COUNT(*) FROM subjects;"
    echo -n "  Knowledge Points: "
    sqlite3 data/quiz-analyzer.db "SELECT COUNT(*) FROM knowledge_points;"
    echo -n "  Quizzes: "
    sqlite3 data/quiz-analyzer.db "SELECT COUNT(*) FROM quizzes;"
    echo -e "${GREEN}✓ Database verified${NC}"
else
    echo -e "${RED}✗ Database not found${NC}"
    exit 1
fi

# Install MCP server dependencies
echo ""
echo "Step 6: Installing MCP server dependencies..."
cd mcp-server
npm install
echo -e "${GREEN}✓ MCP server dependencies installed${NC}"

# Build MCP server
echo ""
echo "Step 7: Building MCP server..."
npm run build
echo -e "${GREEN}✓ MCP server built${NC}"

# Test MCP server (start in background, test health, then stop)
echo ""
echo "Step 8: Testing MCP server..."
npm start &
MCP_PID=$!
sleep 2
if curl -s http://localhost:3006/health > /dev/null; then
    echo -e "${GREEN}✓ MCP server health check passed${NC}"
    curl -s http://localhost:3006/health | jq .
else
    echo -e "${RED}✗ MCP server health check failed${NC}"
fi
kill $MCP_PID 2>/dev/null || true
sleep 1

# Summary
echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo ""
echo "1. Start MCP server:"
echo "   cd mcp-server && npm start"
echo ""
echo "2. Test MCP tools:"
echo "   curl http://localhost:3006/health"
echo ""
echo "3. Implement backend (Phase 3):"
echo "   cd backend && npm install"
echo ""
echo "4. Implement frontend (Phase 4):"
echo "   cd frontend && npm install"
echo ""
echo "See README.md for detailed documentation."
