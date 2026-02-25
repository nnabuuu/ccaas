# Live Lesson - AI Interactive Teaching System

## Overview
AI-driven interactive teaching system with dynamic blackboard and Socratic dialogue.

## Architecture
- **SQLite DB** (`data/live-lesson.db`): Lessons table + session_state table, WAL mode
- **MCP Server**: State machine backed by SQLite, 8 board control tools, session restore on startup
- **Solution Backend** (port 3006): Read-only Express server for lesson list/manifest API
- **Frontend**: React + Vite (port 5283), boardState from output_update events
- **Skill**: socratic-teacher - behavior guide for AI teacher

## Key Files
- `data/lessons/math-linear-eq-intro/manifest.json` - Lesson data (13 nodes, 5 phases)
- `mcp-server/src/db.ts` - SQLite init, seed, CRUD operations
- `mcp-server/src/state-manager.ts` - Factory-based state machine with DB persistence
- `mcp-server/src/index.ts` - 8 MCP tools, DB init + session restore on startup
- `backend/src/index.ts` - Express server (read-only SQLite, lesson API)
- `frontend/src/hooks/useLiveLesson.ts` - boardState accumulation hook
- `skills/socratic-teacher/SKILL.md` - AI teacher behavior guide

## Dev Commands
```bash
# MCP server
cd mcp-server && npm install && npm run build

# Solution backend (lesson API)
cd backend && npm install && npm run build && node dist/index.js

# Frontend
cd frontend && npm install && npm run dev
```

## Ports
- Frontend: 5283
- Solution Backend: 3006 (lesson list + manifest API)
- CCAAS Backend: 3001 (required)
