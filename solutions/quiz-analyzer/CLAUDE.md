# CLAUDE.md - Quiz Analyzer Solution

This file provides guidance to Claude Code when working with the quiz-analyzer solution.

## Project Overview

Quiz Analyzer is a comprehensive educational quiz analysis system with:
- AI-powered knowledge point tagging and verification
- Solution thought process generation (思路)
- Wrong answer analysis and remediation
- Hierarchical knowledge point mapping
- Batch processing capabilities

## Architecture

```
quiz-analyzer/
├── scripts/           # Excel import & database setup
│   ├── analyze-excel-structure.js
│   ├── import-excel-to-db.js
│   └── schema.sql
├── mcp-server/        # REST API for AI tools (port 3006)
│   └── src/
│       ├── index.ts
│       ├── types.ts
│       ├── schemas.ts
│       └── data-loader.ts
├── backend/           # NestJS API server (port 3005)
├── frontend/          # React + Vite UI (port 5282)
├── data/              # SQLite database
└── resources/         # Excel data files (user-provided)
```

## Development Workflow

### Phase 1: Database Foundation ✅

**Status**: COMPLETED

**Files**:
- `scripts/analyze-excel-structure.js` - Understand Excel columns
- `scripts/schema.sql` - Database schema (8 tables)
- `scripts/import-excel-to-db.js` - Two-pass import for hierarchies

**Commands**:
```bash
cd scripts
npm install
node analyze-excel-structure.js  # Analyze Excel structure first
node import-excel-to-db.js        # Import to SQLite
```

**Verification**:
```bash
sqlite3 ../data/quiz-analyzer.db "SELECT COUNT(*) FROM knowledge_points"
sqlite3 ../data/quiz-analyzer.db "SELECT COUNT(*) FROM quizzes"
```

### Phase 2: MCP Server ✅

**Status**: COMPLETED

**Files**:
- `mcp-server/src/index.ts` - REST API (5 tools)
- `mcp-server/src/types.ts` - SYNC_FIELDS + interfaces
- `mcp-server/src/schemas.ts` - Zod validation
- `mcp-server/src/data-loader.ts` - Load knowledge points tree

**Commands**:
```bash
cd mcp-server
npm install
npm run build
npm start  # Should listen on port 3006
```

**Testing**:
```bash
curl http://localhost:3006/health
```

### Phase 3: Backend (TODO)

**Next Steps**:
1. Create NestJS module structure
2. Define TypeORM entities
3. Implement REST API endpoints
4. Build batch processor service
5. Add WebSocket support

**Key Files to Create**:
- `backend/src/quizzes/quizzes.module.ts`
- `backend/src/batch/batch-processor.service.ts`
- `backend/src/database/entities/quiz.entity.ts`

### Phase 4: Frontend (TODO)

**Next Steps**:
1. Create React components
2. Implement useQuizSession hook
3. Build analysis view
4. Add batch processing UI

**Key Files to Create**:
- `frontend/src/hooks/useQuizSession.ts`
- `frontend/src/components/AnalysisView.tsx`
- `frontend/src/components/BatchAnalysisPanel.tsx`

## TDD 强制规则 (Critical Lesson from lesson-plan-designer)

### Background
曾因"信任计划文档 > 信任测试"导致 API 格式不兼容，前端功能完全失效。

### Root Cause
修改代码前没有运行测试，修改后也没有验证。

### Mandatory Checklist

**Before modifying any code**:
- [ ] Run `npm test` to confirm all tests pass
- [ ] If changing API/interface, check frontend type definitions and existing tests
- [ ] Review @ccaas/common types for contract definitions

**After modifying code**:
- [ ] Immediately run related tests, don't wait until the end
- [ ] Test failure = stop and analyze, don't continue forward
- [ ] Verify integration tests if API contracts changed

### Core Principle
```
Tests are the code contract, plans are just intention expressions.
When plans conflict with tests, question the plan, not the tests.
```

## SYNC_FIELDS

The system manages 10 synchronized fields (defined in `mcp-server/src/types.ts`):

1. **quizAnalysis** - Overall analysis summary (Markdown)
2. **knowledgePointTags** - Array of KnowledgePointTag with confidence scores
3. **thinkingProcess** - 解题思路 (Markdown)
4. **solutionSteps** - Array of SolutionStep
5. **correctAnswer** - The answer (string)
6. **commonMistakes** - Array of Mistake with frequency and remediation
7. **knowledgeGapAnalysis** - Analysis of knowledge gaps (Markdown)
8. **difficulty** - Difficulty 1-5 (number)
9. **relatedQuizzes** - Array of RelatedQuiz with similarity scores
10. **timeEstimate** - Estimated solving time (string)

All fields are validated with Zod schemas in `mcp-server/src/schemas.ts`.

## MCP Tools (REST API)

All tools are REST endpoints on port 3006:

### 1. POST /tools/write_output
Store analysis results to synchronized fields.

**Request**:
```json
{
  "field": "thinkingProcess",
  "value": "# 解题思路\n\n...",
  "preview": "Updated thinking process"
}
```

**Validation**: Zod schema checks field type and structure

### 2. POST /tools/get_knowledge_points_tree
Retrieve hierarchical knowledge points structure.

**Request**:
```json
{
  "subjectId": "math-001",
  "gradeLevel": "9"
}
```

### 3. POST /tools/verify_knowledge_point_tags
Verify AI-proposed knowledge point tags.

### 4. POST /tools/calculate_difficulty
Calculate difficulty based on knowledge points and steps.

**Formula**: `min(5, ceil((knowledgePointCount × 0.5 + stepCount × 0.3) × typeWeight))`

### 5. POST /tools/generate_thinking_process_template
Generate template for solution approach based on quiz type.

## Database Schema

### Key Tables

1. **subjects** - Subject/catalog information
2. **knowledge_points** - Hierarchical knowledge tree (self-referencing `parent_id`)
3. **quizzes** - Quiz content and metadata
4. **quiz_knowledge_links** - Many-to-many quiz ↔ knowledge points (with confidence scores)
5. **quiz_analyses** - AI analysis results (stores SYNC_FIELDS)
6. **solution_steps** - Detailed solution breakdown
7. **batch_analysis_jobs** - Batch processing tracking with progress/ETA

### Important Design Decisions

**Hierarchical Knowledge Points**:
- Self-referencing via `parent_id` (NULL for root nodes)
- `level` field tracks tree depth (0=root, 1=chapter, 2=section)
- Two-pass import algorithm prevents foreign key violations

**AI Confidence Tracking**:
- All AI-generated links have `confidence_score` (0.0-1.0)
- `link_type` distinguishes manual/ai-generated/ai-verified
- `created_by` tracks origin (system/ai/user_id)

**Batch Processing**:
- In-memory queue with progress tracking
- ETA calculation based on average processing time
- Cancellation support via status check
- Results stored as JSON array with per-quiz status

## Database Migrations

### Schema Verification First (Critical)

**Always check the actual database schema before writing migration scripts.** Run schema inspection queries first rather than assuming column names from code references.

**Why This Matters**: Code references, TypeScript interfaces, and documentation can drift from the actual database schema. Assumptions about column names often lead to migration failures and wasted effort.

**Required Steps Before Any Migration**:

1. **Inspect Current Schema**:
   ```bash
   sqlite3 data/quiz-analyzer.db ".schema TABLE_NAME"
   # OR
   sqlite3 data/quiz-analyzer.db "PRAGMA table_info(TABLE_NAME)"
   ```

2. **Verify Column Names**: Check that assumed columns actually exist with correct names and types

3. **Check Constraints**: Review foreign keys, indexes, and constraints that may affect migration

4. **Sample Data**: Query sample rows to understand data patterns
   ```bash
   sqlite3 data/quiz-analyzer.db "SELECT * FROM TABLE_NAME LIMIT 3"
   ```

**Migration Workflow**:
1. ✅ Inspect actual schema first
2. ✅ Write migration based on verified schema
3. ✅ Test on database copy (see `backend/scripts/test-migration-*.sh`)
4. ✅ Document changes and provide rollback plan
5. ✅ Apply to production with backup

See `backend/scripts/migrations/` for migration examples and `DIFFICULTY_REFACTOR_MIGRATION.md` for detailed migration documentation.

## Excel Import Details

### Two-Pass Algorithm (Critical)

The import script uses a two-pass algorithm for knowledge points to handle parent-child relationships:

**Pass 1**: Create all nodes
- Insert all knowledge points with `parent_id = NULL`
- Build ID mapping: `originalId → generatedId`

**Pass 2**: Link parent-child relationships
- Update `parent_id` using the ID map
- Validate no orphans or circular references

This ensures no foreign key violations even when children appear before parents in the Excel file.

### Column Name Flexibility

The import script is flexible with column names. It checks multiple variations:

**Subjects**:
- ID: `id`, `科目ID`, `目录ID`
- Name: `name`, `科目名称`, `目录名称`
- Code: `code`, `科目代码`, `目录代码`

**Knowledge Points**:
- ID: `id`, `知识点ID`
- Parent: `parent_id`, `父知识点ID`, `父ID`, `上级ID`
- Name: `name`, `知识点名称`, `知识点`
- Level: `level`, `层级`, `等级`

**Quizzes**:
- ID: `id`, `题目ID`, `题号`
- Content: `content`, `题目内容`, `题干`
- Type: `quiz_type`, `题型`, `类型`

## Common Tasks

### Add a New SYNC_FIELD

1. Update `SYNC_FIELDS` array in `mcp-server/src/types.ts`
2. Add TypeScript interface for the field structure
3. Add Zod schema in `mcp-server/src/schemas.ts`
4. Update database schema if needed (add column to `quiz_analyses`)
5. Update `solution.json` syncFields array
6. Rebuild MCP server: `npm run build`

### Add a New MCP Tool

1. Add endpoint in `mcp-server/src/index.ts`
2. Define request/response types in `types.ts`
3. Add to `solution.json` allowedTools array
4. Update README.md with tool documentation
5. Rebuild and restart MCP server

### Modify Database Schema

1. Update `scripts/schema.sql`
2. Delete `data/quiz-analyzer.db`
3. Re-run import: `node scripts/import-excel-to-db.js`
4. Update TypeORM entities (when backend is implemented)
5. Update migration files

### Debug Import Issues

**Check Excel structure**:
```bash
cd scripts
node analyze-excel-structure.js
```

**Check database statistics**:
```bash
sqlite3 ../data/quiz-analyzer.db
SELECT COUNT(*) FROM subjects;
SELECT COUNT(*) FROM knowledge_points;
SELECT COUNT(*) FROM knowledge_points WHERE parent_id IS NULL;  -- Root nodes
SELECT COUNT(*) FROM quizzes;
```

**Check orphaned knowledge points**:
```sql
SELECT * FROM knowledge_points
WHERE parent_id IS NOT NULL
AND parent_id NOT IN (SELECT id FROM knowledge_points);
```

## Type Safety

### Using @ccaas/common

When backend is implemented, all shared types should come from `@ccaas/common`:

```typescript
import { Session, OutputUpdateEvent } from '@ccaas/common'
```

### Zod Validation

All SYNC_FIELDS are validated with Zod at runtime:

```typescript
import { validateAndFixField } from './schemas.js'

const validation = validateAndFixField('thinkingProcess', userInput)
if (!validation.success) {
  // Handle validation errors
}
```

## Integration with CCAAS

### MCP Server Registration

The MCP server is registered in `solution.json`:

```json
"mcpServers": {
  "quiz-analyzer-tools": {
    "command": "node",
    "args": ["mcp-server/dist/index.js"],
    "env": {
      "MCP_PORT": "3006"
    }
  }
}
```

### Skill Triggers

The skill is activated by keywords:

```json
"triggers": [
  { "type": "keyword", "value": "分析这道题", "priority": 10 },
  { "type": "keyword", "value": "解题思路", "priority": 9 },
  { "type": "keyword", "value": "知识点", "priority": 8 },
  { "type": "keyword", "value": "批量分析", "priority": 10 }
]
```

## Performance Considerations

### Batch Processing

- Rate limit: 2 quizzes/second (500ms delay)
- In-memory queue prevents database overload
- ETA calculation based on moving average
- Cancellation support to prevent wasted work

### Knowledge Points Tree

- Loaded once on MCP server startup
- Cached in memory for fast lookups
- Rebuild only when database changes

### Database Indexes

Critical indexes for performance:
- `idx_kp_subject` - Filter by subject
- `idx_kp_parent` - Tree traversal
- `idx_quizzes_subject` - Quiz filtering
- `idx_qkl_quiz` - Knowledge point lookups

## Error Handling

### Excel Import Errors

- Missing columns → Use fallback values (e.g., 'Unknown')
- Invalid parent references → Skip relationship, log warning
- Duplicate IDs → Use `INSERT OR REPLACE`

### MCP Tool Errors

- Invalid field name → 400 with list of valid fields
- Validation failure → 400 with detailed error messages
- Database errors → 500 with sanitized error message

### Batch Processing Errors

- Individual quiz failure → Continue batch, log error
- Cancellation → Stop immediately, mark as cancelled
- Timeout → Fail job, store error message

## Testing Strategy

### Unit Tests (Future)

- Zod schema validation
- Excel column name mapping
- Difficulty calculation formula
- Tree traversal functions

### Integration Tests (Future)

- Excel import → database verification
- MCP tools → response validation
- Batch processing → progress tracking

### E2E Tests (Future)

- Full quiz analysis workflow
- Batch job lifecycle
- Frontend integration

## Deployment Considerations

### Database Migration

When moving to PostgreSQL:
1. Update TypeORM configuration
2. Replace TEXT with appropriate types
3. Add proper constraints (CHECK, UNIQUE)
4. Setup connection pooling

### MCP Server Scaling

- Use process manager (PM2) for restarts
- Add health check monitoring
- Implement request rate limiting
- Add request logging

### Security

- Validate all user input with Zod
- Sanitize SQL queries (use prepared statements)
- Rate limit API endpoints
- Add authentication when needed

## Conversation Persistence

**Status**: ✅ IMPLEMENTED (Feb 2026)

Quiz-analyzer now supports server-side conversation persistence, replacing the previous localStorage-based approach.

### Architecture

**Database Tables**:
- `messages` - Stores user/assistant messages with metadata
- `conversation_contexts` - Captures reproducibility metadata (model, tools, prompts)
- `turns` - Tracks per-exchange analytics (tokens, duration)

**Backend Services**:
- `MessagesService` - Message creation and retrieval with auto-incrementing messageIndex
- `ConversationContextService` - Context metadata management
- `TurnsService` - Turn analytics tracking with auto-incrementing turnNumber

**REST API Endpoints**:
- `GET/POST /api/v1/sessions/:sessionId/messages` - Message history (paginated)
- `GET/POST /api/v1/sessions/:sessionId/context` - Conversation context
- `GET /api/v1/sessions/:sessionId/turns` - Turn analytics

### Frontend Integration

**useQuizSession Hook**:
- `isLoadingHistory` - True while fetching message history from server
- `clearConversation()` - Creates new session (new sessionId)
- `messages` - Array includes loaded history from server

**User Experience**:
- On page refresh, loading indicator shows ("加载对话历史...")
- Message history auto-loads from server
- "New Conversation" button starts fresh session
- All messages persist across page refreshes

### Message Creation Flow

When quiz analysis completes:
1. `AnalysesService.create()` saves analysis to database
2. If `sessionId` is provided, creates assistant message with analysis content
3. Finds latest open turn and completes it with token counts and duration
4. Failures are logged but don't break analysis flow (graceful degradation)

### Migration

Database migration: `scripts/migrations/003-conversation-persistence.sql`
- Creates 3 tables with proper indexes
- Run automatically on backend startup (TypeORM sync)

### Testing

**Test Coverage**: 34 tests passing
- 6 entity tests (Message, ConversationContext, Turn)
- 16 service tests (MessagesService, ConversationContextService, TurnsService)
- 7 controller tests (REST API endpoints)
- 5 integration tests (AnalysesService hooks)

## Response Language

Respond in the same language as the user's message (Chinese or English).
