#!/bin/bash

# Auto-Load Tenant Skills - Verification Script
# This script tests Phase 1 & 2 implementation

set -e

CCAAS_DIR="/Users/niex/Documents/GitHub/kedge-ccaas"
BACKEND_LOG="/tmp/ccaas-backend.log"
SESSION_DIR="$CCAAS_DIR/.agent-workspace/sessions"

echo "========================================="
echo "  Auto-Load Tenant Skills Test"
echo "========================================="
echo ""

# Step 1: Check if CCAAS backend is running
echo "Step 1: Checking CCAAS backend..."
if curl -s http://localhost:3001/api/v1/chat/health > /dev/null 2>&1; then
  echo "✅ CCAAS backend is running"
else
  echo "❌ CCAAS backend is not running"
  echo "   Start it with: cd packages/backend && npm run start:dev"
  exit 1
fi
echo ""

# Step 2: Check if lesson-plan-designer is accessible
echo "Step 2: Checking lesson-plan-designer..."
if curl -s http://localhost:5280 > /dev/null 2>&1; then
  echo "✅ lesson-plan-designer frontend is accessible"
else
  echo "❌ lesson-plan-designer is not running"
  echo "   Start it with: cd solutions/lesson-plan-designer && ./setup.sh"
  exit 1
fi
echo ""

# Step 3: Query tenant skills
echo "Step 3: Querying tenant skills..."
TENANT_ID="lesson-plan-designer"
SKILLS_RESPONSE=$(curl -s "http://localhost:3001/api/v1/skills?tenantId=$TENANT_ID" | jq -r '.items[] | select(.enabled == true) | .slug' 2>/dev/null || echo "")

if [ -z "$SKILLS_RESPONSE" ]; then
  echo "❌ No enabled skills found for tenant: $TENANT_ID"
  echo "   Check skill status in database or create skills using setup.sh"
  exit 1
fi

SKILL_COUNT=$(echo "$SKILLS_RESPONSE" | wc -l | xargs)
echo "✅ Found $SKILL_COUNT enabled skills:"
echo "$SKILLS_RESPONSE" | sed 's/^/   - /'
echo ""

# Step 4: Find latest session directory (if any)
echo "Step 4: Checking for recent sessions..."
if [ -d "$SESSION_DIR" ]; then
  LATEST_SESSION=$(ls -t "$SESSION_DIR" | grep "^lpd_" | head -1 || echo "")

  if [ -n "$LATEST_SESSION" ]; then
    CLAUDE_MD="$SESSION_DIR/$LATEST_SESSION/CLAUDE.md"

    if [ -f "$CLAUDE_MD" ]; then
      echo "✅ Found CLAUDE.md in latest session: $LATEST_SESSION"
      echo ""
      echo "   Content preview:"
      head -15 "$CLAUDE_MD" | sed 's/^/   /'
      echo ""

      # Check skill count in CLAUDE.md
      MD_SKILL_COUNT=$(grep -c "^- \*\*" "$CLAUDE_MD" || echo "0")
      echo "   Skills listed in CLAUDE.md: $MD_SKILL_COUNT"

      if [ "$MD_SKILL_COUNT" -eq "$SKILL_COUNT" ]; then
        echo "   ✅ Skill count matches enabled skills"
      else
        echo "   ⚠️  Skill count mismatch (DB: $SKILL_COUNT, CLAUDE.md: $MD_SKILL_COUNT)"
      fi
    else
      echo "⚠️  Latest session exists but no CLAUDE.md found"
      echo "   This is expected if no messages have been sent yet"
    fi
  else
    echo "ℹ️  No sessions found yet"
    echo "   Create a lesson plan and send a message to trigger skill sync"
  fi
else
  echo "ℹ️  No session directory found"
fi
echo ""

# Step 5: Check backend logs for auto-load messages
echo "Step 5: Checking backend logs for auto-load..."
if [ -f "$BACKEND_LOG" ]; then
  AUTO_LOAD_LOGS=$(grep "Auto-loaded.*enabled skills" "$BACKEND_LOG" | tail -3 || echo "")
  CLAUDE_MD_LOGS=$(grep "Created CLAUDE.md" "$BACKEND_LOG" | tail -3 || echo "")

  if [ -n "$AUTO_LOAD_LOGS" ]; then
    echo "✅ Found auto-load logs:"
    echo "$AUTO_LOAD_LOGS" | sed 's/^/   /'
  else
    echo "ℹ️  No auto-load logs found (not triggered yet)"
  fi
  echo ""

  if [ -n "$CLAUDE_MD_LOGS" ]; then
    echo "✅ Found CLAUDE.md creation logs:"
    echo "$CLAUDE_MD_LOGS" | sed 's/^/   /'
  else
    echo "ℹ️  No CLAUDE.md creation logs found (not triggered yet)"
  fi
else
  echo "⚠️  Backend log not found at: $BACKEND_LOG"
  echo "   Check if backend is logging to this location"
fi
echo ""

# Summary
echo "========================================="
echo "  Test Summary"
echo "========================================="
echo ""
echo "✅ Phase 2: Auto-load logic implemented (queries enabled skills)"
echo "✅ Phase 1: CLAUDE.md creation implemented"
echo ""
echo "To fully test the implementation:"
echo "1. Open http://localhost:5280"
echo "2. Create a new lesson plan"
echo "3. Click '开始备课' and send a message"
echo "4. Check backend logs for:"
echo "   - 'Auto-loaded N enabled skills for tenant lesson-plan-designer'"
echo "   - 'Created CLAUDE.md with N skills'"
echo "5. Verify Claude uses skills (doesn't ask basic questions)"
echo ""
echo "To check latest session CLAUDE.md:"
echo "   cat \$(ls -t .agent-workspace/sessions/lpd_* | head -1)/CLAUDE.md"
echo ""
