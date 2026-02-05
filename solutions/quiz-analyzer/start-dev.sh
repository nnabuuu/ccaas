#!/bin/bash

echo "🚀 Starting Quiz Analyzer Development Environment"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if backend is running
echo -e "${BLUE}1. Checking Backend (port 3005)...${NC}"
if lsof -Pi :3005 -sTCP:LISTEN -t >/dev/null ; then
    echo -e "${GREEN}✓ Backend already running${NC}"
else
    echo -e "${YELLOW}Starting Backend...${NC}"
    cd backend
    npm run start:dev &
    BACKEND_PID=$!
    echo -e "${GREEN}✓ Backend started (PID: $BACKEND_PID)${NC}"
    cd ..
fi

# Wait for backend to be ready
echo ""
echo -e "${BLUE}2. Waiting for Backend to be ready...${NC}"
for i in {1..30}; do
    if curl -s http://localhost:3005/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Backend is ready${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${YELLOW}⚠ Backend health check timeout, continuing anyway${NC}"
    fi
    sleep 1
done

# Check if frontend is running
echo ""
echo -e "${BLUE}3. Checking Frontend (port 5282)...${NC}"
if lsof -Pi :5282 -sTCP:LISTEN -t >/dev/null ; then
    echo -e "${GREEN}✓ Frontend already running${NC}"
else
    echo -e "${YELLOW}Starting Frontend...${NC}"
    cd frontend
    npm run dev &
    FRONTEND_PID=$!
    echo -e "${GREEN}✓ Frontend started (PID: $FRONTEND_PID)${NC}"
    cd ..
fi

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✨ Quiz Analyzer Development Environment Ready!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}Backend:${NC}  http://localhost:3005"
echo -e "${BLUE}Frontend:${NC} http://localhost:5282"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo ""

# Wait for user interrupt
wait
