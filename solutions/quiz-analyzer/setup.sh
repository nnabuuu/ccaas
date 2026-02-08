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

# Cleanup function (defined early for error handling)
cleanup() {
    echo ""
    echo "🛑 Stopping services..."

    # Stop background processes
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true

    # Ensure ports are released
    if lsof -Pi :3005 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "   Clearing port 3005 (Backend)..."
        lsof -ti:3005 | xargs kill -9 2>/dev/null || true
    fi

    if lsof -Pi :5282 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "   Clearing port 5282 (Frontend)..."
        lsof -ti:5282 | xargs kill -9 2>/dev/null || true
    fi

    echo "✅ Services stopped"
    exit 0
}

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

# Create or verify tenant in CCAAS backend
echo ""
echo "Step 6: Setting up CCAAS tenant..."
CCAAS_DB="$SCRIPT_DIR/../../packages/backend/.agent-workspace/data.db"

if [ -f "$CCAAS_DB" ]; then
    # Check if quiz-analyzer tenant exists
    TENANT_EXISTS=$(sqlite3 "$CCAAS_DB" "SELECT COUNT(*) FROM tenants WHERE slug = 'quiz-analyzer';" 2>/dev/null || echo "0")

    if [ "$TENANT_EXISTS" = "0" ]; then
        echo "Creating quiz-analyzer tenant in CCAAS..."
        sqlite3 "$CCAAS_DB" "
        INSERT INTO tenants (id, name, slug, description, config, maxSessions, maxSkills, maxMcpServers, plan, apiKey, status, createdAt, updatedAt)
        VALUES (
            lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(6))),
            'Quiz Analyzer',
            'quiz-analyzer',
            'AI题目分析系统 - 知识点标注与错题分析',
            '{}',
            100,
            50,
            10,
            'free',
            'sk_' || lower(hex(randomblob(24))),
            'active',
            datetime('now'),
            datetime('now')
        );
        "
        echo -e "${GREEN}✓ Tenant created (slug: quiz-analyzer)${NC}"
    else
        echo -e "${GREEN}✓ Tenant already exists (slug: quiz-analyzer)${NC}"
    fi
else
    echo -e "${YELLOW}⚠ CCAAS database not found at: $CCAAS_DB${NC}"
    echo "Please run CCAAS backend first to initialize the database"
    echo "  cd packages/backend && npm run start:dev"
    exit 1
fi

# Install backend dependencies
echo ""
echo "Step 7: Installing backend dependencies..."
cd "$SCRIPT_DIR/backend"
npm install
echo -e "${GREEN}✓ Backend dependencies installed${NC}"

# Install frontend dependencies
echo ""
echo "Step 8: Installing frontend dependencies..."
cd "$SCRIPT_DIR/frontend"
npm install
echo -e "${GREEN}✓ Frontend dependencies installed${NC}"

# Check and clear port conflicts
echo ""
echo "Step 9: Checking port conflicts..."
cd "$SCRIPT_DIR"

# Check port 3005 (Backend)
if lsof -Pi :3005 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠ Port 3005 occupied, clearing...${NC}"
    lsof -ti:3005 | xargs kill -9 2>/dev/null || true
    sleep 1
fi

# Check port 5282 (Frontend)
if lsof -Pi :5282 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠ Port 5282 occupied, clearing...${NC}"
    lsof -ti:5282 | xargs kill -9 2>/dev/null || true
    sleep 1
fi

echo -e "${GREEN}✓ Ports cleared${NC}"

# Create logs directory
mkdir -p logs

# Start Backend
echo ""
echo "Step 10: Starting backend (port 3005)..."
cd backend
npm run start:dev > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# Wait for Backend to be ready
echo "⏳ Waiting for backend..."
BACKEND_RETRY=0
BACKEND_MAX_RETRY=10
while [ $BACKEND_RETRY -lt $BACKEND_MAX_RETRY ]; do
    if lsof -Pi :3005 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Backend started (port 3005)${NC}"
        break
    fi
    BACKEND_RETRY=$((BACKEND_RETRY + 1))
    if [ $BACKEND_RETRY -eq $BACKEND_MAX_RETRY ]; then
        echo -e "${RED}✗ Backend failed to start${NC}"
        echo "Check logs/backend.log for details"
        cleanup
        exit 1
    fi
    sleep 1
done

# Start Frontend
echo ""
echo "Step 11: Starting frontend (port 5282)..."
cd frontend
npm run dev > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

# Wait for Frontend to be ready
echo "⏳ Waiting for frontend..."
FRONTEND_RETRY=0
FRONTEND_MAX_RETRY=10
while [ $FRONTEND_RETRY -lt $FRONTEND_MAX_RETRY ]; do
    if lsof -Pi :5282 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Frontend started (port 5282)${NC}"
        break
    fi
    FRONTEND_RETRY=$((FRONTEND_RETRY + 1))
    if [ $FRONTEND_RETRY -eq $FRONTEND_MAX_RETRY ]; then
        echo -e "${RED}✗ Frontend failed to start${NC}"
        echo "Check logs/frontend.log for details"
        cleanup
        exit 1
    fi
    sleep 1
done

# Summary
echo ""
echo "=========================================="
echo "✅ All Services Running!"
echo "=========================================="
echo ""
echo "📍 Access URLs:"
echo "   Frontend: http://localhost:5282"
echo "   Backend:  http://localhost:3005 (includes MCP tools)"
echo ""
echo "📊 Database Statistics:"
sqlite3 data/quiz-analyzer.db "SELECT '   Quizzes: ' || COUNT(*) FROM quizzes;" 2>/dev/null || true
sqlite3 data/quiz-analyzer.db "SELECT '   Knowledge Points: ' || COUNT(*) FROM knowledge_points;" 2>/dev/null || true
sqlite3 data/quiz-analyzer.db "SELECT '   Student Answers: ' || COUNT(*) FROM student_answers;" 2>/dev/null || true
echo ""
echo "⚠️  Ensure CCAAS backend is running on port 3001:"
echo "   cd packages/backend && npm run start:dev"
echo ""
echo "📝 Logs:"
echo "   Backend:  tail -f logs/backend.log"
echo "   Frontend: tail -f logs/frontend.log"
echo ""
echo "Press Ctrl+C to stop all services"

# Set up trap for cleanup
trap cleanup SIGINT SIGTERM

# Wait for user interrupt
wait
