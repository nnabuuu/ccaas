#!/bin/bash
# Quick test script to verify attachment flow

echo "=========================================="
echo "Attachment Flow Test"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if backend is running
echo "1. Checking if backend is running..."
if curl -s http://localhost:5280/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Backend is running on port 5280"
else
    echo -e "${RED}✗${NC} Backend is NOT running on port 5280"
    echo "   Start it with: cd solutions/lesson-plan-designer/backend && npm run start:dev"
    exit 1
fi
echo ""

# Check database
echo "2. Checking database..."
DB_PATH="./data/lesson-plans.db"
if [ -f "$DB_PATH" ]; then
    echo -e "${GREEN}✓${NC} Database exists: $DB_PATH"
else
    echo -e "${RED}✗${NC} Database not found: $DB_PATH"
    exit 1
fi
echo ""

# Check uploads directory
echo "3. Checking uploads directory..."
UPLOAD_DIR="../../../.agent-workspace/uploads/attachments"
if [ -d "$UPLOAD_DIR" ]; then
    echo -e "${GREEN}✓${NC} Upload directory exists: $UPLOAD_DIR"
    FILE_COUNT=$(ls -1 "$UPLOAD_DIR" 2>/dev/null | wc -l)
    echo "   Files in directory: $FILE_COUNT"
else
    echo -e "${YELLOW}⚠${NC} Upload directory does not exist: $UPLOAD_DIR"
    echo "   Creating directory..."
    mkdir -p "$UPLOAD_DIR"
    echo -e "${GREEN}✓${NC} Directory created"
fi
echo ""

# Run diagnostic script
echo "4. Running attachment diagnostic..."
if [ -f "./scripts/check-attachments.js" ]; then
    node ./scripts/check-attachments.js
else
    echo -e "${RED}✗${NC} Diagnostic script not found"
    exit 1
fi
echo ""

# Test a download endpoint if fileId is provided
if [ -n "$1" ]; then
    echo "5. Testing download endpoint for fileId: $1"
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:5280/api/v1/files/$1/download")

    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✓${NC} Download endpoint returned 200 OK"
    elif [ "$HTTP_CODE" = "404" ]; then
        echo -e "${RED}✗${NC} Download endpoint returned 404 Not Found"
        echo "   This confirms the issue - fileId not found in database or file not on disk"
    else
        echo -e "${YELLOW}⚠${NC} Download endpoint returned $HTTP_CODE"
    fi
    echo ""
fi

echo "=========================================="
echo "Test Complete"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. If backend is not running, start it"
echo "2. If upload directory doesn't exist, it has been created"
echo "3. Review the diagnostic output above"
echo "4. Check backend logs for [Attachment] and [Download] messages"
echo "5. To test a specific fileId, run:"
echo "   ./scripts/test-attachment-flow.sh <fileId>"
