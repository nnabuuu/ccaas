# Quiz Analyzer - 教育题目智能分析系统

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)]()
[![Version](https://img.shields.io/badge/version-1.0.0-blue)]()
[![License](https://img.shields.io/badge/license-MIT-green)]()

An AI-powered educational quiz analysis system with knowledge point tagging, solution explanation, wrong answer analysis, and batch processing capabilities.

## ✨ Features

- 🎯 **AI-Powered Analysis**: Automated quiz analysis with thinking process (思路) and solution steps (解题步骤)
- 🏷️ **Knowledge Point Tagging**: Hierarchical knowledge point classification with confidence scores
- ⚠️ **Wrong Answer Analysis**: Common mistakes identification with frequency tracking and remediation advice
- 📊 **Knowledge Gap Detection**: Identify learning gaps and suggest targeted improvements
- ⚡ **Batch Processing**: Analyze multiple quizzes efficiently with real-time progress tracking and ETA
- 🌳 **Knowledge Tree Viewer**: Interactive hierarchical knowledge point structure visualization
- 🔄 **Real-time Updates**: Socket.io integration for live AI analysis results
- 📱 **Responsive Design**: Mobile-friendly UI with dark mode support

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ (with npm)
- SQLite3
- curl (for testing)

### 1. One-Command Setup

```bash
# Install all dependencies and initialize database
./setup.sh
```

This will:
- Install dependencies for all packages (scripts, mcp-server, backend, frontend)
- Initialize SQLite database from schema
- Import sample data (2 subjects, 8 knowledge points, 6 quizzes)
- Build all packages
- Verify installation

### 2. Start All Services

```bash
# Start MCP Server, Backend, and Frontend
./start.sh
```

Services will start in order:
1. **MCP Server** (port 3006) - AI tools API
2. **Backend** (port 3005) - REST API
3. **Frontend** (port 5282) - Web UI

### 3. Access the Application

Open your browser to:
- **Frontend**: http://localhost:5282
- **Backend API**: http://localhost:3005/health
- **MCP Health**: http://localhost:3006/health

### 4. Stop Services

```bash
./stop.sh
```

## ⚙️ Skill Registration (Required)

**Important**: Before using quiz-analyzer with the CCAAS platform, you must register the solution's skills to the CCAAS backend database.

### Why Skill Registration is Required

Quiz-analyzer defines its AI skills in `solution.json`, but these must be registered to the CCAAS backend before they can be used. Without registration:
- ❌ AI will use global/default skills instead of quiz-analyzer-specific tools
- ❌ `parse_quiz_content`, `write_output`, etc. won't be available to the AI
- ❌ Frontend won't receive `output_update` events from AI analysis

### One-Time Setup

After installing dependencies (via `./setup.sh` or `npm install`), register the skills:

```bash
cd ../../packages/backend
npm run skill:import -- quiz-analyzer
```

**Expected Output:**
```
🚀 Importing skills for solution: quiz-analyzer

📦 Solution: Quiz Analyzer
📋 Skills to import: 4

✅ Tenant exists: quiz-analyzer (227f2b75-d73a-d450-27ee-d523e270161f)

📝 Processing: three-column-analysis
   ✅ Created: three-column-analysis
   📢 Published: three-column-analysis

... (3 more skills)

✨ Import complete!

📊 Summary:
   • Created: 4 skill(s)
   • Total: 4 skill(s)
   • Tenant: quiz-analyzer (227f2b75...)
```

### Verification

Check that skills are registered:

```bash
# Via API
curl "http://localhost:3001/api/v1/skills?tenantId=quiz-analyzer" | python3 -m json.tool

# Via database
sqlite3 ../../packages/backend/.agent-workspace/data.db \
  "SELECT slug, status, enabled FROM skills WHERE tenantId='227f2b75-d73a-d450-27ee-d523e270161f';"

# Expected output:
# analyze-student-answer|published|1
# complete-analysis|published|1
# knowledge-point-matching|published|1
# three-column-analysis|published|1
```

### Troubleshooting

**If AI uses wrong tools** (e.g., `list_issues` instead of `parse_quiz_content`):
1. ✅ Verify skills are registered (see verification above)
2. ✅ Check frontend sends `tenantId: 'quiz-analyzer'` in API requests
3. ✅ Restart CCAAS backend to reload skill cache
4. ✅ Clear browser console and retry analysis

**If skill import fails**:
- Ensure CCAAS backend is installed: `cd ../../packages/backend && npm install`
- Ensure solution.json exists: `ls solution.json`
- Check for syntax errors in solution.json: `cat solution.json | python3 -m json.tool`

## 📖 Usage

### Web Interface

1. **Browse Quizzes** - Navigate to "题目列表" to see all quizzes
2. **View Analysis** - Click on a quiz to see detailed AI analysis
3. **Start AI Analysis** - Click "开始分析" to trigger real-time AI analysis
4. **Batch Processing** - Go to "批量分析" to analyze multiple quizzes at once
5. **Knowledge Tree** - Explore "知识点" to see the hierarchical structure

### API Usage

```bash
# Health check
curl http://localhost:3005/health

# List quizzes
curl http://localhost:3005/api/v1/quizzes?limit=10

# Search quizzes
curl -X POST http://localhost:3005/api/v1/quizzes/search \
  -H "Content-Type: application/json" \
  -d '{"query": "方程", "difficulty": 3}'

# Get quiz analysis
curl http://localhost:3005/api/v1/analyses/quiz-001

# Get knowledge points tree
curl http://localhost:3005/api/v1/knowledge-points/tree

# Create batch job
curl -X POST http://localhost:3005/api/v1/batch/analyze \
  -H "Content-Type: application/json" \
  -d '{"name": "Math Grade 9", "quiz_ids": ["quiz-001", "quiz-002"]}'
```

See [Backend API Documentation](./backend/README.md) for complete API reference.

## 🧪 Testing

### Integration Test Suite

```bash
# Run full integration tests (requires services running)
./test-integration.sh
```

Tests include:
- ✓ Service health checks (MCP, Backend, Frontend)
- ✓ MCP tool endpoints (8 tools)
- ✓ Backend API endpoints (18 endpoints)
- ✓ Database integrity
- ✓ Frontend page loads

## 🏗️ Architecture

```
quiz-analyzer/
├── scripts/           # Excel import & database setup scripts
│   ├── schema.sql             # Database schema (8 tables)
│   ├── import-excel-to-db.js  # Two-pass import algorithm
│   └── create-sample-data.js  # Sample data generator
├── mcp-server/        # REST MCP Server - AI Tools (port 3006)
│   ├── src/
│   │   ├── index.ts           # 8 REST endpoints
│   │   ├── types.ts           # SYNC_FIELDS definitions
│   │   ├── schemas.ts         # Zod validation
│   │   └── data-loader.ts     # Knowledge points tree loader
│   └── README.md
├── backend/           # NestJS API Server (port 3005)
│   ├── src/
│   │   ├── quizzes/           # Quiz CRUD + search
│   │   ├── knowledge-points/  # Hierarchical tree API
│   │   ├── analyses/          # Analysis CRUD
│   │   ├── batch/             # Batch processing engine
│   │   ├── common/            # Health check + filters
│   │   └── database/          # TypeORM entities
│   └── README.md
├── frontend/          # React + Vite UI (port 5282)
│   ├── src/
│   │   ├── api/               # API client (axios)
│   │   ├── hooks/             # useQuizSession (Socket.io)
│   │   ├── components/        # Layout, AnalysisView
│   │   └── pages/             # QuizList, QuizDetail, Batch, KnowledgePoints
│   └── README.md
├── data/              # SQLite database
│   └── quiz-analyzer.db
├── logs/              # Service logs
└── solution.json      # CCAAS configuration
```

## 📊 Data Model

### SYNC_FIELDS (10 Fields)

AI analysis results synchronized in real-time:

1. **quizAnalysis** - Overall summary (Markdown)
2. **knowledgePointTags** - Tagged knowledge points with confidence
3. **thinkingProcess** - Solution approach (思路, Markdown)
4. **solutionSteps** - Step-by-step breakdown
5. **correctAnswer** - The correct answer
6. **commonMistakes** - Frequent errors with remediation
7. **knowledgeGapAnalysis** - Learning gap analysis (Markdown)
8. **difficulty** - Difficulty rating (1-5)
9. **relatedQuizzes** - Similar quiz recommendations
10. **timeEstimate** - Estimated solving time

### Database Schema

8 tables:
- `subjects` - Subject catalog
- `knowledge_points` - Hierarchical tree (self-referencing)
- `quizzes` - Quiz content
- `quiz_knowledge_links` - Many-to-many (quiz ↔ KP)
- `quiz_analyses` - AI analysis results
- `solution_steps` - Detailed steps
- `batch_analysis_jobs` - Batch processing

See [Database Schema](./scripts/schema.sql) for details.

## 🔧 Tech Stack

### Backend
- **NestJS** 10.3 - Progressive Node.js framework
- **TypeORM** 0.3.19 - ORM with SQLite support
- **Socket.io** 4.6 - Real-time communication
- **class-validator** - DTO validation

### MCP Server
- **Express** - REST API framework
- **Zod** - Runtime validation
- **better-sqlite3** - SQLite driver

### Frontend
- **React** 18 - UI library
- **Vite** 5 - Build tool (fast HMR)
- **TypeScript** 5.3 - Type safety
- **React Router** 6 - Routing
- **Socket.io Client** - Real-time updates
- **Axios** - HTTP client

### Database
- **SQLite** - Lightweight database

## 🛠️ Development

### Individual Service Development

```bash
# MCP Server (port 3006)
cd mcp-server
npm install
npm run build
npm start

# Backend (port 3005)
cd backend
npm install
npm run start:dev  # Watch mode

# Frontend (port 5282)
cd frontend
npm install
npm run dev  # HMR enabled
```

### Database Management

```bash
# Access SQLite database
sqlite3 data/quiz-analyzer.db

# Common queries
SELECT COUNT(*) FROM quizzes;
SELECT COUNT(*) FROM knowledge_points;
SELECT * FROM subjects;
```

### View Logs

```bash
# Real-time logs
tail -f logs/mcp.log
tail -f logs/backend.log
tail -f logs/frontend.log
```

## 📝 Documentation

- **[QUICKSTART.md](./QUICKSTART.md)** - Quick start guide
- **[CLAUDE.md](./CLAUDE.md)** - Claude Code development guide
- **[backend/README.md](./backend/README.md)** - Backend API documentation
- **[frontend/README.md](./frontend/README.md)** - Frontend component guide
- **[MCP_DOCUMENTATION_COMPLETE.md](./MCP_DOCUMENTATION_COMPLETE.md)** - MCP tools reference
- **[IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md)** - Implementation tracking

## 🐛 Troubleshooting

### Port Already in Use

```bash
# Kill processes on specific ports
lsof -ti:3006 | xargs kill -9  # MCP
lsof -ti:3005 | xargs kill -9  # Backend
lsof -ti:5282 | xargs kill -9  # Frontend

# Or use stop script
./stop.sh
```

### Database Not Found

```bash
# Regenerate database
cd scripts
npm install
node create-sample-data.js
```

### Build Errors

```bash
# Clean and rebuild
cd mcp-server && npm run build
cd backend && npm run build
cd frontend && npm run build
```

### Services Won't Start

```bash
# Check logs
cat logs/mcp.log
cat logs/backend.log
cat logs/frontend.log

# Verify database
sqlite3 data/quiz-analyzer.db ".tables"
```

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- Built with Claude Code as a Service (CCAAS)
- Uses NestJS framework for backend
- React + Vite for modern frontend
- Socket.io for real-time updates

---

**Version**: 1.0.0
**Last Updated**: 2026-02-06
**Status**: ✅ Complete and Production Ready
