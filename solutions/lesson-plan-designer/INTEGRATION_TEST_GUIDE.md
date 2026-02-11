# Integration Test Guide - Context Mechanism

## Quick Start Test

### Prerequisites

1. **CCAAS Backend running** on port 3001
2. **Shared Context MCP Server built**:
   ```bash
   cd packages/mcp/shared-context-server
   npm run build
   ```

### Test Procedure

#### 1. Start lesson-plan-designer

```bash
cd solutions/lesson-plan-designer
./setup.sh
```

**Expected**:
- Backend starts on port 3002
- Frontend starts on port 5280
- Opens http://localhost:5280 in browser

#### 2. Create New Lesson Plan

1. Click "新建备课方案"
2. Fill in:
   - **学科**: 数学
   - **年级**: 3
   - **出版社**: 人教版
   - **册次**: 上册
   - **章节**: (任选一个)
3. Click "创建"

**Expected**: Form appears with selected values

#### 3. Start Chat Session

1. Click "开始备课" button
2. Wait for chat panel to appear

**Expected**:
- Chat panel opens
- Shows "已连接" status

#### 4. Test Context Reading

**Send Message**:
```
帮我编写课程要求
```

**Expected Response Pattern**:
```
我看到你正在编写三年级数学的教案...
[根据选择的章节提供具体建议]
```

**❌ Wrong Response** (means context not working):
```
请问你的学科是什么？年级是多少？
```

#### 5. Check Logs

**Backend logs should show**:
```
[ChatGateway] Wrote page context for session lpd_xxx: {"pageType":"lesson-plan-editor"...
```

**Claude logs should show** (if running with --verbose):
```
Tool called: read_context
Tool result: { pageType: "lesson-plan-editor", pageData: { lessonPlanId: "...", currentForm: { ... } } }
```

#### 6. Test Diff Mode

1. In the form, fill in "学习目标" field with some text
2. Send message:
   ```
   帮我优化一下教学目标
   ```

**Expected**:
- Claude acknowledges existing objectives
- Provides optimization suggestions
- Does NOT ask for subject/grade again

**Check logs for diff mode**:
```
Tool called: read_context with args: { mode: 'diff' }
Tool result: { isDiff: true, pageData: { objectives: "..." } }  // Only changed field
```

---

## Detailed Verification

### Backend Context File

Check that context is being written:

```bash
# Find the session directory
ls -la .agent-workspace/sessions/

# Check context file exists
cat .agent-workspace/sessions/lpd_*/. context/page-context.json
```

**Expected Content**:
```json
{
  "pageType": "lesson-plan-editor",
  "pageData": {
    "lessonPlanId": "uuid-here",
    "currentForm": {
      "title": "",
      "subject": "数学",
      "gradeLevel": 3,
      "publisher": "人教版",
      "volume": "上册",
      "chapterId": 123,
      "chapterTitle": "...",
      "objectives": null,
      "content": null,
      // ... other fields
    }
  },
  "timestamp": "2026-02-11T..."
}
```

### Browser Network Tab

1. Open DevTools → Network tab
2. Send a message
3. Find the POST request to `/api/v1/sessions/{sessionId}/completion`

**Request Payload should include**:
```json
{
  "clientId": "...",
  "message": "帮我编写课程要求",
  "tenantId": "lesson-plan-designer",
  "context": {
    "pageType": "lesson-plan-editor",
    "pageData": {
      "lessonPlanId": "...",
      "currentForm": { ... }
    },
    "metadata": {
      "timestamp": 1707654321000
    }
  },
  "mcpServers": { ... },
  "skillPath": "..."
}
```

### MCP Server Test

Test the MCP server directly:

```bash
cd packages/mcp/shared-context-server

# Create test context
mkdir -p test-workspace/sessions/test-session/.context
cat > test-workspace/sessions/test-session/.context/page-context.json <<EOF
{
  "pageType": "lesson-plan-editor",
  "pageData": {
    "lessonPlanId": "test-123",
    "currentForm": {
      "subject": "数学",
      "gradeLevel": 3
    }
  },
  "timestamp": "2026-02-11T10:00:00Z"
}
EOF

# Test full mode
export AGENT_SESSION_ID=test-session
export AGENT_WORKSPACE_DIR=$(pwd)/test-workspace
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"read_context","arguments":{}}}' | node dist/index.js

# Expected output:
# {
#   "jsonrpc": "2.0",
#   "id": 1,
#   "result": {
#     "content": [{
#       "type": "text",
#       "text": "{\"pageType\":\"lesson-plan-editor\",\"pageData\":{...},\"timestamp\":\"...\"}"
#     }]
#   }
# }
```

---

## Troubleshooting

### Problem: Claude asks for subject/grade

**Diagnosis**: Claude is NOT calling read_context tool

**Solutions**:
1. Check MCP server is in solution.json:
   ```bash
   grep -A 5 "read-context" solution.json
   ```
2. Check MCP server builds successfully:
   ```bash
   ls -la ../../../packages/mcp/shared-context-server/dist/index.js
   ```
3. Check backend logs for MCP server registration
4. Try restarting both backend and frontend

### Problem: Context file not found

**Diagnosis**: Context not being written to file

**Solutions**:
1. Check frontend Network tab - is context in request payload?
2. Check backend logs - is "Wrote page context" message present?
3. Check file permissions on .agent-workspace directory
4. Verify useLessonPlanSession is calling updateContext

### Problem: Full context every time (no diff)

**Diagnosis**: Diff mode not working

**Solutions**:
1. Check SKILL.md instructs Claude to use `mode: 'diff'`
2. Verify MCP server has diff logic (check dist/index.js)
3. Check Claude is calling tool with correct arguments
4. First message should return full context, subsequent should return diff

### Problem: Wrong field names in context

**Diagnosis**: Frontend sending incorrect field names

**Solutions**:
1. Check useLessonPlanSession updateContext call
2. Verify field names match LessonPlan interface
3. Check types file: `frontend/src/types/index.ts`

---

## Success Indicators

✅ **All of these should be true**:

- [ ] Context file exists after sending message
- [ ] Context file contains correct pageType and pageData
- [ ] Backend logs show "Wrote page context"
- [ ] Claude calls read_context before responding
- [ ] Claude mentions specific details from context (subject, grade)
- [ ] Claude does NOT ask for information already in context
- [ ] Diff mode returns only changed fields (check logs)
- [ ] Token usage lower with diff mode

---

## Performance Metrics

**Expected Token Savings**:

| Scenario | Full Context | Diff Context | Savings |
|----------|--------------|--------------|---------|
| First message | ~1000 tokens | ~1000 tokens | 0% |
| Minor change (1 field) | ~1000 tokens | ~50 tokens | 95% |
| Multiple changes (3 fields) | ~1000 tokens | ~150 tokens | 85% |
| Major change (all fields) | ~1000 tokens | ~900 tokens | 10% |

**Measure in logs**:
```
Token usage before: input=2000 (includes full context)
Token usage after: input=1100 (diff mode saves 900 tokens)
```

---

Last Updated: 2026-02-11
