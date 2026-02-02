#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "========================================"
echo "  EduAgent - AI 教育助手 Setup"
echo "========================================"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 1. Build MCP server
echo -e "${YELLOW}[1/4] Building MCP server...${NC}"
cd mcp-server
npm install
npm run build
echo -e "${GREEN}MCP server built.${NC}"

# 2. Setup backend
echo -e "${YELLOW}[2/4] Setting up backend...${NC}"
cd "$SCRIPT_DIR/backend"
npm install
echo -e "${GREEN}Backend dependencies installed.${NC}"

# 3. Setup frontend
echo -e "${YELLOW}[3/4] Setting up frontend...${NC}"
cd "$SCRIPT_DIR/frontend"
npm install
echo -e "${GREEN}Frontend dependencies installed.${NC}"

# 4. Start services
echo -e "${YELLOW}[4/4] Starting services...${NC}"
cd "$SCRIPT_DIR"

# Start backend in background
cd backend
npm run start:dev &
BACKEND_PID=$!
echo "Backend started (PID: $BACKEND_PID) on port 3010"

# Start frontend
cd "$SCRIPT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!
echo "Frontend started (PID: $FRONTEND_PID) on port 5282"

echo ""
echo "========================================"
echo -e "${GREEN}  EduAgent is running!${NC}"
echo "  Frontend: http://localhost:5282"
echo "  Backend:  http://localhost:3010"
echo "  CCAAS:    http://localhost:3001 (required)"
echo "========================================"
echo ""
echo "Press Ctrl+C to stop all services"

# Cleanup on exit
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT

wait
