# Quiz Analyzer - Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Prerequisites

- Node.js >= 18.0.0
- npm
- sqlite3 (for verification only)

### Option 1: Automated Setup

```bash
cd solutions/quiz-analyzer
./setup.sh
```

This will:
1. Check for Excel files
2. Install all dependencies
3. Import data to database
4. Build MCP server
5. Test health check

### Option 2: Manual Setup

#### Step 1: Prepare Excel Files (Optional)

Place your Excel files in `resources/`:
```bash
cd solutions/quiz-analyzer/resources
# Copy your files here:
# - 目录信息.xlsx
# - 知识点信息.xlsx
# - 题目信息.xlsx
```

#### Step 2: Analyze Excel Structure

```bash
npm run quiz:analyze
```

This shows you the column names and structure of your Excel files.

#### Step 3: Import to Database

```bash
npm run quiz:import
```

Expected output:
```
✓ Database schema initialized
✓ Imported X subjects
✓ Pass 1: Created Y nodes
✓ Pass 2: Linked Z parent-child relationships
✓ Imported N quizzes
```

#### Step 4: Verify Database

```bash
npm run quiz:verify
```

Or manually:
```bash
sqlite3 solutions/quiz-analyzer/data/quiz-analyzer.db
> SELECT COUNT(*) FROM subjects;
> SELECT COUNT(*) FROM knowledge_points;
> SELECT COUNT(*) FROM quizzes;
> .exit
```

#### Step 5: Start MCP Server

```bash
npm run quiz:mcp:build
npm run quiz:mcp:start
```

Server will start on port 3006.

#### Step 6: Test MCP Server

```bash
curl http://localhost:3006/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "quiz-analyzer-mcp",
  "version": "1.0.0",
  "timestamp": "2026-02-06T...",
  "knowledgePoints": 0
}
```

## 🧪 Test MCP Tools

### 1. Write Output (Store Analysis Results)

```bash
curl -X POST http://localhost:3006/tools/write_output \
  -H "Content-Type: application/json" \
  -d '{
    "field": "thinkingProcess",
    "value": "# 解题思路\n\n这是测试内容",
    "preview": "Updated thinking process"
  }'
```

### 2. Calculate Difficulty

```bash
curl -X POST http://localhost:3006/tools/calculate_difficulty \
  -H "Content-Type: application/json" \
  -d '{
    "knowledgePointCount": 3,
    "stepCount": 5,
    "quizType": "解答题"
  }'
```

Expected response:
```json
{
  "difficulty": 4,
  "label": "较难",
  "timeEstimate": "12-18分钟",
  "formula": "min(5, ceil((3 × 0.5 + 5 × 0.3) × 1.2))"
}
```

### 3. Get Knowledge Points Tree

```bash
curl -X POST http://localhost:3006/tools/get_knowledge_points_tree \
  -H "Content-Type: application/json" \
  -d '{
    "subjectId": "math",
    "gradeLevel": "9"
  }'
```

### 4. Generate Thinking Process Template

```bash
curl -X POST http://localhost:3006/tools/generate_thinking_process_template \
  -H "Content-Type: application/json" \
  -d '{
    "quizType": "解答题",
    "knowledgePoints": ["一元二次方程", "因式分解"]
  }'
```

### 5. Verify Knowledge Point Tags

```bash
curl -X POST http://localhost:3006/tools/verify_knowledge_point_tags \
  -H "Content-Type: application/json" \
  -d '{
    "quizContent": "求解方程 x^2 + 3x + 2 = 0",
    "proposedTags": [
      {
        "id": "kp-001",
        "name": "一元二次方程",
        "confidence": 0.95
      }
    ]
  }'
```

## 📁 Project Structure

```
quiz-analyzer/
├── scripts/           # ✅ Excel import & database setup
├── mcp-server/        # ✅ REST API for AI tools (port 3006)
├── backend/           # 🚧 NestJS API server (port 3005) - TODO
├── frontend/          # 🚧 React + Vite UI (port 5282) - TODO
├── data/              # SQLite database
└── resources/         # Excel data files (user-provided)
```

## 🎯 SYNC_FIELDS

The system manages 10 synchronized fields:

1. `quizAnalysis` - Overall analysis summary (Markdown)
2. `knowledgePointTags` - Array of KnowledgePointTag
3. `thinkingProcess` - 解题思路 (Markdown)
4. `solutionSteps` - Array of SolutionStep
5. `correctAnswer` - The answer
6. `commonMistakes` - Array of Mistake
7. `knowledgeGapAnalysis` - Knowledge gap analysis (Markdown)
8. `difficulty` - Difficulty 1-5
9. `relatedQuizzes` - Array of RelatedQuiz
10. `timeEstimate` - Estimated solving time

## 🐛 Troubleshooting

### MCP Server Won't Start

**Check if database exists:**
```bash
ls -l data/quiz-analyzer.db
```

**If missing, create empty database:**
```bash
sqlite3 data/quiz-analyzer.db < scripts/schema.sql
```

### Excel Import Fails

**Check column names:**
```bash
npm run quiz:analyze
```

The script is flexible with column names (Chinese/English variations).

### Port Already in Use

**Change MCP port in solution.json:**
```json
"mcpServers": {
  "quiz-analyzer-tools": {
    "env": {
      "MCP_PORT": "3007"  // Change to different port
    }
  }
}
```

**Or kill existing process:**
```bash
lsof -ti:3006 | xargs kill -9
```

## 📚 Documentation

- **README.md** - Comprehensive documentation
- **CLAUDE.md** - Development guidance with TDD rules
- **IMPLEMENTATION_STATUS.md** - Implementation progress tracking
- **QUICKSTART.md** - This file

## 🔄 Development Workflow

### Adding New SYNC_FIELD

1. Update `SYNC_FIELDS` in `mcp-server/src/types.ts`
2. Add TypeScript interface
3. Add Zod schema in `schemas.ts`
4. Update database schema if needed
5. Update `solution.json`
6. Rebuild: `npm run quiz:mcp:build`

### Adding New MCP Tool

1. Add endpoint in `mcp-server/src/index.ts`
2. Define types in `types.ts`
3. Add to `solution.json` allowedTools
4. Rebuild and restart
5. Test with curl

## 🚀 Next Steps

### Current Status: Phase 1 & 2 Complete ✅

- ✅ Database schema (8 tables)
- ✅ MCP server with 5 tools
- ✅ Zod validation
- ✅ Health check

### Next: Phase 3 - Backend (TODO)

1. Create NestJS module structure
2. Implement REST API endpoints
3. Build batch processor service
4. Add WebSocket support

### Then: Phase 4 - Frontend (TODO)

1. Create React components
2. Implement useQuizSession hook
3. Build analysis view UI
4. Add batch processing UI

## 💡 Tips

### Use npm Scripts

```bash
npm run quiz:analyze   # Analyze Excel structure
npm run quiz:import    # Import to database
npm run quiz:verify    # Verify database
npm run quiz:mcp:build # Build MCP server
npm run quiz:mcp:start # Start MCP server
npm run quiz:setup     # Full automated setup
```

### Database Queries

```bash
# Check root knowledge points
sqlite3 data/quiz-analyzer.db \
  "SELECT * FROM knowledge_points WHERE parent_id IS NULL;"

# Check quiz count by type
sqlite3 data/quiz-analyzer.db \
  "SELECT quiz_type, COUNT(*) FROM quizzes GROUP BY quiz_type;"

# Check orphaned knowledge points
sqlite3 data/quiz-analyzer.db \
  "SELECT * FROM knowledge_points
   WHERE parent_id IS NOT NULL
   AND parent_id NOT IN (SELECT id FROM knowledge_points);"
```

### MCP Server Development

```bash
# Watch mode (rebuild on changes)
cd mcp-server
npm run dev

# Check TypeScript errors
npm run build
```

## ⚠️ Important Notes

### TDD Enforcement

From lesson-plan-designer experience:

**Before modifying code:**
- ✅ Run `npm test` to confirm tests pass
- ✅ Check frontend type definitions
- ✅ Review existing API contracts

**After modifying code:**
- ✅ Immediately run related tests
- ✅ Test failure = stop and analyze

**Core Principle:**
> Tests are the contract, plans are just intentions.
> When plans conflict with tests, question the plan.

### Excel Import Algorithm

The import uses a two-pass algorithm to handle parent-child relationships correctly:

1. **Pass 1**: Create all nodes with `parent_id = NULL`
2. **Pass 2**: Update parent-child relationships using ID map

This prevents foreign key violations even when children appear before parents in Excel.

## 🎉 Success!

If you see this response, everything is working:

```bash
$ curl http://localhost:3006/health
{"status":"healthy","service":"quiz-analyzer-mcp",...}
```

You're now ready to:
1. Import real Excel data
2. Test MCP tools with quiz content
3. Implement backend (Phase 3)
4. Build frontend (Phase 4)

Happy coding! 🚀
