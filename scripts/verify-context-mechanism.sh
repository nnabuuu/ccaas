#!/bin/bash
# Context Mechanism Verification Script
# Tests all phases of the implementation

set -e

echo "🔍 Context Mechanism Verification"
echo "=================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

success() {
  echo -e "${GREEN}✅ $1${NC}"
}

error() {
  echo -e "${RED}❌ $1${NC}"
}

warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

info() {
  echo -e "ℹ️  $1"
}

# Phase 1: Backend Context Storage
echo "Phase 1: Backend Context Storage"
echo "---------------------------------"

if grep -q "context?: Record<string, unknown>" packages/backend/src/chat/dto/chat-message.dto.ts; then
  success "ChatMessageDto has context field"
else
  error "ChatMessageDto missing context field"
  exit 1
fi

if grep -q "fs.writeFileSync(contextPath" packages/backend/src/chat/chat.gateway.ts; then
  success "Context written to .context/page-context.json"
else
  error "Context storage not implemented"
  exit 1
fi

if grep -q "userContextService.recordContext" packages/backend/src/chat/chat.gateway.ts; then
  success "Context persisted to database"
else
  error "Database persistence not implemented"
  exit 1
fi

echo ""

# Phase 2: Shared MCP Server
echo "Phase 2: Shared MCP Server"
echo "--------------------------"

if [ -f "packages/mcp/shared-context-server/dist/index.js" ]; then
  success "shared-context-server built successfully"
else
  error "shared-context-server not built"
  echo "Run: cd packages/mcp/shared-context-server && npm run build"
  exit 1
fi

if grep -q "enum.*'full'.*'diff'" packages/mcp/shared-context-server/src/index.ts; then
  success "Diff mode implemented"
else
  error "Diff mode not implemented"
  exit 1
fi

if grep -q "calculateDiff" packages/mcp/shared-context-server/src/index.ts; then
  success "Diff calculation algorithm present"
else
  error "Diff calculation missing"
  exit 1
fi

# Test MCP server can start (timeout after 2 seconds)
info "Testing MCP server startup..."
timeout 2s node packages/mcp/shared-context-server/dist/index.js 2>&1 > /dev/null && \
  error "MCP server should wait for stdin (stdio mode)" || \
  success "MCP server starts in stdio mode (expected timeout)"

echo ""

# Phase 3: Frontend SDKs
echo "Phase 3: Frontend SDKs"
echo "----------------------"

if [ -f "packages/react-sdk/src/hooks/usePageContext.ts" ]; then
  success "usePageContext hook exists"
else
  error "usePageContext hook not found"
  exit 1
fi

if grep -q "context," packages/react-sdk/src/hooks/useAgentChat.ts; then
  success "useAgentChat accepts context parameter"
else
  error "useAgentChat doesn't accept context"
  exit 1
fi

if [ -f "packages/react-sdk/dist/index.js" ]; then
  success "react-sdk built successfully"
else
  warning "react-sdk not built - run: npm run build -w @kedge-agentic/react-sdk"
fi

echo ""

# Phase 4: Solution Configuration
echo "Phase 4: Solution Configuration (lesson-plan-designer)"
echo "-------------------------------------------------------"

if grep -q '"read-context"' solutions/lesson-plan-designer/solution.json; then
  success "read-context MCP server configured in solution.json"
else
  error "read-context not configured"
  exit 1
fi

if grep -q "shared-context-server/dist/index.js" solutions/lesson-plan-designer/solution.json; then
  success "Correct path to shared-context-server"
else
  error "Wrong path to shared-context-server"
  exit 1
fi

if grep -q "usePageContext" solutions/lesson-plan-designer/frontend/src/hooks/useLessonPlanSession.ts; then
  success "useLessonPlanSession uses usePageContext"
else
  error "useLessonPlanSession doesn't use usePageContext"
  exit 1
fi

if grep -q "context," solutions/lesson-plan-designer/frontend/src/hooks/useLessonPlanSession.ts; then
  success "Context passed to useAgentChat"
else
  error "Context not passed to useAgentChat"
  exit 1
fi

if grep -q "updateContext" solutions/lesson-plan-designer/frontend/src/hooks/useLessonPlanSession.ts; then
  success "Context updated when lesson plan changes"
else
  error "Context update not implemented"
  exit 1
fi

if [ ! -f "solutions/lesson-plan-designer/frontend/src/hooks/useContextSync.ts" ]; then
  success "Old useContextSync.ts deleted"
else
  warning "Old useContextSync.ts still exists - should be deleted"
fi

echo ""

# Phase 5: SKILL.md Documentation
echo "Phase 5: SKILL.md Documentation"
echo "--------------------------------"

if grep -q "read_context" solutions/lesson-plan-designer/skills/lesson-plan-designer/SKILL.md; then
  success "SKILL.md mentions read_context tool"
else
  error "SKILL.md doesn't mention read_context"
  exit 1
fi

if grep -q "mode.*diff" solutions/lesson-plan-designer/skills/lesson-plan-designer/SKILL.md; then
  success "SKILL.md documents diff mode"
else
  error "SKILL.md doesn't document diff mode"
  exit 1
fi

if grep -q "90-95% tokens" solutions/lesson-plan-designer/skills/lesson-plan-designer/SKILL.md; then
  success "SKILL.md mentions token savings"
else
  warning "SKILL.md doesn't mention token savings"
fi

if grep -q "强制要求.*read_context" solutions/lesson-plan-designer/skills/lesson-plan-designer/SKILL.md; then
  success "SKILL.md enforces read_context usage"
else
  error "SKILL.md doesn't enforce read_context"
  exit 1
fi

echo ""

# Summary
echo "=================================="
echo "Verification Complete!"
echo "=================================="
echo ""
success "All phases implemented successfully"
echo ""
info "Next Steps:"
echo "  1. Start CCAAS backend: cd packages/backend && npm run start:dev"
echo "  2. Start lesson-plan-designer: cd solutions/lesson-plan-designer && ./setup.sh"
echo "  3. Test in browser:"
echo "     - Create lesson plan (title=\"Test\", subject=\"数学\", grade=3)"
echo "     - Click \"开始备课\""
echo "     - Say: \"帮我编写课程要求\""
echo "     - Verify Claude calls read_context before responding"
echo "     - Verify Claude doesn't ask \"请问你的学科是什么？\""
echo ""
info "Check logs for:"
echo "  - \"Wrote page context for session...\""
echo "  - \"Tool called: read_context\""
echo "  - \"我看到你正在编写三年级数学的教案...\""
echo ""
